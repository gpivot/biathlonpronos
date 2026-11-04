-- Biathlonpronos — cartes Fusée, Gâchette et Talent, réglages des cartes dans l'admin
-- (Guillaume, 04/11/2026). À coller APRÈS 0037, avant de fusionner la PR.
--
-- 1. Fusée et Gâchette ne sont plus des bonus automatiques mais des cartes du 10/10, posées sur une
--    étape avant sa 1re course (play_stage_card). Le moteur de points (code) lit le rang au temps
--    de ski (race_results.ski_rank, 1er/2e/3e) et le sans-faute au tir (is_gachette).
-- 2. Talent : une fois une pépite révélée, la réactiver (de nouveau cachée) ou en choisir une
--    nouvelle (play_talent_card). Elle ne marque qu'à partir des courses parties après
--    (pepites.active_from). La course de la 1re révélation est gardée (pepites.revealed_race_id).
-- 3. bonus_card_settings : l'admin active ou non chaque carte et limite la période où elle est
--    proposée au 10/10. Pas de ligne = carte active, sans limite. Une carte déjà en main reste jouable.
--    force_unlock : débloque tout de suite une carte qui attend son étape (Aspiration, Équipe).
-- 4. Mondiaux / JO (étape au coefficient 2) : aucune carte bonus ne s'y joue, l'événement garde son
--    seul ×2. Le 4e choix saute leurs courses (il reprend à l'étape suivante).
-- 5. Ça farte ne se cumule pas avec Fusée / Gâchette : pas de Ça farte sur une course d'une étape
--    où l'une d'elles est posée, et inversement.

-- Données -----------------------------------------------------------------------------------------

alter table race_results add column if not exists ski_rank smallint;
-- Ancienne case Fusée = meilleur temps de ski.
update race_results set ski_rank = 1 where is_fusee and ski_rank is null;

alter table bonus_cards add column if not exists used_on_stage_id uuid references stages(id) on delete set null;

alter table pepites add column if not exists revealed_race_id uuid references races(id) on delete set null;
alter table pepites add column if not exists active_from timestamptz;
-- Pépites déjà révélées : la course de la révélation, retrouvée dans les points.
update pepites p
   set revealed_race_id = l.race_id
  from score_ledger l
 where p.bonus_claimed
   and p.revealed_race_id is null
   and l.user_id = p.user_id
   and l.season_id = p.season_id
   and l.breakdown->>'pepiteAthleteId' = p.athlete_id::text;

create table if not exists bonus_card_settings (
  season_id uuid not null references seasons(id) on delete cascade,
  card_type text not null,
  enabled boolean not null default true,
  available_from timestamptz,
  available_until timestamptz,
  force_unlock boolean not null default false,
  primary key (season_id, card_type)
);
alter table bonus_card_settings enable row level security;
drop policy if exists "bonus_card_settings: read all" on bonus_card_settings;
create policy "bonus_card_settings: read all" on bonus_card_settings for select using (true);
-- Écriture : back-office seulement (clé service_role), aucune politique d'écriture.

-- La carte est-elle proposée au 10/10 selon les réglages de l'admin ?
create or replace function bonus_card_offered(p_season_id uuid, p_card_type text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select enabled
       and (available_from is null or available_from <= effective_now())
       and (available_until is null or available_until >= effective_now())
      from bonus_card_settings
     where season_id = p_season_id and card_type = p_card_type
  ), true);
$$;

-- Mondiaux / JO : pas de carte -------------------------------------------------------------------

create or replace function race_is_championship(p_race_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.coefficient = 2 from races r join stages s on s.id = r.stage_id where r.id = p_race_id), false);
$$;

-- Prochaine course individuelle hors Mondiaux/JO (activation du 4e choix).
create or replace function next_individual_race(p_season_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id
    from races r join stages s on s.id = r.stage_id
   where s.season_id = p_season_id
     and s.coefficient <> 2
     and r.format::text not like 'relais%'
     and r.locks_at > effective_now()
   order by r.locks_at, r.id
   limit 1;
$$;

-- Courses couvertes par un 4e choix joué sur p_race_id, Mondiaux/JO exclus (même règle que
-- quatriemeChoixWindow côté code).
create or replace function quatrieme_choix_window(p_race_id uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with activation as (
    select r.id, r.locks_at, s.season_id
      from races r join stages s on s.id = r.stage_id
     where r.id = p_race_id and r.format::text not like 'relais%' and s.coefficient <> 2
  ),
  candidates as (
    select r.id,
           row_number() over (
             partition by r.sex
             order by r.locks_at, (r.id <> a.id)
           ) as n
      from activation a
      join stages s on s.season_id = a.season_id
      join races r on r.stage_id = s.id
     where r.format::text not like 'relais%'
       and s.coefficient <> 2
       and r.locks_at >= a.locks_at
  )
  select id from candidates where n <= 2;
$$;

-- Choisir sa carte au 10/10 --------------------------------------------------------------------

create or replace function claim_bonus_card(p_season_id uuid, p_card_type text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_earned integer;
  v_held integer;
  v_previous text;
  v_race uuid;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_card_type not in ('ca_farte', 'balle_de_pioche', 'aspiration', 'equipe', 'fusee', 'gachette', 'talent') then
    raise exception 'card_not_offered';
  end if;
  if not bonus_card_offered(p_season_id, p_card_type) then raise exception 'card_not_offered'; end if;

  select coalesce(max(cards_earned), 0) into v_earned
    from streak_counters where user_id = v_user and season_id = p_season_id;
  select count(*) into v_held
    from bonus_cards where user_id = v_user and season_id = p_season_id;
  if v_held >= v_earned then raise exception 'no_card_to_claim'; end if;

  select card_type::text into v_previous
    from bonus_cards where user_id = v_user and season_id = p_season_id
   order by earned_at desc, id desc limit 1;
  if v_previous = p_card_type then raise exception 'same_card_twice_in_a_row'; end if;
  if not bonus_card_unlocked(p_season_id, p_card_type) and not coalesce((
    select force_unlock from bonus_card_settings where season_id = p_season_id and card_type = p_card_type
  ), false) then raise exception 'card_locked'; end if;
  -- Talent : seulement si une de ses pépites a été révélée.
  if p_card_type = 'talent' and not exists (
    select 1 from pepites where user_id = v_user and season_id = p_season_id and bonus_claimed
  ) then raise exception 'card_locked'; end if;

  if p_card_type = 'balle_de_pioche' then
    v_race := next_individual_race(p_season_id);
  elsif p_card_type = 'equipe' then
    v_race := next_race(p_season_id);
  end if;

  insert into bonus_cards (user_id, season_id, card_type, status, used_at, used_on_race_id)
  values (
    v_user, p_season_id, p_card_type::bonus_card_type,
    case when v_race is null then 'available' else 'used' end::bonus_card_status,
    case when v_race is null then null else now() end,
    v_race
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function claim_bonus_card(uuid, text) from public;
grant execute on function claim_bonus_card(uuid, text) to authenticated;

-- Jouer une carte de course : Fusée, Gâchette et Talent ne s'y jouent pas -----------------------

create or replace function play_bonus_card(p_card_id uuid, p_race_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_card bonus_cards%rowtype;
  v_race races%rowtype;
  v_season uuid;
  v_type text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_card from bonus_cards where id = p_card_id and user_id = v_user for update;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.status <> 'available' then raise exception 'card_already_used'; end if;
  v_type := v_card.card_type::text;
  if v_type = 'equipe' then raise exception 'card_activates_itself'; end if;
  if v_type = 'fondue' then raise exception 'card_retired'; end if;
  if v_type in ('fusee', 'gachette', 'talent') then raise exception 'card_not_for_a_race'; end if;

  select r.* into v_race from races r where r.id = p_race_id;
  if not found then raise exception 'race_not_found'; end if;
  select season_id into v_season from stages where id = v_race.stage_id;
  if v_season <> v_card.season_id then raise exception 'wrong_season'; end if;
  if v_race.locks_at <= effective_now() then raise exception 'race_locked'; end if;
  if v_race.format::text like 'relais%' then raise exception 'individual_races_only'; end if;
  if race_is_championship(p_race_id) then raise exception 'no_card_at_championships'; end if;

  -- Ça farte : pas sur une étape où Fusée ou Gâchette est posée.
  if v_type = 'ca_farte' and exists (
    select 1 from bonus_cards c
     where c.user_id = v_user and c.status = 'used' and c.used_on_stage_id = v_race.stage_id
       and c.card_type::text in ('fusee', 'gachette')
  ) then raise exception 'not_with_fusee_gachette'; end if;

  if v_type in ('ca_farte', 'aspiration') and exists (
    select 1 from bonus_cards c
     where c.user_id = v_user and c.status = 'used' and c.used_on_race_id = p_race_id
       and c.card_type::text in ('ca_farte', 'aspiration')
  ) then raise exception 'one_card_at_a_time'; end if;

  if v_type = 'aspiration' and exists (
    select 1 from bonus_cards c
     where c.user_id = v_user and c.status = 'used' and c.card_type::text = 'balle_de_pioche'
       and c.used_on_race_id is not null
       and p_race_id in (select quatrieme_choix_window(c.used_on_race_id))
  ) then raise exception 'one_card_at_a_time'; end if;

  if v_type = 'balle_de_pioche' and (
    exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.card_type::text = 'balle_de_pioche'
         and c.used_on_race_id is not null
         and p_race_id in (select quatrieme_choix_window(c.used_on_race_id))
    )
    or exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.card_type::text = 'aspiration'
         and c.used_on_race_id in (select quatrieme_choix_window(p_race_id))
    )
  ) then raise exception 'one_card_at_a_time'; end if;

  update bonus_cards
     set status = 'used', used_at = now(), used_on_race_id = p_race_id
   where id = p_card_id;
end;
$$;

revoke all on function play_bonus_card(uuid, uuid) from public;
grant execute on function play_bonus_card(uuid, uuid) to authenticated;

-- Poser une carte Fusée ou Gâchette sur une étape -----------------------------------------------
-- Avant la 1re course de l'étape (relais compris), une seule fois la même carte par étape. Même
-- règle que canPlayStageCard côté code.

create or replace function play_stage_card(p_card_id uuid, p_stage_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_card bonus_cards%rowtype;
  v_season uuid;
  v_first_lock timestamptz;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_card from bonus_cards where id = p_card_id and user_id = v_user for update;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.status <> 'available' then raise exception 'card_already_used'; end if;
  if v_card.card_type::text not in ('fusee', 'gachette') then raise exception 'not_a_stage_card'; end if;

  select season_id into v_season from stages where id = p_stage_id;
  if not found then raise exception 'stage_not_found'; end if;
  if v_season <> v_card.season_id then raise exception 'wrong_season'; end if;
  if not exists (select 1 from races where stage_id = p_stage_id and format::text not like 'relais%') then
    raise exception 'no_individual_race';
  end if;
  select min(locks_at) into v_first_lock from races where stage_id = p_stage_id;
  if v_first_lock <= effective_now() then raise exception 'stage_started'; end if;
  if exists (select 1 from stages where id = p_stage_id and coefficient = 2) then
    raise exception 'no_card_at_championships';
  end if;
  -- Pas de cumul avec un Ça farte déjà posé sur une course de l'étape.
  if exists (
    select 1 from bonus_cards c join races r on r.id = c.used_on_race_id
     where c.user_id = v_user and c.status = 'used' and c.card_type::text = 'ca_farte'
       and r.stage_id = p_stage_id
  ) then raise exception 'not_with_ca_farte'; end if;

  if exists (
    select 1 from bonus_cards c
     where c.user_id = v_user and c.status = 'used' and c.used_on_stage_id = p_stage_id
       and c.card_type = v_card.card_type
  ) then raise exception 'already_on_stage'; end if;

  update bonus_cards
     set status = 'used', used_at = now(), used_on_stage_id = p_stage_id
   where id = p_card_id;
end;
$$;

revoke all on function play_stage_card(uuid, uuid) from public;
grant execute on function play_stage_card(uuid, uuid) to authenticated;

-- Carte Talent ------------------------------------------------------------------------------------

-- Le contrôle des pépites (0035) laisse passer la carte Talent, qui fait ses propres vérifications.
create or replace function public.pepites_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sex sex;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  if coalesce(current_setting('biathlonpronos.talent_card', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.bonus_claimed then
      raise exception 'pepite_already_revealed' using errcode = '23514';
    end if;
    if new.athlete_id is distinct from old.athlete_id and public.pepite_is_eligible(old.athlete_id, old.season_id) then
      raise exception 'pepite_definitive' using errcode = '23514';
    end if;
    -- Pépite choisie ou réactivée avec la carte Talent : définitive, même si ses cotes ont baissé.
    if new.athlete_id is distinct from old.athlete_id and old.active_from is not null then
      raise exception 'pepite_definitive' using errcode = '23514';
    end if;
  end if;

  new.bonus_claimed := false;
  -- Un joueur ne fixe jamais lui-même la course de révélation ni la date d'effet.
  new.revealed_race_id := case when tg_op = 'UPDATE' then old.revealed_race_id else null end;
  new.active_from := case when tg_op = 'UPDATE' then old.active_from else null end;

  if tg_op = 'INSERT' or new.athlete_id is distinct from old.athlete_id then
    select sex into v_sex from athletes where id = new.athlete_id;
    if v_sex is null or v_sex <> new.sex then
      raise exception 'pepite_wrong_sex' using errcode = '23514';
    end if;
    if not public.pepite_is_eligible(new.athlete_id, new.season_id) then
      raise exception 'pepite_not_eligible' using errcode = '23514';
    end if;
    select min(value) into new.odds_at_pick
    from odds
    where athlete_id = new.athlete_id and season_id = new.season_id and valid_until is null;
  else
    new.odds_at_pick := old.odds_at_pick;
  end if;

  return new;
end;
$$;

-- Joue la carte Talent pour la pépite révélée du sexe p_sex : p_athlete_id est la même pépite
-- (réactivation, sans contrôle de cote) ou une nouvelle (toutes ses cotes >= 30). Refusée si ce
-- biathlète est dans un de ses pronostics de course pas encore partie.
create or replace function play_talent_card(p_card_id uuid, p_sex sex, p_athlete_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_card bonus_cards%rowtype;
  v_pepite pepites%rowtype;
  v_sex sex;
  v_odds integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_card from bonus_cards where id = p_card_id and user_id = v_user for update;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.status <> 'available' then raise exception 'card_already_used'; end if;
  if v_card.card_type::text <> 'talent' then raise exception 'not_a_talent_card'; end if;

  select * into v_pepite from pepites
   where user_id = v_user and season_id = v_card.season_id and sex = p_sex for update;
  if not found or not v_pepite.bonus_claimed then raise exception 'pepite_not_revealed'; end if;

  select sex into v_sex from athletes where id = p_athlete_id;
  if v_sex is null or v_sex <> p_sex then raise exception 'pepite_wrong_sex'; end if;

  if p_athlete_id = v_pepite.athlete_id then
    v_odds := v_pepite.odds_at_pick;
  else
    if not public.pepite_is_eligible(p_athlete_id, v_card.season_id) then raise exception 'pepite_not_eligible'; end if;
    select min(value) into v_odds from odds
     where athlete_id = p_athlete_id and season_id = v_card.season_id and valid_until is null;
  end if;

  if exists (
    select 1
      from predictions pr
      join races r on r.id = pr.race_id
      join stages s on s.id = r.stage_id
     where pr.user_id = v_user
       and s.season_id = v_card.season_id
       and r.locks_at > effective_now()
       and p_athlete_id = any (pr.athlete_ids)
  ) then raise exception 'pepite_in_upcoming_prediction'; end if;

  perform set_config('biathlonpronos.talent_card', 'on', true);
  update pepites
     set athlete_id = p_athlete_id,
         odds_at_pick = v_odds,
         bonus_claimed = false,
         revealed_race_id = null,
         active_from = effective_now()
   where user_id = v_user and season_id = v_card.season_id and sex = p_sex;
  perform set_config('biathlonpronos.talent_card', '', true);

  update bonus_cards set status = 'used', used_at = now() where id = p_card_id;
end;
$$;

revoke all on function play_talent_card(uuid, sex, uuid) from public;
grant execute on function play_talent_card(uuid, sex, uuid) to authenticated;

-- Biathlonpronos — règles des cartes bonus au fil de la saison (demande de Guillaume, 30/10/2026).
-- À coller APRÈS 0025.
--
-- - Cinq cartes au choix au 10/10 : Fondue, Ça farte, 4e choix, Aspiration, Équipe.
-- - Une même carte ne se prend pas sur deux 10/10 d'affilée (elle redevient possible au suivant).
-- - Aspiration se débloque quand la 1re course de la 4e étape de la saison est partie ; Équipe,
--   quand celle de l'étape qui suit les Mondiaux/JO (coefficient 2) est partie (la 7e étape si la
--   saison n'a ni Mondiaux ni JO). Même règle que cardUnlockStageIndex côté code.
-- - 4e choix et Équipe s'activent dès qu'ils sont choisis : le 4e choix sur la prochaine course
--   individuelle pas encore partie (puis 2 courses par sexe), Équipe sur la prochaine course pas
--   encore partie et toutes les suivantes. Fondue, Ça farte et Aspiration restent en main.
-- - Une seule carte de course à la fois (Ça farte, Aspiration, 4e choix) ; Fondue et Équipe se
--   cumulent avec les autres.

-- Prochaine course de la saison pas encore partie, relais compris (carte Équipe).
create or replace function next_race(p_season_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id
    from races r join stages s on s.id = r.stage_id
   where s.season_id = p_season_id
     and r.locks_at > effective_now()
   order by r.locks_at, r.id
   limit 1;
$$;

-- La carte est-elle débloquée à ce moment de la saison ?
create or replace function bonus_card_unlocked(p_season_id uuid, p_card_type text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_index integer;
  v_championships integer;
  v_first_lock timestamptz;
begin
  if p_card_type = 'aspiration' then
    v_index := 4;
  elsif p_card_type = 'equipe' then
    select n into v_championships
      from (select coefficient, row_number() over (order by starts_on) as n
              from stages where season_id = p_season_id) st
     where coefficient = 2
     order by n limit 1;
    v_index := coalesce(v_championships + 1, 7);
  else
    return true;
  end if;

  select min(r.locks_at) into v_first_lock
    from (select id, row_number() over (order by starts_on) as n
            from stages where season_id = p_season_id) st
    join races r on r.stage_id = st.id
   where st.n = v_index;
  return v_first_lock is not null and v_first_lock <= effective_now();
end;
$$;

drop function if exists claim_bonus_card(uuid, bonus_card_type);

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
  if p_card_type not in ('fondue', 'ca_farte', 'balle_de_pioche', 'aspiration', 'equipe') then
    raise exception 'card_not_offered';
  end if;

  select coalesce(max(cards_earned), 0) into v_earned
    from streak_counters where user_id = v_user and season_id = p_season_id;
  select count(*) into v_held
    from bonus_cards where user_id = v_user and season_id = p_season_id;
  if v_held >= v_earned then raise exception 'no_card_to_claim'; end if;

  select card_type::text into v_previous
    from bonus_cards where user_id = v_user and season_id = p_season_id
   order by earned_at desc, id desc limit 1;
  if v_previous = p_card_type then raise exception 'same_card_twice_in_a_row'; end if;
  if not bonus_card_unlocked(p_season_id, p_card_type) then raise exception 'card_locked'; end if;

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

create or replace function play_bonus_card(p_card_id uuid, p_race_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_card bonus_cards%rowtype;
  v_race races%rowtype;
  v_season uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_card from bonus_cards where id = p_card_id and user_id = v_user for update;
  if not found then raise exception 'card_not_found'; end if;
  if v_card.status <> 'available' then raise exception 'card_already_used'; end if;
  if v_card.card_type::text = 'equipe' then raise exception 'card_activates_itself'; end if;

  select r.* into v_race from races r where r.id = p_race_id;
  if not found then raise exception 'race_not_found'; end if;
  select season_id into v_season from stages where id = v_race.stage_id;
  if v_season <> v_card.season_id then raise exception 'wrong_season'; end if;
  if v_race.locks_at <= effective_now() then raise exception 'race_locked'; end if;
  if v_race.format::text like 'relais%' then raise exception 'individual_races_only'; end if;

  if v_card.card_type::text in ('ca_farte', 'aspiration', 'balle_de_pioche') then
    -- Une seule carte de course à la fois : aucune autre déjà jouée sur cette course…
    if exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.used_on_race_id is not null
         and c.card_type::text in ('ca_farte', 'aspiration', 'balle_de_pioche')
         and (
           (c.card_type::text in ('ca_farte', 'aspiration') and c.used_on_race_id = p_race_id)
           or (c.card_type::text = 'balle_de_pioche' and p_race_id in (select quatrieme_choix_window(c.used_on_race_id)))
         )
    ) then raise exception 'one_card_at_a_time'; end if;
    -- … ni, pour un 4e choix, sur une des courses qu'il couvrirait.
    if v_card.card_type::text = 'balle_de_pioche' and exists (
      select 1 from bonus_cards c
       where c.user_id = v_user and c.status = 'used' and c.card_type::text in ('ca_farte', 'aspiration')
         and c.used_on_race_id in (select quatrieme_choix_window(p_race_id))
    ) then raise exception 'one_card_at_a_time'; end if;
  end if;

  update bonus_cards
     set status = 'used', used_at = now(), used_on_race_id = p_race_id
   where id = p_card_id;
end;
$$;

revoke all on function claim_bonus_card(uuid, text) from public;
grant execute on function claim_bonus_card(uuid, text) to authenticated;

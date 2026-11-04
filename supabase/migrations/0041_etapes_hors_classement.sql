-- Biathlonpronos — étapes « Autre (×0) », hors classement (Guillaume, 04/11/2026).
-- À coller dans l'éditeur SQL de Supabase AVANT de fusionner la PR.
--
-- Une étape peut être marquée hors classement (courses tests, courses bonus, courses pour recruter
-- de nouveaux joueurs) : ses courses se pronostiquent et se notent normalement (×1), ont leur propre
-- classement, mais leurs points ne s'ajoutent pas au classement de la saison et ne donnent pas de
-- dossard rouge. Pas de carte bonus ni de ×2 perso dessus, pas de Pépite révélée, pas de série 10/10.
--
-- Générique (reprenable pour VéloPronos) : un simple drapeau `counts_in_standings` sur l'étape, recopié
-- par trigger sur chaque ligne de points (score_ledger), pour que tous les totaux de saison filtrent
-- d'un seul `counts_in_standings = true`.

-- Données -----------------------------------------------------------------------------------------

alter table stages add column if not exists counts_in_standings boolean not null default true;
alter table score_ledger add column if not exists counts_in_standings boolean not null default true;

-- Chaque ligne de points prend le drapeau de l'étape de sa course (ou de la course de sa question
-- bonus). Lignes « globes » de saison : toujours comptées.
create or replace function score_ledger_set_counts_in_standings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.counts_in_standings := coalesce((
    select s.counts_in_standings
      from races r join stages s on s.id = r.stage_id
     where r.id = coalesce(new.race_id, (select q.race_id from bonus_questions q where q.id = new.bonus_question_id))
  ), true);
  return new;
end;
$$;

drop trigger if exists score_ledger_counts_in_standings on score_ledger;
create trigger score_ledger_counts_in_standings
  before insert or update on score_ledger
  for each row execute function score_ledger_set_counts_in_standings();

-- Quand l'admin change la catégorie d'une étape, les points déjà attribués suivent.
create or replace function stages_sync_counts_in_standings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.counts_in_standings is distinct from old.counts_in_standings then
    update score_ledger l
       set counts_in_standings = new.counts_in_standings
     where l.race_id in (select id from races where stage_id = new.id)
        or l.bonus_question_id in (
             select q.id from bonus_questions q join races r on r.id = q.race_id where r.stage_id = new.id
           );
  end if;
  return new;
end;
$$;

drop trigger if exists stages_counts_in_standings on stages;
create trigger stages_counts_in_standings
  after update of counts_in_standings on stages
  for each row execute function stages_sync_counts_in_standings();

-- Cartes bonus : rien sur une étape hors classement (comme aux Mondiaux / JO) -----------------------

-- Utilisée par play_bonus_card : « pas de carte sur cette course ».
create or replace function race_is_championship(p_race_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.coefficient = 2 or not s.counts_in_standings
      from races r join stages s on s.id = r.stage_id where r.id = p_race_id
  ), false);
$$;

-- Prochaine course individuelle hors Mondiaux/JO et hors étapes hors classement (activation du 4e choix).
create or replace function next_individual_race(p_season_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id
    from races r join stages s on s.id = r.stage_id
   where s.season_id = p_season_id
     and s.coefficient <> 2
     and s.counts_in_standings
     and r.format::text not like 'relais%'
     and r.locks_at > effective_now()
   order by r.locks_at, r.id
   limit 1;
$$;

-- Courses couvertes par un 4e choix : Mondiaux/JO et étapes hors classement sautés.
create or replace function quatrieme_choix_window(p_race_id uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with activation as (
    select r.id, r.locks_at, s.season_id
      from races r join stages s on s.id = r.stage_id
     where r.id = p_race_id and r.format::text not like 'relais%' and s.coefficient <> 2 and s.counts_in_standings
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
       and s.counts_in_standings
       and r.locks_at >= a.locks_at
  )
  select id from candidates where n <= 2;
$$;

-- Déblocage d'Aspiration (4e étape) et d'Équipe (étape après les Mondiaux/JO) : les étapes hors
-- classement ne comptent pas dans la numérotation des étapes.
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
              from stages where season_id = p_season_id and counts_in_standings) st
     where coefficient = 2
     order by n limit 1;
    v_index := coalesce(v_championships + 1, 7);
  else
    return true;
  end if;

  select min(r.locks_at) into v_first_lock
    from (select id, row_number() over (order by starts_on) as n
            from stages where season_id = p_season_id and counts_in_standings) st
    join races r on r.stage_id = st.id
   where st.n = v_index;
  return v_first_lock is not null and v_first_lock <= effective_now();
end;
$$;

-- Fusée / Gâchette posées sur une étape : pas sur une étape hors classement.
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
  if exists (select 1 from stages where id = p_stage_id and (coefficient = 2 or not counts_in_standings)) then
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

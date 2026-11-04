-- Pépite cachée (demande de Guillaume, 04/11/2026).
--
-- 1. Éligibilité : un biathlète n'est une Pépite possible que si TOUTES ses cotes courantes de la
--    saison (sprint, poursuite, individuel, mass start, gros globe, meilleur jeune) sont >= 30.
--    Avant, seule la cote du sprint comptait (ex. Ponsiluoma : sprint 30 mais poursuite 15).
-- 2. Choix définitif, sauf si la Pépite déjà choisie n'est plus éligible avec la nouvelle règle :
--    le joueur peut alors en choisir une autre (tant que le bonus n'est pas obtenu).
-- 3. Un joueur ne fixe jamais lui-même bonus_claimed ni odds_at_pick (calculés ici / au scoring).
-- 4. Une Pépite pas encore révélée ne peut pas figurer dans les pronostics de course de son
--    joueur : elle est déjà jouée en caché sur toutes les courses.
--
-- La visibilité pour les autres joueurs ne change pas : « pepites: read all once revealed »
-- (0018) ne laisse lire une Pépite qu'une fois révélée (bonus_claimed).
--
-- Le back-office (clé service_role) et l'éditeur SQL ne passent pas par ces contrôles.

create or replace function public.pepite_is_eligible(p_athlete_id uuid, p_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) > 0 and coalesce(bool_and(value >= 30), false)
  from odds
  where athlete_id = p_athlete_id
    and season_id = p_season_id
    and valid_until is null;
$$;

grant execute on function public.pepite_is_eligible(uuid, uuid) to authenticated;

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

  if tg_op = 'UPDATE' then
    if old.bonus_claimed then
      raise exception 'pepite_already_revealed' using errcode = '23514';
    end if;
    -- Choix définitif, sauf si l'ancienne Pépite n'est plus éligible.
    if new.athlete_id is distinct from old.athlete_id and public.pepite_is_eligible(old.athlete_id, old.season_id) then
      raise exception 'pepite_definitive' using errcode = '23514';
    end if;
  end if;

  new.bonus_claimed := false;

  if tg_op = 'INSERT' or new.athlete_id is distinct from old.athlete_id then
    select sex into v_sex from athletes where id = new.athlete_id;
    if v_sex is null or v_sex <> new.sex then
      raise exception 'pepite_wrong_sex' using errcode = '23514';
    end if;
    if not public.pepite_is_eligible(new.athlete_id, new.season_id) then
      raise exception 'pepite_not_eligible' using errcode = '23514';
    end if;
    -- Cote retenue au moment du choix : la plus basse de ses cotes.
    select min(value) into new.odds_at_pick
    from odds
    where athlete_id = new.athlete_id and season_id = new.season_id and valid_until is null;
  else
    new.odds_at_pick := old.odds_at_pick;
  end if;

  return new;
end;
$$;

drop trigger if exists pepites_check on pepites;
create trigger pepites_check
  before insert or update on pepites
  for each row execute function public.pepites_check();

create or replace function public.predictions_no_hidden_pepite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or new.athlete_ids is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.athlete_ids is not distinct from old.athlete_ids then
    return new;
  end if;

  if exists (
    select 1
    from pepites p
    join races r on r.id = new.race_id
    join stages s on s.id = r.stage_id
    where p.user_id = new.user_id
      and p.season_id = s.season_id
      and not p.bonus_claimed
      and p.athlete_id = any (new.athlete_ids)
  ) then
    raise exception 'hidden_pepite_in_prediction' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_no_hidden_pepite on predictions;
create trigger predictions_no_hidden_pepite
  before insert or update on predictions
  for each row execute function public.predictions_no_hidden_pepite();

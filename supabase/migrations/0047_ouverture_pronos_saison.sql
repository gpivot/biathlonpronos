-- Biathlonpronos — ouverture des pronostics de saison (Guillaume, 24/11/2026).
-- À coller dans l'éditeur SQL de Supabase AVANT de fusionner la PR.
--
-- Règle : chaque joueur peut faire ou modifier ses pronostics de saison (6 globes + Pépites
-- cachées) jusqu'au départ de la PREMIÈRE COURSE QU'IL PRONOSTIQUE (étape qui compte au
-- classement : les étapes « Autre (×0) », ex. pré-saison, ne comptent pas), et au plus tard
-- jusqu'au départ de la mass start femmes du Grand-Bornand. Ensuite, tout est fermé.
-- Conséquences :
--   * avant la 1re course de Coupe du Monde, tout le monde peut modifier (comme avant) ;
--   * après, seul un nouveau joueur (aucune course pronostiquée déjà partie) peut encore les saisir ;
--   * après le départ de la mass start femmes du Grand-Bornand, plus personne.
--
-- Avant cette migration, rien n'empêchait côté base d'écrire un pronostic de saison après le
-- début de la saison (seul l'écran le bloquait) : c'est désormais vérifié par Supabase.
-- Inchangé : l'équipe favorite (règles de 0046, nécessaire à la carte Équipe en cours de saison),
-- le remplacement d'une Pépite devenue inéligible, la carte Talent.
-- Le back-office (clé service_role) et l'éditeur SQL ne passent pas par ces contrôles.

-- Départ de la mass start femmes du Grand-Bornand (null si pas au calendrier).
create or replace function public.season_picks_closing_race_at(p_season_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select min(r.locks_at)
    from races r
    join stages s on s.id = r.stage_id
   where s.season_id = p_season_id
     and r.format = 'mass_start'
     and r.sex = 'F'
     and s.location ilike '%bornand%';
$$;

-- Fermeture pour le joueur connecté : la plus proche entre sa 1re course pronostiquée et la mass
-- start femmes du Grand-Bornand (à défaut, la 1re course de Coupe du Monde). least() ignore les null.
create or replace function public.season_picks_closes_at(p_season_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select least(
    (select min(r.locks_at)
       from predictions p
       join races r on r.id = p.race_id
       join stages s on s.id = r.stage_id
      where p.user_id = auth.uid()
        and s.season_id = p_season_id
        and s.counts_in_standings),
    coalesce(public.season_picks_closing_race_at(p_season_id), public.first_world_cup_race_at(p_season_id))
  );
$$;

-- Encore ouverts pour le joueur connecté ? (horloge simulée de l'admin comprise)
create or replace function public.season_picks_open(p_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.season_picks_closes_at(p_season_id) > effective_now(), true);
$$;

grant execute on function public.season_picks_closing_race_at(uuid) to authenticated, anon;
grant execute on function public.season_picks_closes_at(uuid) to authenticated;
grant execute on function public.season_picks_open(uuid) to authenticated;

-- Pronostics de saison (globes) ---------------------------------------------------------------
-- « write own » (0001) autorisait tout, à tout moment. Remplacée par insert/update/delete tant que
-- c'est ouvert pour le joueur. La lecture reste couverte par « read own » (0001) et « read all
-- after season start » (0018).

drop policy if exists "season_predictions: write own" on season_predictions;
drop policy if exists "season_predictions: insert own while open" on season_predictions;
drop policy if exists "season_predictions: update own while open" on season_predictions;
drop policy if exists "season_predictions: delete own while open" on season_predictions;

create policy "season_predictions: insert own while open" on season_predictions for insert
  with check (auth.uid() = user_id and public.season_picks_open(season_id));

create policy "season_predictions: update own while open" on season_predictions for update
  using (auth.uid() = user_id and public.season_picks_open(season_id))
  with check (auth.uid() = user_id and public.season_picks_open(season_id));

create policy "season_predictions: delete own while open" on season_predictions for delete
  using (auth.uid() = user_id and public.season_picks_open(season_id));

-- Pépite cachée ---------------------------------------------------------------------------------
-- Reprise de 0046 avec deux changements :
--   * premier choix (insert) : seulement tant que c'est ouvert pour le joueur ;
--   * modification : « jusqu'à la 1re course de Coupe du Monde » devient « tant que c'est ouvert ».

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

  if tg_op = 'INSERT' and not public.season_picks_open(new.season_id) then
    raise exception 'pepite_closed' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.bonus_claimed then
      raise exception 'pepite_already_revealed' using errcode = '23514';
    end if;
    -- Pépite choisie ou réactivée avec la carte Talent : définitive, même si ses cotes ont baissé.
    if new.athlete_id is distinct from old.athlete_id and old.active_from is not null then
      raise exception 'pepite_definitive' using errcode = '23514';
    end if;
    -- Modifiable tant que les pronostics de saison sont ouverts pour le joueur ; ensuite seulement
    -- si l'ancienne Pépite n'est plus éligible (règle « toutes les cotes >= 30 »).
    if new.athlete_id is distinct from old.athlete_id
       and not public.season_picks_open(old.season_id)
       and public.pepite_is_eligible(old.athlete_id, old.season_id) then
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
    -- Une Pépite cachée ne peut pas figurer dans ses pronostics de course pas encore partie.
    if exists (
      select 1
        from predictions pr
        join races r on r.id = pr.race_id
        join stages s on s.id = r.stage_id
       where pr.user_id = new.user_id
         and s.season_id = new.season_id
         and r.locks_at > effective_now()
         and new.athlete_id = any (pr.athlete_ids)
    ) then
      raise exception 'pepite_in_upcoming_prediction' using errcode = '23514';
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

-- Vérification : la course qui ferme tout (doit afficher la mass start femmes du Grand-Bornand).
-- Si rien ne s'affiche, le nom du lieu ne contient pas « Bornand » : prévenir Claude.
select s.location, r.format, r.sex, r.locks_at
  from races r
  join stages s on s.id = r.stage_id
  join seasons se on se.id = s.season_id and se.status = 'active'
 where r.format = 'mass_start' and r.sex = 'F' and s.location ilike '%bornand%';

-- Biathlonpronos — Pépite cachée et équipe favorite modifiables jusqu'à la 1re course de Coupe du
-- Monde (Guillaume, 24/11/2026). À coller dans l'éditeur SQL de Supabase AVANT de fusionner la PR.
--
-- Avant : une fois choisies, la Pépite cachée (0035) et l'équipe favorite (0028) étaient définitives.
-- Maintenant : le joueur peut les changer autant qu'il veut jusqu'au départ de la première course de
-- Coupe du Monde de la saison (étape ×1 qui compte au classement ; les étapes « Autre (×0) », ex.
-- pré-saison, ne comptent pas). Après ce départ, elles sont verrouillées.
-- Inchangé : un joueur qui n'a encore rien choisi peut toujours faire son premier choix plus tard ;
-- une Pépite plus éligible peut toujours être remplacée ; la carte Talent garde ses propres règles.
--
-- Le back-office (clé service_role) et l'éditeur SQL ne passent pas par ces contrôles.

-- Départ de la 1re course de Coupe du Monde de la saison (null si aucune course au calendrier).
create or replace function public.first_world_cup_race_at(p_season_id uuid)
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
     and s.coefficient = 1
     and s.counts_in_standings;
$$;

-- Les choix de début de saison sont-ils encore modifiables ? (horloge simulée de l'admin comprise)
create or replace function public.season_choices_editable(p_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.first_world_cup_race_at(p_season_id) > effective_now(), true);
$$;

grant execute on function public.first_world_cup_race_at(uuid) to authenticated, anon;
grant execute on function public.season_choices_editable(uuid) to authenticated;

-- Pépite cachée --------------------------------------------------------------------------------

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
    -- Pépite choisie ou réactivée avec la carte Talent : définitive, même si ses cotes ont baissé.
    if new.athlete_id is distinct from old.athlete_id and old.active_from is not null then
      raise exception 'pepite_definitive' using errcode = '23514';
    end if;
    -- Modifiable jusqu'au départ de la 1re course de Coupe du Monde ; ensuite seulement si
    -- l'ancienne Pépite n'est plus éligible (règle « toutes les cotes >= 30 »).
    if new.athlete_id is distinct from old.athlete_id
       and not public.season_choices_editable(old.season_id)
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

-- Équipe favorite ------------------------------------------------------------------------------
-- Premier choix : inchangé (« favorite_teams: insert own once », 0028). Nouveau : modification par
-- le joueur jusqu'au départ de la 1re course de Coupe du Monde (et tant que sa carte Équipe n'est
-- pas active). Toujours pas de suppression par le joueur.

drop policy if exists "favorite_teams: update own until first race" on favorite_teams;

create policy "favorite_teams: update own until first race" on favorite_teams for update
  using (
    auth.uid() = user_id
    and public.season_choices_editable(favorite_teams.season_id)
  )
  with check (
    auth.uid() = user_id
    and public.season_choices_editable(favorite_teams.season_id)
    and not exists (
      select 1 from bonus_cards b
      where b.user_id = auth.uid()
        and b.season_id = favorite_teams.season_id
        and b.card_type = 'equipe'
        and b.status = 'used'
    )
  );

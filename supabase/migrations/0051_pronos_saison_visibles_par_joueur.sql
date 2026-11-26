-- Biathlonpronos — pronostics de saison d'un autre joueur visibles dès que LES SIENS sont fermés
-- (Guillaume, 26/11/2026). À coller dans l'éditeur SQL de Supabase AVANT de fusionner la PR.
-- À exécuter après 0050.
--
-- 0050 les rendait visibles seulement à la fermeture pour tout le monde (Grand-Bornand). Guillaume
-- préfère : visibles dès que ce joueur ne peut plus les modifier, c'est-à-dire au départ de sa 1re
-- course pronostiquée (règles 0047 et 0048), au plus tard la mass start femmes du Grand-Bornand.
-- Un invité (« Je teste le jeu ») n'a pas accès aux classements, donc ne peut pas copier.
-- Inchangé : chacun lit toujours les siens ; les Pépites cachées restent invisibles tant qu'elles
-- ne sont pas révélées.

-- Fermeture des pronostics de saison d'un joueur donné (même calcul que season_picks_closes_at).
create or replace function public.season_picks_closes_at_for(p_season_id uuid, p_user_id uuid)
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
      where p.user_id = p_user_id
        and s.season_id = p_season_id
        and s.counts_in_standings
        and r.locks_at > coalesce(
          (select pr.account_completed_at from profiles pr where pr.id = p_user_id),
          '-infinity'::timestamptz
        )),
    coalesce(public.season_picks_closing_race_at(p_season_id), public.first_world_cup_race_at(p_season_id))
  );
$$;

-- Le joueur connecté : même fonction, pour qu'il n'y ait qu'un seul calcul.
create or replace function public.season_picks_closes_at(p_season_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select public.season_picks_closes_at_for(p_season_id, auth.uid());
$$;

revoke execute on function public.season_picks_closes_at_for(uuid, uuid) from public;
grant execute on function public.season_picks_closes_at_for(uuid, uuid) to authenticated;

drop policy if exists "season_predictions: read all once closed" on season_predictions;
drop policy if exists "season_predictions: read all after season start" on season_predictions;
drop policy if exists "season_predictions: read once player closed" on season_predictions;

create policy "season_predictions: read once player closed" on season_predictions for select using (
  public.season_picks_closes_at_for(season_id, user_id) <= effective_now()
);

-- Vérification : nombre de joueurs dont les pronostics de saison sont déjà visibles par les autres.
select count(distinct sp.user_id) as joueurs_visibles
  from season_predictions sp
  join seasons se on se.id = sp.season_id and se.status = 'active'
 where public.season_picks_closes_at_for(sp.season_id, sp.user_id) <= effective_now();

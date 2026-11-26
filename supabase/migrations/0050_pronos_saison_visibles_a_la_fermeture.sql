-- Biathlonpronos — pronostics de saison des autres joueurs visibles seulement à la fermeture
-- (Guillaume, 26/11/2026). À coller dans l'éditeur SQL de Supabase AVANT de fusionner la PR.
--
-- Avant (0018) : les globes d'un autre joueur étaient lisibles dès le début de la saison
-- (seasons.starts_on). Mais depuis 0047, un joueur qui n'a pas encore pronostiqué de course peut
-- saisir ou modifier ses pronostics de saison jusqu'à la mass start femmes du Grand-Bornand : il
-- pourrait donc copier ceux des autres.
-- Maintenant : lisibles par tous seulement quand plus personne ne peut les modifier, c'est-à-dire
-- au départ de la mass start femmes du Grand-Bornand (à défaut, la 1re course de Coupe du Monde).
-- Même logique que les pronostics de course, visibles à leur départ.
-- Inchangé : chacun lit toujours les siens (« read own », 0001) ; les Pépites cachées restent
-- invisibles tant qu'elles ne sont pas révélées (« pepites: read all once revealed », 0018).

drop policy if exists "season_predictions: read all after season start" on season_predictions;
drop policy if exists "season_predictions: read all once closed" on season_predictions;

create policy "season_predictions: read all once closed" on season_predictions for select using (
  coalesce(
    public.season_picks_closing_race_at(season_id),
    public.first_world_cup_race_at(season_id)
  ) <= effective_now()
);

-- Vérification : doit afficher la date de fermeture (départ de la mass start femmes du Grand-Bornand).
select coalesce(public.season_picks_closing_race_at(id), public.first_world_cup_race_at(id)) as visibles_a_partir_de
  from seasons
 where status = 'active';

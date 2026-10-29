-- Biathlonpronos — pop-up d'un joueur dans le Classement (sa page « Ma saison »).
-- Jusqu'ici chaque joueur ne pouvait lire que ses propres pronostics. On ouvre la
-- lecture aux autres joueurs, mais seulement quand ça ne permet plus de copier :
--   * pronostic de course : une fois la course partie (locks_at passé) ;
--   * pronostics de saison (globes) : une fois la saison commencée ;
--   * Pépite : une fois révélée (bonus obtenu), puisque c'est un pronostic caché.
-- Les règles « read own » existantes restent : son propre pronostic reste lisible à tout moment.

create policy "predictions: read all after lock" on predictions for select using (
  exists (select 1 from races where races.id = race_id and races.locks_at <= effective_now())
);

create policy "season_predictions: read all after season start" on season_predictions for select using (
  exists (select 1 from seasons where seasons.id = season_id and seasons.starts_on <= effective_now()::date)
);

create policy "pepites: read all once revealed" on pepites for select using (bonus_claimed);

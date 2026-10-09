-- Biathlonpronos — rend le calcul de score ré-exécutable sans dupliquer.
-- L'admin doit pouvoir corriger une saisie de résultats et recalculer sans
-- créer une deuxième ligne de score pour le même utilisateur/course (même
-- défaut que celui corrigé pour `odds` en 0003). NULL n'entre jamais en
-- conflit avec NULL dans une contrainte unique Postgres, donc ces deux
-- contraintes coexistent sans conflit avec le check score_ledger_source_check.

alter table score_ledger add constraint score_ledger_user_race_unique unique (user_id, race_id);
alter table score_ledger add constraint score_ledger_user_season_category_unique
  unique (user_id, season_id, season_prediction_category);

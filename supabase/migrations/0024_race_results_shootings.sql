-- Biathlonpronos — fautes au tir, tir par tir (demande de Guillaume, 30/10/2026).
--
-- Une valeur par tir : [0, 1, 0, 2] pour une poursuite, [1, 3] pour un relais (couché, debout,
-- équipe entière). Affichées en ronds noirs à côté de chaque athlète ou nation dans les
-- résultats ; leur somme sert de nombre de tours de pénalité à la course « Tour de péna ».
-- Vide (null) pour les résultats saisis avant cette migration.

alter table race_results add column if not exists shootings smallint[];

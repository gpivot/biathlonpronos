-- Biathlonpronos — ouverture des pronostics d'une étape forcée depuis l'admin (09/11/2026).
-- Vide (null) : règle normale, le lundi qui précède l'étape à 17 h. Une date : ce jour-là à 17 h
-- (heure de Paris). Sert par exemple à ouvrir la 1re étape de la saison en avance.

alter table stages add column if not exists predictions_open_on date;

-- Biathlonpronos — empêche les doublons de cotes courantes.
-- La table odds n'avait aucune contrainte d'unicité sur sa clé naturelle :
-- relancer supabase/seed.sql (ou une ré-saisie manuelle par erreur) duplique
-- silencieusement chaque cote courante. Une cote historisée (valid_until
-- renseigné) reste libre de se répéter dans le temps ; seule LA cote
-- courante (valid_until is null) par athlète+format, ou par nation+sexe+format,
-- doit être unique.

create unique index odds_athlete_current_unique
  on odds (season_id, format, athlete_id)
  where valid_until is null and athlete_id is not null;

create unique index odds_nation_current_unique
  on odds (season_id, format, nation_code, nation_sex)
  where valid_until is null and nation_code is not null;

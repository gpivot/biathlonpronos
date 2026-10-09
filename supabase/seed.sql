-- Données d'exemple pour tester l'app en local après 0001_init.sql.
-- À exécuter dans l'éditeur SQL Supabase. Ne pas utiliser en production.

insert into nations (code, name) values
  ('FRA', 'France'), ('NOR', 'Norvège'), ('ITA', 'Italie'),
  ('GER', 'Allemagne'), ('SWE', 'Suède'), ('FIN', 'Finlande')
on conflict do nothing;

insert into seasons (id, label, starts_on, ends_on, status)
values ('00000000-0000-0000-0000-000000000001', '2026-27', '2026-11-28', '2027-03-21', 'active')
on conflict do nothing;

insert into athletes (id, season_id, first_name, last_name, nation_code, sex) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Julia', 'Simon', 'FRA', 'F'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Lisa', 'Vittozzi', 'ITA', 'F'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Franziska', 'Preuss', 'GER', 'F'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Elvira', 'Öberg', 'SWE', 'F'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Lou', 'Jeanmonnot', 'FRA', 'F'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Justine', 'Braisaz-Bouchet', 'FRA', 'F'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Selina', 'Grotian', 'GER', 'F')
on conflict do nothing;

insert into stages (id, season_id, location, country_code, starts_on, ends_on, coefficient)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Kontiolahti', 'FIN', '2026-11-28', '2026-12-01', 1)
on conflict do nothing;

insert into races (id, stage_id, sex, format, locks_at, status) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'F', 'sprint', '2026-11-29 14:20:00+00', 'upcoming'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'F', 'poursuite', '2026-11-30 13:45:00+00', 'upcoming')
on conflict do nothing;

insert into odds (season_id, format, athlete_id, value) values
  ('00000000-0000-0000-0000-000000000001', 'sprint', '10000000-0000-0000-0000-000000000001', 14),
  ('00000000-0000-0000-0000-000000000001', 'sprint', '10000000-0000-0000-0000-000000000002', 16),
  ('00000000-0000-0000-0000-000000000001', 'sprint', '10000000-0000-0000-0000-000000000003', 17),
  ('00000000-0000-0000-0000-000000000001', 'sprint', '10000000-0000-0000-0000-000000000004', 18),
  ('00000000-0000-0000-0000-000000000001', 'sprint', '10000000-0000-0000-0000-000000000005', 20),
  ('00000000-0000-0000-0000-000000000001', 'sprint', '10000000-0000-0000-0000-000000000006', 22),
  ('00000000-0000-0000-0000-000000000001', 'sprint', '10000000-0000-0000-0000-000000000007', 26)
on conflict (season_id, format, athlete_id) where valid_until is null do nothing;

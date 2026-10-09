-- Biathlonpronos — lecture publique des données de jeu.
-- 0001_init.sql laissait nations/seasons/athletes/odds/stages/races/race_results
-- sans RLS explicite en supposant l'accès ouvert par défaut. Les projets
-- Supabase récents activent RLS par défaut sur toute nouvelle table, ce qui
-- bloque silencieusement la lecture via la clé anon (200 + tableau vide).
-- Ces tables sont des données de jeu publiques (courses, athlètes, cotes,
-- résultats) : tout le monde doit pouvoir les lire, seule l'écriture reste
-- réservée au rôle admin (service_role, qui contourne RLS).

alter table nations enable row level security;
alter table seasons enable row level security;
alter table athletes enable row level security;
alter table odds enable row level security;
alter table stages enable row level security;
alter table races enable row level security;
alter table race_results enable row level security;

create policy "nations: read all" on nations for select using (true);
create policy "seasons: read all" on seasons for select using (true);
create policy "athletes: read all" on athletes for select using (true);
create policy "odds: read all" on odds for select using (true);
create policy "stages: read all" on stages for select using (true);
create policy "races: read all" on races for select using (true);
create policy "race_results: read all" on race_results for select using (true);

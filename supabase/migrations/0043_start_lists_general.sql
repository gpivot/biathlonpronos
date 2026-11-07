-- Biathlonpronos — ouverture des pronostics le lundi 17 h avec une liste de départ provisoire
-- (règle du 07/11/2026).
--
-- À l'ouverture, les sprints et individuels ne proposent que les 60 premiers du classement
-- général de la Coupe du monde, et les relais les nations classées au général du relais. La
-- liste officielle IBU, récupérée à la main depuis le back-office (en général la veille de la
-- course), remplace ensuite cette liste provisoire.
--
-- 1. race_start_lists : origine de la liste ('general' = provisoire, 'ibu' = officielle).
-- 2. race_start_nations : la même chose pour les relais (une nation par ligne).
-- Écriture réservée à l'admin (clé service, sans policy), lecture ouverte à tous comme 0020.

alter table race_start_lists
  add column if not exists source text not null default 'ibu'
  check (source in ('ibu', 'general'));

create table if not exists race_start_nations (
  race_id uuid not null references races(id) on delete cascade,
  nation_code text not null references nations(code) on delete cascade,
  start_position smallint not null check (start_position > 0),
  source text not null default 'ibu' check (source in ('ibu', 'general')),
  created_at timestamptz not null default now(),
  primary key (race_id, nation_code)
);

alter table race_start_nations enable row level security;
drop policy if exists "race_start_nations: read all" on race_start_nations;
create policy "race_start_nations: read all" on race_start_nations for select using (true);

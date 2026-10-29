-- Biathlonpronos — liste de départ officielle d'une poursuite ou d'une mass start.
-- Seuls les qualifiés prennent le départ (60 premiers du sprint pour la poursuite, 30 athlètes
-- pour la mass start) : la page de la course n'affiche qu'eux. La liste est récupérée sur le
-- site de l'IBU depuis le back-office ; écriture réservée à l'admin (clé service, sans policy),
-- lecture ouverte à tous comme les résultats (0002).

create table race_start_lists (
  race_id uuid not null references races(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  start_position smallint not null check (start_position > 0),
  bib smallint,
  created_at timestamptz not null default now(),
  primary key (race_id, athlete_id)
);

alter table race_start_lists enable row level security;
create policy "race_start_lists: read all" on race_start_lists for select using (true);

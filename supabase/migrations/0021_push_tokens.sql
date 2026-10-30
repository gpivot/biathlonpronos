-- Biathlonpronos — notifications de l'appli Android / iOS.
-- Un jeton par téléphone où l'appli est installée et autorisée à notifier, rattaché au joueur
-- connecté. Le jeton est la clé : si un autre joueur se connecte sur le même téléphone, la ligne
-- passe à ce joueur. Lecture et écriture réservées au serveur (clé service, sans policy, comme
-- 0020) : le site enregistre le jeton via une Server Action après avoir vérifié la connexion.

create table push_tokens (
  token text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index idx_push_tokens_user on push_tokens(user_id);

alter table push_tokens enable row level security;

-- Biathlonpronos — « Suggérer une modification » : messagerie joueur ↔ admin (demande de
-- Guillaume, 04/11/2026, reprise de VéloPronos).
--
-- Une seule conversation par joueur : toutes les lignes d'un même user_id. from_admin dit qui
-- parle (false : le joueur, true : l'équipe Biathlonpronos). read_at : lu par le destinataire
-- (le joueur pour une réponse de l'admin, les admins pour un message du joueur).
--
-- Comme notification_preferences (0034) : lecture et écriture réservées au serveur (clé
-- service, sans policy). Les pages vérifient elles-mêmes qui est connecté avant de lire.
-- La suppression d'un compte efface sa conversation (on delete cascade).

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  from_admin boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists support_messages_user_created_idx on support_messages (user_id, created_at);

alter table support_messages enable row level security;

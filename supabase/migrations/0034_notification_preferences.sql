-- Biathlonpronos — notifications des joueurs (demande de Guillaume, 02/11/2026).
--
-- Chaque joueur choisit, par type de message, s'il le reçoit sur l'appli (notification du
-- téléphone) et/ou par e-mail. Pas de ligne = réglages par défaut (les mêmes valeurs que les
-- « default » ci-dessous, répétées dans src/lib/notifications/preferences.ts).
--   - Rappel de pronostic (2 h avant une course non pronostiquée) : appli oui, e-mail oui.
--   - Résultats et points : appli oui (après chaque course), e-mail non (récap du lundi).
--   - Questions bonus en direct : appli seulement.
--   - Nouvelles du jeu : appli oui, e-mail non (consentement explicite exigé par le RGPD).
-- unsubscribe_token sert au lien « Se désabonner » des e-mails, utilisable sans être connecté.
--
-- notification_sends garde la trace de ce qui est déjà parti (rappel d'une course, résultats
-- d'une course, récap d'une semaine) pour ne jamais envoyer deux fois le même message.
--
-- Comme push_tokens (0021) : lecture et écriture réservées au serveur (clé service, sans policy).

create table if not exists notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  reminder_push boolean not null default true,
  reminder_email boolean not null default true,
  results_push boolean not null default true,
  results_email boolean not null default false,
  live_push boolean not null default true,
  news_push boolean not null default true,
  news_email boolean not null default false,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create table if not exists notification_sends (
  kind text not null check (kind in ('reminder', 'results', 'weekly')),
  ref text not null,           -- id de la course, ou semaine « 2026-W45 » pour le récap
  user_id uuid not null references profiles(id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  sent_at timestamptz not null default now(),
  primary key (kind, ref, user_id, channel)
);

alter table notification_sends enable row level security;

-- Adresses e-mail des joueurs (hors invités) et langue choisie à l'inscription (la même que celle
-- des e-mails de code de connexion), lues par le serveur pour les envois.
create or replace function public.player_emails(user_ids uuid[] default null)
returns table (id uuid, email text, locale text)
language sql
stable
security definer set search_path = public
as $$
  select u.id, u.email::text, coalesce(nullif(u.raw_user_meta_data->>'locale', ''), 'fr')
  from auth.users u
  join public.profiles p on p.id = u.id
  where not coalesce(u.is_anonymous, false)
    and u.email is not null and u.email <> ''
    and (user_ids is null or u.id = any(user_ids))
$$;

revoke execute on function public.player_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.player_emails(uuid[]) to service_role;

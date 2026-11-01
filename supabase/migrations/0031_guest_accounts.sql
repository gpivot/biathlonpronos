-- Biathlonpronos — parcours d'invité (décision de Guillaume, 01/11/2026).
-- Le bouton « Jouer » de l'accueil ouvre la prochaine course sans compte : l'appli crée une session
-- anonyme Supabase (signInAnonymously). À la validation du premier pronostic, le joueur donne
-- pseudo, prénom, nom et e-mail ; le compte anonyme devient permanent avec le même identifiant
-- (updateUser({ email }) puis code à 6 chiffres reçu par e-mail), sans mot de passe obligatoire.
--
-- Avant d'exécuter ce fichier : activer « Allow anonymous sign-ins » (Authentication > Sign In /
-- Providers). À exécuter après 0029 et 0030.

-- 1. Un compte anonyme n'a pas d'e-mail : le profil créé à l'inscription doit tout de même avoir
--    un pseudo (profiles.pseudo est NOT NULL). Le vrai pseudo est saisi à la conversion.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'pseudo', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Invité')
  );
  return new;
end;
$$;

-- 2. Un invité est reconnu à la revendication « is_anonymous » de son jeton.
create or replace function public.is_guest()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- 3. Règles RLS : un invité peut tout lire comme un visiteur, mais n'écrit rien tant que son compte
--    n'est pas confirmé (pronostics, pronostics de saison, Pépites, équipe favorite, ligues, pseudo).
--    Politiques « restrictive » : elles s'ajoutent (ET) aux règles existantes sans les remplacer.
do $$
declare
  t text;
  op text;
begin
  foreach t in array array['predictions', 'season_predictions', 'pepites', 'favorite_teams', 'leagues', 'league_memberships', 'profiles']
  loop
    foreach op in array array['insert', 'update', 'delete']
    loop
      execute format('drop policy if exists %I on public.%I', t || ': no guest ' || op, t);
      if op = 'insert' then
        execute format(
          'create policy %I on public.%I as restrictive for insert to authenticated with check (not public.is_guest())',
          t || ': no guest ' || op, t);
      else
        execute format(
          'create policy %I on public.%I as restrictive for %s to authenticated using (not public.is_guest())',
          t || ': no guest ' || op, t, op);
      end if;
    end loop;
  end loop;
end;
$$;

-- 4. Limite de création de comptes invités : au plus 300 par heure pour tout le site (garde-fou
--    contre les robots ; la limite par adresse IP se règle dans Authentication > Rate Limits).
create or replace function public.limit_anonymous_signups()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_anonymous and (
    select count(*) from auth.users where is_anonymous and created_at > now() - interval '1 hour'
  ) >= 300 then
    raise exception 'Trop de comptes invités créés en une heure, réessaie plus tard.';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_anonymous_signups on auth.users;
create trigger limit_anonymous_signups
  before insert on auth.users
  for each row execute function public.limit_anonymous_signups();

-- 5. Purge : les invités qui n'ont pas confirmé leur compte au bout de 7 jours sont supprimés
--    (leur profil part avec, par cascade). Appelée chaque nuit par pg_cron s'il est activé
--    (Database > Extensions > pg_cron), et par le bouton « Purger les invités » de /admin/joueurs.
create or replace function public.purge_anonymous_users(older_than interval default interval '7 days')
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  purged integer;
begin
  delete from auth.users where is_anonymous and created_at < now() - older_than;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke execute on function public.purge_anonymous_users(interval) from public, anon, authenticated;
grant execute on function public.purge_anonymous_users(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-anonymous-users', '30 3 * * *', 'select public.purge_anonymous_users()');
  end if;
end;
$$;

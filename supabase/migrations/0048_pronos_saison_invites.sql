-- Biathlonpronos — pronostics de saison des invités devenus joueurs (Guillaume, 25/11/2026).
-- À coller dans l'éditeur SQL de Supabase AVANT de fusionner la PR. À exécuter après 0047.
--
-- Problème : un invité (bouton « Je teste le jeu ») pronostique une course, reçoit son code après
-- le résultat, puis crée son compte. Son compte garde ses pronostics : la course jouée en invité
-- comptait donc comme sa « 1re course pronostiquée », déjà partie, et ses pronostics de saison
-- étaient fermés dès son arrivée (règle de 0047).
--
-- Règle : les courses jouées en invité, parties avant la création de son compte, ne comptent plus.
-- Une fois inscrit, il peut faire ses pronostics de saison jusqu'au départ de la prochaine course
-- qu'il pronostique, et toujours au plus tard jusqu'au départ de la mass start femmes du
-- Grand-Bornand. Rien ne change pour les autres joueurs.

-- 1. Date de création du compte d'un invité (null pour les joueurs inscrits directement).
alter table public.profiles add column if not exists account_completed_at timestamptz;

-- 2. Seule la page d'inscription (côté serveur, clé service) peut la fixer, comme signup_pending.
create or replace function public.protect_signup_pending()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.signup_pending is distinct from old.signup_pending then
      new.signup_pending := old.signup_pending;
    end if;
    if new.account_completed_at is distinct from old.account_completed_at then
      new.account_completed_at := old.account_completed_at;
    end if;
  end if;
  return new;
end;
$$;

-- 3. Fermeture pour le joueur connecté (reprise de 0047) : les courses parties avant la création de
--    son compte d'invité sont ignorées.
create or replace function public.season_picks_closes_at(p_season_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select least(
    (select min(r.locks_at)
       from predictions p
       join races r on r.id = p.race_id
       join stages s on s.id = r.stage_id
      where p.user_id = auth.uid()
        and s.season_id = p_season_id
        and s.counts_in_standings
        and r.locks_at > coalesce(
          (select pr.account_completed_at from profiles pr where pr.id = auth.uid()),
          '-infinity'::timestamptz
        )),
    coalesce(public.season_picks_closing_race_at(p_season_id), public.first_world_cup_race_at(p_season_id))
  );
$$;

-- Vérification : la colonne existe (doit afficher une ligne « account_completed_at »).
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_completed_at';

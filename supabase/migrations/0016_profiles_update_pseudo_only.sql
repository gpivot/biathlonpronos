-- Les joueurs peuvent modifier leur pseudo depuis la page Profil (policy « profiles: update own »).
-- Sans restriction de colonnes, cette policy leur permettait aussi de passer leur propre
-- profiles.is_admin à true via l'API. On limite donc la mise à jour côté client à la seule
-- colonne pseudo ; is_admin reste modifiable via l'éditeur SQL / la clé service_role.
revoke update on table public.profiles from anon, authenticated;
grant update (pseudo) on table public.profiles to authenticated;


-- Biathlonpronos — picto de profil (demande de Guillaume, 04/11/2026).
--
-- Chaque joueur peut choisir un picto (un emoji d'une liste fixe, src/lib/avatars.ts) qui
-- remplace l'initiale de son pseudo sur le profil et le rond vide en haut à droite des onglets.
-- null : pas de picto (initiale / silhouette comme avant).
--
-- Pas de droit de mise à jour côté client (0016 ne l'autorise que pour pseudo) : le choix passe
-- par une Server Action qui vérifie que le picto fait partie de la liste.

alter table profiles add column if not exists avatar text
  check (avatar is null or char_length(avatar) between 1 and 16);

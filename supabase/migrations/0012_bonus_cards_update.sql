-- Biathlonpronos — un joueur doit pouvoir marquer sa propre carte comme
-- utilisée (Balle de pioche / Ça farte activées depuis l'écran de
-- pronostic, Fondue depuis l'écran de course). 0001_init.sql n'autorisait
-- que la lecture ("read own") ; l'attribution des cartes reste réservée à
-- l'admin (insert via service_role uniquement, pas de policy publique).

create policy "bonus_cards: update own" on bonus_cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

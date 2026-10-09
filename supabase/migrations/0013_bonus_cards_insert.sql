-- Biathlonpronos — le joueur choisit lui-même sa carte au 10/10 (au lieu
-- d'un tirage aléatoire) : il lui faut donc pouvoir insérer sa propre ligne
-- bonus_cards depuis l'écran de compte, pas seulement la mettre à jour.

create policy "bonus_cards: insert own" on bonus_cards for insert
  with check (auth.uid() = user_id);

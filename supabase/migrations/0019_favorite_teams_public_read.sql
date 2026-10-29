-- Biathlonpronos — pop-up d'un joueur dans le Classement : on y affiche son équipe favorite.
-- Jusqu'ici chacun ne lisait que la sienne. Rien à copier ici (elle ne donne pas de pronostic),
-- donc lecture ouverte à tous, comme le classement et les séries (0007, 0014).
-- L'écriture reste réservée au joueur (« favorite_teams: write own »).

create policy "favorite_teams: read all" on favorite_teams for select using (true);

-- Équipe favorite définitive (demande de Guillaume, 30/10/2026) : choisie une seule fois par
-- saison, à tout moment tant que la carte Équipe du joueur n'est pas active. Plus de modification
-- ni de suppression par le joueur (aucune politique update/delete) ; la clé primaire
-- (user_id, season_id) empêche un second choix.

drop policy if exists "favorite_teams: write own" on favorite_teams;

create policy "favorite_teams: insert own once" on favorite_teams for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from bonus_cards b
      where b.user_id = auth.uid()
        and b.season_id = favorite_teams.season_id
        and b.card_type = 'equipe'
        and b.status = 'used'
    )
  );

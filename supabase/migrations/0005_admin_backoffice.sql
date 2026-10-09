-- Biathlonpronos — prérequis du back-office de saisie des résultats.

-- Rôle admin, nécessaire pour protéger /admin (aucune notion de rôle
-- n'existait encore dans profiles).
alter table profiles add column is_admin boolean not null default false;

-- La carte "Ça farte" cible un athlète précis parmi les 3 (ou 4) choisis ;
-- rien ne stockait encore lequel.
alter table predictions add column bonus_card_target_athlete_id uuid references athletes(id);

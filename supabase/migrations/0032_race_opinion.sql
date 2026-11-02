-- Biathlonpronos — « L'avis de Biathlonpronos » (demande de Guillaume, 02/11/2026).
-- Commentaire libre saisi par l'admin dans le back-office (/admin/races/[id]) pour chaque course,
-- affiché dans un encadré sur la page course. Vide ou null : la rubrique est masquée.
-- Lecture publique comme le reste de la table races (politiques RLS existantes inchangées).

alter table races add column if not exists opinion text;

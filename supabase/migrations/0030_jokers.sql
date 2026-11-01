-- Biathlonpronos — jokers de fin de saison (décision de Guillaume, 01/11/2026).
-- L'admin les active en fin de saison (bouton « Appliquer les jokers » de /admin, section de la
-- saison) : le classement retire alors à chaque joueur ses 3 plus mauvais résultats de courses
-- individuelles et ses 2 plus mauvais relais (hors Mondiaux/JO, courses non jouées d'abord).
-- Calcul à la lecture (src/lib/jokers.ts) : aucun point n'est effacé de score_ledger, le bouton
-- est réversible.

alter table seasons add column if not exists jokers_applied boolean not null default false;

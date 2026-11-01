-- Biathlonpronos — Fête nationale (décision de Guillaume, 01/11/2026).
-- Nouvelle course spéciale « bonus », désignée à la main sur une course individuelle : les points
-- d'un biathlète pronostiqué de l'équipe favorite du joueur (nation + sexe) classé dans le Top 10
-- sont doublés (calcul dans src/lib/scoring/individualRace.ts).
--
-- À exécuter SEUL dans l'éditeur SQL de Supabase (une nouvelle valeur d'enum doit être validée
-- avant d'être utilisée), avant 0030.

alter type special_rule add value if not exists 'fete_nationale';

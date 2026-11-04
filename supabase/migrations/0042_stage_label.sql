-- Biathlonpronos — mention d'étape réglable dans l'admin (Guillaume, 04/11/2026).
-- À coller dans l'éditeur SQL de Supabase AVANT de fusionner la PR.
--
-- Texte court affiché en majuscules au-dessus du lieu de l'étape dans le Calendrier (ex. « PRÉ-SAISON »
-- pour une étape hors classement). Vide : la mention par défaut de la catégorie (« Coupe du Monde »,
-- « Championnats du monde », rien pour une étape hors classement).

alter table stages add column if not exists label text;
alter table stages drop constraint if exists stages_label_length;
alter table stages add constraint stages_label_length check (label is null or char_length(label) <= 40);

-- Biathlonpronos — trois nouvelles cartes bonus (Guillaume, 04/11/2026) : Fusée, Gâchette et Talent.
-- À coller et exécuter SEUL, avant 0038 : une nouvelle valeur d'enum ne peut pas servir dans la
-- même exécution que celle qui la crée.

alter type bonus_card_type add value if not exists 'fusee';
alter type bonus_card_type add value if not exists 'gachette';
alter type bonus_card_type add value if not exists 'talent';

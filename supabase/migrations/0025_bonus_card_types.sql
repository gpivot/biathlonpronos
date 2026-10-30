-- Biathlonpronos — deux nouvelles cartes bonus (demande de Guillaume, 30/10/2026) : Aspiration et
-- Équipe. À coller et exécuter SEUL, avant 0026 : une nouvelle valeur d'enum ne peut pas servir
-- dans la même exécution que celle qui la crée.

alter type bonus_card_type add value if not exists 'aspiration';
alter type bonus_card_type add value if not exists 'equipe';

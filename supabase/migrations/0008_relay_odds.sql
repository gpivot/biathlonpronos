-- Biathlonpronos — cotes de relais (§5 du règlement).
-- Décisions de Guillaume (2026-09-11) : les cotes de relais (H, F, mixte,
-- mixte simple) sont des cotes "course", réévaluées aux mêmes pauses de
-- saison que sprint/individuel/mass start — contrairement à la cote
-- "meilleure nation" qui est une cote "saison" fixée une fois pour toutes
-- (déjà correctement modélisée, aucun changement nécessaire pour elle).
-- Mixte et mixte simple ont chacun leur propre cote par nation (pas de
-- cote partagée), et n'ont pas de sexe associé (une nation, une équipe).

alter type odds_format add value 'relais_h';
alter type odds_format add value 'relais_f';
alter type odds_format add value 'relais_mixte';
alter type odds_format add value 'relais_mixte_simple';

-- Biathlonpronos — relayeurs dans la liste de départ des relais (27/11/2026).
--
-- La liste de départ IBU d'un relais (hommes, femmes, mixte, mixte simple) donne, sous chaque
-- nation, ses relayeurs dans l'ordre des relais. Ils sont enregistrés avec la nation pour être
-- affichés sous son nom (back-office et page de la course). Tableau JSON de
-- { "first_name", "last_name" }, sans doublon (relais mixte simple : 2 noms pour 4 relais).
-- Vide (null) pour la liste provisoire du général et tant que l'IBU n'a pas annoncé les noms.

alter table race_start_nations
  add column if not exists relayers jsonb;

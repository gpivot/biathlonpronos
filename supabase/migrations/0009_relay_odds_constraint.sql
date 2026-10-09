-- Biathlonpronos — autorise les cotes de relais (nation, sans athlète) dans
-- `odds`, en plus de "meilleure_nation". Séparé de 0008 : Postgres interdit
-- d'utiliser une valeur d'enum tout juste ajoutée dans la même transaction.
-- relais_h/relais_f gardent un sexe (une nation = une équipe par sexe) ;
-- relais_mixte/relais_mixte_simple n'en ont pas (une seule équipe mixte).

alter table odds drop constraint odds_target_check;

alter table odds add constraint odds_target_check check (
  (athlete_id is not null and nation_code is null and nation_sex is null)
  or (
    athlete_id is null and nation_code is not null
    and format in ('meilleure_nation', 'relais_h', 'relais_f', 'relais_mixte', 'relais_mixte_simple')
    and (
      (format in ('meilleure_nation', 'relais_h', 'relais_f') and nation_sex is not null)
      or (format in ('relais_mixte', 'relais_mixte_simple') and nation_sex is null)
    )
  )
);

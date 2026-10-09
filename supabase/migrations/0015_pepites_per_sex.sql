-- §14 — une Pépite par sexe (et non une seule par joueur/saison).
alter table pepites add column sex sex;
update pepites p set sex = a.sex from athletes a where a.id = p.athlete_id and p.sex is null;
alter table pepites alter column sex set not null;

alter table pepites drop constraint pepites_pkey;
alter table pepites add primary key (user_id, season_id, sex);

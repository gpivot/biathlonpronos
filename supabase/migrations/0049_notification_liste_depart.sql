-- Notification « un de tes choix n'est pas au départ » (après l'enregistrement d'une liste de
-- départ) : nouveau type dans la trace des envois, pour ne jamais l'envoyer deux fois.
alter table notification_sends drop constraint if exists notification_sends_kind_check;
alter table notification_sends
  add constraint notification_sends_kind_check check (kind in ('reminder', 'results', 'weekly', 'start_list'));

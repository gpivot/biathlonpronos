-- Biathlonpronos — verrouillage réel des pronostics à l'heure du départ.
-- La policy "update own before lock" de 0001_init.sql portait ce nom mais
-- ne vérifiait jamais locks_at : un joueur pouvait modifier son pronostic
-- après le départ de la course (voire après la saisie des résultats). Même
-- défaut à l'insertion (aucune policy ne l'empêchait).

drop policy "predictions: insert own" on predictions;
drop policy "predictions: update own before lock" on predictions;

create policy "predictions: insert own before lock" on predictions for insert with check (
  auth.uid() = user_id
  and exists (select 1 from races where races.id = race_id and races.locks_at > now())
);

create policy "predictions: update own before lock" on predictions for update using (
  auth.uid() = user_id
  and exists (select 1 from races where races.id = race_id and races.locks_at > now())
);

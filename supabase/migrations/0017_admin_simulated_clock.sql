-- Biathlonpronos — horloge simulée de l'admin appliquée aussi en base.
-- Jusqu'ici la simulation (/admin/horloge) ne changeait que l'affichage : la
-- policy de 0010 comparait locks_at à now(), donc impossible de tester des
-- pronos sur une saison passée. Le décalage choisi par l'admin est désormais
-- stocké dans son profil, et effective_now() l'ajoute à now() — pour un admin
-- seulement. Les joueurs restent sur l'heure réelle. La colonne n'est pas
-- modifiable côté client (cf. 0016 : seul pseudo l'est), uniquement via la
-- clé service_role du back-office.

alter table profiles add column simulated_clock_offset_ms bigint;

create or replace function effective_now() returns timestamptz
language sql stable security definer set search_path = public as $$
  select now() + coalesce(
    (select simulated_clock_offset_ms * interval '1 millisecond'
       from profiles
      where id = auth.uid() and is_admin),
    interval '0'
  );
$$;

drop policy "predictions: insert own before lock" on predictions;
drop policy "predictions: update own before lock" on predictions;

create policy "predictions: insert own before lock" on predictions for insert with check (
  auth.uid() = user_id
  and exists (select 1 from races where races.id = race_id and races.locks_at > effective_now())
);

create policy "predictions: update own before lock" on predictions for update using (
  auth.uid() = user_id
  and exists (select 1 from races where races.id = race_id and races.locks_at > effective_now())
);

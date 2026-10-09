-- Biathlonpronos — le grillage (§2) est géré côté client (PredictionForm)
-- à chaque pronostic soumis, mais 0001_init.sql n'autorisait que la
-- lecture de ses propres lignes ("read own"), aucune écriture.

create policy "grilled_states: write own" on grilled_states for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

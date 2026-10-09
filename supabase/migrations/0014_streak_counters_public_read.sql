-- Biathlonpronos — le "Dossard Rouge" (classement annexe sur la meilleure
-- série 10/10, §12/§16) doit pouvoir lire la série de tout le monde, pas
-- seulement la sienne. Même correction que score_ledger en 0007.

drop policy "streak_counters: read own" on streak_counters;
create policy "streak_counters: read all" on streak_counters for select using (true);

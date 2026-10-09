-- Biathlonpronos — le classement est public par nature (jeu compétitif) :
-- 0001_init.sql restreignait score_ledger à son propre utilisateur ("read
-- own"), ce qui empêche toute page de classement de fonctionner pour qui
-- que ce soit d'autre que soi-même.

drop policy "score_ledger: read own" on score_ledger;
create policy "score_ledger: read all" on score_ledger for select using (true);

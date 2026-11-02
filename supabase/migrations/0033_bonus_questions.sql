-- Biathlonpronos — questions bonus (demande de Guillaume, 02/11/2026).
--
-- Deux sortes de questions, rattachées à une course et saisies dans /admin/races/[id] :
-- - pre_race : avant le départ, 2 à 4 réponses au choix, visible sur la page de la course pendant
--   qu'on pronostique ; on peut répondre jusqu'au départ (races.locks_at). Pas de notification.
-- - live : pendant la course, 2 réponses, durée de vie courte. Préparée en brouillon (opens_at
--   vide, invisible des joueurs), puis lancée par l'admin : opens_at / closes_at sont posés et une
--   notification push part vers les téléphones.
--
-- Points (décision de Guillaume, 02/11/2026) : 20 pts pour une bonne réponse, 0 pour une mauvaise.
-- L'admin saisit la bonne réponse (correct_option) une fois la question fermée ; le back-office
-- écrit alors 20 pts dans score_ledger pour chaque bonne réponse (une ligne par question et par
-- joueur, colonne bonus_question_id) : le classement général les compte sans autre changement.
--
-- Le joueur ne peut pas écrire directement dans ces tables : il passe par answer_bonus_question,
-- qui vérifie que la question est ouverte. Il peut changer d'avis tant qu'elle est ouverte.

create table if not exists bonus_questions (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races(id) on delete cascade,
  kind text not null check (kind in ('pre_race', 'live')),
  question text not null check (char_length(question) between 1 and 300),
  options text[] not null check (array_length(options, 1) between 2 and 4),
  -- Question live : lancement et fin (heure réelle). Vides tant qu'elle est en brouillon.
  -- Question avant le départ : vides, elle ferme au départ de la course.
  opens_at timestamptz,
  closes_at timestamptz,
  -- Bonne réponse (index dans options), saisie par l'admin après la fermeture. Vide : pas encore notée.
  correct_option smallint check (correct_option >= 0),
  created_at timestamptz not null default now(),
  constraint bonus_questions_live_two_options check (kind = 'pre_race' or array_length(options, 1) = 2)
);

create index if not exists idx_bonus_questions_race on bonus_questions(race_id);
create index if not exists idx_bonus_questions_live_open on bonus_questions(closes_at) where kind = 'live';

create table if not exists bonus_answers (
  question_id uuid not null references bonus_questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  option_index smallint not null check (option_index >= 0),
  answered_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

alter table bonus_questions enable row level security;
alter table bonus_answers enable row level security;

-- Brouillons de questions live invisibles des joueurs.
drop policy if exists "bonus_questions: read published" on bonus_questions;
create policy "bonus_questions: read published" on bonus_questions for select
  using (kind = 'pre_race' or opens_at is not null);

drop policy if exists "bonus_answers: read own" on bonus_answers;
create policy "bonus_answers: read own" on bonus_answers for select using (auth.uid() = user_id);

-- Points des questions bonus dans le grand livre des points.
alter table score_ledger
  add column if not exists bonus_question_id uuid references bonus_questions(id) on delete cascade;

alter table score_ledger drop constraint if exists score_ledger_source_check;
alter table score_ledger add constraint score_ledger_source_check
  check (num_nonnulls(race_id, season_prediction_category, bonus_question_id) = 1);

alter table score_ledger drop constraint if exists score_ledger_user_bonus_question_unique;
alter table score_ledger add constraint score_ledger_user_bonus_question_unique unique (user_id, bonus_question_id);

create or replace function answer_bonus_question(p_question_id uuid, p_option integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_question bonus_questions%rowtype;
  v_locks_at timestamptz;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  -- Invité (compte pas encore confirmé, migration 0031) : ne peut rien écrire, comme pour les pronos.
  if is_guest() then raise exception 'not_authenticated'; end if;

  select * into v_question from bonus_questions where id = p_question_id;
  if not found then raise exception 'question_not_found'; end if;
  if p_option is null or p_option < 0 or p_option >= array_length(v_question.options, 1) then
    raise exception 'invalid_option';
  end if;

  select r.locks_at into v_locks_at from races r where r.id = v_question.race_id;

  if v_question.kind = 'pre_race' then
    -- Même horloge que les pronostics (horloge simulée de l'admin comprise).
    if v_locks_at <= effective_now() then raise exception 'question_closed'; end if;
  else
    -- Question live : heure réelle, elle se joue pendant la vraie course.
    if v_question.opens_at is null or now() < v_question.opens_at or now() >= v_question.closes_at then
      raise exception 'question_closed';
    end if;
  end if;

  insert into bonus_answers (question_id, user_id, option_index)
  values (p_question_id, v_user, p_option)
  on conflict (question_id, user_id) do update set option_index = excluded.option_index, answered_at = now();
end;
$$;

revoke all on function answer_bonus_question(uuid, integer) from public;
grant execute on function answer_bonus_question(uuid, integer) to authenticated;

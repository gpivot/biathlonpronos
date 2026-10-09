-- Biathlonpronos — schéma initial
-- Reflète claude/architecture-technique-biathlonpronos.md (projet claude.ai "Biathlopronos")
-- À exécuter dans l'éditeur SQL Supabase, ou via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Saisons
-- ---------------------------------------------------------------------
create type season_status as enum ('preparation', 'active', 'archived');

create table seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,              -- "2026-27"
  starts_on date not null,
  ends_on date not null,
  status season_status not null default 'preparation',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Nations & biathlètes
-- ---------------------------------------------------------------------
create table nations (
  code text primary key,                    -- "FRA", "NOR"...
  name text not null
);

create type sex as enum ('H', 'F');

create table athletes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  nation_code text not null references nations(code),
  sex sex not null,
  created_at timestamptz not null default now()
);

create index idx_athletes_season on athletes(season_id);

-- ---------------------------------------------------------------------
-- Cotes historisées
-- format: sprint | poursuite | individuel | mass_start | gros_globe | meilleur_jeune
-- Pour "meilleure_nation", athlete_id est NULL et (nation_code, sex) est renseigné à la place.
-- ---------------------------------------------------------------------
create type odds_format as enum (
  'sprint', 'poursuite', 'individuel', 'mass_start',
  'gros_globe', 'meilleur_jeune', 'meilleure_nation'
);

create table odds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  format odds_format not null,
  athlete_id uuid references athletes(id) on delete cascade,
  nation_code text references nations(code),
  nation_sex sex,
  value integer not null check (value > 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,                  -- NULL = valeur courante
  created_at timestamptz not null default now(),
  constraint odds_target_check check (
    (athlete_id is not null and nation_code is null and nation_sex is null)
    or (athlete_id is null and nation_code is not null and nation_sex is not null and format = 'meilleure_nation')
  )
);

create index idx_odds_athlete_current on odds(athlete_id, format) where valid_until is null;
create index idx_odds_nation_current on odds(nation_code, nation_sex) where valid_until is null and format = 'meilleure_nation';

-- ---------------------------------------------------------------------
-- Étapes & courses
-- ---------------------------------------------------------------------
create table stages (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  location text not null,
  country_code text not null references nations(code),
  starts_on date not null,
  ends_on date not null,
  coefficient smallint not null default 1 check (coefficient in (1, 2)), -- 2 = Mondiaux / JO
  created_at timestamptz not null default now()
);

create index idx_stages_season on stages(season_id);

create type race_format as enum (
  'sprint', 'poursuite', 'individuel', 'mass_start',
  'relais_h', 'relais_f', 'relais_mixte', 'relais_mixte_simple'
);

create type special_rule as enum ('tour_de_pena', 'brouillard', 'tes_colle');

create type race_status as enum ('upcoming', 'locked', 'finished');

create table races (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stages(id) on delete cascade,
  sex sex,                                   -- NULL pour un relais mixte
  format race_format not null,
  locks_at timestamptz not null,             -- heure exacte de départ = verrouillage des pronostics
  special_rule special_rule,
  status race_status not null default 'upcoming',
  created_at timestamptz not null default now()
);

create index idx_races_stage on races(stage_id);
create index idx_races_locks_at on races(locks_at);

-- Résultats : un athlète (course individuelle) ou une nation (relais)
create table race_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races(id) on delete cascade,
  athlete_id uuid references athletes(id),
  nation_code text references nations(code),
  rank smallint not null check (rank > 0),
  time_gap_seconds numeric,                  -- écart au vainqueur, requis pour recalcul cote poursuite
  penalty_laps smallint default 0,           -- pour la course "tour de péna"
  is_fusee boolean not null default false,   -- meilleur temps de ski
  is_gachette boolean not null default false, -- sans-faute au tir
  created_at timestamptz not null default now(),
  constraint race_results_target_check check (
    (athlete_id is not null and nation_code is null)
    or (athlete_id is null and nation_code is not null)
  ),
  unique (race_id, athlete_id),
  unique (race_id, nation_code)
);

create index idx_race_results_race on race_results(race_id);

-- ---------------------------------------------------------------------
-- Utilisateurs (miroir léger de auth.users) & pronostics
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null,
  created_at timestamptz not null default now()
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  race_id uuid not null references races(id) on delete cascade,
  athlete_ids uuid[],                        -- 3 athlètes pour une course individuelle
  nation_code text references nations(code), -- pour un relais
  bonus_x2_used boolean not null default false,
  bonus_card_used text,                      -- 'balle_de_pioche' | 'ca_farte' | 'fondue' | 'chat_noir'
  submitted_at timestamptz not null default now(),
  unique (user_id, race_id)
);

create index idx_predictions_race on predictions(race_id);
create index idx_predictions_user on predictions(user_id);

create type season_prediction_category as enum (
  'gros_globe_h', 'gros_globe_f',
  'meilleur_jeune_h', 'meilleur_jeune_f',
  'meilleure_nation_h', 'meilleure_nation_f'
);

create table season_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  category season_prediction_category not null,
  athlete_id uuid references athletes(id),
  nation_code text references nations(code),
  corrected_via_chat_noir boolean not null default false,
  locked_at timestamptz,
  unique (user_id, season_id, category)
);

create table favorite_teams (
  user_id uuid not null references profiles(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  nation_code text not null references nations(code),
  sex sex not null,
  primary key (user_id, season_id)
);

create table pepites (
  user_id uuid not null references profiles(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  athlete_id uuid not null references athletes(id),
  odds_at_pick integer not null,
  bonus_claimed boolean not null default false,
  primary key (user_id, season_id)
);

create type bonus_card_type as enum ('balle_de_pioche', 'ca_farte', 'fondue', 'chat_noir');
create type bonus_card_status as enum ('available', 'used');

create table bonus_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  card_type bonus_card_type not null,
  status bonus_card_status not null default 'available',
  earned_at timestamptz not null default now(),
  used_at timestamptz,
  used_on_race_id uuid references races(id)
);

create table streak_counters (
  user_id uuid not null references profiles(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  current_streak integer not null default 0,
  cards_earned integer not null default 0,
  primary key (user_id, season_id)
);

create table grilled_states (
  user_id uuid not null references profiles(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  stage_id uuid not null references stages(id) on delete cascade,
  grilled boolean not null default true,
  primary key (user_id, athlete_id, stage_id)
);

-- ---------------------------------------------------------------------
-- Ligues privées
-- ---------------------------------------------------------------------
create table leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  owner_id uuid not null references profiles(id),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table league_memberships (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- ---------------------------------------------------------------------
-- ScoreLedger — source de vérité du classement
-- ---------------------------------------------------------------------
create table score_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  race_id uuid references races(id),                       -- NULL si ligne "globes" de saison
  season_prediction_category season_prediction_category,    -- renseigné si ligne "globes"
  points numeric not null,
  breakdown jsonb not null default '{}'::jsonb,             -- détail base/bonus/malus pour audit
  created_at timestamptz not null default now(),
  constraint score_ledger_source_check check (
    (race_id is not null and season_prediction_category is null)
    or (race_id is null and season_prediction_category is not null)
  )
);

create index idx_score_ledger_user_season on score_ledger(user_id, season_id);

-- ---------------------------------------------------------------------
-- Row Level Security — chacun lit tout ce qui est public (courses, cotes,
-- résultats, classement), mais ne peut écrire que ses propres pronostics.
-- À affiner avant mise en production (policies admin pour la saisie de
-- résultats via un rôle service dédié plutôt que l'utilisateur courant).
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table predictions enable row level security;
alter table season_predictions enable row level security;
alter table favorite_teams enable row level security;
alter table pepites enable row level security;
alter table bonus_cards enable row level security;
alter table streak_counters enable row level security;
alter table grilled_states enable row level security;
alter table leagues enable row level security;
alter table league_memberships enable row level security;
alter table score_ledger enable row level security;

create policy "profiles: read all" on profiles for select using (true);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);

create policy "predictions: read own" on predictions for select using (auth.uid() = user_id);
create policy "predictions: insert own" on predictions for insert with check (auth.uid() = user_id);
create policy "predictions: update own before lock" on predictions for update using (auth.uid() = user_id);

create policy "season_predictions: read own" on season_predictions for select using (auth.uid() = user_id);
create policy "season_predictions: write own" on season_predictions for all using (auth.uid() = user_id);

create policy "favorite_teams: read own" on favorite_teams for select using (auth.uid() = user_id);
create policy "favorite_teams: write own" on favorite_teams for all using (auth.uid() = user_id);

create policy "pepites: read own" on pepites for select using (auth.uid() = user_id);
create policy "pepites: write own" on pepites for all using (auth.uid() = user_id);

create policy "bonus_cards: read own" on bonus_cards for select using (auth.uid() = user_id);

create policy "streak_counters: read own" on streak_counters for select using (auth.uid() = user_id);

create policy "grilled_states: read own" on grilled_states for select using (auth.uid() = user_id);

create policy "leagues: read all" on leagues for select using (true);
create policy "leagues: insert own" on leagues for insert with check (auth.uid() = owner_id);

create policy "league_memberships: read all" on league_memberships for select using (true);
create policy "league_memberships: join self" on league_memberships for insert with check (auth.uid() = user_id);

create policy "score_ledger: read own" on score_ledger for select using (auth.uid() = user_id);

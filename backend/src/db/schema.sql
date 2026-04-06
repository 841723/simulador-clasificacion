-- ============================================================
-- Simulador de Clasificación - Database Schema
-- ============================================================

-- Leagues (e.g., LaLiga 2, Primera División)
CREATE TABLE IF NOT EXISTS leagues (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  country     VARCHAR(50),
  external_id INTEGER                    -- e.g. SofaScore uniqueTournament id
);

-- Seasons (e.g., 2024-25 for LaLiga 2)
CREATE TABLE IF NOT EXISTS seasons (
  id          SERIAL PRIMARY KEY,
  league_id   INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  year        VARCHAR(10) NOT NULL,   -- e.g. "2024-25"
  name        VARCHAR(100),
  external_id INTEGER,                -- e.g. SofaScore season id
  UNIQUE (league_id, year)
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  slug         VARCHAR(80)  NOT NULL UNIQUE,
  image_url    TEXT,
  external_id  INTEGER               -- e.g. SofaScore team id
);

-- Which teams participate in which season
CREATE TABLE IF NOT EXISTS season_teams (
  season_id  INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id    INTEGER NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
  PRIMARY KEY (season_id, team_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id              INTEGER PRIMARY KEY,   -- SofaScore event id
  season_id       INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  home_team_id    INTEGER NOT NULL REFERENCES teams(id),
  away_team_id    INTEGER NOT NULL REFERENCES teams(id),
  jornada         INTEGER NOT NULL,
  start_timestamp BIGINT,
  home_score      INTEGER,
  away_score      INTEGER,
  status          VARCHAR(50),
  winner_code     VARCHAR(10),           -- 'home' | 'away' | 'draw'
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
  locked_result   VARCHAR(10),           -- "1-3" style string when locked
  prob_home       NUMERIC(6,4),
  prob_draw       NUMERIC(6,4),
  prob_away       NUMERIC(6,4)
);

-- Base standings snapshot (taken at the start of the simulation window)
CREATE TABLE IF NOT EXISTS base_standings (
  id              SERIAL PRIMARY KEY,
  season_id       INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  team_id         INTEGER NOT NULL REFERENCES teams(id),
  position        INTEGER NOT NULL,
  played          INTEGER NOT NULL DEFAULT 0,
  wins            INTEGER NOT NULL DEFAULT 0,
  draws           INTEGER NOT NULL DEFAULT 0,
  losses          INTEGER NOT NULL DEFAULT 0,
  goals_for       INTEGER NOT NULL DEFAULT 0,
  goals_against   INTEGER NOT NULL DEFAULT 0,
  points          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (season_id, team_id)
);

-- Saved simulations
CREATE TABLE IF NOT EXISTS simulations (
  id         SERIAL PRIMARY KEY,
  uuid       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  season_id  INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-match results stored for each simulation
CREATE TABLE IF NOT EXISTS simulation_results (
  id             SERIAL PRIMARY KEY,
  simulation_id  INTEGER NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  match_id       INTEGER NOT NULL REFERENCES matches(id)     ON DELETE CASCADE,
  result         VARCHAR(2) NOT NULL,  -- '1' | 'X' | '2'
  home_score     INTEGER,
  away_score     INTEGER,
  UNIQUE (simulation_id, match_id)
);

-- Probability sources (e.g., betting odds, equal weights)
CREATE TABLE IF NOT EXISTS probability_sources (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT
);

-- Per-match probabilities keyed by source
CREATE TABLE IF NOT EXISTS match_probabilities (
  id          SERIAL PRIMARY KEY,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  source_id   INTEGER NOT NULL REFERENCES probability_sources(id) ON DELETE CASCADE,
  prob_home   NUMERIC(6,4) NOT NULL,
  prob_draw   NUMERIC(6,4) NOT NULL,
  prob_away   NUMERIC(6,4) NOT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (match_id, source_id)
);

-- Idempotent column additions for existing databases
ALTER TABLE leagues  ADD COLUMN IF NOT EXISTS external_id INTEGER;
ALTER TABLE seasons  ADD COLUMN IF NOT EXISTS external_id INTEGER;

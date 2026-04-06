/**
 * Seed the database from the existing JSON static files.
 *
 * Run once after migrations:
 *   node src/scripts/seed.js
 *
 * The script is idempotent: running it multiple times won't duplicate data
 * because every INSERT uses ON CONFLICT DO NOTHING / DO UPDATE.
 *
 * Strategy (all 42 jornadas):
 *  - base_standings is seeded with zeros (all stats start at 0).
 *  - All 42 jornadas are loaded as matches.
 *  - Finished matches are locked with their actual score.
 *  - Unfinished matches are unlocked (pronostico only, user simulates).
 *  - calculateProjectedStandings on the client applies ALL matches from scratch.
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import pool from '../db/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../../../public'); // /repo-root/public

const ALL_JORNADAS = Array.from({ length: 42 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Returns "H-A" string for a finished match, or null if not finished. */
function lockedScoreFromEvent(e) {
  if (e.status?.type !== 'finished') return null;
  const h = e.homeScore?.current;
  const a = e.awayScore?.current;
  if (h == null || a == null) return null;
  return `${h}-${a}`;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Build slug→name map from ALL jornada data ───────────────────────
    const slugToName = {}; // slug → human-readable name
    for (const j of ALL_JORNADAS) {
      const data = readJSON(join(PUBLIC_DIR, 'jornadas', `${j}.json`));
      for (const e of data.events) {
        slugToName[e.homeTeam.slug] = e.homeTeam.name;
        slugToName[e.awayTeam.slug] = e.awayTeam.name;
      }
    }

    // ── 2. Extract league/season external IDs from jornada 1 ──────────────
    const j1data = readJSON(join(PUBLIC_DIR, 'jornadas', '1.json'));
    const sampleEvent = j1data.events[0];
    const leagueExtId = sampleEvent.tournament?.uniqueTournament?.id ?? null;
    const seasonExtId = sampleEvent.season?.id ?? null;
    const leagueName = sampleEvent.tournament?.uniqueTournament?.name ?? 'LaLiga 2';
    const seasonName = sampleEvent.season?.name ?? 'LaLiga 2 25/26';
    const seasonYear = sampleEvent.season?.year ?? '25/26';

    // ── 3. League ──────────────────────────────────────────────────────────
    const leagueRes = await client.query(
      `INSERT INTO leagues (name, slug, country, external_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE
         SET name        = EXCLUDED.name,
             external_id = EXCLUDED.external_id
       RETURNING id`,
      [leagueName, 'laliga2', 'Spain', leagueExtId],
    );
    const leagueId = leagueRes.rows[0].id;
    console.log(`League id: ${leagueId} (external: ${leagueExtId})`);

    // ── 4. Season ──────────────────────────────────────────────────────────
    const seasonRes = await client.query(
      `INSERT INTO seasons (league_id, year, name, external_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (league_id, year) DO UPDATE
         SET name        = EXCLUDED.name,
             external_id = EXCLUDED.external_id
       RETURNING id`,
      [leagueId, seasonYear, seasonName, seasonExtId],
    );
    const seasonId = seasonRes.rows[0].id;
    console.log(`Season id: ${seasonId} (external: ${seasonExtId})`);

    // ── 5. Teams ───────────────────────────────────────────────────────────
    const teamsData = readJSON(join(PUBLIC_DIR, 'teams.json'));
    const teamIdBySlug = {};

    for (const [slug, info] of Object.entries(teamsData)) {
      const imageUrl = info.imagen ?? null;
      const externalId = info.id ?? null;
      const name = slugToName[slug] || slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const res = await client.query(
        `INSERT INTO teams (name, slug, image_url, external_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE
           SET image_url   = EXCLUDED.image_url,
               external_id = EXCLUDED.external_id,
               name        = EXCLUDED.name
         RETURNING id`,
        [name, slug, imageUrl, externalId],
      );
      teamIdBySlug[slug] = res.rows[0].id;

      await client.query(
        `INSERT INTO season_teams (season_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [seasonId, res.rows[0].id],
      );
    }
    console.log(`Upserted ${Object.keys(teamsData).length} teams`);

    // ── 6. Ensure all teams from all jornadas exist ────────────────────────
    for (const j of ALL_JORNADAS) {
      const data = readJSON(join(PUBLIC_DIR, 'jornadas', `${j}.json`));
      for (const e of data.events) {
        for (const teamInfo of [e.homeTeam, e.awayTeam]) {
          if (!teamIdBySlug[teamInfo.slug]) {
            const res = await client.query(
              `INSERT INTO teams (name, slug)
               VALUES ($1, $2)
               ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
               RETURNING id`,
              [teamInfo.name, teamInfo.slug],
            );
            teamIdBySlug[teamInfo.slug] = res.rows[0].id;
            await client.query(
              `INSERT INTO season_teams (season_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [seasonId, res.rows[0].id],
            );
          }
        }
      }
    }

    // ── 7. Load pronosticos from resultados.json ───────────────────────────
    // resultados.json only covers jornadas 34-42 (simulation window)
    const resultados = readJSON(join(PUBLIC_DIR, 'resultados.json'));
    const pronosticosById = {};
    for (const jornadaMatches of Object.values(resultados)) {
      for (const match of Object.values(jornadaMatches)) {
        if (match.pronostico) {
          pronosticosById[match.id] = match.pronostico;
        }
      }
    }

    // ── 8. Matches (all 42 jornadas) ──────────────────────────────────────
    // Lock strategy: a match is locked if its status is 'finished'.
    // The actual score from the JSON is used as the locked result.
    let matchCount = 0;
    for (const j of ALL_JORNADAS) {
      const data = readJSON(join(PUBLIC_DIR, 'jornadas', `${j}.json`));
      for (const e of data.events) {
        const homeTeamId = teamIdBySlug[e.homeTeam.slug];
        const awayTeamId = teamIdBySlug[e.awayTeam.slug];

        if (!homeTeamId || !awayTeamId) {
          console.warn(`  Skipping match ${e.id}: team not found`);
          continue;
        }

        const lockedResult = lockedScoreFromEvent(e);
        const isLocked = lockedResult !== null;

        let homeScore = null;
        let awayScore = null;
        if (isLocked) {
          const parts = lockedResult.split('-');
          homeScore = parseInt(parts[0], 10);
          awayScore = parseInt(parts[1], 10);
        }

        const pronos = pronosticosById[e.id] ?? null;
        const probHome = pronos?.local ?? null;
        const probDraw = pronos?.empate ?? null;
        const probAway = pronos?.visitante ?? null;

        await client.query(
          `INSERT INTO matches
             (id, season_id, home_team_id, away_team_id, jornada, start_timestamp,
              home_score, away_score, status, winner_code, is_locked, locked_result,
              prob_home, prob_draw, prob_away)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO UPDATE SET
             is_locked     = EXCLUDED.is_locked,
             locked_result = EXCLUDED.locked_result,
             home_score    = EXCLUDED.home_score,
             away_score    = EXCLUDED.away_score,
             status        = EXCLUDED.status,
             winner_code   = EXCLUDED.winner_code,
             prob_home     = EXCLUDED.prob_home,
             prob_draw     = EXCLUDED.prob_draw,
             prob_away     = EXCLUDED.prob_away`,
          [
            e.id,
            seasonId,
            homeTeamId,
            awayTeamId,
            j,
            e.startTimestamp ?? null,
            homeScore,
            awayScore,
            e.status?.description ?? null,
            e.winnerCode ?? null,
            isLocked,
            lockedResult,
            probHome,
            probDraw,
            probAway,
          ],
        );
        matchCount++;
      }
    }
    console.log(`Upserted ${matchCount} matches`);

    // ── 9. Base standings (zeros) ──────────────────────────────────────────
    // The client calculates standings from scratch by applying all match results,
    // so base_standings represents the start of season (everything at 0).
    let standingsCount = 0;
    let position = 1;
    for (const [slug, teamId] of Object.entries(teamIdBySlug)) {
      await client.query(
        `INSERT INTO base_standings
           (season_id, team_id, position, played, wins, draws, losses, goals_for, goals_against, points)
         VALUES ($1,$2,$3,0,0,0,0,0,0,0)
         ON CONFLICT (season_id, team_id) DO UPDATE SET
           position      = EXCLUDED.position,
           played        = 0,
           wins          = 0,
           draws         = 0,
           losses        = 0,
           goals_for     = 0,
           goals_against = 0,
           points        = 0`,
        [seasonId, teamId, position++],
      );
      standingsCount++;
    }
    console.log(`Upserted ${standingsCount} base standings rows (all zeros)`);

    await client.query('COMMIT');
    console.log('Seed completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

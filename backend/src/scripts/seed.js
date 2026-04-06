/**
 * Seed the database from the existing JSON static files.
 *
 * Run once after migrations:
 *   node src/scripts/seed.js
 *
 * The script is idempotent: running it multiple times won't duplicate data
 * because every INSERT uses ON CONFLICT DO NOTHING / DO UPDATE.
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import pool from '../db/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '../../../public'); // /repo-root/public

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Build slug→name map from jornada data (most accurate source) ───
    const JORNADAS = [34, 35, 36, 37, 38, 39, 40, 41, 42];
    const slugToName = {}; // slug → human-readable name
    for (const j of JORNADAS) {
      const data = readJSON(join(PUBLIC_DIR, 'jornadas', `${j}.json`));
      for (const e of data.events) {
        slugToName[e.homeTeam.slug] = e.homeTeam.name;
        slugToName[e.awayTeam.slug] = e.awayTeam.name;
      }
    }

    // ── 2. League ──────────────────────────────────────────────────────────
    const leagueRes = await client.query(
      `INSERT INTO leagues (name, slug, country)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['LaLiga 2', 'laliga2', 'Spain'],
    );
    const leagueId = leagueRes.rows[0].id;
    console.log(`League id: ${leagueId}`);

    // ── 3. Season ──────────────────────────────────────────────────────────
    const seasonRes = await client.query(
      `INSERT INTO seasons (league_id, year, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (league_id, year) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [leagueId, '2024-25', 'LaLiga 2 2024-25'],
    );
    const seasonId = seasonRes.rows[0].id;
    console.log(`Season id: ${seasonId}`);

    // ── 4. Teams ───────────────────────────────────────────────────────────
    const teamsData = readJSON(join(PUBLIC_DIR, 'teams.json'));
    const teamIdBySlug = {};

    for (const [slug, info] of Object.entries(teamsData)) {
      const imageUrl = info.imagen ?? null;
      const externalId = info.id ?? null;
      // Use the name from jornada data if available, else fall back to slug
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

      // Link team to season
      await client.query(
        `INSERT INTO season_teams (season_id, team_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [seasonId, res.rows[0].id],
      );
    }
    console.log(`Upserted ${Object.keys(teamsData).length} teams`);

    // ── 5. Ensure all teams from jornada data exist ────────────────────────
    for (const j of JORNADAS) {
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

    // ── 6. Matches ─────────────────────────────────────────────────────────
    // Load resultados for locked status + pronosticos
    const resultados = readJSON(join(PUBLIC_DIR, 'resultados.json'));
    const resultadosById = {};
    for (const jornadaMatches of Object.values(resultados)) {
      for (const match of Object.values(jornadaMatches)) {
        resultadosById[match.id] = {
          resultado: match.resultado || '',
          pronostico: match.pronostico || null,
        };
      }
    }

    let matchCount = 0;
    for (const j of JORNADAS) {
      const data = readJSON(join(PUBLIC_DIR, 'jornadas', `${j}.json`));
      for (const e of data.events) {
        const homeTeamId = teamIdBySlug[e.homeTeam.slug];
        const awayTeamId = teamIdBySlug[e.awayTeam.slug];

        if (!homeTeamId || !awayTeamId) {
          console.warn(`  Skipping match ${e.id}: team not found`);
          continue;
        }

        const res = resultadosById[e.id] || { resultado: '', pronostico: null };
        const isLocked = res.resultado !== '';
        const lockedResult = isLocked ? res.resultado : null;
        let homeScore = null;
        let awayScore = null;
        if (isLocked) {
          const parts = res.resultado.split('-');
          homeScore = parseInt(parts[0], 10);
          awayScore = parseInt(parts[1], 10);
        } else {
          homeScore = e.homeScore?.current ?? null;
          awayScore = e.awayScore?.current ?? null;
        }

        const probHome = res.pronostico?.local ?? null;
        const probDraw = res.pronostico?.empate ?? null;
        const probAway = res.pronostico?.visitante ?? null;

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

    // ── 7. Base standings ──────────────────────────────────────────────────
    const standingsFile = join(PUBLIC_DIR, 'standings', '2026-04-04-16-55.json');
    const standingsData = readJSON(standingsFile);
    const rows = standingsData.standings[0].rows;
    let standingsCount = 0;

    for (const row of rows) {
      const slug = row.team.slug;
      let teamId = teamIdBySlug[slug];
      if (!teamId) {
        const createRes = await client.query(
          `INSERT INTO teams (name, slug) VALUES ($1, $2)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [row.team.name, slug],
        );
        teamId = createRes.rows[0].id;
        teamIdBySlug[slug] = teamId;
        await client.query(
          `INSERT INTO season_teams (season_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [seasonId, teamId],
        );
      }

      await client.query(
        `INSERT INTO base_standings
           (season_id, team_id, position, played, wins, draws, losses, goals_for, goals_against, points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (season_id, team_id) DO UPDATE SET
           position      = EXCLUDED.position,
           played        = EXCLUDED.played,
           wins          = EXCLUDED.wins,
           draws         = EXCLUDED.draws,
           losses        = EXCLUDED.losses,
           goals_for     = EXCLUDED.goals_for,
           goals_against = EXCLUDED.goals_against,
           points        = EXCLUDED.points`,
        [
          seasonId,
          teamId,
          row.position,
          row.played || 0,
          row.wins,
          row.draws,
          row.losses,
          row.scoresFor,
          row.scoresAgainst,
          row.points,
        ],
      );
      standingsCount++;
    }
    console.log(`Upserted ${standingsCount} base standings rows`);

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

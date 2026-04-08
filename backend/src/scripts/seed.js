/**
 * Minimal seed script – ensures the league, season, and probability_sources rows
 * exist so the app can start.
 *
 * Run once after migrations:
 *   node src/scripts/seed.js
 *
 * The script is idempotent: running it multiple times won't duplicate data
 * because every INSERT uses ON CONFLICT DO NOTHING / DO UPDATE.
 *
 * After seeding, run the scraper to populate teams, matches, and standings:
 *   python sofascore_scrapper/sofascore.py --init-teams
 */

import 'dotenv/config';
import pool from '../db/connection.js';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. League ──────────────────────────────────────────────────────────
    const leagueRes = await client.query(
      `INSERT INTO leagues (name, slug, country, external_id)
       VALUES ('LaLiga 2', 'laliga2', 'Spain', 54)
       ON CONFLICT (slug) DO UPDATE
         SET name        = EXCLUDED.name,
             external_id = EXCLUDED.external_id
       RETURNING id`,
    );
    const leagueId = leagueRes.rows[0].id;
    console.log(`League id: ${leagueId}`);

    // ── 2. Season ──────────────────────────────────────────────────────────
    const seasonRes = await client.query(
      `INSERT INTO seasons (league_id, year, name, external_id)
       VALUES ($1, '25/26', 'LaLiga 2 25/26', 77558)
       ON CONFLICT (league_id, year) DO UPDATE
         SET name        = EXCLUDED.name,
             external_id = EXCLUDED.external_id
       RETURNING id`,
      [leagueId],
    );
    const seasonId = seasonRes.rows[0].id;
    console.log(`Season id: ${seasonId}`);

    // ── 3. Probability source ──────────────────────────────────────────────
    await client.query(
      `INSERT INTO probability_sources (slug, name, description)
       VALUES ('odds', 'Cuotas de casas de apuestas',
         'Probabilidades calculadas a partir de las cuotas ofrecidas por las casas de apuestas, normalizadas para eliminar el margen del bookmaker.')
       ON CONFLICT (slug) DO UPDATE
         SET name        = EXCLUDED.name,
             description = EXCLUDED.description`,
    );
    console.log('Upserted probability_sources');

    // ── 4. Zero base_standings (only if teams already exist for this season) ──
    // Run the scraper (sofascore.py --init-teams) to populate teams, matches,
    // and standings before or after this step.
    const teamsRes = await client.query(
      `SELECT team_id FROM season_teams WHERE season_id = $1`,
      [seasonId],
    );
    if (teamsRes.rows.length > 0) {
      let position = 1;
      for (const { team_id } of teamsRes.rows) {
        await client.query(
          `INSERT INTO base_standings
             (season_id, team_id, position, played, wins, draws, losses, goals_for, goals_against, points)
           VALUES ($1, $2, $3, 0, 0, 0, 0, 0, 0, 0)
           ON CONFLICT (season_id, team_id) DO NOTHING`,
          [seasonId, team_id, position++],
        );
      }
      console.log(`Upserted ${teamsRes.rows.length} base standings rows (all zeros)`);
    } else {
      console.log('No teams found for this season — run the scraper to populate teams.');
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully.');
    console.log('');
    console.log('Next step: run the scraper to populate teams, matches, and standings:');
    console.log('  cd sofascore_scrapper && python sofascore.py --init-teams');
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

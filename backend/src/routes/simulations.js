import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/simulations?seasonId=X - list all simulations (no results payload)
router.get('/', async (req, res, next) => {
  try {
    const { seasonId } = req.query;
    const { rows } = await pool.query(
      `SELECT
         uuid,
         name,
         season_id  AS "seasonId",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM simulations
       ${seasonId ? 'WHERE season_id = $1' : ''}
       ORDER BY updated_at DESC`,
      seasonId ? [seasonId] : [],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/simulations/:uuid - get simulation with results
router.get('/:uuid', async (req, res, next) => {
  try {
    const simRes = await pool.query(
      `SELECT id, uuid, name, season_id AS "seasonId", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM simulations WHERE uuid = $1`,
      [req.params.uuid],
    );
    if (!simRes.rows.length) return res.status(404).json({ error: 'Simulation not found' });

    const sim = simRes.rows[0];

    const { rows: resultRows } = await pool.query(
      `SELECT match_id AS "matchId", result, home_score AS "homeScore", away_score AS "awayScore"
       FROM simulation_results WHERE simulation_id = $1`,
      [sim.id],
    );

    // Build results and scores maps
    const results = {};
    const scores = {};
    for (const r of resultRows) {
      results[r.matchId] = r.result;
      scores[r.matchId] = { home: r.homeScore, away: r.awayScore };
    }

    res.json({ ...sim, results, scores });
  } catch (err) {
    next(err);
  }
});

// POST /api/simulations - create or update simulation
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, seasonId, results = {}, scores = {}, uuid: existingUuid } = req.body;

    if (!name || !seasonId) {
      return res.status(400).json({ error: 'name and seasonId are required' });
    }

    await client.query('BEGIN');

    let simId;
    let uuid;

    if (existingUuid) {
      // Update existing simulation
      const simRes = await client.query(
        `UPDATE simulations SET name = $1, updated_at = NOW()
         WHERE uuid = $2
         RETURNING id, uuid`,
        [name, existingUuid],
      );
      if (!simRes.rows.length) return res.status(404).json({ error: 'Simulation not found' });
      simId = simRes.rows[0].id;
      uuid = simRes.rows[0].uuid;

      // Delete old results
      await client.query('DELETE FROM simulation_results WHERE simulation_id = $1', [simId]);
    } else {
      // Create new simulation
      const simRes = await client.query(
        `INSERT INTO simulations (name, season_id) VALUES ($1, $2) RETURNING id, uuid`,
        [name, seasonId],
      );
      simId = simRes.rows[0].id;
      uuid = simRes.rows[0].uuid;
    }

    // Insert result rows
    for (const [matchIdStr, result] of Object.entries(results)) {
      const matchId = parseInt(matchIdStr, 10);
      const score = scores[matchIdStr] || scores[matchId] || { home: 0, away: 0 };
      await client.query(
        `INSERT INTO simulation_results (simulation_id, match_id, result, home_score, away_score)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (simulation_id, match_id) DO UPDATE
           SET result = EXCLUDED.result, home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score`,
        [simId, matchId, result, score.home ?? 0, score.away ?? 0],
      );
    }

    await client.query('COMMIT');
    res.status(existingUuid ? 200 : 201).json({ uuid, name, seasonId });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/simulations/:uuid
router.delete('/:uuid', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM simulations WHERE uuid = $1`,
      [req.params.uuid],
    );
    if (!rowCount) return res.status(404).json({ error: 'Simulation not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

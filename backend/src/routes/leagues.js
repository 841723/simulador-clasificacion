import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/leagues - list all leagues
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, country FROM leagues ORDER BY name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/:slug/zones – zone config for a league
router.get('/:slug/zones', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT key, label, color, text_color AS "textColor", border_color AS "borderColor",
              min_pos AS "minPos", max_pos AS "maxPos", sort_order AS "sortOrder"
       FROM league_zones
       WHERE league_slug = $1
       ORDER BY sort_order`,
      [req.params.slug],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/:id/seasons
router.get('/:id/seasons', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, league_id AS "leagueId", year, name
       FROM seasons WHERE league_id = $1 ORDER BY year DESC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;

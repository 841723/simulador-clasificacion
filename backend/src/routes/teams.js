import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/teams - list all teams
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, image_url AS "imageUrl", external_id AS "externalId"
       FROM teams
       ORDER BY name`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/teams/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, image_url AS "imageUrl", external_id AS "externalId"
       FROM teams WHERE id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Team not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

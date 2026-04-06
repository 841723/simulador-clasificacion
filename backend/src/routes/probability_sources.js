import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/probability-sources
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, name, description FROM probability_sources ORDER BY id`,
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;

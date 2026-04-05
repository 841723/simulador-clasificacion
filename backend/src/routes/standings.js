import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router({ mergeParams: true });

// GET /api/seasons/:seasonId/standings
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         bs.position,
         bs.played,
         bs.wins,
         bs.draws,
         bs.losses,
         bs.goals_for       AS "scoresFor",
         bs.goals_against   AS "scoresAgainst",
         bs.points,
         t.name             AS "teamName",
         t.slug             AS "teamSlug",
         t.image_url        AS "teamImageUrl"
       FROM base_standings bs
       JOIN teams t ON t.id = bs.team_id
       WHERE bs.season_id = $1
       ORDER BY bs.position`,
      [req.params.seasonId],
    );

    // Shape to match the format that calculateProjectedStandings() expects
    const standings = rows.map((r) => ({
      position: r.position,
      played: r.played,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      scoresFor: r.scoresFor,
      scoresAgainst: r.scoresAgainst,
      points: r.points,
      team: {
        name: r.teamName,
        slug: r.teamSlug,
        imageUrl: r.teamImageUrl,
      },
    }));

    res.json(standings);
  } catch (err) {
    next(err);
  }
});

export default router;

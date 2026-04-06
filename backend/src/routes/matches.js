import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router({ mergeParams: true });

// GET /api/seasons/:seasonId/matches
router.get('/', async (req, res, next) => {
  try {
    const { sourceSlug } = req.query;

    let rows;
    if (sourceSlug) {
      // JOIN with match_probabilities filtered by the requested source slug
      const result = await pool.query(
        `SELECT
           m.id,
           m.jornada,
           m.start_timestamp        AS "startTimestamp",
           m.home_score             AS "homeScore",
           m.away_score             AS "awayScore",
           m.status,
           m.winner_code            AS "winnerCode",
           m.is_locked              AS "isLocked",
           m.locked_result          AS "lockedResult",
           COALESCE(mp.prob_home, m.prob_home) AS "probHome",
           COALESCE(mp.prob_draw, m.prob_draw) AS "probDraw",
           COALESCE(mp.prob_away, m.prob_away) AS "probAway",
           ht.name                  AS "homeTeamName",
           ht.slug                  AS "homeTeamSlug",
           ht.image_url             AS "homeTeamImageUrl",
           at.name                  AS "awayTeamName",
           at.slug                  AS "awayTeamSlug",
           at.image_url             AS "awayTeamImageUrl"
         FROM matches m
         JOIN teams ht ON ht.id = m.home_team_id
         JOIN teams at ON at.id = m.away_team_id
         LEFT JOIN match_probabilities mp
           ON mp.match_id = m.id
          AND mp.source_id = (SELECT id FROM probability_sources WHERE slug = $2)
         WHERE m.season_id = $1
         ORDER BY m.jornada, m.start_timestamp`,
        [req.params.seasonId, sourceSlug],
      );
      rows = result.rows;
    } else {
      // Default: use matches.prob_home/draw/away for backwards compat
      const result = await pool.query(
        `SELECT
           m.id,
           m.jornada,
           m.start_timestamp        AS "startTimestamp",
           m.home_score             AS "homeScore",
           m.away_score             AS "awayScore",
           m.status,
           m.winner_code            AS "winnerCode",
           m.is_locked              AS "isLocked",
           m.locked_result          AS "lockedResult",
           m.prob_home              AS "probHome",
           m.prob_draw              AS "probDraw",
           m.prob_away              AS "probAway",
           ht.name                  AS "homeTeamName",
           ht.slug                  AS "homeTeamSlug",
           ht.image_url             AS "homeTeamImageUrl",
           at.name                  AS "awayTeamName",
           at.slug                  AS "awayTeamSlug",
           at.image_url             AS "awayTeamImageUrl"
         FROM matches m
         JOIN teams ht ON ht.id = m.home_team_id
         JOIN teams at ON at.id = m.away_team_id
         WHERE m.season_id = $1
         ORDER BY m.jornada, m.start_timestamp`,
        [req.params.seasonId],
      );
      rows = result.rows;
    }

    // Shape the response to match the format the frontend expects
    const matches = rows.map((r) => ({
      id: r.id,
      jornada: r.jornada,
      startTimestamp: r.startTimestamp,
      homeTeam: r.homeTeamName,
      homeTeamSlug: r.homeTeamSlug,
      homeTeamImageUrl: r.homeTeamImageUrl,
      awayTeam: r.awayTeamName,
      awayTeamSlug: r.awayTeamSlug,
      awayTeamImageUrl: r.awayTeamImageUrl,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      status: r.status,
      winnerCode: r.winnerCode,
      isLocked: r.isLocked,
      lockedResult: r.lockedResult,
      pronostico:
        r.probHome !== null
          ? {
              local: parseFloat(r.probHome),
              empate: parseFloat(r.probDraw),
              visitante: parseFloat(r.probAway),
            }
          : null,
    }));

    res.json(matches);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/seasons/:seasonId/matches/:matchId - update result (admin use)
router.patch('/:matchId', async (req, res, next) => {
  try {
    const { isLocked, lockedResult, homeScore, awayScore, probHome, probDraw, probAway } =
      req.body;

    const { rows } = await pool.query(
      `UPDATE matches SET
         is_locked     = COALESCE($1, is_locked),
         locked_result = COALESCE($2, locked_result),
         home_score    = COALESCE($3, home_score),
         away_score    = COALESCE($4, away_score),
         prob_home     = COALESCE($5, prob_home),
         prob_draw     = COALESCE($6, prob_draw),
         prob_away     = COALESCE($7, prob_away)
       WHERE id = $8 AND season_id = $9
       RETURNING id`,
      [
        isLocked ?? null,
        lockedResult ?? null,
        homeScore ?? null,
        awayScore ?? null,
        probHome ?? null,
        probDraw ?? null,
        probAway ?? null,
        req.params.matchId,
        req.params.seasonId,
      ],
    );

    if (!rows.length) return res.status(404).json({ error: 'Match not found' });
    res.json({ updated: true, id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

export default router;

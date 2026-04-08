/**
 * Route: GET /api/standings/:leagueSlug/:seasonYear/:jornada
 *
 * Returns standings computed by applying all locked match results
 * (up to and including :jornada) on top of the base standings stored in DB.
 *
 * :leagueSlug  – e.g. "laliga2"
 * :seasonYear  – URL year, e.g. "24-25" (DB stores as "24/25")
 * :jornada     – integer jornada number
 */
import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

/**
 * Converts a "homeGoals-awayGoals" locked result string to a result code.
 * Returns '1' (home win), 'X' (draw), or '2' (away win). Returns null on invalid input.
 */
function parseLockedResult(lockedResult) {
  if (!lockedResult) return null;
  const parts = lockedResult.split('-');
  if (parts.length !== 2) return null;
  const home = parseInt(parts[0], 10);
  const away = parseInt(parts[1], 10);
  if (isNaN(home) || isNaN(away)) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
}

router.get('/:leagueSlug/:seasonYear/:jornada', async (req, res, next) => {
  try {
    const { leagueSlug, seasonYear } = req.params;
    const jornada = parseInt(req.params.jornada, 10);

    if (isNaN(jornada) || jornada < 1) {
      return res.status(400).json({ error: 'Invalid jornada parameter: must be a positive integer' });
    }

    // URL year "24-25" → DB year "24/25"
    const yearNormalized = seasonYear.replace(/-/g, '/');

    // Resolve season
    const seasonRes = await pool.query(
      `SELECT s.id
       FROM seasons s
       JOIN leagues l ON l.id = s.league_id
       WHERE l.slug = $1 AND s.year = $2
       LIMIT 1`,
      [leagueSlug, yearNormalized],
    );

    if (!seasonRes.rows.length) {
      return res.status(404).json({ error: 'Season not found' });
    }
    const seasonId = seasonRes.rows[0].id;

    // Fetch base standings and locked matches up to jornada in parallel
    const [baseRes, matchesRes] = await Promise.all([
      pool.query(
        `SELECT
           bs.position,
           bs.played,
           bs.wins,
           bs.draws,
           bs.losses,
           bs.goals_for       AS "goalsFor",
           bs.goals_against   AS "goalsAgainst",
           bs.points,
           t.name             AS "teamName",
           t.slug             AS "teamSlug",
           t.image_url        AS "teamImageUrl"
         FROM base_standings bs
         JOIN teams t ON t.id = bs.team_id
         WHERE bs.season_id = $1
         ORDER BY bs.position`,
        [seasonId],
      ),
      pool.query(
        `SELECT
           m.id,
           m.locked_result    AS "lockedResult",
           ht.name            AS "homeTeam",
           at.name            AS "awayTeam"
         FROM matches m
         JOIN teams ht ON ht.id = m.home_team_id
         JOIN teams at ON at.id = m.away_team_id
         WHERE m.season_id = $1
           AND m.jornada <= $2
           AND m.is_locked = true
           AND m.locked_result IS NOT NULL
         ORDER BY m.jornada, m.start_timestamp`,
        [seasonId, jornada],
      ),
    ]);

    // Build mutable standings map keyed by team name
    const map = {};
    for (const r of baseRes.rows) {
      map[r.teamName] = {
        position: r.position,
        team: { name: r.teamName, slug: r.teamSlug, imageUrl: r.teamImageUrl },
        played: r.played,
        wins: r.wins,
        draws: r.draws,
        losses: r.losses,
        scoresFor: r.goalsFor,
        scoresAgainst: r.goalsAgainst,
        points: r.points,
      };
    }

    // Apply each locked match result to accumulate stats
    for (const m of matchesRes.rows) {
      const resultCode = parseLockedResult(m.lockedResult);
      if (!resultCode) continue;

      const home = map[m.homeTeam];
      const away = map[m.awayTeam];
      if (!home || !away) continue;

      const [homeGoals, awayGoals] = m.lockedResult.split('-').map(Number);

      home.played += 1;
      away.played += 1;
      home.scoresFor += homeGoals;
      home.scoresAgainst += awayGoals;
      away.scoresFor += awayGoals;
      away.scoresAgainst += homeGoals;

      if (resultCode === '1') {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (resultCode === '2') {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        // Draw
        home.draws += 1;
        home.points += 1;
        away.draws += 1;
        away.points += 1;
      }
    }

    // Sort: points desc → goal diff desc → goals for desc → name asc
    const standings = Object.values(map);
    standings.sort((a, b) => {
      const ptsDiff = b.points - a.points;
      if (ptsDiff !== 0) return ptsDiff;
      const gdA = a.scoresFor - a.scoresAgainst;
      const gdB = b.scoresFor - b.scoresAgainst;
      if (gdB !== gdA) return gdB - gdA;
      if (b.scoresFor !== a.scoresFor) return b.scoresFor - a.scoresFor;
      return a.team.name.localeCompare(b.team.name);
    });

    res.json(standings.map((r, i) => ({ ...r, position: i + 1 })));
  } catch (err) {
    next(err);
  }
});

export default router;

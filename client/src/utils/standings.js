/**
 * Parse a "home-away" score string to { home, away } numbers.
 */
export function parseScore(resultado) {
  if (!resultado) return { home: 0, away: 0 };
  const parts = resultado.split('-');
  if (parts.length !== 2) return { home: 0, away: 0 };
  return {
    home: parseInt(parts[0], 10) || 0,
    away: parseInt(parts[1], 10) || 0,
  };
}

/**
 * Returns the default score { home, away } for a given 1/X/2 result.
 * '1' → 1-0, 'X' → 0-0, '2' → 0-1
 */
export function defaultScoreForResult(result) {
  if (result === '1') return { home: 1, away: 0 };
  if (result === '2') return { home: 0, away: 1 };
  return { home: 0, away: 0 };
}

/**
 * Builds the initial scores map from locked and unlocked matches.
 */
export function buildInitialScores(allMatches, results, lockedMatchIds) {
  const scores = {};
  for (const match of allMatches) {
    if (lockedMatchIds[match.id] !== undefined) {
      scores[match.id] = parseScore(lockedMatchIds[match.id]);
    } else {
      scores[match.id] = defaultScoreForResult(results[match.id]);
    }
  }
  return scores;
}

/**
 * Parse a "home-away" resultado string to a 1/X/2 result code.
 * Returns null if the string is empty or invalid.
 */
export function parseResultado(resultado) {
  if (!resultado) return null;
  const parts = resultado.split('-');
  if (parts.length !== 2) return null;
  const home = parseInt(parts[0], 10);
  const away = parseInt(parts[1], 10);
  if (isNaN(home) || isNaN(away)) return null;
  if (home > away) return '1';
  if (home < away) return '2';
  return 'X';
}

/**
 * Returns true if a match is locked (result cannot be modified).
 * A match is locked when resultados.json has a non-empty resultado for it.
 */
export function isMatchLocked(matchId, lockedMatchIds) {
  return matchId in lockedMatchIds;
}

/**
 * Determines default result for a pending match based on standings positions.
 * Home team higher rank (lower position number) → "1", equal → "X", away higher → "2".
 */
export function getDefaultResult(homeTeam, awayTeam, standings) {
  const homeRow = standings.find((r) => r.team.name === homeTeam);
  const awayRow = standings.find((r) => r.team.name === awayTeam);
  if (!homeRow || !awayRow) return '1';
  if (homeRow.position < awayRow.position) return '1';
  if (homeRow.position > awayRow.position) return '2';
  return 'X';
}

/**
 * Build the initial results map.
 * Locked matches: result derived from resultados.json resultado.
 * Pending matches: default result from standings positions.
 */
export function buildInitialResults(allMatches, standingsRows, lockedMatchIds = {}) {
  const results = {};
  for (const match of allMatches) {
    if (lockedMatchIds[match.id] !== undefined) {
      results[match.id] = parseResultado(lockedMatchIds[match.id]) ?? 'X';
    } else {
      results[match.id] = getDefaultResult(match.homeTeam, match.awayTeam, standingsRows);
    }
  }
  return results;
}

/**
 * Returns true if the match result has been changed from its original/default value.
 */
export function isModified(matchId, state) {
  return state.results[matchId] !== state.originalResults[matchId];
}

/**
 * Calculate projected standings from base standings + simulated match results.
 * Base standings already incorporate locked/played matches.
 * We apply only unlocked (pending) match results on top.
 */
export function calculateProjectedStandings(baseStandingsRows, allMatches, results, lockedMatchIds = {}, scores = {}) {
  // Deep clone base standings into a mutable map
  const map = {};
  for (const row of baseStandingsRows) {
    map[row.team.name] = {
      position: row.position,
      team: row.team,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      scoresFor: row.scoresFor,
      scoresAgainst: row.scoresAgainst,
      points: row.points,
    };
  }

  for (const match of allMatches) {
    // Skip locked matches – already accounted for in baseStandings
    if (isMatchLocked(match.id, lockedMatchIds)) continue;

    const result = results[match.id];
    if (!result) continue;

    const home = map[match.homeTeam];
    const away = map[match.awayTeam];
    if (!home || !away) continue;

    const score = scores[match.id] || { home: 0, away: 0 };

    home.played += 1;
    away.played += 1;

    if (result === '1') {
      home.wins += 1;
      home.points += 3;
      home.scoresFor += score.home;
      home.scoresAgainst += score.away;
      away.losses += 1;
      away.scoresFor += score.away;
      away.scoresAgainst += score.home;
    } else if (result === 'X') {
      home.draws += 1;
      home.points += 1;
      home.scoresFor += score.home;
      home.scoresAgainst += score.away;
      away.draws += 1;
      away.points += 1;
      away.scoresFor += score.away;
      away.scoresAgainst += score.home;
    } else if (result === '2') {
      away.wins += 1;
      away.points += 3;
      away.scoresFor += score.away;
      away.scoresAgainst += score.home;
      home.losses += 1;
      home.scoresFor += score.home;
      home.scoresAgainst += score.away;
    }
  }

  const rows = Object.values(map);

  // Sort: points desc → goal diff desc → goals for desc → team name asc
  rows.sort((a, b) => {
    const ptsDiff = b.points - a.points;
    if (ptsDiff !== 0) return ptsDiff;
    const gdA = a.scoresFor - a.scoresAgainst;
    const gdB = b.scoresFor - b.scoresAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.scoresFor !== a.scoresFor) return b.scoresFor - a.scoresFor;
    return a.team.name.localeCompare(b.team.name);
  });

  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

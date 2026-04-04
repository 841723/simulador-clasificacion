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
 * Calculate projected standings from base standings + simulated match results.
 * Base standings already incorporate locked/played matches.
 * We apply only unlocked (pending) match results on top.
 */
export function calculateProjectedStandings(baseStandingsRows, allMatches, results, lockedMatchIds = {}) {
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

    home.played += 1;
    away.played += 1;

    if (result === '1') {
      home.wins += 1;
      home.points += 3;
      home.scoresFor += 1;
      away.losses += 1;
      away.scoresAgainst += 1;
    } else if (result === 'X') {
      home.draws += 1;
      home.points += 1;
      away.draws += 1;
      away.points += 1;
    } else if (result === '2') {
      away.wins += 1;
      away.points += 3;
      away.scoresFor += 1;
      home.losses += 1;
      home.scoresAgainst += 1;
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

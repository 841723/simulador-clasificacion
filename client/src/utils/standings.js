/**
 * Determines if a match is finished (non-editable).
 */
export function isMatchFinished(status) {
  return status === 'Ended' || status === 'Finished' || status === 'AET' || status === 'AP';
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
 * Build the initial results map from match data.
 * Finished matches: result from actual winnerCode.
 * Pending matches: default result from standings positions.
 */
export function buildInitialResults(allMatches, standingsRows) {
  const results = {};
  for (const match of allMatches) {
    if (isMatchFinished(match.status)) {
      // winnerCode: 1=home, 2=away, 3=draw
      if (match.winnerCode === 1) results[match.id] = '1';
      else if (match.winnerCode === 2) results[match.id] = '2';
      else results[match.id] = 'X';
    } else {
      results[match.id] = getDefaultResult(match.homeTeam, match.awayTeam, standingsRows);
    }
  }
  return results;
}

/**
 * Calculate projected standings from base standings + pending match results.
 * Base standings already incorporate finished matches.
 * We apply only pending (non-finished) match results on top.
 */
export function calculateProjectedStandings(baseStandingsRows, allMatches, results) {
  // Deep clone
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
    if (isMatchFinished(match.status)) continue;
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

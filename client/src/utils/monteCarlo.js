import { calculateProjectedStandings } from './standings.js';

/**
 * Run N Monte Carlo simulations to estimate the probability of each team
 * finishing in each classification zone.
 *
 * @param {Array}  allMatches       - all match objects
 * @param {Array}  baseStandings    - base standings rows
 * @param {Object} lockedMatchIds   - matchId → lockedResult string
 * @param {Object} pronosticos      - matchId → { local, empate, visitante }
 * @param {Object} currentScores    - matchId → { home, away }
 * @param {Object} currentResults   - matchId → '1'|'X'|'2'
 * @param {number} N                - number of simulations (default 500)
 * @returns {Object} teamName → { ascenso, playoff, mid, descenso } (percentages as numbers)
 */
export function runMonteCarloSimulations(
  allMatches,
  baseStandings,
  lockedMatchIds,
  pronosticos,
  currentScores,
  currentResults,
  N = 500,
) {
  const counts = {};

  // Initialise counters for every team that appears in any match
  for (const match of allMatches) {
    if (!counts[match.homeTeam]) counts[match.homeTeam] = { ascenso: 0, playoff: 0, mid: 0, descenso: 0 };
    if (!counts[match.awayTeam]) counts[match.awayTeam] = { ascenso: 0, playoff: 0, mid: 0, descenso: 0 };
  }

  for (let i = 0; i < N; i++) {
    const simResults = {};
    const simScores = {};

    for (const match of allMatches) {
      if (lockedMatchIds[match.id] !== undefined) {
        // Locked match – use the actual stored result/score
        simResults[match.id] = currentResults[match.id];
        simScores[match.id] = currentScores[match.id] || { home: 0, away: 0 };
      } else {
        const p = pronosticos[match.id];
        const rand = Math.random();

        if (p) {
          if (rand < p.local) {
            simResults[match.id] = '1';
            simScores[match.id] = { home: 1, away: 0 };
          } else if (rand < p.local + p.empate) {
            simResults[match.id] = 'X';
            simScores[match.id] = { home: 0, away: 0 };
          } else {
            simResults[match.id] = '2';
            simScores[match.id] = { home: 0, away: 1 };
          }
        } else {
          // No pronostico: home-favoured defaults (40% home, 30% draw, 30% away)
          if (rand < 0.4) {
            simResults[match.id] = '1';
            simScores[match.id] = { home: 1, away: 0 };
          } else if (rand < 0.7) {
            simResults[match.id] = 'X';
            simScores[match.id] = { home: 0, away: 0 };
          } else {
            simResults[match.id] = '2';
            simScores[match.id] = { home: 0, away: 1 };
          }
        }
      }
    }

    const standings = calculateProjectedStandings(
      baseStandings,
      allMatches,
      simResults,
      lockedMatchIds,
      simScores,
    );

    for (const row of standings) {
      const c = counts[row.team.name];
      if (!c) continue;
      if (row.position <= 2) c.ascenso++;
      else if (row.position <= 6) c.playoff++;
      else if (row.position >= 19) c.descenso++;
      else c.mid++;
    }
  }

  // Convert raw counts to percentages (one decimal place)
  return Object.fromEntries(
    Object.entries(counts).map(([team, c]) => [
      team,
      {
        ascenso: parseFloat((c.ascenso / N * 100).toFixed(1)),
        playoff: parseFloat((c.playoff / N * 100).toFixed(1)),
        mid: parseFloat((c.mid / N * 100).toFixed(1)),
        descenso: parseFloat((c.descenso / N * 100).toFixed(1)),
      },
    ]),
  );
}

/**
 * Get the last 5 results for every team (sorted oldest→newest).
 * Includes all matches (locked played + unlocked simulated) ordered by startTimestamp.
 *
 * @returns {Object} teamName → Array<{ result: 'W'|'D'|'L', isLocked: boolean, opponent: string, isHome: boolean }>
 */
export function getLast5Matches(allMatches, results, lockedMatchIds) {
  const sorted = [...allMatches].sort((a, b) => (a.startTimestamp || 0) - (b.startTimestamp || 0));
  const history = {};

  for (const match of sorted) {
    const result = results[match.id];
    if (!result) continue;

    const isLocked = lockedMatchIds[match.id] !== undefined;
    const homeWin = result === '1';
    const draw = result === 'X';

    if (!history[match.homeTeam]) history[match.homeTeam] = [];
    history[match.homeTeam].push({
      result: homeWin ? 'W' : draw ? 'D' : 'L',
      isLocked,
      opponent: match.awayTeam,
      isHome: true,
    });

    if (!history[match.awayTeam]) history[match.awayTeam] = [];
    history[match.awayTeam].push({
      result: homeWin ? 'L' : draw ? 'D' : 'W',
      isLocked,
      opponent: match.homeTeam,
      isHome: false,
    });
  }

  // Keep only the last 5 entries per team
  return Object.fromEntries(
    Object.entries(history).map(([team, matches]) => [team, matches.slice(-5)]),
  );
}

/**
 * Calculate head-to-head records for a selected team against all opponents.
 *
 * @returns {Array} sorted by opponent position in projectedStandings:
 *   { opponentName, position, h2hPoints, wins, draws, losses, goalsFor, goalsAgainst, goalDiff }
 */
export function calculateH2H(
  selectedTeam,
  allMatches,
  results,
  scores,
  lockedMatchIds,
  projectedStandings,
) {
  const opponents = {};

  for (const match of allMatches) {
    let opponentName = null;
    let teamIsHome = false;

    if (match.homeTeam === selectedTeam) {
      opponentName = match.awayTeam;
      teamIsHome = true;
    } else if (match.awayTeam === selectedTeam) {
      opponentName = match.homeTeam;
      teamIsHome = false;
    } else {
      continue;
    }

    if (!opponents[opponentName]) {
      opponents[opponentName] = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
    }

    const result = results[match.id];
    const score = scores[match.id] || { home: 0, away: 0 };
    if (!result) continue;

    const teamWins =
      (teamIsHome && result === '1') || (!teamIsHome && result === '2');
    const isDraw = result === 'X';

    if (teamWins) opponents[opponentName].wins++;
    else if (isDraw) opponents[opponentName].draws++;
    else opponents[opponentName].losses++;

    if (teamIsHome) {
      opponents[opponentName].goalsFor += score.home ?? 0;
      opponents[opponentName].goalsAgainst += score.away ?? 0;
    } else {
      opponents[opponentName].goalsFor += score.away ?? 0;
      opponents[opponentName].goalsAgainst += score.home ?? 0;
    }
  }

  return Object.entries(opponents)
    .map(([opponentName, h2h]) => {
      const standing = projectedStandings.find((r) => r.team.name === opponentName);
      return {
        opponentName,
        position: standing?.position ?? 999,
        h2hPoints: h2h.wins * 3 + h2h.draws,
        wins: h2h.wins,
        draws: h2h.draws,
        losses: h2h.losses,
        goalsFor: h2h.goalsFor,
        goalsAgainst: h2h.goalsAgainst,
        goalDiff: h2h.goalsFor - h2h.goalsAgainst,
      };
    })
    .sort((a, b) => a.position - b.position);
}

import { calculateProjectedStandings } from './standings.js';

/**
 * Build a position lookup map from a standings array: teamName → position (1-based).
 */
function buildPositionMap(standings) {
  const map = {};
  for (const row of standings) {
    map[row.team.name] = row.position;
  }
  return map;
}

/**
 * Given the base standings, compute standings-based probability for a match.
 * Higher-ranked team (lower position number) is favoured.
 * Returns { local, empate, visitante }.
 */
function positionBasedProb(homeTeam, awayTeam, positionMap) {
  const homePos = positionMap[homeTeam] ?? 11;
  const awayPos = positionMap[awayTeam] ?? 11;
  if (homePos < awayPos) {
    // Home team is ranked higher → home favoured
    return { local: 0.50, empate: 0.25, visitante: 0.25 };
  } else if (awayPos < homePos) {
    // Away team is ranked higher → away favoured
    return { local: 0.25, empate: 0.25, visitante: 0.50 };
  }
  // Equal position → balanced with slight home advantage
  return { local: 0.38, empate: 0.26, visitante: 0.36 };
}

/**
 * Assign a zone key to a position given an array of zone definitions.
 * Each zone has minPos (nullable) and maxPos (nullable).
 */
function getZoneKey(position, zones) {
  for (const z of zones) {
    const aboveMin = z.minPos == null || position >= z.minPos;
    const belowMax = z.maxPos == null || position <= z.maxPos;
    if (aboveMin && belowMax) return z.key;
  }
  return 'mid';
}

/**
 * Run N Monte Carlo simulations to estimate the probability of each team
 * finishing in each classification zone.
 *
 * @param {Array}  allMatches       - all match objects (may include probIsFinal flag)
 * @param {Array}  baseStandings    - base standings rows (used as starting point AND for position fallback)
 * @param {Object} lockedMatchIds   - matchId → lockedResult string
 * @param {Object} pronosticos      - matchId → { local, empate, visitante }
 * @param {Object} currentScores    - matchId → { home, away }
 * @param {Object} currentResults   - matchId → '1'|'X'|'2'
 * @param {number} N                - number of simulations (default 500)
 * @param {Array}  zones            - zone definitions from league config (optional)
 * @returns {Object} teamName → { [zoneKey]: percentage } (percentages as numbers)
 */
export function runMonteCarloSimulations(
  allMatches,
  baseStandings,
  lockedMatchIds,
  pronosticos,
  currentScores,
  currentResults,
  N = 500,
  zones = [],
) {
  // Derive zone keys from config, fallback to legacy keys
  const zoneKeys = zones.length > 0 ? zones.map((z) => z.key) : ['ascenso', 'playoff', 'mid', 'descenso'];
  const emptyCount = () => Object.fromEntries(zoneKeys.map((k) => [k, 0]));

  const counts = {};

  // Initialise counters for every team that appears in any match
  for (const match of allMatches) {
    if (!counts[match.homeTeam]) counts[match.homeTeam] = emptyCount();
    if (!counts[match.awayTeam]) counts[match.awayTeam] = emptyCount();
  }

  // Build position map from base standings for fallback probability computation
  const positionMap = buildPositionMap(baseStandings);

  for (let i = 0; i < N; i++) {
    const simResults = {};
    const simScores = {};

    for (const match of allMatches) {
      if (lockedMatchIds[match.id] !== undefined) {
        // Locked match – use the actual stored result/score
        simResults[match.id] = currentResults[match.id];
        simScores[match.id] = currentScores[match.id] || { home: 0, away: 0 };
      } else {
        // Use real odds only when probIsFinal is true, otherwise use standings-based probs
        const p = (match.probIsFinal && pronosticos[match.id])
          ? pronosticos[match.id]
          : positionBasedProb(match.homeTeam, match.awayTeam, positionMap);
        const rand = Math.random();

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
      const key = zones.length > 0
        ? getZoneKey(row.position, zones)
        : (row.position <= 2 ? 'ascenso' : row.position <= 6 ? 'playoff' : row.position >= 19 ? 'descenso' : 'mid');
      if (c[key] !== undefined) c[key]++;
    }
  }

  // Convert raw counts to percentages (one decimal place)
  return Object.fromEntries(
    Object.entries(counts).map(([team, c]) => [
      team,
      Object.fromEntries(
        Object.entries(c).map(([k, v]) => [k, parseFloat((v / N * 100).toFixed(1))]),
      ),
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

    // Score from lockedResult string (e.g. "2-1") or fallback
    const scoreStr = lockedMatchIds[match.id] || null;
    const scoreParts = scoreStr ? scoreStr.split('-') : null;
    const homeGoals = scoreParts ? parseInt(scoreParts[0], 10) : null;
    const awayGoals = scoreParts ? parseInt(scoreParts[1], 10) : null;

    if (!history[match.homeTeam]) history[match.homeTeam] = [];
    history[match.homeTeam].push({
      result: homeWin ? 'W' : draw ? 'D' : 'L',
      isLocked,
      opponent: match.awayTeam,
      isHome: true,
      jornada: match.jornada,
      homeGoals,
      awayGoals,
    });

    if (!history[match.awayTeam]) history[match.awayTeam] = [];
    history[match.awayTeam].push({
      result: homeWin ? 'L' : draw ? 'D' : 'W',
      isLocked,
      opponent: match.homeTeam,
      isHome: false,
      jornada: match.jornada,
      homeGoals,
      awayGoals,
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

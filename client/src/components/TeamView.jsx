import { useSimulation } from '../context/SimulationContext';
import { isMatchLocked } from '../utils/standings';
import { getTeamColor } from '../utils/teamColors';
import TeamLogo from './TeamLogo';

function isModified(matchId, state) {
  if (!state.activeSimulationName) return false;
  const savedResult = state.savedSimulations[state.activeSimulationName]?.results?.[matchId];
  return savedResult !== undefined && savedResult !== state.results[matchId];
}

function GoalInput({ value, onChange }) {
  return (
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      className="w-10 text-center text-sm font-bold border border-gray-200 rounded py-0.5 focus:outline-none focus:border-blue-400 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function MatchCell({ match, teamName }) {
  const { state, dispatch } = useSimulation();
  const locked = isMatchLocked(match.id, state.lockedMatchIds);
  const current = state.results[match.id];
  const score = state.scores[match.id] || { home: 0, away: 0 };
  const modified = isModified(match.id, state);

  const isHome = match.homeTeam === teamName;
  const opponent = isHome ? match.awayTeam : match.homeTeam;

  // Goals from selected team's perspective
  const goalsFor = isHome ? score.home : score.away;
  const goalsAgainst = isHome ? score.away : score.home;

  // Result from selected team's perspective
  const teamWins = (isHome && current === '1') || (!isHome && current === '2');
  const teamDraws = current === 'X';
  const teamLoses = (isHome && current === '2') || (!isHome && current === '1');

  const resultLabel = teamWins ? 'Victoria' : teamDraws ? 'Empate' : 'Derrota';
  const resultClass = teamWins
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : teamDraws
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-rose-700 bg-rose-50 border-rose-200';

  const handleGoalChange = (side, val) => {
    // side: 'for' or 'against'
    let newHome, newAway;
    if (isHome) {
      newHome = side === 'for' ? val : score.home;
      newAway = side === 'against' ? val : score.away;
    } else {
      newHome = side === 'against' ? val : score.home;
      newAway = side === 'for' ? val : score.away;
    }
    dispatch({ type: 'SET_SCORE', payload: { matchId: match.id, home: newHome, away: newAway } });
  };

  const venueBg = isHome ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
  const venueLabel = isHome ? 'Local' : 'Visitante';

  return (
    <td
      className={`border border-gray-200 p-2 align-top min-w-[170px] ${
        modified ? 'bg-yellow-50' : ''
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Opponent row */}
      <div className="flex items-center gap-1 mb-1.5">
        <TeamLogo teamName={opponent} size="xs" />
        <span className="text-xs text-gray-700 font-medium truncate flex-1">{opponent}</span>
        {modified && (
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" title="Resultado modificado" />
        )}
      </div>

      {/* Venue badge */}
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${venueBg}`}>
        {venueLabel}
      </span>

      {locked ? (
        /* Locked: show actual score */
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-sm font-black font-mono">
            {goalsFor} — {goalsAgainst}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${resultClass}`}>
            {resultLabel}
          </span>
        </div>
      ) : (
        /* Editable: goal inputs + result */
        <div className="mt-1.5 flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 w-14 shrink-0">A favor</span>
            <GoalInput value={goalsFor} onChange={(v) => handleGoalChange('for', v)} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 w-14 shrink-0">En contra</span>
            <GoalInput value={goalsAgainst} onChange={(v) => handleGoalChange('against', v)} />
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold inline-block self-start mt-0.5 ${resultClass}`}>
            {resultLabel}
          </span>
        </div>
      )}
    </td>
  );
}

export default function TeamView() {
  const { state, dispatch, projectedStandings, JORNADAS } = useSimulation();

  const allTeams = projectedStandings.map((r) => r.team.name);
  const selected = state.selectedTeams;

  function toggleTeam(name) {
    dispatch({ type: 'TOGGLE_TEAM', payload: { teamName: name } });
  }

  // Build jornada → matches map for selected teams
  const jornadaMatchMap = {};
  for (const j of JORNADAS) {
    jornadaMatchMap[j] = {};
    for (const team of selected) {
      const match = state.allMatches.find(
        (m) => m.jornada === j && (m.homeTeam === team || m.awayTeam === team)
      );
      jornadaMatchMap[j][team] = match || null;
    }
  }

  return (
    <div className="px-2 py-4">
      <h2 className="text-lg font-bold text-gray-800 mb-3">Vista por Equipo</h2>

      {/* Team selector */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-2">
          Selecciona uno o más equipos:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {allTeams.map((name) => {
            const isSelected = selected.includes(name);
            const color = getTeamColor(name, selected);
            const pos = projectedStandings.find((r) => r.team.name === name)?.position;
            return (
              <button
                key={name}
                onClick={() => toggleTeam(name)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  isSelected && color
                    ? `${color.bg} text-white border-transparent`
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                <TeamLogo teamName={name} size="xs" />
                {pos}. {name}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'SET_SELECTED_TEAMS', payload: [] })}
            className="mt-2 text-xs text-rose-500 hover:text-rose-700 underline"
          >
            Limpiar selección
          </button>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="text-center text-gray-400 py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-base">Selecciona al menos un equipo</p>
        </div>
      ) : (
        <>
          {/* Reset buttons per team */}
          <div className="flex gap-2 flex-wrap mb-3">
            {selected.map((team) => {
              const color = getTeamColor(team, selected);
              return (
                <button
                  key={team}
                  onClick={() =>
                    dispatch({ type: 'RESET_TEAM', payload: { teamName: team } })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium border transition-colors ${
                    color
                      ? `${color.light} ${color.text} ${color.border}`
                      : 'bg-orange-50 text-orange-700 border-orange-300'
                  }`}
                >
                  <TeamLogo teamName={team} size="xs" />
                  ↺ Reset {team}
                </button>
              );
            })}
          </div>

          {/* Results table */}
          <div className="overflow-x-auto rounded-xl shadow border border-gray-200">
            <table className="text-sm border-collapse min-w-full">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-3 py-2 bg-gray-800 text-white text-left min-w-[50px] text-xs">
                    J
                  </th>
                  {selected.map((team) => {
                    const color = getTeamColor(team, selected);
                    return (
                      <th
                        key={team}
                        className={`border border-gray-300 px-3 py-2 text-left min-w-[170px] ${
                          color ? color.header : 'bg-blue-900 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <TeamLogo teamName={team} size="xs" />
                          <span className="text-xs font-semibold">{team}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {JORNADAS.map((j) => (
                  <tr key={j} className="odd:bg-white even:bg-gray-50/50">
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-blue-700 text-sm">
                      {j}
                    </td>
                    {selected.map((team) => {
                      const match = jornadaMatchMap[j][team];
                      if (!match) {
                        return (
                          <td
                            key={team}
                            className="border border-gray-200 p-2 text-gray-400 text-xs italic text-center"
                          >
                            —
                          </td>
                        );
                      }
                      return <MatchCell key={team} match={match} teamName={team} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

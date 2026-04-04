import { useSimulation } from '../context/SimulationContext';
import { isMatchLocked, parseResultado } from '../utils/standings';
import { getTeamColor } from '../utils/teamColors';
import TeamLogo from './TeamLogo';

const RESULT_OPTIONS = ['1', 'X', '2'];

function isModified(matchId, state) {
  if (!state.activeSimulationName) return false;
  const savedResult = state.savedSimulations[state.activeSimulationName]?.results?.[matchId];
  return savedResult !== undefined && savedResult !== state.results[matchId];
}

function MatchCell({ match, teamName }) {
  const { state, dispatch } = useSimulation();
  const locked = isMatchLocked(match.id, state.lockedMatchIds);
  const current = state.results[match.id];
  const isHome = match.homeTeam === teamName;
  const modified = isModified(match.id, state);

  const getTeamResult = (r) => {
    if (r === '1') return isHome ? 'W' : 'L';
    if (r === 'X') return 'D';
    return isHome ? 'L' : 'W';
  };

  const teamResult = getTeamResult(current);

  const resultClass =
    teamResult === 'W'
      ? 'text-emerald-700 font-bold'
      : teamResult === 'L'
      ? 'text-rose-700 font-bold'
      : 'text-amber-600 font-bold';

  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const venue = isHome ? 'L' : 'V';
  const venueBadge = isHome
    ? 'bg-blue-100 text-blue-700'
    : 'bg-purple-100 text-purple-700';

  return (
    <td
      className={`border border-gray-200 p-2 min-w-[160px] align-top ${
        modified ? 'bg-yellow-50' : ''
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Opponent row */}
      <div className="flex items-center gap-1 mb-1.5">
        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${venueBadge}`}>
          {venue}
        </span>
        <TeamLogo teamName={opponent} size="xs" />
        <span className="text-xs text-gray-600 truncate">{opponent}</span>
        {modified && (
          <span className="ml-auto w-3 h-3 rounded-full bg-yellow-400 shrink-0" title="Resultado modificado" />
        )}
      </div>

      {locked ? (
        <div className="flex items-center gap-1">
          <span className={`text-sm ${resultClass}`}>
            {match.homeScore} – {match.awayScore}
          </span>
          <span className="text-xs text-gray-400">({current})</span>
        </div>
      ) : (
        <div className="flex gap-0.5">
          {RESULT_OPTIONS.map((opt) => {
            const optTeamResult = getTeamResult(opt);
            const isActive = current === opt;
            const activeClass = isActive
              ? optTeamResult === 'W'
                ? 'bg-emerald-600 text-white'
                : optTeamResult === 'L'
                ? 'bg-rose-600 text-white'
                : 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200';

            return (
              <button
                key={opt}
                onClick={() =>
                  dispatch({
                    type: 'SET_RESULT',
                    payload: { matchId: match.id, result: opt },
                  })
                }
                className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${activeClass}`}
              >
                {opt}
              </button>
            );
          })}
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
                  <th className="border border-gray-300 px-3 py-2 bg-gray-800 text-white text-left min-w-[60px]">
                    J
                  </th>
                  {selected.map((team) => {
                    const color = getTeamColor(team, selected);
                    return (
                      <th
                        key={team}
                        className={`border border-gray-300 px-3 py-2 text-left min-w-[160px] ${
                          color ? color.header : 'bg-blue-900 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <TeamLogo teamName={team} size="xs" />
                          <span className="text-sm font-semibold">{team}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {JORNADAS.map((j) => (
                  <tr
                    key={j}
                    className="hover:bg-blue-50 odd:bg-white even:bg-gray-50"
                  >
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-blue-700 text-sm">
                      {j}
                    </td>
                    {selected.map((team) => {
                      const match = jornadaMatchMap[j][team];
                      if (!match) {
                        return (
                          <td
                            key={team}
                            className="border border-gray-200 p-2 text-gray-400 text-xs italic"
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

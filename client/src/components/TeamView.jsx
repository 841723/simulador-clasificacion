import { useSimulation } from '../context/SimulationContext';
import { isMatchFinished } from '../utils/standings';

const RESULT_LABELS = { '1': '1', X: 'X', '2': '2' };
const RESULT_COLORS = {
  '1': 'bg-green-100 text-green-800',
  X: 'bg-yellow-100 text-yellow-800',
  '2': 'bg-red-100 text-red-800',
};
const RESULT_OPTIONS = ['1', 'X', '2'];

function MatchCell({ match, teamName }) {
  const { state, dispatch } = useSimulation();
  const finished = isMatchFinished(match.status);
  const current = state.results[match.id];
  const isHome = match.homeTeam === teamName;

  // Determine win/draw/loss from team's perspective
  let teamResult = null;
  if (current === '1') teamResult = isHome ? 'W' : 'L';
  else if (current === 'X') teamResult = 'D';
  else if (current === '2') teamResult = isHome ? 'L' : 'W';

  const resultClass =
    teamResult === 'W'
      ? 'text-green-700'
      : teamResult === 'L'
      ? 'text-red-700'
      : 'text-yellow-700';

  const opponent = isHome ? match.awayTeam : match.homeTeam;
  const venue = isHome ? 'L' : 'V';

  return (
    <td className="border border-gray-200 p-2 min-w-[180px] align-top">
      <div className="text-xs text-gray-500 mb-1">
        <span className={`font-bold ${venue === 'L' ? 'text-blue-600' : 'text-purple-600'}`}>
          {venue}
        </span>{' '}
        vs <span className="font-medium">{opponent}</span>
      </div>
      {finished ? (
        <div className="flex items-center gap-1">
          <span className={`text-sm font-bold ${resultClass}`}>
            {match.homeScore} – {match.awayScore}
          </span>
          <span
            className={`text-xs px-1 rounded ${RESULT_COLORS[current] || ''} font-semibold`}
          >
            {RESULT_LABELS[current]}
          </span>
        </div>
      ) : (
        <div className="flex gap-1 mt-1">
          {RESULT_OPTIONS.map((opt) => {
            let optTeamResult = null;
            if (opt === '1') optTeamResult = isHome ? 'W' : 'L';
            else if (opt === 'X') optTeamResult = 'D';
            else optTeamResult = isHome ? 'L' : 'W';

            const activeClass =
              current === opt
                ? optTeamResult === 'W'
                  ? 'bg-green-600 text-white'
                  : optTeamResult === 'L'
                  ? 'bg-red-600 text-white'
                  : 'bg-yellow-500 text-white'
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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Vista por Equipo</h2>

      {/* Team selector */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-600 mb-2">
          Selecciona equipos (puede ser más de uno):
        </p>
        <div className="flex flex-wrap gap-2">
          {allTeams.map((name) => {
            const isSelected = selected.includes(name);
            const pos = projectedStandings.find((r) => r.team.name === name)?.position;
            return (
              <button
                key={name}
                onClick={() => toggleTeam(name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {pos}. {name}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'SET_SELECTED_TEAMS', payload: [] })}
            className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
          >
            Limpiar selección
          </button>
        )}
      </div>

      {selected.length === 0 ? (
        <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-lg">Selecciona al menos un equipo para ver sus resultados</p>
        </div>
      ) : (
        <>
          {/* Reset buttons per team */}
          <div className="flex gap-2 flex-wrap mb-4">
            {selected.map((team) => (
              <button
                key={team}
                onClick={() =>
                  dispatch({ type: 'RESET_TEAM', payload: { teamName: team } })
                }
                className="px-3 py-1 text-xs rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300 font-medium"
              >
                ↺ Reset {team}
              </button>
            ))}
          </div>

          {/* Results table */}
          <div className="overflow-x-auto rounded-xl shadow border border-gray-200">
            <table className="text-sm border-collapse min-w-full">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="border border-blue-800 px-3 py-2 text-left min-w-[80px]">
                    Jornada
                  </th>
                  {selected.map((team) => (
                    <th
                      key={team}
                      className="border border-blue-800 px-3 py-2 text-left min-w-[180px]"
                    >
                      {team}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {JORNADAS.map((j) => (
                  <tr
                    key={j}
                    className="hover:bg-blue-50 odd:bg-white even:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      dispatch({ type: 'SET_JORNADA', payload: j });
                      dispatch({ type: 'SET_VIEW', payload: 'jornada' });
                    }}
                  >
                    <td className="border border-gray-200 px-3 py-2 font-semibold text-blue-700">
                      J{j}
                    </td>
                    {selected.map((team) => {
                      const match = jornadaMatchMap[j][team];
                      if (!match)
                        return (
                          <td
                            key={team}
                            className="border border-gray-200 p-2 text-gray-400 text-xs italic"
                          >
                            Descansa
                          </td>
                        );
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

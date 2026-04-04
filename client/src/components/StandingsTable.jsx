import { useSimulation } from '../context/SimulationContext';
import { getTeamColor } from '../utils/teamColors';
import TeamLogo from './TeamLogo';

// Zone config for LaLiga 2
const ZONES = [
  { label: 'Ascenso', color: 'bg-emerald-500', max: 2 },
  { label: 'Playoff', color: 'bg-blue-400', min: 3, max: 6 },
  { label: 'Descenso', color: 'bg-rose-400', min: 19 },
];

function getZoneBorder(position) {
  if (position <= 2) return 'border-l-4 border-emerald-500';
  if (position <= 6) return 'border-l-4 border-blue-400';
  if (position >= 19) return 'border-l-4 border-rose-400';
  return 'border-l-4 border-transparent';
}

export default function StandingsTable() {
  const { projectedStandings, state, dispatch } = useSimulation();
  const selected = state.selectedTeams;

  function toggleTeam(name) {
    dispatch({ type: 'TOGGLE_TEAM', payload: { teamName: name } });
  }

  if (projectedStandings.length === 0) {
    return (
      <div className="py-10 text-center text-gray-400 text-sm">Calculando clasificación…</div>
    );
  }

  return (
    <div className="py-3 px-2">
      <h2 className="text-sm font-bold text-gray-700 mb-2 px-1 uppercase tracking-wide">
        Clasificación Proyectada
      </h2>

      <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-2 py-2 text-center w-7">#</th>
              <th className="px-2 py-2 text-left">Equipo</th>
              <th className="px-2 py-2 text-center font-bold">Pts</th>
              <th className="px-2 py-2 text-center text-gray-300">DG</th>
            </tr>
          </thead>
          <tbody>
            {projectedStandings.map((row) => {
              const isSelected = selected.includes(row.team.name);
              const color = getTeamColor(row.team.name, selected);
              const goalDiff = row.scoresFor - row.scoresAgainst;

              return (
                <tr
                  key={row.team.name}
                  onClick={() => toggleTeam(row.team.name)}
                  className={`cursor-pointer transition-colors ${getZoneBorder(row.position)} ${
                    isSelected && color
                      ? `${color.row} hover:brightness-95`
                      : 'hover:bg-gray-50 odd:bg-white even:bg-gray-50/60'
                  }`}
                >
                  <td className="px-2 py-1.5 text-center text-gray-500 font-medium">
                    {row.position}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isSelected && color && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
                      )}
                      <TeamLogo teamName={row.team.name} size="xs" />
                      <span
                        className={`truncate text-xs ${
                          isSelected && color ? color.text + ' font-semibold' : 'text-gray-700'
                        }`}
                      >
                        {row.team.name}
                      </span>
                    </div>
                  </td>
                  <td className={`px-2 py-1.5 text-center font-bold ${
                    isSelected && color ? color.text : 'text-blue-700'
                  }`}>
                    {row.points}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-center ${
                      goalDiff > 0
                        ? 'text-emerald-600'
                        : goalDiff < 0
                        ? 'text-rose-500'
                        : 'text-gray-400'
                    }`}
                  >
                    {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-2 px-1 flex flex-col gap-0.5">
        {ZONES.map((z) => (
          <div key={z.label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-sm shrink-0 ${z.color}`} />
            {z.label}
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <p className="mt-2 px-1 text-xs text-gray-400">
          Clic en un equipo para resaltarlo
        </p>
      )}
    </div>
  );
}

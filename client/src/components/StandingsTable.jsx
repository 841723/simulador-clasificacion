import { useSimulation } from '../context/SimulationContext';
import { getTeamColor } from '../utils/teamColors';
import TeamLogo from './TeamLogo';

// Default zone config (fallback for LaLiga 2 when DB zones not yet loaded)
const DEFAULT_ZONES = [
  { key: 'ascenso',  label: 'Ascenso',   color: 'bg-emerald-500', borderColor: 'border-emerald-500', minPos: 1,  maxPos: 2    },
  { key: 'playoff',  label: 'Playoff',   color: 'bg-blue-400',    borderColor: 'border-blue-400',    minPos: 3,  maxPos: 6    },
  { key: 'mid',      label: null,        color: 'bg-gray-300',    borderColor: 'border-transparent', minPos: 7,  maxPos: 18   },
  { key: 'descenso', label: 'Descenso',  color: 'bg-rose-400',    borderColor: 'border-rose-400',    minPos: 19, maxPos: null },
];

function getZoneBorder(position, zones) {
  const z = zones.find(
    (z) => (z.minPos == null || position >= z.minPos) && (z.maxPos == null || position <= z.maxPos),
  );
  if (!z || z.borderColor === 'border-transparent') return 'border-l-4 border-transparent';
  return `border-l-4 ${z.borderColor}`;
}

export default function StandingsTable() {
  const { projectedStandings, state, dispatch, currentZones } = useSimulation();
  const selected = state.selectedTeams;
  const zones = currentZones.length > 0 ? currentZones : DEFAULT_ZONES;

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
                  className={`cursor-pointer transition-colors ${getZoneBorder(row.position, zones)} ${
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

      {/* Legend – only show named zones */}
      <div className="mt-2 px-1 flex flex-col gap-0.5">
        {zones.filter((z) => z.label).map((z) => (
          <div key={z.key} className="flex items-center gap-1.5 text-xs text-gray-500">
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

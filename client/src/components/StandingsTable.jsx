import { useSimulation } from '../context/SimulationContext';

export default function StandingsTable() {
  const { projectedStandings, state, dispatch } = useSimulation();

  const selected = state.selectedTeams;

  function toggleTeam(name) {
    dispatch({ type: 'TOGGLE_TEAM', payload: { teamName: name } });
  }

  if (projectedStandings.length === 0) {
    return <p className="text-center text-gray-500 py-10">Calculando clasificación…</p>;
  }

  // Zone bands for LaLiga 2: top 2 promoted, 3-6 playoff, 18-22 relegated
  function getZoneClass(position) {
    if (position <= 2) return 'border-l-4 border-green-500';
    if (position <= 6) return 'border-l-4 border-blue-400';
    if (position >= 18) return 'border-l-4 border-red-400';
    return '';
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Clasificación Proyectada</h2>
      <p className="text-xs text-gray-500 mb-4">
        Basada en resultados reales + simulación de partidos pendientes.
        Haz clic en un equipo para destacarlo en la vista por equipo.
      </p>

      {/* Legend */}
      <div className="flex gap-4 text-xs mb-3 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500 inline-block" /> Ascenso directo
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Playoff ascenso
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-400 inline-block" /> Descenso
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl shadow border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-900 text-white">
            <tr>
              <th className="px-3 py-2 text-center w-10">#</th>
              <th className="px-3 py-2 text-left">Equipo</th>
              <th className="px-3 py-2 text-center">PJ</th>
              <th className="px-3 py-2 text-center">G</th>
              <th className="px-3 py-2 text-center">E</th>
              <th className="px-3 py-2 text-center">P</th>
              <th className="px-3 py-2 text-center">GF</th>
              <th className="px-3 py-2 text-center">GC</th>
              <th className="px-3 py-2 text-center">DG</th>
              <th className="px-3 py-2 text-center font-bold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {projectedStandings.map((row) => {
              const isSelected = selected.includes(row.team.name);
              const goalDiff = row.scoresFor - row.scoresAgainst;

              return (
                <tr
                  key={row.team.name}
                  onClick={() => toggleTeam(row.team.name)}
                  className={`cursor-pointer transition-colors ${getZoneClass(row.position)} ${
                    isSelected
                      ? 'bg-blue-100 hover:bg-blue-200 font-semibold'
                      : 'hover:bg-gray-50 odd:bg-white even:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-2 text-center text-gray-600 font-medium">
                    {row.position}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    <span className="flex items-center gap-1">
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      )}
                      {row.team.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">{row.played}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{row.wins}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{row.draws}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{row.losses}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{row.scoresFor}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{row.scoresAgainst}</td>
                  <td
                    className={`px-3 py-2 text-center font-medium ${
                      goalDiff > 0 ? 'text-green-600' : goalDiff < 0 ? 'text-red-500' : 'text-gray-600'
                    }`}
                  >
                    {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Equipos seleccionados: {selected.join(', ')}. También se resaltan en la vista por equipo.
        </p>
      )}
    </div>
  );
}

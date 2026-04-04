import { useSimulation } from '../context/SimulationContext';
import { isMatchFinished } from '../utils/standings';

const RESULT_OPTIONS = [
  { value: '1', label: '1', title: 'Local', bg: 'bg-green-600' },
  { value: 'X', label: 'X', title: 'Empate', bg: 'bg-yellow-500' },
  { value: '2', label: '2', title: 'Visitante', bg: 'bg-red-600' },
];

function ResultSelector({ match }) {
  const { state, dispatch } = useSimulation();
  const finished = isMatchFinished(match.status);
  const current = state.results[match.id];

  if (finished) {
    const label = match.winnerCode === 1 ? '1' : match.winnerCode === 2 ? '2' : 'X';
    return (
      <span className="inline-flex items-center gap-1 text-sm text-gray-500">
        <span className="font-mono font-bold">
          {match.homeScore} – {match.awayScore}
        </span>
        <span className="text-xs bg-gray-200 rounded px-1">{label}</span>
        <span className="text-xs text-gray-400 italic">Finalizado</span>
      </span>
    );
  }

  return (
    <div className="inline-flex rounded-md overflow-hidden border border-gray-300">
      {RESULT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          title={opt.title}
          onClick={() =>
            dispatch({ type: 'SET_RESULT', payload: { matchId: match.id, result: opt.value } })
          }
          className={`px-3 py-1 text-sm font-bold transition-colors ${
            current === opt.value
              ? `${opt.bg} text-white`
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function JornadaView() {
  const { state, dispatch, JORNADAS } = useSimulation();
  const jornada = state.currentJornada;

  const matches = state.allMatches
    .filter((m) => m.jornada === jornada)
    .sort((a, b) => a.startTimestamp - b.startTimestamp);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Jornada selector */}
      <div className="flex items-center justify-between mb-6">
        <button
          disabled={jornada <= JORNADAS[0]}
          onClick={() => dispatch({ type: 'SET_JORNADA', payload: jornada - 1 })}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40 hover:bg-blue-700 disabled:hover:bg-blue-600 transition-colors"
        >
          ← Anterior
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Jornada {jornada}</h2>
          <div className="flex gap-1 mt-1 justify-center">
            {JORNADAS.map((j) => (
              <button
                key={j}
                onClick={() => dispatch({ type: 'SET_JORNADA', payload: j })}
                className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${
                  j === jornada
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>
        <button
          disabled={jornada >= JORNADAS[JORNADAS.length - 1]}
          onClick={() => dispatch({ type: 'SET_JORNADA', payload: jornada + 1 })}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40 hover:bg-blue-700 disabled:hover:bg-blue-600 transition-colors"
        >
          Siguiente →
        </button>
      </div>

      {/* Matches */}
      {matches.length === 0 ? (
        <p className="text-center text-gray-500">Cargando partidos...</p>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.id}
              className={`bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isMatchFinished(match.status) ? 'opacity-75' : ''
              }`}
            >
              <div className="flex-1 text-right">
                <span className="font-semibold text-gray-800">{match.homeTeam}</span>
              </div>
              <div className="flex flex-col items-center gap-1 min-w-[140px]">
                <ResultSelector match={match} />
                {!isMatchFinished(match.status) && (
                  <span className="text-xs text-gray-400">{match.status}</span>
                )}
              </div>
              <div className="flex-1 text-left">
                <span className="font-semibold text-gray-800">{match.awayTeam}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

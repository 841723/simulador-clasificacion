import { useSimulation } from '../context/SimulationContext';
import { isMatchLocked, parseResultado } from '../utils/standings';
import TeamLogo from './TeamLogo';

const RESULT_OPTIONS = [
  { value: '1', label: '1', title: 'Local gana', activeClass: 'bg-emerald-600 text-white' },
  { value: 'X', label: 'X', title: 'Empate', activeClass: 'bg-amber-500 text-white' },
  { value: '2', label: '2', title: 'Visitante gana', activeClass: 'bg-rose-600 text-white' },
];

function isModified(matchId, state) {
  if (!state.activeSimulationName) return false;
  const savedResult = state.savedSimulations[state.activeSimulationName]?.results?.[matchId];
  return savedResult !== undefined && savedResult !== state.results[matchId];
}

function PronosticoDisplay({ pronostico }) {
  return (
    <div className="flex gap-1 mt-1 justify-center flex-wrap">
      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-xs font-medium">
        Local {(pronostico.local * 100).toFixed(2)}%
      </span>
      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-xs font-medium">
        Empate {(pronostico.empate * 100).toFixed(2)}%
      </span>
      <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-xs font-medium">
        Visit. {(pronostico.visitante * 100).toFixed(2)}%
      </span>
    </div>
  );
}

function GoalInput({ value, onChange, disabled }) {
  return (
    <input
      type="number"
      min="0"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      className="w-12 text-center text-xl font-black border-2 border-gray-200 rounded-lg py-1 focus:outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent disabled:text-gray-400 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function ResultSelector({ match }) {
  const { state, dispatch } = useSimulation();
  const locked = isMatchLocked(match.id, state.lockedMatchIds);
  const current = state.results[match.id];
  const score = state.scores[match.id] || { home: 0, away: 0 };
  const pronostico = state.pronosticos[match.id];

  const handleGoalChange = (side, val) => {
    const newHome = side === 'home' ? val : score.home;
    const newAway = side === 'away' ? val : score.away;
    dispatch({ type: 'SET_SCORE', payload: { matchId: match.id, home: newHome, away: newAway } });
  };

  if (locked) {
    const scoreStr = state.lockedMatchIds[match.id];
    const result = parseResultado(scoreStr);
    const resultColor =
      result === '1' ? 'text-emerald-600' : result === '2' ? 'text-rose-600' : 'text-amber-600';
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-2xl font-black font-mono tracking-widest ${resultColor}`}>
          {scoreStr}
        </span>
        {pronostico && <PronosticoDisplay pronostico={pronostico} />}
      </div>
    );
  }

  const modified = isModified(match.id, state);

  return (
    <div className={`flex flex-col items-center gap-1.5 ${modified ? 'relative' : ''}`}>
      {modified && (
        <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold flex items-center justify-center z-10">
          !
        </span>
      )}

      {/* Goal inputs */}
      <div className="flex items-center gap-2">
        <GoalInput value={score.home} onChange={(v) => handleGoalChange('home', v)} />
        <span className="text-gray-300 font-bold text-lg">—</span>
        <GoalInput value={score.away} onChange={(v) => handleGoalChange('away', v)} />
      </div>

      {/* 1/X/2 selector */}
      <div
        className={`inline-flex rounded-lg overflow-hidden border-2 transition-shadow ${
          modified ? 'border-yellow-400 shadow-yellow-200 shadow-md' : 'border-gray-200'
        }`}
      >
        {RESULT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            title={opt.title}
            onClick={() =>
              dispatch({ type: 'SET_RESULT', payload: { matchId: match.id, result: opt.value } })
            }
            className={`px-4 py-1.5 text-sm font-bold transition-colors ${
              current === opt.value
                ? opt.activeClass
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Pronostico */}
      {pronostico && <PronosticoDisplay pronostico={pronostico} />}
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
    <div className="px-2 py-4">
      {/* Jornada navigator */}
      <div className="flex items-center justify-between mb-5 gap-2">
        <button
          disabled={jornada <= JORNADAS[0]}
          onClick={() => dispatch({ type: 'SET_JORNADA', payload: jornada - 1 })}
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 disabled:hover:bg-blue-600 transition-colors"
        >
          ←
        </button>
        <div className="flex flex-col items-center gap-1 flex-1">
          <h2 className="text-lg font-bold text-gray-800">Jornada {jornada}</h2>
          <div className="flex gap-0.5 flex-wrap justify-center">
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
          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 disabled:hover:bg-blue-600 transition-colors"
        >
          →
        </button>
      </div>

      {/* Match list */}
      {matches.length === 0 ? (
        <p className="text-center text-gray-500">Cargando partidos...</p>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => {
            const locked = isMatchLocked(match.id, state.lockedMatchIds);
            return (
              <div
                key={match.id}
                className={`rounded-xl border p-3 sm:p-4 flex items-center justify-between gap-3 transition-all ${
                  locked
                    ? 'bg-gray-50 border-gray-200 opacity-80'
                    : 'bg-white border-gray-200 shadow-sm hover:shadow'
                }`}
              >
                {/* Home team */}
                <div className="flex flex-col items-end gap-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-end w-full">
                    <span className={`font-semibold text-sm truncate ${locked ? 'text-gray-500' : 'text-gray-800'}`}>
                      {match.homeTeam}
                    </span>
                    <TeamLogo teamName={match.homeTeam} size="md" />
                  </div>
                </div>

                {/* Center: inputs / score */}
                <div className="flex flex-col items-center gap-1 shrink-0 min-w-[150px]">
                  <ResultSelector match={match} />
                </div>

                {/* Away team */}
                <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-start w-full">
                    <TeamLogo teamName={match.awayTeam} size="md" />
                    <span className={`font-semibold text-sm truncate ${locked ? 'text-gray-500' : 'text-gray-800'}`}>
                      {match.awayTeam}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

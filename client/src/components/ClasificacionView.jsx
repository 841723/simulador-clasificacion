import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import {
  runMonteCarloSimulations,
  getLast5Matches,
  calculateH2H,
} from '../utils/monteCarlo';
import { calculateProjectedStandings } from '../utils/standings';
import { computeCurrentJornada } from '../utils/navigation';
import TeamLogo from './TeamLogo';

// ── Zone definitions ───────────────────────────────────────────────────────────
const ZONES = [
  { key: 'ascenso',  label: 'Ascenso directo', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
  { key: 'playoff',  label: 'Playoff',          color: 'bg-blue-400',    textColor: 'text-blue-600'    },
  { key: 'mid',      label: 'Permanencia',      color: 'bg-gray-300',    textColor: 'text-gray-500'    },
  { key: 'descenso', label: 'Descenso',         color: 'bg-rose-400',    textColor: 'text-rose-600'    },
];

function getZoneBorder(position) {
  if (position <= 2) return 'border-l-4 border-emerald-500';
  if (position <= 6) return 'border-l-4 border-blue-400';
  if (position >= 19) return 'border-l-4 border-rose-400';
  return 'border-l-4 border-transparent';
}

// ── Form dots ──────────────────────────────────────────────────────────────────
function FormDot({ result, isLocked }) {
  const base = 'w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold';
  const colors = { W: 'bg-emerald-500', D: 'bg-gray-400', L: 'bg-rose-500' };
  const labels = { W: 'V', D: 'E', L: 'D' };
  return (
    <span
      title={result === 'W' ? 'Victoria' : result === 'D' ? 'Empate' : 'Derrota'}
      className={`${base} ${colors[result] || 'bg-gray-200'} ${!isLocked ? 'opacity-60' : ''}`}
    >
      {labels[result] || '?'}
    </span>
  );
}

// ── Zone probability display (text only, no bar) ───────────────────────────────
function ZoneProbDisplay({ probs }) {
  if (!probs) return <span className="text-gray-300 text-xs">—</span>;

  const formatted = ZONES.map(({ key, textColor }) => {
    const pct = probs[key] || 0;
    let label = null;
    if (pct === 0) {
      label = null;
    } else if (pct < 1) {
      label = '<1%';
    } else {
      label = `${Math.round(pct)}%`;
    }
    return label ? { key, textColor, label } : null;
  }).filter(Boolean);

  if (formatted.length === 0) return <span className="text-gray-300 text-xs">—</span>;

  return (
    <div className="flex gap-1.5 flex-wrap justify-center">
      {formatted.map(({ key, textColor, label }) => (
        <span key={key} className={`text-xs font-semibold ${textColor}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Full Standings Table ───────────────────────────────────────────────────────
function FullStandingsTable({ standings, zoneProbabilities, last5ByTeam, selectedTeam, onTeamClick }) {
  return (
    <div className="overflow-auto rounded-xl shadow border border-gray-200">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-800 text-white sticky top-0 z-10">
          <tr>
            <th className="px-2 py-2 text-center w-7">#</th>
            <th className="px-2 py-2 text-left min-w-36">Equipo</th>
            <th className="px-2 py-2 text-center font-bold w-10">Pts</th>
            <th className="px-2 py-2 text-center w-8 text-gray-300">PJ</th>
            <th className="px-2 py-2 text-center w-8 text-emerald-300">G</th>
            <th className="px-2 py-2 text-center w-8 text-yellow-300">E</th>
            <th className="px-2 py-2 text-center w-8 text-rose-300">P</th>
            <th className="px-2 py-2 text-center w-8 text-gray-300">GF</th>
            <th className="px-2 py-2 text-center w-8 text-gray-300">GC</th>
            <th className="px-2 py-2 text-center w-10 text-gray-300">DG</th>
            <th className="px-2 py-2 text-center min-w-28">Últimos 5</th>
            <th className="px-2 py-2 text-center min-w-24">
              <div>Probabilidades</div>
              <div className="flex gap-1.5 justify-center font-normal text-gray-400 mt-0.5">
                {ZONES.map(z => (
                  <span key={z.key} className="text-xs">{z.label.split(' ')[0]}</span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const gd = row.scoresFor - row.scoresAgainst;
            const form = last5ByTeam[row.team.name] || [];
            const probs = zoneProbabilities[row.team.name];
            const isSelected = selectedTeam === row.team.name;

            return (
              <tr
                key={row.team.name}
                onClick={() => onTeamClick(isSelected ? null : row.team.name)}
                className={`cursor-pointer transition-colors ${getZoneBorder(row.position)} ${
                  isSelected
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50 odd:bg-white even:bg-gray-50/60'
                }`}
              >
                <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{row.position}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TeamLogo teamName={row.team.name} size="xs" />
                    <span className={`truncate font-medium ${isSelected ? 'text-blue-700 font-bold' : 'text-gray-700'}`}>
                      {row.team.name}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center font-black text-blue-700">{row.points}</td>
                <td className="px-2 py-1.5 text-center text-gray-500">{row.played}</td>
                <td className="px-2 py-1.5 text-center text-emerald-600 font-medium">{row.wins}</td>
                <td className="px-2 py-1.5 text-center text-yellow-600 font-medium">{row.draws}</td>
                <td className="px-2 py-1.5 text-center text-rose-500 font-medium">{row.losses}</td>
                <td className="px-2 py-1.5 text-center text-gray-500">{row.scoresFor}</td>
                <td className="px-2 py-1.5 text-center text-gray-500">{row.scoresAgainst}</td>
                <td className={`px-2 py-1.5 text-center font-medium ${
                  gd > 0 ? 'text-emerald-600' : gd < 0 ? 'text-rose-500' : 'text-gray-400'
                }`}>
                  {gd > 0 ? `+${gd}` : gd}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-0.5 justify-center">
                    {form.length === 0
                      ? <span className="text-gray-300">—</span>
                      : form.map((f, idx) => (
                          <FormDot key={idx} result={f.result} isLocked={f.isLocked} />
                        ))
                    }
                  </div>
                </td>
                <td className="px-2 py-2">
                  <ZoneProbDisplay probs={probs} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex gap-4 flex-wrap items-center">
        {ZONES.map((z) => (
          <div key={z.key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2.5 h-2.5 rounded-sm ${z.color}`} />
            {z.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">V</span>
          <span className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">E</span>
          <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs">D</span>
          <span className="text-gray-400">(opaco = proyectado)</span>
        </div>
      </div>
    </div>
  );
}

// ── H2H Table ─────────────────────────────────────────────────────────────────
function H2HTable({ selectedTeam, h2hData, onClose }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">
            H2H: <span className="text-blue-700">{selectedTeam}</span>
          </h3>
          <p className="text-xs text-gray-400">vs cada rival (resultados proyectados)</p>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
        >
          ← Volver a clasificación
        </button>
      </div>

      <div className="overflow-auto rounded-xl shadow border border-gray-200">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-gray-800 text-white sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-center w-7">#</th>
              <th className="px-2 py-2 text-left min-w-36">Rival</th>
              <th className="px-2 py-2 text-center w-10 font-bold">Pts</th>
              <th className="px-2 py-2 text-center w-8 text-emerald-300">G</th>
              <th className="px-2 py-2 text-center w-8 text-yellow-300">E</th>
              <th className="px-2 py-2 text-center w-8 text-rose-300">P</th>
              <th className="px-2 py-2 text-center w-8 text-gray-300">GF</th>
              <th className="px-2 py-2 text-center w-8 text-gray-300">GC</th>
              <th className="px-2 py-2 text-center w-10 text-gray-300">DG</th>
            </tr>
          </thead>
          <tbody>
            {h2hData.map((row) => {
              const gd = row.goalDiff;
              return (
                <tr
                  key={row.opponentName}
                  className="odd:bg-white even:bg-gray-50/60 hover:bg-blue-50 transition-colors"
                >
                  <td className="px-2 py-1.5 text-center text-gray-400">{row.position}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <TeamLogo teamName={row.opponentName} size="xs" />
                      <span className="text-gray-700 font-medium">{row.opponentName}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center font-black text-blue-700">{row.h2hPoints}</td>
                  <td className="px-2 py-1.5 text-center text-emerald-600 font-medium">{row.wins}</td>
                  <td className="px-2 py-1.5 text-center text-yellow-600 font-medium">{row.draws}</td>
                  <td className="px-2 py-1.5 text-center text-rose-500 font-medium">{row.losses}</td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{row.goalsFor}</td>
                  <td className="px-2 py-1.5 text-center text-gray-500">{row.goalsAgainst}</td>
                  <td className={`px-2 py-1.5 text-center font-medium ${
                    gd > 0 ? 'text-emerald-600' : gd < 0 ? 'text-rose-500' : 'text-gray-400'
                  }`}>
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Match Calendar ─────────────────────────────────────────────────────────────
function MatchCalendar({ allMatches, pronosticos, lockedMatchIds, results, selectedTeam, onTeamClick }) {
  const byJornada = {};
  for (const m of allMatches) {
    if (!byJornada[m.jornada]) byJornada[m.jornada] = [];
    byJornada[m.jornada].push(m);
  }
  const jornadas = Object.keys(byJornada).map(Number).sort((a, b) => a - b);

  const filtered = (matches) =>
    selectedTeam
      ? matches.filter((m) => m.homeTeam === selectedTeam || m.awayTeam === selectedTeam)
      : matches;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          {selectedTeam ? `Partidos: ${selectedTeam}` : 'Calendario'}
        </h3>
        {selectedTeam && (
          <button
            onClick={() => onTeamClick(null)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Ver todos
          </button>
        )}
      </div>

      {jornadas.map((j) => {
        const matches = filtered(byJornada[j] || []);
        if (matches.length === 0) return null;
        return (
          <div key={j}>
            <p className="text-xs font-bold text-gray-500 uppercase mb-1.5 px-1">Jornada {j}</p>
            <div className="space-y-1.5">
              {matches.map((m) => {
                const pronos = pronosticos[m.id];
                const isLocked = lockedMatchIds[m.id] !== undefined;
                const result = results[m.id];
                const homeWins = result === '1';
                const draw = result === 'X';
                const homeHighlight = selectedTeam === m.homeTeam;
                const awayHighlight = selectedTeam === m.awayTeam;

                // Pronostico highlight logic (same as JornadaView)
                let pronosticoHighlight = null;
                if (isLocked) {
                  pronosticoHighlight = result === 'X' ? null : result;
                } else if (pronos) {
                  const max = Math.max(pronos.local, pronos.empate, pronos.visitante);
                  if (pronos.local === max) pronosticoHighlight = '1';
                  else if (pronos.visitante === max) pronosticoHighlight = '2';
                  else pronosticoHighlight = 'X';
                }

                return (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-2 text-xs ${
                      isLocked ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    {/* Teams row */}
                    <div className="flex items-center gap-1 justify-between">
                      <button
                        onClick={() => onTeamClick(m.homeTeam === selectedTeam ? null : m.homeTeam)}
                        className={`flex items-center gap-1 flex-1 min-w-0 text-left rounded px-1 py-0.5 transition-colors ${
                          homeHighlight ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <TeamLogo teamName={m.homeTeam} size="xs" />
                        <span className={`truncate ${isLocked && homeWins ? 'font-black' : 'font-medium'}`}>
                          {m.homeTeam}
                        </span>
                      </button>

                      <div className="shrink-0 px-1 text-center min-w-12">
                        {isLocked ? (
                          <div className="flex items-center gap-0.5 font-mono justify-center">
                            <span className={homeWins ? 'font-black text-gray-900' : 'font-normal text-gray-400'}>
                              {lockedMatchIds[m.id].split('-')[0]}
                            </span>
                            <span className="text-gray-400">-</span>
                            <span className={!homeWins && !draw ? 'font-black text-gray-900' : 'font-normal text-gray-400'}>
                              {lockedMatchIds[m.id].split('-')[1]}
                            </span>
                          </div>
                        ) : (
                          <span className={`font-bold ${
                            homeWins ? 'text-emerald-600' : draw ? 'text-yellow-600' : 'text-rose-500'
                          }`}>
                            {result === '1' ? '1' : result === 'X' ? 'X' : '2'}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onTeamClick(m.awayTeam === selectedTeam ? null : m.awayTeam)}
                        className={`flex items-center gap-1 flex-1 min-w-0 text-right justify-end rounded px-1 py-0.5 transition-colors ${
                          awayHighlight ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className={`truncate ${isLocked && !homeWins && !draw ? 'font-black' : 'font-medium'}`}>
                          {m.awayTeam}
                        </span>
                        <TeamLogo teamName={m.awayTeam} size="xs" />
                      </button>
                    </div>

                    {/* Pronostico row */}
                    {pronos && (
                      <div className="mt-1.5 flex gap-1 justify-center">
                        {[
                          { key: '1', label: 'L', value: pronos.local },
                          { key: 'X', label: 'E', value: pronos.empate },
                          { key: '2', label: 'V', value: pronos.visitante },
                        ].map(({ key, label, value }) => (
                          <span
                            key={key}
                            className={`px-1.5 py-0.5 rounded text-xs border ${
                              key === pronosticoHighlight
                                ? 'font-black border-blue-400 bg-blue-50 text-blue-700'
                                : 'font-medium border-gray-200 text-gray-500'
                            }`}
                          >
                            {label} {(value * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Jornada selector (dropdown) ────────────────────────────────────────────────
function JornadaSelector({ jornadas, effectiveEvalJornada, onChange }) {
  return (
    <select
      value={effectiveEvalJornada}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="border-2 border-blue-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors cursor-pointer"
    >
      {jornadas.map((j) => (
        <option key={j} value={j}>
          Jornada {j}
        </option>
      ))}
    </select>
  );
}

// ── Main ClasificacionView ─────────────────────────────────────────────────────
export default function ClasificacionView() {
  const { state, JORNADAS, leagueExternalId, seasonExternalId, selectedProbSource, setProbSource, probSources } = useSimulation();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const params = useParams();
  const navigate = useNavigate();

  // Compute the "current" jornada (next match's jornada) once matches are loaded
  const autoJornada = useMemo(
    () => state.allMatches.length > 0 ? computeCurrentJornada(state.allMatches) : null,
    [state.allMatches],
  );

  // evalJornada: from URL param if provided and valid, else auto jornada
  const urlJornada = params.jornada ? parseInt(params.jornada, 10) : null;
  const effectiveEvalJornada = useMemo(() => {
    if (urlJornada && !isNaN(urlJornada) && urlJornada >= 1 && urlJornada <= 42) return urlJornada;
    return autoJornada ?? (JORNADAS[JORNADAS.length - 1] ?? 42);
  }, [urlJornada, autoJornada, JORNADAS]);

  // When auto jornada is computed and no URL jornada is set, redirect to the canonical URL
  useEffect(() => {
    if (!params.jornada && leagueExternalId && seasonExternalId && autoJornada) {
      navigate(
        `/clasificacion/${leagueExternalId}/${seasonExternalId}/${autoJornada}`,
        { replace: true },
      );
    }
  }, [params.jornada, leagueExternalId, seasonExternalId, autoJornada, navigate]);

  // When jornada changes, update URL
  const handleJornadaChange = (j) => {
    if (leagueExternalId && seasonExternalId) {
      navigate(`/clasificacion/${leagueExternalId}/${seasonExternalId}/${j}`);
    }
  };

  // Filter matches to those in the evaluation window
  const filteredMatches = useMemo(
    () => state.allMatches.filter((m) => m.jornada <= effectiveEvalJornada),
    [state.allMatches, effectiveEvalJornada],
  );

  // Compute projected standings for the selected jornada window
  const localProjectedStandings = useMemo(() => {
    if (state.baseStandings.length === 0) return [];
    return calculateProjectedStandings(
      state.baseStandings,
      filteredMatches,
      state.results,
      state.lockedMatchIds,
      state.scores,
    );
  }, [state.baseStandings, filteredMatches, state.results, state.lockedMatchIds, state.scores]);

  // Zone probabilities via Monte Carlo for the filtered window
  const effectivePronosticos = useMemo(() => {
    if (selectedProbSource === 'equal') {
      const equalProno = { local: 1 / 3, empate: 1 / 3, visitante: 1 / 3 };
      const result = {};
      for (const m of filteredMatches) {
        if (!state.lockedMatchIds[m.id]) result[m.id] = equalProno;
      }
      return result;
    }
    return state.pronosticos;
  }, [selectedProbSource, filteredMatches, state.lockedMatchIds, state.pronosticos]);

  const zoneProbabilities = useMemo(() => {
    if (state.baseStandings.length === 0) return {};
    return runMonteCarloSimulations(
      filteredMatches,
      state.baseStandings,
      state.lockedMatchIds,
      effectivePronosticos,
      state.scores,
      state.results,
      500,
    );
  }, [filteredMatches, state.baseStandings, state.lockedMatchIds, effectivePronosticos, state.scores, state.results]);

  // Last 5 results per team (use filtered matches)
  const last5ByTeam = useMemo(
    () => getLast5Matches(filteredMatches, state.results, state.lockedMatchIds),
    [filteredMatches, state.results, state.lockedMatchIds],
  );

  // H2H data when a team is selected
  const h2hData = useMemo(() => {
    if (!selectedTeam) return null;
    return calculateH2H(
      selectedTeam,
      filteredMatches,
      state.results,
      state.scores,
      state.lockedMatchIds,
      localProjectedStandings,
    );
  }, [selectedTeam, filteredMatches, state.results, state.scores, state.lockedMatchIds, localProjectedStandings]);

  if (localProjectedStandings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Calculando clasificación…
      </div>
    );
  }

  const lastJornada = JORNADAS[JORNADAS.length - 1] ?? 42;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Jornada evaluator toolbar ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-6 shrink-0 flex-wrap">
        {/* Jornada dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide shrink-0">
            Hasta jornada:
          </span>
          <JornadaSelector
            jornadas={JORNADAS}
            effectiveEvalJornada={effectiveEvalJornada}
            onChange={handleJornadaChange}
          />
          {autoJornada && effectiveEvalJornada !== autoJornada && (
            <button
              onClick={() => handleJornadaChange(autoJornada)}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Actual
            </button>
          )}
        </div>

        {/* Probability source selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide shrink-0">
            Probabilidades:
          </span>
          <select
            value={selectedProbSource}
            onChange={(e) => setProbSource(e.target.value)}
            className="border-2 border-blue-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors cursor-pointer"
          >
            <option value="equal">Igual (1/3 cada una)</option>
            {probSources.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main content: standings + calendar ── */}
      <div className="flex gap-4 p-4 flex-1 overflow-hidden">
        {/* Left: standings or H2H */}
        <div className="flex-1 overflow-auto">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-800">
              {selectedTeam && h2hData ? null : 'Clasificación Completa'}
            </h2>
          </div>

          {selectedTeam && h2hData ? (
            <H2HTable
              selectedTeam={selectedTeam}
              h2hData={h2hData}
              onClose={() => setSelectedTeam(null)}
            />
          ) : (
            <FullStandingsTable
              standings={localProjectedStandings}
              zoneProbabilities={zoneProbabilities}
              last5ByTeam={last5ByTeam}
              selectedTeam={selectedTeam}
              onTeamClick={setSelectedTeam}
            />
          )}
        </div>

        {/* Right: calendar */}
        <div className="w-72 shrink-0 overflow-auto">
          <MatchCalendar
            allMatches={filteredMatches}
            pronosticos={effectivePronosticos}
            lockedMatchIds={state.lockedMatchIds}
            results={state.results}
            selectedTeam={selectedTeam}
            onTeamClick={setSelectedTeam}
          />
        </div>
      </div>
    </div>
  );
}

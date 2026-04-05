import { useState, useMemo } from 'react';
import { useSimulation } from '../context/SimulationContext';
import {
  runMonteCarloSimulations,
  getLast5Matches,
  calculateH2H,
} from '../utils/monteCarlo';
import TeamLogo from './TeamLogo';

// ── Zone helpers ───────────────────────────────────────────────────────────────
const ZONES = [
  { key: 'ascenso', label: 'Ascenso', color: 'bg-emerald-500', text: 'text-emerald-700', positions: [1, 2] },
  { key: 'playoff', label: 'Playoff', color: 'bg-blue-400', text: 'text-blue-700', positions: [3, 4, 5, 6] },
  { key: 'mid', label: 'Permanencia', color: 'bg-gray-300', text: 'text-gray-600', positions: [] },
  { key: 'descenso', label: 'Descenso', color: 'bg-rose-400', text: 'text-rose-700', positions: [] },
];

// Minimum probability (%) to render a zone segment in the bar chart
const MIN_PROB_PCT = 0.1;

function getZoneBorder(position) {
  if (position <= 2) return 'border-l-4 border-emerald-500';
  if (position <= 6) return 'border-l-4 border-blue-400';
  if (position >= 19) return 'border-l-4 border-rose-400';
  return 'border-l-4 border-transparent';
}

// ── Form dots ──────────────────────────────────────────────────────────────────
function FormDot({ result, isLocked }) {
  const base = 'w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold';
  const colors = {
    W: 'bg-emerald-500',
    D: 'bg-gray-400',
    L: 'bg-rose-500',
  };
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

// ── Zone probability mini-bars ─────────────────────────────────────────────────
function ZoneProbBars({ probs }) {
  if (!probs) return null;
  const bars = [
    { key: 'ascenso', color: 'bg-emerald-500', title: 'Ascenso directo' },
    { key: 'playoff', color: 'bg-blue-400', title: 'Playoff ascenso' },
    { key: 'mid', color: 'bg-gray-300', title: 'Permanencia' },
    { key: 'descenso', color: 'bg-rose-500', title: 'Descenso' },
  ];

  return (
    <div className="flex gap-px h-3 w-24 rounded overflow-hidden" title="Probabilidades por zona">
      {bars.map(({ key, color, title }) => {
        const pct = probs[key] || 0;
        if (pct < MIN_PROB_PCT) return null;
        return (
          <div
            key={key}
            className={`${color} h-full`}
            style={{ width: `${pct}%` }}
            title={`${title}: ${pct}%`}
          />
        );
      })}
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
            <th className="px-2 py-2 text-center min-w-28">Probabilidades</th>
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
                <td className="px-2 py-1.5">
                  <div className="flex flex-col items-center gap-0.5">
                    <ZoneProbBars probs={probs} />
                    {probs && (
                      <div className="flex gap-1 text-xs">
                        {probs.ascenso > 0 && (
                          <span className="text-emerald-600 font-medium">{probs.ascenso}%</span>
                        )}
                        {probs.playoff > 0 && (
                          <span className="text-blue-500 font-medium">{probs.playoff}%</span>
                        )}
                        {probs.descenso > 0 && (
                          <span className="text-rose-500 font-medium">{probs.descenso}%</span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex gap-4 flex-wrap">
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
  // Group by jornada
  const byJornada = {};
  for (const m of allMatches) {
    if (!byJornada[m.jornada]) byJornada[m.jornada] = [];
    byJornada[m.jornada].push(m);
  }
  const jornadas = Object.keys(byJornada)
    .map(Number)
    .sort((a, b) => a - b);

  // Filter to selected team if any
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

                return (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-2 text-xs ${
                      isLocked
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-white border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    {/* Teams row */}
                    <div className="flex items-center gap-1 justify-between">
                      {/* Home */}
                      <button
                        onClick={() => onTeamClick(m.homeTeam === selectedTeam ? null : m.homeTeam)}
                        className={`flex items-center gap-1 flex-1 min-w-0 text-left rounded px-1 py-0.5 transition-colors ${
                          homeHighlight ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <TeamLogo teamName={m.homeTeam} size="xs" />
                        <span className="truncate font-medium">{m.homeTeam}</span>
                      </button>

                      {/* Score or result indicator */}
                      <div className="shrink-0 px-1 text-center min-w-12">
                        {isLocked ? (
                          <span className="font-black text-gray-700">
                            {lockedMatchIds[m.id]}
                          </span>
                        ) : (
                          <span className={`font-bold ${
                            homeWins ? 'text-emerald-600' :
                            draw ? 'text-yellow-600' :
                            'text-rose-500'
                          }`}>
                            {result === '1' ? '1' : result === 'X' ? 'X' : '2'}
                          </span>
                        )}
                      </div>

                      {/* Away */}
                      <button
                        onClick={() => onTeamClick(m.awayTeam === selectedTeam ? null : m.awayTeam)}
                        className={`flex items-center gap-1 flex-1 min-w-0 text-right justify-end rounded px-1 py-0.5 transition-colors ${
                          awayHighlight ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate font-medium">{m.awayTeam}</span>
                        <TeamLogo teamName={m.awayTeam} size="xs" />
                      </button>
                    </div>

                    {/* Pronostico row */}
                    {pronos && (
                      <div className="mt-1.5 flex gap-1 justify-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${
                          result === '1' && !isLocked
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'border-gray-200 text-gray-500'
                        }`}>
                          {(pronos.local * 100).toFixed(0)}%
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${
                          result === 'X' && !isLocked
                            ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                            : 'border-gray-200 text-gray-500'
                        }`}>
                          {(pronos.empate * 100).toFixed(0)}%
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${
                          result === '2' && !isLocked
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'border-gray-200 text-gray-500'
                        }`}>
                          {(pronos.visitante * 100).toFixed(0)}%
                        </span>
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

// ── Main ClasificacionView ─────────────────────────────────────────────────────
export default function ClasificacionView() {
  const { projectedStandings, state } = useSimulation();
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Zone probabilities via Monte Carlo (runs whenever results/pronosticos change)
  const zoneProbabilities = useMemo(() => {
    if (state.baseStandings.length === 0) return {};
    return runMonteCarloSimulations(
      state.allMatches,
      state.baseStandings,
      state.lockedMatchIds,
      state.pronosticos,
      state.scores,
      state.results,
      500,
    );
  }, [
    state.allMatches,
    state.baseStandings,
    state.lockedMatchIds,
    state.pronosticos,
    state.scores,
    state.results,
  ]);

  // Last 5 results per team
  const last5ByTeam = useMemo(() => {
    return getLast5Matches(state.allMatches, state.results, state.lockedMatchIds);
  }, [state.allMatches, state.results, state.lockedMatchIds]);

  // H2H data when a team is selected
  const h2hData = useMemo(() => {
    if (!selectedTeam) return null;
    return calculateH2H(
      selectedTeam,
      state.allMatches,
      state.results,
      state.scores,
      state.lockedMatchIds,
      projectedStandings,
    );
  }, [selectedTeam, state.allMatches, state.results, state.scores, state.lockedMatchIds, projectedStandings]);

  if (projectedStandings.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Calculando clasificación…
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-4 h-full overflow-hidden">
      {/* ── Left panel: Full standings or H2H ── */}
      <div className="flex-1 overflow-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">
            {selectedTeam && h2hData
              ? null
              : 'Clasificación Completa'}
          </h2>
          {selectedTeam && !h2hData && (
            <span className="text-xs text-gray-400">Cargando H2H…</span>
          )}
        </div>

        {selectedTeam && h2hData ? (
          <H2HTable
            selectedTeam={selectedTeam}
            h2hData={h2hData}
            onClose={() => setSelectedTeam(null)}
          />
        ) : (
          <FullStandingsTable
            standings={projectedStandings}
            zoneProbabilities={zoneProbabilities}
            last5ByTeam={last5ByTeam}
            selectedTeam={selectedTeam}
            onTeamClick={setSelectedTeam}
          />
        )}
      </div>

      {/* ── Right panel: Match calendar ── */}
      <div className="w-72 shrink-0 overflow-auto">
        <MatchCalendar
          allMatches={state.allMatches}
          pronosticos={state.pronosticos}
          lockedMatchIds={state.lockedMatchIds}
          results={state.results}
          selectedTeam={selectedTeam}
          onTeamClick={setSelectedTeam}
        />
      </div>
    </div>
  );
}

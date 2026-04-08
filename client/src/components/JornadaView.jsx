import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import { isMatchLocked, isModified, parseResultado } from '../utils/standings';
import TeamLogo from './TeamLogo';

const RESULT_OPTIONS = [
    { value: "1", label: "1", title: "Local gana" },
    { value: "X", label: "×", title: "Empate" },
    { value: "2", label: "2", title: "Visitante gana" },
];

/**
 * Returns '1' | 'X' | '2' | null for the outcome with the highest pronostico probability.
 * Returns null when no pronostico or all values are equal.
 */
function getHighestProbResult(pronostico) {
    if (!pronostico) return null;
    const { local, empate, visitante } = pronostico;
    const max = Math.max(local, empate, visitante);
    if (local === max) return '1';
    if (visitante === max) return '2';
    return 'X';
}

/**
 * Renders the three pronostico percentage pills.
 * @param {string|null} highlightResult - '1' | 'X' | '2' | null – which pill to bold/highlight
 */
function PronosticoDisplay({ pronostico, highlightResult }) {
    const pills = [
        { key: '1', value: pronostico.local },
        { key: 'X', value: pronostico.empate },
        { key: '2', value: pronostico.visitante },
    ];
    return (
        <div className='flex gap-1 mt-1 justify-center flex-wrap'>
            {pills.map(({ key, value }) => {
                const isHighlighted = key === highlightResult;
                return (
                    <span
                        key={key}
                        title={
                            key === "1"
                                ? "Local"
                                : key === "X"
                                  ? "Empate"
                                  : "Visitante"
                        }
                        className={`px-1.5 py-0.5 rounded text-xs border border-gray-200 text-gray-500 ${
                            isHighlighted
                                ? "bg-blue-100/60 border-blue-300 text-blue-800"
                                : ""
                        }`}
                    >
                        {(value * 100).toFixed(0)}%
                    </span>
                );
            })}
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

export function ResultSelector({ match }) {
    const { state, dispatch } = useSimulation();
    const locked = isMatchLocked(match.id, state.lockedMatchIds);
    const current = state.results[match.id];
    const score = state.scores[match.id] || { home: 0, away: 0 };
    // Only show pronostico pills when the match has real odds (probIsFinal)
    const rawPronostico = state.pronosticos[match.id];
    const matchInfo = state.allMatches.find((m) => m.id === match.id);
    const pronostico = (matchInfo?.probIsFinal && rawPronostico) ? rawPronostico : null;

    const handleGoalChange = (side, val) => {
        const newHome = side === 'home' ? val : score.home;
        const newAway = side === 'away' ? val : score.away;
        dispatch({ type: 'SET_SCORE', payload: { matchId: match.id, home: newHome, away: newAway } });
    };

    if (locked) {
        const scoreStr = state.lockedMatchIds[match.id];
        // e.g. "1-3" → home=1, away=3
        const parts = scoreStr.split('-');
        const homeGoals = parseInt(parts[0], 10);
        const awayGoals = parseInt(parts[1], 10);
        const winnerResult = parseResultado(scoreStr); // '1' | 'X' | '2'
        // For pronostico highlight: match the actual outcome. Null if draw (don't highlight).
        const pronosticoHighlight = winnerResult === 'X' ? null : winnerResult;

        return (
            <div className="flex flex-col items-center gap-0.5">
                {/* Score: bold the winner's side */}
                <div className="flex items-center gap-0.5 font-mono text-2xl tracking-widest text-gray-700">
                    <span className={homeGoals > awayGoals ? 'font-black text-gray-900' : 'font-normal text-gray-400'}>
                        {homeGoals}
                    </span>
                    <span className="font-normal text-gray-400">-</span>
                    <span className={awayGoals > homeGoals ? 'font-black text-gray-900' : 'font-normal text-gray-400'}>
                        {awayGoals}
                    </span>
                </div>
                {pronostico && (
                    <PronosticoDisplay pronostico={pronostico} highlightResult={pronosticoHighlight} />
                )}
            </div>
        );
    }

    // Unlocked match: highlight the pronostico of the highest-probability outcome
    const pronosticoHighlight = getHighestProbResult(pronostico);

    return (
        <div className="flex flex-col items-center gap-1.5">
            {/* Goal inputs */}
            <div className="flex items-center gap-2">
                <GoalInput value={score.home} onChange={(v) => handleGoalChange('home', v)} />
                <span className="text-gray-300 font-bold text-lg">—</span>
                <GoalInput value={score.away} onChange={(v) => handleGoalChange('away', v)} />
            </div>

            {/* 1/X/2 selector */}
            <div className="inline-flex rounded-lg overflow-hidden border-2 border-gray-200">
                {RESULT_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        title={opt.title}
                        onClick={() =>
                            dispatch({ type: 'SET_RESULT', payload: { matchId: match.id, result: opt.value } })
                        }
                        className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                            current === opt.value
                                ? 'bg-blue-400 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Pronostico: highlight highest-probability outcome */}
            {pronostico && (
                <PronosticoDisplay pronostico={pronostico} highlightResult={pronosticoHighlight} />
            )}
        </div>
    );
}

export default function JornadaView() {
    const { state, dispatch, JORNADAS, leagueSlug, seasonYear } = useSimulation();
    const params = useParams();
    const navigate = useNavigate();

    // Jornada from URL params takes priority; fall back to context currentJornada
    const urlJornada = params.jornada ? parseInt(params.jornada, 10) : null;
    const jornada = (urlJornada && !isNaN(urlJornada)) ? urlJornada : (state.currentJornada ?? JORNADAS[0] ?? 1);

    // On mount without URL jornada, redirect to canonical URL
    useEffect(() => {
        if (!params.jornada && leagueSlug && seasonYear && state.currentJornada) {
            navigate(
                `/jornadas/${leagueSlug}/${seasonYear}/${state.currentJornada}`,
                { replace: true },
            );
        }
    }, [params.jornada, leagueSlug, seasonYear, state.currentJornada, navigate]);

    // Sync URL jornada back into context so other views that read currentJornada stay in sync
    useEffect(() => {
        if (urlJornada && !isNaN(urlJornada) && urlJornada !== state.currentJornada) {
            dispatch({ type: 'SET_JORNADA', payload: urlJornada });
        }
    }, [urlJornada, state.currentJornada, dispatch]);

    const handleJornadaChange = (j) => {
        if (leagueSlug && seasonYear) {
            navigate(`/jornadas/${leagueSlug}/${seasonYear}/${j}`);
        } else {
            dispatch({ type: 'SET_JORNADA', payload: j });
        }
    };

    const matches = state.allMatches
        .filter((m) => m.jornada === jornada)
        .sort((a, b) => a.startTimestamp - b.startTimestamp);

    return (
        <div className='px-2 py-4'>
            {/* Jornada navigator with dropdown */}
            <div className='flex items-center justify-center mb-5 gap-3'>
                <label htmlFor="jornada-select" className="text-sm font-semibold text-gray-700 shrink-0">
                    Jornada:
                </label>
                <div className="relative inline-block">
                    <select
                        id="jornada-select"
                        className="appearance-none bg-white border-2 border-blue-200 text-gray-700 font-semibold rounded-xl pl-4 pr-10 py-2 text-sm shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 cursor-pointer transition-all"
                        value={jornada}
                        onChange={(e) => handleJornadaChange(parseInt(e.target.value, 10))}
                    >
                        {JORNADAS.map((j) => (
                            <option key={j} value={j}>Jornada {j}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-blue-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Match list */}
            {matches.length === 0 ? (
                <p className='text-center text-gray-500'>
                    Cargando partidos...
                </p>
            ) : (
                <div className='space-y-3'>
                    {matches.map((match) => {
                        const locked = isMatchLocked(
                            match.id,
                            state.lockedMatchIds,
                        );
                        const modified = isModified(match.id, state);
                        // For locked matches, determine winning team name
                        const scoreStr = locked
                            ? state.lockedMatchIds[match.id]
                            : null;
                        const winnerResult = scoreStr
                            ? parseResultado(scoreStr)
                            : null;
                        const homeWins = winnerResult === "1";
                        const awayWins = winnerResult === "2";

                        return (
                            <div
                                key={match.id}
                                className={`rounded-xl border p-3 sm:p-4 flex items-center justify-between gap-3 transition-all ${
                                    locked
                                        ? "bg-gray-50 border-gray-200 opacity-80"
                                        : modified
                                          ? "bg-white border-yellow-400 border-t-4"
                                          : "bg-white border-gray-200"
                                }`}
                            >
                                {/* Home team */}
                                <div className='flex flex-col items-end gap-1 flex-1 min-w-0'>
                                    <div className='flex items-center gap-2 justify-end w-full'>
                                        <span
                                            className={`font-semibold text-sm truncate ${
                                                locked
                                                    ? homeWins
                                                        ? "text-gray-900 font-black"
                                                        : "text-gray-500"
                                                    : "text-gray-800"
                                            }`}
                                        >
                                            {match.homeTeam}
                                        </span>
                                        <TeamLogo
                                            teamName={match.homeTeam}
                                            size='md'
                                        />
                                    </div>
                                </div>

                                {/* Center: inputs / score */}
                                <div className='flex flex-col items-center gap-1 shrink-0 min-w-37.5'>
                                    <ResultSelector match={match} />
                                </div>

                                {/* Away team */}
                                <div className='flex flex-col items-start gap-1 flex-1 min-w-0'>
                                    <div className='flex items-center gap-2 justify-start w-full'>
                                        <TeamLogo
                                            teamName={match.awayTeam}
                                            size='md'
                                        />
                                        <span
                                            className={`font-semibold text-sm truncate ${
                                                locked
                                                    ? awayWins
                                                        ? "text-gray-900 font-black"
                                                        : "text-gray-500"
                                                    : "text-gray-800"
                                            }`}
                                        >
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

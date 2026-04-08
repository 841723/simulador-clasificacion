import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimulation } from "../context/SimulationContext";
import { isMatchLocked, isModified } from "../utils/standings";
import { getTeamColor } from "../utils/teamColors";
import TeamLogo from "./TeamLogo";

const MAX_SELECTED_TEAMS = 5;

function MatchCell({ match, teamName }) {
    const { state, dispatch } = useSimulation();
    const locked = isMatchLocked(match.id, state.lockedMatchIds);
    const current = state.results[match.id];
    const modified = isModified(match.id, state);

    const isHome = match.homeTeam === teamName;
    const opponent = isHome ? match.awayTeam : match.homeTeam;

    const teamWins =
        (isHome && current === "1") || (!isHome && current === "2");
    const teamDraws = current === "X";
    const resultLabel = teamWins
        ? "Victoria"
        : teamDraws
          ? "Empate"
          : "Derrota";

    // Click a logo: losing→draw, drawing→win, winning→keep
    const handleLogoClick = (newResult) => {
        if (newResult !== "1" && newResult !== "2" && newResult !== "X") return;
        dispatch({
            type: "SET_RESULT",
            payload: { matchId: match.id, result: newResult },
        });
    };

    const venueLabel = isHome ? "Local" : "Visitante";

    return (
        <td
            className={`border border-gray-200 p-2 align-top min-w-37.5 ${
                modified ? "border-l-4 border-l-yellow-400 bg-yellow-50/40" : ""
            }`}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Opponent + venue */}
            <div className='flex items-center gap-1 mb-1.5'>
                <span className='text-xs text-gray-700 font-medium truncate'>
                    {venueLabel} vs{" "}
                    <span className='font-semibold'>{opponent}</span>
                </span>
            </div>

            <div className='mt-1 flex items-center gap-2'>
                <button
                    onClick={() => handleLogoClick("1")}
                    title={match.homeTeam}
                    disabled={locked}
                    className={`p-1 rounded-lg border-2 transition-all disabled:opacity-50 ${
                        current === "1"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 not-disabled:hover:border-gray-300"
                    }`}
                >
                    <TeamLogo teamName={match.homeTeam} size='sm' />
                </button>
                <button
                    onClick={() => handleLogoClick("X")}
                    title={match.awayTeam}
                    disabled={locked}
                    className={`px-2 py-1 rounded-lg border-2 transition-all disabled:opacity-50 ${
                        current === "X"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 not-disabled:hover:border-gray-300"
                    }`}
                >
                    <span className='w-4 h-4 font-medium text-gray-400'>×</span>
                </button>
                <button
                    onClick={() => handleLogoClick("2")}
                    title={match.awayTeam}
                    disabled={locked}
                    className={`p-1 rounded-lg border-2 transition-all disabled:opacity-50 ${
                        current === "2"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 not-disabled:hover:border-gray-300"
                    }`}
                >
                    <TeamLogo teamName={match.awayTeam} size='sm' />
                </button>
                <span className='text-xs text-gray-500 font-medium'>
                    {resultLabel}
                </span>
            </div>
        </td>
    );
}

export default function TeamView() {
    const { state, dispatch, projectedStandings, JORNADAS, leagueSlug, seasonYear } = useSimulation();
    const params = useParams();
    const navigate = useNavigate();

    // On mount without URL params, redirect to canonical URL
    useEffect(() => {
        if (!params.leagueSlug && leagueSlug && seasonYear) {
            navigate(`/equipos/${leagueSlug}/${seasonYear}`, { replace: true });
        }
    }, [params.leagueSlug, leagueSlug, seasonYear, navigate]);

    const nowTs = Math.floor(Date.now() / 1000);

    // Only show future jornadas (where at least one match hasn't started yet)
    const futureJornadas = JORNADAS.filter((j) =>
        state.allMatches.some((m) => m.jornada === j && m.startTimestamp && m.startTimestamp > nowTs),
    );

    const allTeams = projectedStandings.map((r) => r.team.name);
    const selected = state.selectedTeams;
    const atMax = selected.length >= MAX_SELECTED_TEAMS;

    function toggleTeam(name) {
        if (!selected.includes(name) && atMax) return;
        dispatch({ type: "TOGGLE_TEAM", payload: { teamName: name } });
    }

    // Build jornada → matches map for selected teams (future jornadas only)
    const jornadaMatchMap = {};
    for (const j of futureJornadas) {
        jornadaMatchMap[j] = {};
        for (const team of selected) {
            const match = state.allMatches.find(
                (m) =>
                    m.jornada === j &&
                    (m.homeTeam === team || m.awayTeam === team),
            );
            jornadaMatchMap[j][team] = match || null;
        }
    }

    return (
        <div className='px-2 py-4'>
            <h2 className='text-lg font-bold text-gray-800 mb-3'>
                Vista por Equipo
            </h2>

            {/* Team selector */}
            <div className='mb-4'>
                <p className='text-xs font-medium text-gray-500 mb-2'>
                    Selecciona hasta {MAX_SELECTED_TEAMS} equipos:
                </p>
                <div className='flex flex-wrap gap-1.5'>
                    {allTeams.map((name) => {
                        const isSelected = selected.includes(name);
                        const color = getTeamColor(name, selected);
                        const pos = projectedStandings.find(
                            (r) => r.team.name === name,
                        )?.position;
                        const disabled = !isSelected && atMax;
                        return (
                            <button
                                key={name}
                                onClick={() => toggleTeam(name)}
                                disabled={disabled}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                                    isSelected && color
                                        ? `${color.bg} text-white border-transparent`
                                        : disabled
                                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                                }`}
                            >
                                <TeamLogo teamName={name} size='xs' />
                                {pos}. {name}
                            </button>
                        );
                    })}
                </div>
                {atMax && (
                    <p className="mt-1 text-xs text-amber-600">
                        Máximo {MAX_SELECTED_TEAMS} equipos seleccionados.
                    </p>
                )}
                {selected.length > 0 && (
                    <button
                        onClick={() =>
                            dispatch({
                                type: "SET_SELECTED_TEAMS",
                                payload: [],
                            })
                        }
                        className='mt-2 text-xs text-rose-500 hover:text-rose-700 underline'
                    >
                        Limpiar selección
                    </button>
                )}
            </div>

            {selected.length === 0 ? (
                <div className='text-center text-gray-400 py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300'>
                    <p className='text-base'>Selecciona al menos un equipo</p>
                </div>
            ) : (
                <>
                    {/* Reset buttons per team */}
                    <div className='flex gap-2 flex-wrap mb-3'>
                        {selected.map((team) => {
                            const color = getTeamColor(team, selected);
                            return (
                                <button
                                    key={team}
                                    onClick={() =>
                                        dispatch({
                                            type: "RESET_TEAM",
                                            payload: { teamName: team },
                                        })
                                    }
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg font-medium border transition-colors ${
                                        color
                                            ? `${color.light} ${color.text} ${color.border}`
                                            : "bg-orange-50 text-orange-700 border-orange-300"
                                    }`}
                                >
                                    <TeamLogo teamName={team} size='xs' />↺
                                    Reset {team}
                                </button>
                            );
                        })}
                    </div>

                    {futureJornadas.length === 0 ? (
                        <div className='text-center text-gray-400 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300'>
                            <p className='text-sm'>No hay jornadas futuras pendientes</p>
                        </div>
                    ) : (
                        /* Results table */
                        <div className='overflow-x-auto rounded-xl shadow border border-gray-200'>
                            <table className='text-sm border-collapse min-w-full'>
                                <thead>
                                    <tr>
                                        <th className='border border-gray-300 px-3 py-2 bg-gray-800 text-white text-left min-w-12.5 text-xs'>
                                            J
                                        </th>
                                        {selected.map((team) => {
                                            const color = getTeamColor(
                                                team,
                                                selected,
                                            );
                                            return (
                                                <th
                                                    key={team}
                                                    className={`border border-gray-300 px-3 py-2 text-left min-w-37.5 ${
                                                        color
                                                            ? color.header
                                                            : "bg-blue-900 text-white"
                                                    }`}
                                                >
                                                    <div className='flex items-center gap-1.5'>
                                                        <TeamLogo
                                                            teamName={team}
                                                            size='xs'
                                                        />
                                                        <span className='text-xs font-semibold'>
                                                            {team}
                                                        </span>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {futureJornadas.map((j) => (
                                        <tr
                                            key={j}
                                            className='odd:bg-white even:bg-gray-50/50'
                                        >
                                            <td className='border border-gray-200 px-3 py-2 font-semibold text-blue-700 text-sm'>
                                                {j}
                                            </td>
                                            {selected.map((team) => {
                                                const match =
                                                    jornadaMatchMap[j][team];
                                                if (!match) {
                                                    return (
                                                        <td
                                                            key={team}
                                                            className='border border-gray-200 p-2 text-gray-400 text-xs italic text-center'
                                                        >
                                                            —
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <MatchCell
                                                        key={team}
                                                        match={match}
                                                        teamName={team}
                                                    />
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useSimulation } from "./context/SimulationContext";
import Header from "./components/Header";
import SimulationManager from "./components/SimulationManager";
import JornadaView from "./components/JornadaView";
import TeamView from "./components/TeamView";
import StandingsTable from "./components/StandingsTable";
import ClasificacionView from "./components/ClasificacionView";
import { Logo } from "./components/Logo";

// ── URL → season syncer ────────────────────────────────────────────────────────
// Reads leagueSlug/seasonYear/jornada from the current URL path and keeps
// selectedSeasonId in sync. Also navigates bare paths to their canonical full URL
// once season data and current-jornada are available.
// The URL is the single source of truth for application state.
function UrlSeasonSync() {
    const {
        state,
        allSeasons,
        seasonsLoaded,
        selectedSeasonId,
        setSelectedSeasonId,
        findSeasonId,
    } = useSimulation();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!seasonsLoaded || allSeasons.length === 0) return;

        const path = location.pathname;

        // Match full-param patterns: /:view/:leagueSlug/:seasonYear[/:jornada]
        const match =
            path.match(/^\/(?:jornadas|equipos|clasificacion)\/([^/]+)\/([^/]+)(?:\/|$)/) ||
            path.match(/^\/(?:jornadas|equipos|clasificacion)\/([^/]+)\/([^/]+)$/);

        if (match) {
            // Full URL – keep selectedSeasonId in sync with URL params
            const urlLeagueSlug = match[1];
            const urlSeasonYear = match[2];
            const foundId = findSeasonId(urlLeagueSlug, urlSeasonYear);
            if (foundId && foundId !== selectedSeasonId) {
                setSelectedSeasonId(foundId);
            } else if (!foundId) {
                // Unrecognised league/season → redirect to default
                const defaultSeason = allSeasons[0];
                if (defaultSeason) {
                    const fy = defaultSeason.year.replace('/', '-');
                    const base = path.startsWith('/equipos') ? 'equipos' :
                                  path.startsWith('/clasificacion') ? 'clasificacion' : 'jornadas';
                    navigate(`/${base}/${defaultSeason.leagueSlug}/${fy}`, { replace: true });
                }
            }
        } else {
            // Bare URL (/jornadas, /equipos, /clasificacion, /) – pick a season if needed
            if (!selectedSeasonId && allSeasons.length > 0) {
                setSelectedSeasonId(allSeasons[0].id);
            }

            // Once season data + current jornada are loaded, redirect to the canonical URL
            // so the user always lands on a fully-qualified URL they can share.
            if (state.leagueSlug && state.seasonYear && state.currentJornada) {
                const base = path.startsWith('/equipos') ? 'equipos' :
                              path.startsWith('/clasificacion') ? 'clasificacion' : 'jornadas';
                if (base === 'equipos') {
                    navigate(`/equipos/${state.leagueSlug}/${state.seasonYear}`, { replace: true });
                } else {
                    navigate(
                        `/${base}/${state.leagueSlug}/${state.seasonYear}/${state.currentJornada}`,
                        { replace: true },
                    );
                }
            }
        }
    // We intentionally scope this effect to path + season/jornada state changes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, seasonsLoaded, allSeasons, state.leagueSlug, state.seasonYear, state.currentJornada]);

    return null;
}

// ── View syncer (activeView for legacy code) ──────────────────────────────────
function ViewSyncer() {
    const { dispatch } = useSimulation();
    const location = useLocation();
    useEffect(() => {
        if (location.pathname.startsWith("/equipos")) dispatch({ type: "SET_VIEW", payload: "teams" });
        else if (location.pathname.startsWith("/clasificacion")) dispatch({ type: "SET_VIEW", payload: "clasificacion" });
        else dispatch({ type: "SET_VIEW", payload: "jornada" });
    }, [location.pathname, dispatch]);
    return null;
}

function AppContent() {
    const { state, seasonsLoaded } = useSimulation();

    // Show loading screen while seasons haven't loaded yet OR while data is loading
    if (!seasonsLoaded || state.loading) {
        return (
            <div className='min-h-screen bg-gray-100 flex items-center justify-center'>
                <div className='text-center flex flex-col items-center gap-4'>
                    <Logo className="w-14 h-14 text-black animate-bounce" />
                    <p className='text-gray-600 text-lg font-medium'>
                        Cargando datos...
                    </p>
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className='min-h-screen bg-gray-100 flex items-center justify-center'>
                <div className='text-center text-red-600 bg-white rounded-2xl p-8 shadow'>
                    <p className='text-lg font-semibold mb-1'>
                        Error al cargar datos
                    </p>
                    <p className='text-sm text-gray-500'>{state.error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className='h-screen bg-gray-100 flex flex-col overflow-hidden'>
            <UrlSeasonSync />
            <ViewSyncer />
            <Header />

            <Routes>
                {/* Root → jornadas */}
                <Route path='/' element={<Navigate to='/jornadas' replace />} />

                {/* ── Jornadas ──────────────────────────────────────────────────
                    Bare path renders a loading shell; UrlSeasonSync will redirect
                    to the full canonical URL once season data is available.        */}
                <Route
                    path='/jornadas'
                    element={
                        <>
                            <SimulationManager />
                            <main className='grid grid-cols-[3fr_1fr] p-4 relative overflow-auto flex-1' />
                        </>
                    }
                />
                <Route
                    path='/jornadas/:leagueSlug/:seasonYear/:jornada'
                    element={
                        <>
                            <SimulationManager />
                            <main className='grid grid-cols-[3fr_1fr] p-4 relative overflow-auto flex-1'>
                                <JornadaView />
                                <StandingsTable />
                            </main>
                        </>
                    }
                />

                {/* ── Equipos ───────────────────────────────────────────────── */}
                <Route
                    path='/equipos'
                    element={
                        <>
                            <SimulationManager />
                            <main className='grid grid-cols-[3fr_1fr] p-4 relative overflow-auto flex-1' />
                        </>
                    }
                />
                <Route
                    path='/equipos/:leagueSlug/:seasonYear'
                    element={
                        <>
                            <SimulationManager />
                            <main className='grid grid-cols-[3fr_1fr] p-4 relative overflow-auto flex-1'>
                                <TeamView />
                                <div className='sticky top-0 self-start'>
                                    <StandingsTable />
                                </div>
                            </main>
                        </>
                    }
                />

                {/* ── Clasificación ─────────────────────────────────────────── */}
                <Route
                    path='/clasificacion'
                    element={<main className='flex-1 overflow-hidden' />}
                />
                <Route
                    path='/clasificacion/:leagueSlug/:seasonYear/:jornada'
                    element={
                        <main className='flex-1 overflow-hidden'>
                            <ClasificacionView />
                        </main>
                    }
                />

                {/* Catch-all → jornadas */}
                <Route path='*' element={<Navigate to='/jornadas' replace />} />
            </Routes>
        </div>
    );
}

export default function App() {
    return <AppContent />;
}

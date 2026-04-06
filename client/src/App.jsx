import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useSimulation } from "./context/SimulationContext";
import Header from "./components/Header";
import SimulationManager from "./components/SimulationManager";
import JornadaView from "./components/JornadaView";
import TeamView from "./components/TeamView";
import StandingsTable from "./components/StandingsTable";
import ClasificacionView from "./components/ClasificacionView";
import { Logo } from "./components/Logo";

// Sync URL → state.activeView so legacy code that reads activeView still works
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
    const { state } = useSimulation();

    if (state.loading) {
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
            <ViewSyncer />
            <Header />

            <Routes>
                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/jornadas" replace />} />

                {/* Jornadas */}
                <Route path="/jornadas" element={
                    <>
                        <SimulationManager />
                        <main className='grid grid-cols-[3fr_1fr] p-4 relative overflow-auto flex-1'>
                            <JornadaView />
                            <StandingsTable />
                        </main>
                    </>
                } />

                {/* Equipos */}
                <Route path="/equipos" element={
                    <>
                        <SimulationManager />
                        <main className='grid grid-cols-[3fr_1fr] p-4 relative overflow-auto flex-1'>
                            <TeamView />
                            <StandingsTable />
                        </main>
                    </>
                } />

                {/* Clasificación */}
                <Route path="/clasificacion" element={
                    <main className='flex-1 overflow-hidden'>
                        <ClasificacionView />
                    </main>
                } />

                {/* Catch-all → jornadas */}
                <Route path="*" element={<Navigate to="/jornadas" replace />} />
            </Routes>
        </div>
    );
}

export default function App() {
    return <AppContent />;
}

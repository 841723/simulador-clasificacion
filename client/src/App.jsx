import { useSimulation } from "./context/SimulationContext";
import Header from "./components/Header";
import SimulationManager from "./components/SimulationManager";
import JornadaView from "./components/JornadaView";
import TeamView from "./components/TeamView";
import StandingsTable from "./components/StandingsTable";
import { Logo } from "./components/Logo";

function AppContent() {
    const { state } = useSimulation();

    if (state.loading) {
        return (
            <div className='min-h-screen bg-gray-100 flex items-center justify-center'>
                <div className='text-center flex flex-col items-center gap-4'>
                    <Logo className="w-14 h-1w-14 text-black animate-bounce" />
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
        <div className='h-screen bg-gray-100 flex flex-col'>
            <Header />
            <SimulationManager />

            <main className='grid grid-cols-[3fr_1fr] p-4 relative'>
                {/* Main content */}
                {state.activeView === "jornada" && <JornadaView />}
                {state.activeView === "teams" && <TeamView />}
                <StandingsTable />
            </main>
        </div>
    );
}

export default function App() {
    return <AppContent />;
}

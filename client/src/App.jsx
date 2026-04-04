import { useSimulation } from './context/SimulationContext';
import Header from './components/Header';
import SimulationManager from './components/SimulationManager';
import JornadaView from './components/JornadaView';
import TeamView from './components/TeamView';
import StandingsTable from './components/StandingsTable';

function AppContent() {
  const { state } = useSimulation();

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">⚽</div>
          <p className="text-gray-600 text-lg font-medium">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center text-red-600 bg-white rounded-2xl p-8 shadow">
          <p className="text-lg font-semibold mb-1">Error al cargar datos</p>
          <p className="text-sm text-gray-500">{state.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <SimulationManager />

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4">
          {state.activeView === 'jornada' && <JornadaView />}
          {state.activeView === 'teams' && <TeamView />}
        </main>

        {/* Sticky sidebar standings */}
        <aside className="w-72 shrink-0 overflow-y-auto bg-white border-l border-gray-200 shadow-inner">
          <StandingsTable />
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⚽</div>
          <p className="text-gray-600 text-lg font-medium">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold">Error al cargar datos</p>
          <p className="text-sm mt-1">{state.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <SimulationManager />
      <main>
        {state.activeView === 'jornada' && <JornadaView />}
        {state.activeView === 'teams' && <TeamView />}
        {state.activeView === 'standings' && <StandingsTable />}
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}

import { useSimulation } from '../context/SimulationContext';

const TABS = [
  { id: 'jornada', label: 'Por Jornada' },
  { id: 'teams', label: 'Por Equipo' },
  { id: 'standings', label: 'Clasificación' },
];

export default function Header() {
  const { state, dispatch } = useSimulation();

  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Simulador de Clasificación</h1>
            <p className="text-xs text-blue-200">LaLiga 2 · Desde jornada 34</p>
          </div>
        </div>
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: tab.id })}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                state.activeView === tab.id
                  ? 'bg-white text-blue-900'
                  : 'text-blue-100 hover:bg-blue-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

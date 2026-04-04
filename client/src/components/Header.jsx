import { useSimulation } from '../context/SimulationContext';
import { Logo } from "./Logo.jsx";

const TABS = [
  { id: 'jornada', label: 'Jornadas' },
  { id: 'teams', label: 'Equipos' },
];

export default function Header() {
  const { state, dispatch } = useSimulation();

  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <picture>
            <Logo className="w-10 h-10" />
          </picture>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Simulador de Clasificación</h1>
            <p className="text-xs text-blue-200">LaLiga 2</p>
          </div>
        </div>

        {/* Active simulation name */}
        {state.activeSimulationName && (
          <div className="hidden sm:flex items-center gap-1 bg-blue-800 rounded-lg px-3 py-1 text-xs shrink-0">
            <span className="text-blue-300">Simulación:</span>
            <span className="font-semibold text-yellow-300 truncate max-w-40">
              {state.activeSimulationName}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex gap-1 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: tab.id })}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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

      {/* Mobile sim name */}
      {state.activeSimulationName && (
        <div className="sm:hidden bg-blue-800 px-4 py-1 text-xs text-center">
          <span className="text-blue-300">Simulación activa: </span>
          <span className="font-semibold text-yellow-300">{state.activeSimulationName}</span>
        </div>
      )}
    </header>
  );
}

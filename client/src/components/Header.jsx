import { NavLink } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import { Logo } from "./Logo.jsx";

const TABS = [
  { path: '/jornadas',      label: 'Jornadas' },
  { path: '/equipos',       label: 'Equipos' },
  { path: '/clasificacion', label: 'Clasificación' },
];

export default function Header() {
  const { state } = useSimulation();

  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand + league/season selector */}
        <div className="flex items-center gap-3 min-w-0">
          <picture>
            <Logo className="w-10 h-10" />
          </picture>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">Simulador de Clasificación</h1>
            {/* League / season selector — prepared for multiple leagues & seasons */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <select
                className="bg-blue-800 text-blue-100 text-xs rounded px-1.5 py-0.5 border border-blue-600 focus:outline-none focus:border-blue-400 disabled:opacity-70"
                defaultValue="laliga2"
                disabled
                title="Selección de liga (próximamente)"
              >
                <option value="laliga2">LaLiga 2</option>
              </select>
              <select
                className="bg-blue-800 text-blue-100 text-xs rounded px-1.5 py-0.5 border border-blue-600 focus:outline-none focus:border-blue-400 disabled:opacity-70"
                defaultValue="2024-25"
                disabled
                title="Selección de temporada (próximamente)"
              >
                <option value="2024-25">2024-25</option>
              </select>
            </div>
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
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-blue-900'
                    : 'text-blue-100 hover:bg-blue-800'
                }`
              }
            >
              {tab.label}
            </NavLink>
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

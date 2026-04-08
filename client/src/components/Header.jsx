import { useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import { Logo } from "./Logo.jsx";

export default function Header() {
  const { state, leagueSlug, seasonYear, allSeasons, selectedSeasonId, setSelectedSeasonId } = useSimulation();
  const navigate = useNavigate();

  // Build canonical tab paths once slug/year are known
  const jornadaPath = leagueSlug && seasonYear && state.currentJornada
    ? `/jornadas/${leagueSlug}/${seasonYear}/${state.currentJornada}`
    : '/jornadas';
  const equiposPath = leagueSlug && seasonYear
    ? `/equipos/${leagueSlug}/${seasonYear}`
    : '/equipos';
  const clasificacionPath = leagueSlug && seasonYear && state.currentJornada
    ? `/clasificacion/${leagueSlug}/${seasonYear}/${state.currentJornada}`
    : '/clasificacion';

  const TABS = [
    { path: jornadaPath,      base: '/jornadas',      label: 'Jornadas' },
    { path: equiposPath,      base: '/equipos',       label: 'Equipos' },
    { path: clasificacionPath, base: '/clasificacion', label: 'Clasificación' },
  ];

  // Derive unique leagues from allSeasons
  const leagues = useMemo(() => {
    const seen = new Set();
    return allSeasons.filter((s) => {
      if (seen.has(s.leagueSlug)) return false;
      seen.add(s.leagueSlug);
      return true;
    });
  }, [allSeasons]);

  // Current season info
  const currentSeason = allSeasons.find((s) => String(s.id) === String(selectedSeasonId));
  const currentLeagueSlug = currentSeason?.leagueSlug ?? '';

  // Seasons for the current league
  const seasonsForLeague = useMemo(
    () => allSeasons.filter((s) => s.leagueSlug === currentLeagueSlug),
    [allSeasons, currentLeagueSlug],
  );

  function handleLeagueChange(newLeagueSlug) {
    // Pick the first (most recent) season of the selected league
    const first = allSeasons.find((s) => s.leagueSlug === newLeagueSlug);
    if (first) handleSeasonChange(first.id);
  }

  function handleSeasonChange(newSeasonId) {
    setSelectedSeasonId(newSeasonId);
    // Navigate to jornadas root so it auto-redirects to the right jornada
    navigate('/jornadas');
  }

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
            {/* League / season selector */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {/* League dropdown */}
              <select
                className="bg-blue-800 text-blue-100 text-xs rounded px-1.5 py-0.5 border border-blue-600 focus:outline-none focus:border-blue-400 cursor-pointer"
                value={currentLeagueSlug}
                onChange={(e) => handleLeagueChange(e.target.value)}
                disabled={leagues.length <= 1}
              >
                {leagues.length === 0 && (
                  <option value="">—</option>
                )}
                {leagues.map((l) => (
                  <option key={l.leagueSlug} value={l.leagueSlug}>
                    {l.leagueName}
                  </option>
                ))}
              </select>
              {/* Season dropdown */}
              <select
                className="bg-blue-800 text-blue-100 text-xs rounded px-1.5 py-0.5 border border-blue-600 focus:outline-none focus:border-blue-400 cursor-pointer"
                value={selectedSeasonId}
                onChange={(e) => handleSeasonChange(Number(e.target.value))}
                disabled={seasonsForLeague.length <= 1}
              >
                {seasonsForLeague.length === 0 && (
                  <option value="">—</option>
                )}
                {seasonsForLeague.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.year}
                  </option>
                ))}
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
              key={tab.base}
              to={tab.path}
              end={false}
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


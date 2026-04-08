import { useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSimulation } from '../context/SimulationContext';
import { Logo } from "./Logo.jsx";

export default function Header() {
  const { state, allSeasons, leagueSlug, seasonYear } = useSimulation();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Derive unique leagues ──────────────────────────────────────────────
  const leagues = useMemo(() => {
    const seen = new Set();
    return allSeasons.filter((s) => {
      if (seen.has(s.leagueSlug)) return false;
      seen.add(s.leagueSlug);
      return true;
    });
  }, [allSeasons]);

  // Current league / season from URL params (or from loaded state as fallback)
  const currentLeagueSlug = leagueSlug ?? '';
  const currentSeasonYear = seasonYear ?? '';  // e.g. "25-26"

  // Seasons for the active league
  const seasonsForLeague = useMemo(
    () => allSeasons.filter((s) => s.leagueSlug === currentLeagueSlug),
    [allSeasons, currentLeagueSlug],
  );

  // ── Navigation helpers ─────────────────────────────────────────────────
  // Build path keeping the same view but swapping league/season
  function buildPath(newLeagueSlug, newSeasonYear) {
    const fy = newSeasonYear.replace('/', '-');
    const path = location.pathname;
    if (path.startsWith('/equipos')) return `/equipos/${newLeagueSlug}/${fy}`;
    if (path.startsWith('/clasificacion')) {
      // keep jornada if present
      const m = path.match(/^\/clasificacion\/[^/]+\/[^/]+\/(\d+)/);
      return m ? `/clasificacion/${newLeagueSlug}/${fy}/${m[1]}` : `/clasificacion/${newLeagueSlug}/${fy}`;
    }
    // jornadas (default)
    const m = path.match(/^\/jornadas\/[^/]+\/[^/]+\/(\d+)/);
    return m ? `/jornadas/${newLeagueSlug}/${fy}/${m[1]}` : `/jornadas/${newLeagueSlug}/${fy}`;
  }

  function handleLeagueChange(newLeagueSlug) {
    const firstSeason = allSeasons.find((s) => s.leagueSlug === newLeagueSlug);
    if (!firstSeason) return;
    navigate(buildPath(newLeagueSlug, firstSeason.year), { replace: false });
  }

  function handleSeasonChange(newSeasonYear) {
    navigate(buildPath(currentLeagueSlug, newSeasonYear), { replace: false });
  }

  // ── Tab paths (canonical, with slug/year/jornada) ─────────────────────
  const jornadaPath = currentLeagueSlug && currentSeasonYear && state.currentJornada
    ? `/jornadas/${currentLeagueSlug}/${currentSeasonYear}/${state.currentJornada}`
    : '/jornadas';
  const equiposPath = currentLeagueSlug && currentSeasonYear
    ? `/equipos/${currentLeagueSlug}/${currentSeasonYear}`
    : '/equipos';
  const clasificacionPath = currentLeagueSlug && currentSeasonYear && state.currentJornada
    ? `/clasificacion/${currentLeagueSlug}/${currentSeasonYear}/${state.currentJornada}`
    : '/clasificacion';

  const TABS = [
    { path: jornadaPath,      base: '/jornadas',      label: 'Jornadas' },
    { path: equiposPath,      base: '/equipos',       label: 'Equipos' },
    { path: clasificacionPath, base: '/clasificacion', label: 'Clasificación' },
  ];

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
            <div className="flex items-center gap-1.5 mt-0.5">
              {/* League dropdown – shows current league, navigates on change */}
              <select
                className="bg-blue-800 text-blue-100 text-xs rounded px-1.5 py-0.5 border border-blue-600 focus:outline-none focus:border-blue-400 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                value={currentLeagueSlug}
                onChange={(e) => handleLeagueChange(e.target.value)}
                disabled={leagues.length <= 1}
              >
                {leagues.length === 0 && <option value="">—</option>}
                {leagues.map((l) => (
                  <option key={l.leagueSlug} value={l.leagueSlug}>
                    {l.leagueName}
                  </option>
                ))}
              </select>
              {/* Season dropdown – shows current season year, navigates on change */}
              <select
                className="bg-blue-800 text-blue-100 text-xs rounded px-1.5 py-0.5 border border-blue-600 focus:outline-none focus:border-blue-400 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                value={currentSeasonYear.replace('-', '/')}  /* stored as "25/26", shown that way */
                onChange={(e) => handleSeasonChange(e.target.value)}
                disabled={seasonsForLeague.length <= 1}
              >
                {seasonsForLeague.length === 0 && <option value="">—</option>}
                {seasonsForLeague.map((s) => (
                  <option key={s.id} value={s.year}>
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

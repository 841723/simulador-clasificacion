import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import {
  buildInitialResults,
  calculateProjectedStandings,
  isMatchLocked,
} from '../utils/standings';

const SimulationContext = createContext(null);

const JORNADAS = [34, 35, 36, 37, 38, 39, 40, 41, 42];
const STANDINGS_URL = '/standings/2026-04-04-16-55.json';

function buildJornadaUrls() {
  return JORNADAS.map((j) => `/jornadas/${j}.json`);
}

const initialState = {
  loading: true,
  error: null,
  baseStandings: [],          // raw rows from standings JSON
  allMatches: [],             // flat list of all matches across jornadas
  results: {},                // matchId → "1" | "X" | "2"
  originalResults: {},        // initial computed results (for reset)
  lockedMatchIds: {},         // matchId → resultado string (e.g. "1-3")
  savedSimulations: {},       // name → { results }
  activeSimulationName: null, // name of currently loaded/saved simulation
  selectedTeams: [],
  currentJornada: 34,
  activeView: 'jornada',      // 'jornada' | 'teams'
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA': {
      const { baseStandings, allMatches, lockedMatchIds } = action.payload;
      const results = buildInitialResults(allMatches, baseStandings, lockedMatchIds);
      const originalResults = { ...results };
      return {
        ...state,
        loading: false,
        baseStandings,
        allMatches,
        results,
        originalResults,
        lockedMatchIds,
      };
    }
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'SET_RESULT': {
      const { matchId, result } = action.payload;
      // Prevent modifying locked matches
      if (isMatchLocked(matchId, state.lockedMatchIds)) return state;
      return { ...state, results: { ...state.results, [matchId]: result } };
    }
    case 'SAVE_SIMULATION': {
      const { name } = action.payload;
      const updated = {
        ...state.savedSimulations,
        [name]: { results: { ...state.results } },
      };
      try {
        localStorage.setItem('savedSimulations', JSON.stringify(updated));
      } catch (_) {}
      return { ...state, savedSimulations: updated, activeSimulationName: name };
    }
    case 'LOAD_SIMULATION': {
      const { name } = action.payload;
      const sim = state.savedSimulations[name];
      if (!sim) return state;
      return { ...state, results: { ...sim.results }, activeSimulationName: name };
    }
    case 'DELETE_SIMULATION': {
      const { name } = action.payload;
      const updated = { ...state.savedSimulations };
      delete updated[name];
      try {
        localStorage.setItem('savedSimulations', JSON.stringify(updated));
      } catch (_) {}
      const activeSimulationName =
        state.activeSimulationName === name ? null : state.activeSimulationName;
      return { ...state, savedSimulations: updated, activeSimulationName };
    }
    case 'RESET_SIMULATION':
      return {
        ...state,
        results: { ...state.originalResults },
        activeSimulationName: null,
      };

    case 'RESET_TEAM': {
      const { teamName } = action.payload;
      const teamMatches = state.allMatches.filter(
        (m) => m.homeTeam === teamName || m.awayTeam === teamName
      );
      const resetResults = { ...state.results };
      for (const m of teamMatches) {
        if (!isMatchLocked(m.id, state.lockedMatchIds)) {
          resetResults[m.id] = state.originalResults[m.id];
        }
      }
      return { ...state, results: resetResults };
    }

    case 'TOGGLE_TEAM': {
      const { teamName } = action.payload;
      const already = state.selectedTeams.includes(teamName);
      return {
        ...state,
        selectedTeams: already
          ? state.selectedTeams.filter((t) => t !== teamName)
          : [...state.selectedTeams, teamName],
      };
    }
    case 'SET_SELECTED_TEAMS':
      return { ...state, selectedTeams: action.payload };

    case 'SET_JORNADA':
      return { ...state, currentJornada: action.payload };

    case 'SET_VIEW':
      return { ...state, activeView: action.payload };

    case 'LOAD_SAVED_SIMS':
      return { ...state, savedSimulations: action.payload };

    default:
      return state;
  }
}

export function SimulationProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [teamSlugMap, setTeamSlugMap] = React.useState({});
  const [teamImages, setTeamImages] = React.useState({});

  // Load saved simulations from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('savedSimulations');
      if (raw) {
        dispatch({ type: 'LOAD_SAVED_SIMS', payload: JSON.parse(raw) });
      }
    } catch (_) {}
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    async function fetchAll() {
      try {
        const [standingsRes, resultadosRes, teamsRes, ...jornadaRes] = await Promise.all([
          fetch(STANDINGS_URL),
          fetch('/resultados.json'),
          fetch('/teams.json'),
          ...buildJornadaUrls().map((url) => fetch(url)),
        ]);

        const standingsData = await standingsRes.json();
        const baseStandings = standingsData.standings[0].rows;

        const resultadosData = await resultadosRes.json();
        const teamsData = await teamsRes.json();

        // Build lockedMatchIds: matchId → resultado string (only non-empty)
        const lockedMatchIds = {};
        for (const jornada of Object.values(resultadosData)) {
          for (const match of Object.values(jornada)) {
            if (match.resultado !== '') {
              lockedMatchIds[match.id] = match.resultado;
            }
          }
        }

        // Build team images map: slug → image URL
        const images = {};
        for (const [slug, data] of Object.entries(teamsData)) {
          images[slug] = data.imagen;
        }
        setTeamImages(images);

        const jornadaDataArr = await Promise.all(jornadaRes.map((r) => r.json()));

        // Build slug map while parsing match data
        const slugMap = {};
        const allMatches = jornadaDataArr.flatMap((data) =>
          data.events.map((e) => {
            slugMap[e.homeTeam.name] = e.homeTeam.slug;
            slugMap[e.awayTeam.name] = e.awayTeam.slug;
            return {
              id: e.id,
              jornada: e.roundInfo.round,
              homeTeam: e.homeTeam.name,
              homeTeamSlug: e.homeTeam.slug,
              awayTeam: e.awayTeam.name,
              awayTeamSlug: e.awayTeam.slug,
              homeScore: e.homeScore?.current ?? null,
              awayScore: e.awayScore?.current ?? null,
              status: e.status.description,
              winnerCode: e.winnerCode ?? null,
              startTimestamp: e.startTimestamp,
            };
          })
        );

        setTeamSlugMap(slugMap);
        dispatch({ type: 'LOAD_DATA', payload: { baseStandings, allMatches, lockedMatchIds } });
      } catch (err) {
        dispatch({ type: 'LOAD_ERROR', payload: err.message });
      }
    }
    fetchAll();
  }, []);

  // Compute projected standings whenever results or lockedMatchIds change
  const projectedStandings = useMemo(() => {
    if (state.baseStandings.length === 0) return [];
    return calculateProjectedStandings(
      state.baseStandings,
      state.allMatches,
      state.results,
      state.lockedMatchIds
    );
  }, [state.baseStandings, state.allMatches, state.results, state.lockedMatchIds]);

  const value = {
    state,
    dispatch,
    projectedStandings,
    JORNADAS,
    teamSlugMap,
    teamImages,
  };
  return (
    <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used inside SimulationProvider');
  return ctx;
}

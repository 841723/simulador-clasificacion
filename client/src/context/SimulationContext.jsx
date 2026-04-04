import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import {
  buildInitialResults,
  buildInitialScores,
  defaultScoreForResult,
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
  scores: {},                 // matchId → { home: number, away: number }
  originalScores: {},         // initial computed scores (for reset)
  lockedMatchIds: {},         // matchId → resultado string (e.g. "1-3")
  pronosticos: {},            // matchId → { local, empate, visitante }
  savedSimulations: {},       // name → { results, scores }
  activeSimulationName: null, // name of currently loaded/saved simulation
  selectedTeams: [],
  currentJornada: 34,
  activeView: 'jornada',      // 'jornada' | 'teams'
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA': {
      const { baseStandings, allMatches, lockedMatchIds, pronosticos } = action.payload;
      const results = buildInitialResults(allMatches, baseStandings, lockedMatchIds);
      const scores = buildInitialScores(allMatches, results, lockedMatchIds);
      return {
        ...state,
        loading: false,
        baseStandings,
        allMatches,
        results,
        originalResults: { ...results },
        scores,
        originalScores: { ...scores },
        lockedMatchIds,
        pronosticos,
      };
    }
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'SET_RESULT': {
      const { matchId, result } = action.payload;
      if (isMatchLocked(matchId, state.lockedMatchIds)) return state;
      const score = defaultScoreForResult(result);
      return {
        ...state,
        results: { ...state.results, [matchId]: result },
        scores: { ...state.scores, [matchId]: score },
      };
    }

    case 'SET_SCORE': {
      const { matchId, home, away } = action.payload;
      if (isMatchLocked(matchId, state.lockedMatchIds)) return state;
      const result = home > away ? '1' : home < away ? '2' : 'X';
      return {
        ...state,
        scores: { ...state.scores, [matchId]: { home, away } },
        results: { ...state.results, [matchId]: result },
      };
    }

    case 'SAVE_SIMULATION': {
      const { name } = action.payload;
      const updated = {
        ...state.savedSimulations,
        [name]: { results: { ...state.results }, scores: { ...state.scores } },
      };
      try {
        localStorage.setItem('savedSimulations', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving simulation:', e);
      }
      return { ...state, savedSimulations: updated, activeSimulationName: name };
    }
    case 'LOAD_SIMULATION': {
      const { name } = action.payload;
      const sim = state.savedSimulations[name];
      if (!sim) return state;
      const results = { ...sim.results };
      const scores = sim.scores
        ? { ...sim.scores }
        : buildInitialScores(state.allMatches, results, state.lockedMatchIds);
      return { ...state, results, scores, activeSimulationName: name };
    }
    case 'DELETE_SIMULATION': {
      const { name } = action.payload;
      const updated = { ...state.savedSimulations };
      delete updated[name];
      try {
        localStorage.setItem('savedSimulations', JSON.stringify(updated));
      } catch (e) {
        console.error('Error deleting simulation:', e);
      }
      const activeSimulationName =
        state.activeSimulationName === name ? null : state.activeSimulationName;
      return { ...state, savedSimulations: updated, activeSimulationName };
    }
    case 'RESET_SIMULATION':
      return {
        ...state,
        results: { ...state.originalResults },
        scores: { ...state.originalScores },
        activeSimulationName: null,
      };

    case 'RESET_TEAM': {
      const { teamName } = action.payload;
      const teamMatches = state.allMatches.filter(
        (m) => m.homeTeam === teamName || m.awayTeam === teamName
      );
      const resetResults = { ...state.results };
      const resetScores = { ...state.scores };
      for (const m of teamMatches) {
        if (!isMatchLocked(m.id, state.lockedMatchIds)) {
          resetResults[m.id] = state.originalResults[m.id];
          resetScores[m.id] = state.originalScores[m.id];
        }
      }
      return { ...state, results: resetResults, scores: resetScores };
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
    } catch (e) {      
      console.error('Error loading saved simulations:', e);
    }
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

        // Build lockedMatchIds and pronosticos
        const lockedMatchIds = {};
        const pronosticos = {};
        for (const jornada of Object.values(resultadosData)) {
          for (const match of Object.values(jornada)) {
            if (match.resultado !== '') {
              lockedMatchIds[match.id] = match.resultado;
            }
            if (match.pronostico) {
              pronosticos[match.id] = match.pronostico;
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
        dispatch({
          type: 'LOAD_DATA',
          payload: { baseStandings, allMatches, lockedMatchIds, pronosticos },
        });
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
      state.lockedMatchIds,
      state.scores
    );
  }, [state.baseStandings, state.allMatches, state.results, state.lockedMatchIds, state.scores]);

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

// eslint-disable-next-line react-refresh/only-export-components
export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used inside SimulationProvider');
  return ctx;
}

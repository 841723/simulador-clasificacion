import { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import {
  buildInitialResults,
  calculateProjectedStandings,
  isMatchFinished,
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
  baseStandings: [],      // raw rows from standings JSON
  allMatches: [],         // flat list of all matches across jornadas
  results: {},            // matchId → "1" | "X" | "2"
  originalResults: {},    // initial computed results (for reset)
  savedSimulations: {},   // name → { results }
  selectedTeams: [],
  currentJornada: 34,
  activeView: 'jornada', // 'jornada' | 'teams' | 'standings'
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA': {
      const { baseStandings, allMatches } = action.payload;
      const results = buildInitialResults(allMatches, baseStandings);
      const originalResults = { ...results };
      return {
        ...state,
        loading: false,
        baseStandings,
        allMatches,
        results,
        originalResults,
      };
    }
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'SET_RESULT': {
      const { matchId, result } = action.payload;
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
      return { ...state, savedSimulations: updated };
    }
    case 'LOAD_SIMULATION': {
      const { name } = action.payload;
      const sim = state.savedSimulations[name];
      if (!sim) return state;
      return { ...state, results: { ...sim.results } };
    }
    case 'DELETE_SIMULATION': {
      const { name } = action.payload;
      const updated = { ...state.savedSimulations };
      delete updated[name];
      try {
        localStorage.setItem('savedSimulations', JSON.stringify(updated));
      } catch (_) {}
      return { ...state, savedSimulations: updated };
    }
    case 'RESET_SIMULATION':
      return { ...state, results: { ...state.originalResults } };

    case 'RESET_TEAM': {
      const { teamName } = action.payload;
      const teamMatches = state.allMatches.filter(
        (m) => m.homeTeam === teamName || m.awayTeam === teamName
      );
      const resetResults = { ...state.results };
      for (const m of teamMatches) {
        if (!isMatchFinished(m.status)) {
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
        const [standingsRes, ...jornadaRes] = await Promise.all([
          fetch(STANDINGS_URL),
          ...buildJornadaUrls().map((url) => fetch(url)),
        ]);

        const standingsData = await standingsRes.json();
        const baseStandings = standingsData.standings[0].rows;

        const jornadaDataArr = await Promise.all(jornadaRes.map((r) => r.json()));
        const allMatches = jornadaDataArr.flatMap((data) =>
          data.events.map((e) => ({
            id: e.id,
            jornada: e.roundInfo.round,
            homeTeam: e.homeTeam.name,
            awayTeam: e.awayTeam.name,
            homeScore: e.homeScore?.current ?? null,
            awayScore: e.awayScore?.current ?? null,
            status: e.status.description,
            winnerCode: e.winnerCode ?? null,
            startTimestamp: e.startTimestamp,
          }))
        );

        dispatch({ type: 'LOAD_DATA', payload: { baseStandings, allMatches } });
      } catch (err) {
        dispatch({ type: 'LOAD_ERROR', payload: err.message });
      }
    }
    fetchAll();
  }, []);

  // Compute projected standings whenever results change
  const projectedStandings = useMemo(() => {
    if (state.baseStandings.length === 0) return [];
    return calculateProjectedStandings(state.baseStandings, state.allMatches, state.results);
  }, [state.baseStandings, state.allMatches, state.results]);

  const value = { state, dispatch, projectedStandings, JORNADAS };
  return (
    <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used inside SimulationProvider');
  return ctx;
}

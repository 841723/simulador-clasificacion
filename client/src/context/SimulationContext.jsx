import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import {
  buildInitialResults,
  buildInitialScores,
  defaultScoreForResult,
  calculateProjectedStandings,
  isMatchLocked,
} from '../utils/standings';
import { computeCurrentJornada } from '../utils/navigation';

const SimulationContext = createContext(null);

// Default season id – can be overridden via VITE_SEASON_ID env var
const SEASON_ID = import.meta.env.VITE_SEASON_ID || 1;

const initialState = {
  loading: true,
  error: null,
  seasonId: SEASON_ID,
  leagueExternalId: null,   // SofaScore uniqueTournament id
  seasonExternalId: null,   // SofaScore season id
  baseStandings: [],          // raw rows from API
  allMatches: [],             // flat list of all matches
  results: {},                // matchId → "1" | "X" | "2"
  originalResults: {},        // initial computed results (for reset)
  scores: {},                 // matchId → { home: number, away: number }
  originalScores: {},         // initial computed scores (for reset)
  lockedMatchIds: {},         // matchId → resultado string (e.g. "1-3")
  pronosticos: {},            // matchId → { local, empate, visitante }
  savedSimulations: {},       // uuid → { uuid, name, results?, scores? }
  activeSimulationName: null, // name of currently loaded/saved simulation
  activeSimulationUuid: null, // uuid of currently loaded/saved simulation
  selectedTeams: [],
  currentJornada: null,       // computed from next future match after data loads
  activeView: 'jornada',      // 'jornada' | 'teams' | 'clasificacion'
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA': {
      const { baseStandings, allMatches, lockedMatchIds, pronosticos, leagueExternalId, seasonExternalId } = action.payload;
      const results = buildInitialResults(allMatches, baseStandings, lockedMatchIds);
      const scores = buildInitialScores(allMatches, results, lockedMatchIds);
      const jornadas = [...new Set(allMatches.map((m) => m.jornada))].sort((a, b) => a - b);
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
        leagueExternalId: leagueExternalId ?? state.leagueExternalId,
        seasonExternalId: seasonExternalId ?? state.seasonExternalId,
        currentJornada: computeCurrentJornada(allMatches, jornadas[jornadas.length - 1] ?? 42),
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
      const { name, uuid } = action.payload;
      const entry = { uuid, name, results: { ...state.results }, scores: { ...state.scores } };
      const updated = { ...state.savedSimulations, [uuid]: entry };
      return { ...state, savedSimulations: updated, activeSimulationName: name, activeSimulationUuid: uuid };
    }
    case 'LOAD_SIMULATION': {
      const { uuid } = action.payload;
      const sim = state.savedSimulations[uuid];
      if (!sim) return state;
      const results = { ...sim.results };
      const scores = sim.scores
        ? { ...sim.scores }
        : buildInitialScores(state.allMatches, results, state.lockedMatchIds);
      return { ...state, results, scores, activeSimulationName: sim.name, activeSimulationUuid: uuid };
    }
    case 'DELETE_SIMULATION': {
      const { uuid } = action.payload;
      const updated = { ...state.savedSimulations };
      delete updated[uuid];
      const activeSimulationName = state.activeSimulationUuid === uuid ? null : state.activeSimulationName;
      const activeSimulationUuid = state.activeSimulationUuid === uuid ? null : state.activeSimulationUuid;
      return { ...state, savedSimulations: updated, activeSimulationName, activeSimulationUuid };
    }
    case 'RESET_SIMULATION':
      return {
        ...state,
        results: { ...state.originalResults },
        scores: { ...state.originalScores },
        activeSimulationName: null,
        activeSimulationUuid: null,
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
  const [teamImages, setTeamImages] = React.useState({});
  const [teamSlugMap, setTeamSlugMap] = React.useState({});
  const [probSources, setProbSources] = React.useState([]);
  const [selectedProbSource, setSelectedProbSource] = React.useState('odds');

  // ── Load probability sources on mount ─────────────────────────────────
  useEffect(() => {
    async function loadProbSources() {
      try {
        const res = await fetch('/api/probability-sources');
        if (!res.ok) return;
        const sources = await res.json();
        setProbSources(sources);
      } catch {
        // silently ignore
      }
    }
    loadProbSources();
  }, []);

  // ── Load saved simulations from API on mount ────────────────────────────
  useEffect(() => {
    async function loadSims() {
      try {
        const res = await fetch(`/api/simulations?seasonId=${SEASON_ID}`);
        if (!res.ok) return;
        const sims = await res.json();
        const simMap = {};
        for (const s of sims) simMap[s.uuid] = s;
        dispatch({ type: 'LOAD_SAVED_SIMS', payload: simMap });
      } catch {
        // silently ignore – app works without saved simulations
      }
    }
    loadSims();
  }, []);

  // ── Fetch all data from REST API on mount ──────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      try {
        const [standingsRes, matchesRes, teamsRes, seasonsRes] = await Promise.all([
          fetch(`/api/seasons/${SEASON_ID}/standings`),
          fetch(`/api/seasons/${SEASON_ID}/matches`),
          fetch('/api/teams'),
          fetch('/api/seasons'),
        ]);

        if (!standingsRes.ok) throw new Error(`Standings API error: ${standingsRes.status}`);
        if (!matchesRes.ok) throw new Error(`Matches API error: ${matchesRes.status}`);

        const baseStandings = await standingsRes.json();
        const matchesData = await matchesRes.json();
        const teamsData = teamsRes.ok ? await teamsRes.json() : [];
        const seasonsData = seasonsRes.ok ? await seasonsRes.json() : [];

        // Extract external IDs for the current season
        const currentSeasonInfo = seasonsData.find((s) => String(s.id) === String(SEASON_ID));
        const leagueExternalId = currentSeasonInfo?.leagueExternalId ?? null;
        const seasonExternalId = currentSeasonInfo?.seasonExternalId ?? null;

        // Build team images map: slug → imageUrl
        const images = {};
        const slugMap = {};
        for (const t of teamsData) {
          if (t.imageUrl) images[t.slug] = t.imageUrl;
          if (t.name) slugMap[t.name] = t.slug;
        }
        // Also pick up image URLs from matches data
        for (const m of matchesData) {
          if (m.homeTeamImageUrl) images[m.homeTeamSlug] = m.homeTeamImageUrl;
          if (m.awayTeamImageUrl) images[m.awayTeamSlug] = m.awayTeamImageUrl;
          slugMap[m.homeTeam] = m.homeTeamSlug;
          slugMap[m.awayTeam] = m.awayTeamSlug;
        }
        setTeamImages(images);
        setTeamSlugMap(slugMap);

        // Build lockedMatchIds and pronosticos from matches
        const lockedMatchIds = {};
        const pronosticos = {};
        for (const m of matchesData) {
          if (m.isLocked && m.lockedResult) {
            lockedMatchIds[m.id] = m.lockedResult;
          }
          if (m.pronostico) {
            pronosticos[m.id] = m.pronostico;
          }
        }

        // Shape matches to the format standings.js expects
        const allMatches = matchesData.map((m) => ({
          id: m.id,
          jornada: m.jornada,
          homeTeam: m.homeTeam,
          homeTeamSlug: m.homeTeamSlug,
          awayTeam: m.awayTeam,
          awayTeamSlug: m.awayTeamSlug,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          winnerCode: m.winnerCode,
          startTimestamp: m.startTimestamp,
        }));

        dispatch({
          type: 'LOAD_DATA',
          payload: { baseStandings, allMatches, lockedMatchIds, pronosticos, leagueExternalId, seasonExternalId },
        });
      } catch (err) {
        dispatch({ type: 'LOAD_ERROR', payload: err.message });
      }
    }
    fetchAll();
  }, []);

  // ── Compute projected standings ────────────────────────────────────────
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

  // ── Derive JORNADAS list dynamically from loaded matches ───────────────
  const JORNADAS = useMemo(
    () => [...new Set(state.allMatches.map((m) => m.jornada))].sort((a, b) => a - b),
    [state.allMatches],
  );

  // ── Simulation persistence helpers (callable from SimulationManager) ───
  async function saveSimulationToAPI(name) {
    const body = {
      name,
      seasonId: SEASON_ID,
      results: state.results,
      scores: state.scores,
      uuid: state.activeSimulationUuid || undefined,
    };
    const res = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to save simulation');
    const { uuid } = await res.json();
    dispatch({ type: 'SAVE_SIMULATION', payload: { name, uuid } });
    return uuid;
  }

  async function loadSimulationFromAPI(uuid) {
    const cached = state.savedSimulations[uuid];
    if (cached?.results) {
      dispatch({ type: 'LOAD_SIMULATION', payload: { uuid } });
      return;
    }
    const res = await fetch(`/api/simulations/${uuid}`);
    if (!res.ok) throw new Error('Failed to load simulation');
    const sim = await res.json();
    const updated = { ...state.savedSimulations, [uuid]: sim };
    dispatch({ type: 'LOAD_SAVED_SIMS', payload: updated });
    dispatch({ type: 'LOAD_SIMULATION', payload: { uuid } });
  }

  async function deleteSimulationFromAPI(uuid) {
    await fetch(`/api/simulations/${uuid}`, { method: 'DELETE' });
    dispatch({ type: 'DELETE_SIMULATION', payload: { uuid } });
  }

  const value = {
    state,
    dispatch,
    projectedStandings,
    JORNADAS,
    teamSlugMap,
    teamImages,
    saveSimulationToAPI,
    loadSimulationFromAPI,
    deleteSimulationFromAPI,
    SEASON_ID,
    leagueExternalId: state.leagueExternalId,
    seasonExternalId: state.seasonExternalId,
    probSources,
    selectedProbSource,
    setProbSource: setSelectedProbSource,
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

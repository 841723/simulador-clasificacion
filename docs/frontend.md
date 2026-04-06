# Frontend – Documentación técnica

React 18 + Vite + Tailwind CSS SPA que sirve el simulador interactivo de clasificación.

## Iniciar el cliente

```bash
cd client
npm install
npm run dev      # Servidor de desarrollo en http://localhost:5173
npm run build    # Build de producción → client/dist/
npm run preview  # Previsualiza el build de producción
```

## Variables de entorno

| Variable         | Descripción                       | Default |
|------------------|-----------------------------------|---------|
| `VITE_SEASON_ID` | ID interno de la temporada a usar | `1`     |

## Estructura de rutas

| Ruta                                              | Componente        | Descripción |
|---------------------------------------------------|-------------------|-------------|
| `/`                                               | —                 | Redirige a `/jornadas` |
| `/jornadas`                                       | JornadaView       | Redirige a URL canónica con jornada actual |
| `/jornadas/:leagueExtId/:seasonExtId/:jornada`   | JornadaView       | Vista de partidos de una jornada |
| `/equipos`                                        | TeamView          | Redirige a URL canónica |
| `/equipos/:leagueExtId/:seasonExtId`             | TeamView          | Vista comparativa por equipo |
| `/clasificacion`                                  | ClasificacionView | Redirige a URL canónica con jornada actual |
| `/clasificacion/:leagueExtId/:seasonExtId/:jornada` | ClasificacionView | Clasificación hasta esa jornada con Monte Carlo |

## Arquitectura de componentes

```
App.jsx
├── Header.jsx               Links de navegación con URLs canónicas
├── SimulationManager.jsx    Guardar / cargar / eliminar simulaciones
├── JornadaView.jsx          Lista de partidos con selector de jornada (dropdown)
│   └── ResultSelector.jsx   Inputs de goles + botones 1/X/2 + probabilidades
├── TeamView.jsx             Tabla por equipo (máx 5, solo jornadas futuras)
├── ClasificacionView.jsx    Clasificación completa + Monte Carlo + H2H
│   ├── FullStandingsTable   Tabla con forma, puntos, probabilidades de zona
│   ├── H2HTable             Tabla cabeza a cabeza al seleccionar un equipo
│   ├── MatchCalendar        Calendario lateral de partidos
│   └── JornadaSelector      Dropdown de selección de jornada
└── StandingsTable.jsx       Clasificación proyectada en sidebar (sticky en /equipos)
```

## Gestión de estado (SimulationContext)

`client/src/context/SimulationContext.jsx` provee un contexto global con:

| Estado / función         | Descripción |
|--------------------------|-------------|
| `state.allMatches`       | Todos los partidos de la temporada |
| `state.results`          | `matchId → '1'|'X'|'2'` (editable) |
| `state.scores`           | `matchId → { home, away }` |
| `state.lockedMatchIds`   | Partidos finalizados (no editables) |
| `state.pronosticos`      | Probabilidades del servidor para cada partido |
| `state.currentJornada`   | Jornada actual (próximo partido futuro) |
| `projectedStandings`     | Clasificación calculada con `results` actuales |
| `JORNADAS`               | Lista ordenada de números de jornada |
| `probSources`            | Fuentes de probabilidad disponibles (del servidor) |
| `selectedProbSource`     | Fuente activa (`'odds'` o `'equal'`) |
| `setProbSource`          | Cambia la fuente de probabilidad |
| `saveSimulationToAPI`    | Guarda la simulación actual en la BD |
| `loadSimulationFromAPI`  | Carga una simulación guardada |
| `deleteSimulationFromAPI`| Elimina una simulación |

## Utilidades

| Fichero                     | Descripción |
|-----------------------------|-------------|
| `utils/standings.js`        | Cálculo de clasificación proyectada |
| `utils/monteCarlo.js`       | Simulación Monte Carlo (N=500 por defecto) |
| `utils/navigation.js`       | `computeCurrentJornada` – detecta la jornada actual por timestamp |
| `utils/teamColors.js`       | Paleta de colores por equipo seleccionado |

## Fuente de probabilidades

El selector en ClasificacionView permite elegir entre:
- **Igual (1/3 cada una)** – Calculado en cliente, no requiere datos del servidor.
- **Cuotas de casas de apuestas** – Probabilidades normalizadas cargadas desde `match_probabilities` vía API.

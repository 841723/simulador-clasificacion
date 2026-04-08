# Simulador de Clasificación

Un simulador interactivo de la clasificación de **LaLiga 2** (temporada 2025/26) con simulación Monte Carlo, construido con React + Vite (frontend), Express + PostgreSQL (backend) y un scraper Python/Playwright.

## Características

- 🗓 **Vista por Jornada** – Simula los resultados de cada jornada editando marcadores o seleccionando 1/X/2.
- 📊 **Clasificación dinámica** – La clasificación se recalcula en tiempo real con cada cambio.
- 🎲 **Simulación Monte Carlo** – Calcula probabilidades de ascenso, playoff y descenso basadas en cuotas de apuestas normalizadas o probabilidades iguales (1/3 cada una).
- 👥 **Vista por Equipo** – Tabla comparativa de hasta 5 equipos con sus partidos futuros pendientes.
- 💾 **Guardar simulaciones** – Guarda y carga escenarios con nombre.
- 🔗 **URLs canónicas** – Cada vista tiene su propia URL compartible con liga/temporada/jornada.

## Arquitectura

```
client/        React + Vite + Tailwind CSS
backend/       Express + PostgreSQL (API REST)
sofascore_scrapper/  Python + Playwright (scraper de datos)
```

### Base de datos

PostgreSQL con las tablas: `leagues`, `seasons`, `teams`, `season_teams`, `matches`, `base_standings`, `simulations`, `simulation_results`, `probability_sources`, `match_probabilities`.

## Inicio rápido con Docker Compose

```bash
# Clona el repositorio
git clone https://github.com/tu-usuario/simulador-clasificacion.git
cd simulador-clasificacion

# Arranca todos los servicios (PostgreSQL + backend + cliente)
docker compose up --build

# La app estará disponible en http://localhost:3001
```

## Configuración manual (sin Docker)

### Requisitos

- Node.js 20+
- PostgreSQL 15+
- Python 3.11+

### Backend

```bash
cd backend
cp .env.example .env   # configura DB_HOST, DB_USER, etc.
npm install
node src/db/migrate.js  # aplica el schema
node src/scripts/seed.js  # carga datos iniciales
npm start
```

### Cliente

```bash
cd client
npm install
npm run dev    # servidor de desarrollo en http://localhost:5173
```

### Build de producción

```bash
cd client && npm run build
# Los ficheros estáticos se generan en client/dist/
# El backend sirve client/dist/ cuando NODE_ENV=production
```

## Scraper

```bash
cd sofascore_scrapper
pip install playwright psycopg
playwright install chromium

# First run: seed teams from standings API, then scrape all jornadas
python sofascore.py --init-teams

# Subsequent runs: incremental (auto-detects first incomplete jornada)
python sofascore.py

# With explicit options
python sofascore.py --from-jornada 30 --to-jornada 42
```

Ver [docs/scraper.md](docs/scraper.md) para más detalles.

## Variables de entorno

| Variable          | Descripción                            | Default        |
|-------------------|----------------------------------------|----------------|
| `DB_HOST`         | Host de PostgreSQL                     | `localhost`    |
| `DB_PORT`         | Puerto de PostgreSQL                   | `5432`         |
| `DB_NAME`         | Nombre de la base de datos             | `simulador_db` |
| `DB_USER`         | Usuario de PostgreSQL                  | `simulador`    |
| `DB_PASSWORD`     | Contraseña de PostgreSQL               | `simulador`    |
| `PORT`            | Puerto del servidor Express            | `3001`         |
| `NODE_ENV`        | Entorno (`production` sirve el SPA)    | —              |
| `VITE_SEASON_ID`  | ID interno de temporada a usar         | `1`            |

## Estructura del proyecto

```
client/
  src/
    App.jsx                      # Rutas principales
    components/                  # Componentes React
    context/SimulationContext.jsx  # Estado global
    utils/                       # Utilidades (standings, monteCarlo, navigation)
backend/
  src/
    db/schema.sql                # Schema de la BD
    routes/                      # Rutas Express
    scripts/seed.js              # Seed inicial
sofascore_scrapper/
  sofascore.py                   # Scraper incremental
docs/
  backend.md                     # Documentación del backend
  frontend.md                    # Documentación del frontend
  scraper.md                     # Documentación del scraper
```
 - LaLiga 2

Aplicación web para simular la clasificación final de LaLiga 2 desde la **jornada 34 hasta la 42**, permitiendo modificar los resultados de los partidos pendientes y ver cómo quedaría la tabla en tiempo real.

## Características

- 📅 **Vista por Jornada**: navega jornada a jornada y modifica el resultado de cada partido (1/X/2). Los partidos ya jugados están bloqueados y no se pueden editar.
- 👥 **Vista por Equipo**: selecciona uno o más equipos y visualiza sus partidos en una tabla, con selector de resultado por partido.
- 📊 **Clasificación en tiempo real**: siempre visible en la barra lateral derecha, se actualiza automáticamente al cambiar cualquier resultado.
- 💾 **Simulaciones guardadas**: guarda el estado actual con un nombre y recupéralo cuando quieras (persiste en `localStorage`).
- 🎨 **Colores por equipo**: cuando se seleccionan varios equipos, cada uno tiene un color distinto en todas las vistas.
- 🔒 **Resultados bloqueados**: los partidos ya disputados se determinan mediante el archivo `public/resultados.json` y no se pueden modificar.

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- npm v9 o superior

## Instalación y ejecución

### 1. Instalar dependencias

```bash
# Dependencias del servidor
npm install

# Dependencias del cliente React
npm install --prefix client
```

### 2. Construir el cliente

```bash
npm run build
```

Esto genera la carpeta `dist/` con la aplicación React compilada.

### 3. Iniciar el servidor

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### Atajo: instalar, construir e iniciar en un solo paso

```bash
npm install && npm run build && npm run dev
```

## Desarrollo

Para desarrollar con hot-reload, necesitas dos terminales:

**Terminal 1 — Servidor Express (datos):**
```bash
npm run dev
```

**Terminal 2 — Cliente Vite (hot-reload):**
```bash
cd client && npm run dev
```

El cliente Vite usa `http://localhost:5173` y proxea las peticiones de datos a `http://localhost:3000`.

## Actualizar resultados reales

Cuando se juegue un partido, edita `public/resultados.json` y actualiza el campo `resultado` con el marcador real (por ejemplo `"2-1"`). Los partidos con resultado no vacío quedan bloqueados en el simulador.

## Estructura del proyecto

```
simulador-clasificacion/
├── public/
│   ├── jornadas/        # Datos de partidos por jornada (34-42)
│   ├── standings/       # Clasificación real a fecha de inicio
│   ├── resultados.json  # Resultados reales (bloquea partidos jugados)
│   └── teams.json       # Imágenes de los equipos
├── client/              # Aplicación React (Vite + Tailwind CSS)
│   └── src/
│       ├── components/  # Header, JornadaView, TeamView, StandingsTable, …
│       ├── context/     # Estado global (SimulationContext)
│       └── utils/       # Cálculo de clasificación, colores de equipo
├── dist/                # Build del cliente (generado)
└── index.js             # Servidor Express
```

# Backend – Documentación técnica

Express + PostgreSQL API que sirve los datos de la temporada y gestiona las simulaciones guardadas.

## Variables de entorno

| Variable      | Descripción              | Default        |
|---------------|--------------------------|----------------|
| `DB_HOST`     | Host de PostgreSQL       | `localhost`    |
| `DB_PORT`     | Puerto de PostgreSQL     | `5432`         |
| `DB_NAME`     | Nombre de la BD          | `simulador_db` |
| `DB_USER`     | Usuario de PostgreSQL    | `simulador`    |
| `DB_PASSWORD` | Contraseña               | `simulador`    |
| `PORT`        | Puerto del servidor      | `3001`         |
| `NODE_ENV`    | Entorno de ejecución     | —              |

## Iniciar el servidor

```bash
cd backend
npm install
npm start          # producción
npm run dev        # desarrollo con nodemon (si está configurado)
```

## Migraciones y seeds

```bash
# Aplica el schema (idempotente)
node src/db/migrate.js

# Carga datos iniciales desde los JSON estáticos en /public
node src/scripts/seed.js
```

## Endpoints de la API

### Health

| Método | Ruta         | Descripción       |
|--------|--------------|-------------------|
| GET    | `/api/health` | Comprueba que el servidor está vivo |

### Temporadas

| Método | Ruta          | Descripción                              |
|--------|---------------|------------------------------------------|
| GET    | `/api/seasons` | Lista todas las temporadas con liga info |

### Clasificación

| Método | Ruta                              | Descripción                        |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/seasons/:seasonId/standings` | Clasificación base de la temporada |

### Partidos

| Método | Ruta                               | Query params      | Descripción |
|--------|------------------------------------|-------------------|-------------|
| GET    | `/api/seasons/:seasonId/matches`   | `?sourceSlug=odds` | Lista todos los partidos. Cuando se pasa `sourceSlug`, las probabilidades se obtienen de `match_probabilities`. Sin `sourceSlug` usa `matches.prob_home/draw/away`. |
| PATCH  | `/api/seasons/:seasonId/matches/:matchId` | — | Actualiza resultado / probabilidades de un partido (admin) |

### Equipos

| Método | Ruta         | Descripción               |
|--------|--------------|---------------------------|
| GET    | `/api/teams` | Lista todos los equipos   |

### Simulaciones

| Método | Ruta                      | Descripción                           |
|--------|---------------------------|---------------------------------------|
| GET    | `/api/simulations`        | Lista simulaciones guardadas (por `seasonId`) |
| POST   | `/api/simulations`        | Guarda o actualiza una simulación     |
| GET    | `/api/simulations/:uuid`  | Carga una simulación por UUID         |
| DELETE | `/api/simulations/:uuid`  | Elimina una simulación                |

### Fuentes de probabilidad

| Método | Ruta                       | Descripción                          |
|--------|----------------------------|--------------------------------------|
| GET    | `/api/probability-sources` | Lista las fuentes de probabilidad disponibles |

## Schema de la base de datos

```sql
leagues           -- Ligas (LaLiga 2, etc.)
seasons           -- Temporadas ligadas a leagues
teams             -- Equipos con slug e imagen
season_teams      -- Relación many-to-many temporada/equipo
matches           -- Partidos con scores, estado y probs legacy
base_standings    -- Clasificación base (inicio de temporada, todo a ceros)
simulations       -- Escenarios guardados por el usuario
simulation_results -- Resultados por partido para cada simulación
probability_sources -- Fuentes de probabilidad (slug, nombre, descripción)
match_probabilities -- Probabilidades por partido y fuente
```

### Fuentes de probabilidad incluidas

| slug   | Descripción |
|--------|-------------|
| `odds` | Probabilidades normalizadas a partir de cuotas de casas de apuestas |

El frontend también soporta `equal` (1/3 cada una), que se calcula en cliente y no tiene fila en la tabla.

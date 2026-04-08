# Scraper – Documentación técnica

Script Python que obtiene datos de partidos y cuotas de apuestas desde la API pública de SofaScore, y los persiste en la base de datos PostgreSQL.

## Requisitos

```bash
pip install playwright psycopg
playwright install chromium
```

## Uso básico

```bash
cd sofascore_scrapper

# Primera ejecución: siembra equipos desde la API de standings y scrapea todas las jornadas
python sofascore.py --init-teams

# Ejecución incremental (detecta automáticamente la primera jornada incompleta)
python sofascore.py

# Especificar rango de jornadas
python sofascore.py --from-jornada 30 --to-jornada 42

# Especificar IDs de liga/temporada de SofaScore (si cambian de temporada)
python sofascore.py --league 54 --season 77558
```

## Argumentos

| Argumento          | Descripción                                           | Default    |
|--------------------|-------------------------------------------------------|------------|
| `--from-jornada N` | Primera jornada a scrapear                           | Auto-detect |
| `--to-jornada N`   | Última jornada a scrapear                             | `42`       |
| `--league N`       | ID de liga en SofaScore (`uniqueTournament`)          | `54`       |
| `--season N`       | ID de temporada en SofaScore                          | `77558`    |
| `--init-teams`     | Siembra equipos desde la API de standings antes de scrapear | `false` |

La auto-detección busca la primera jornada donde no todos los partidos están finalizados, menos 1 de buffer. Cuando no hay equipos en la temporada (primera ejecución), `--init-teams` se activa automáticamente.

## Variables de entorno

| Variable      | Descripción              | Default        |
|---------------|--------------------------|----------------|
| `DB_HOST`     | Host de PostgreSQL       | `localhost`    |
| `DB_PORT`     | Puerto de PostgreSQL     | `5432`         |
| `DB_NAME`     | Nombre de la BD          | `simulador_db` |
| `DB_USER`     | Usuario de PostgreSQL    | `simulador`    |
| `DB_PASSWORD` | Contraseña               | `simulador`    |

## Cómo funciona

1. **Conecta a la BD** y garantiza que existen las filas de liga, temporada y fuente de probabilidad `odds`.
2. **Siembra equipos** si se usa `--init-teams` o si no hay equipos para la temporada (primera ejecución automática). Obtiene la tabla de clasificación de SofaScore y crea los equipos con imagen e inserta filas de `base_standings` a cero.
3. **Calcula la jornada de inicio** (si no se especifica `--from-jornada`): busca en la BD la primera jornada con partidos no finalizados.
4. **Lanza Playwright** (Chromium headless) para hacer peticiones a la API de SofaScore.
5. Por cada jornada en el rango:
   - Obtiene la lista de partidos (`/api/v1/unique-tournament/{league}/season/{season}/events/round/{j}`).
   - **Upsert de equipos** en la tabla `teams` y enlaza con `season_teams`.
   - **Upsert de partidos** en `matches` con score, status y `is_locked` si está finalizado.
   - Por cada partido, intenta obtener cuotas (`/api/v1/event/{id}/odds/1/all`).
   - Si encuentra cuotas "Full time" con opciones 1/X/2, normaliza las probabilidades y hace **upsert en `match_probabilities`** (con `source_id` de `odds`) y también actualiza los campos legacy `matches.prob_home/draw/away`.

## Interacciones con la BD

| Tabla                  | Operación  | Descripción |
|------------------------|------------|-------------|
| `leagues`              | Upsert     | Garantiza que la liga existe |
| `seasons`              | Upsert     | Garantiza que la temporada existe |
| `probability_sources`  | Upsert     | Garantiza que la fuente `odds` existe |
| `teams`                | Upsert     | Crea/actualiza equipos por slug |
| `season_teams`         | Insert ON CONFLICT DO NOTHING | Enlaza equipo con temporada |
| `base_standings`       | Insert ON CONFLICT DO NOTHING | Fila a cero por equipo (si no existe) |
| `matches`              | Upsert por `id` | Crea/actualiza partidos con score y estado |
| `match_probabilities`  | Upsert por `(match_id, source_id)` | Probabilidades de apuestas |
| `matches.prob_*`       | UPDATE     | Actualiza columnas legacy para compatibilidad |

## Gestión de errores

- Si un partido no tiene cuotas disponibles, se registra en consola y continua.
- Si una jornada falla completamente (error de red, etc.), se hace rollback de esa jornada y continua con la siguiente.
- Cada jornada exitosa se confirma con `COMMIT`.

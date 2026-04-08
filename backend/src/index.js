import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import teamsRouter from './routes/teams.js';
import leaguesRouter from './routes/leagues.js';
import matchesRouter from './routes/matches.js';
import standingsRouter from './routes/standings.js';
import simulationsRouter from './routes/simulations.js';
import probabilitySourcesRouter from './routes/probability_sources.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 300,             // max 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// Rate limiter for static asset/SPA serving
const staticLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/teams', teamsRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/seasons/:seasonId/matches', matchesRouter);
app.use('/api/seasons/:seasonId/standings', standingsRouter);
app.use('/api/simulations', simulationsRouter);
app.use('/api/probability-sources', probabilitySourcesRouter);

// GET /api/seasons – list all seasons with league info and zone config
app.get('/api/seasons', async (_req, res, next) => {
  try {
    // Lazily import pool to avoid circular deps
    const { default: pool } = await import('./db/connection.js');
    const [seasonsResult, zonesResult] = await Promise.all([
      pool.query(
        `SELECT s.id, s.year, s.name, s.external_id AS "seasonExternalId",
                l.name AS "leagueName", l.slug AS "leagueSlug", l.id AS "leagueId",
                l.external_id AS "leagueExternalId"
         FROM seasons s JOIN leagues l ON l.id = s.league_id
         ORDER BY s.id DESC`,
      ),
      pool.query(
        `SELECT league_slug AS "leagueSlug", key, label,
                color, text_color AS "textColor", border_color AS "borderColor",
                min_pos AS "minPos", max_pos AS "maxPos", sort_order AS "sortOrder"
         FROM league_zones ORDER BY league_slug, sort_order`,
      ),
    ]);

    // Group zones by leagueSlug
    const zonesByLeague = {};
    for (const z of zonesResult.rows) {
      if (!zonesByLeague[z.leagueSlug]) zonesByLeague[z.leagueSlug] = [];
      const { leagueSlug: _ls, ...rest } = z;
      zonesByLeague[_ls].push(rest);
    }

    const seasons = seasonsResult.rows.map((s) => ({
      ...s,
      zones: zonesByLeague[s.leagueSlug] ?? [],
    }));
    res.json(seasons);
  } catch (err) {
    next(err);
  }
});

// ── Serve built React app in production ───────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '../../client/dist');
  app.use(express.static(distPath));
  // SPA fallback: any non-API route serves index.html
  app.get('*', staticLimiter, (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});

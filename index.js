import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Serve data files (jornadas + standings)
app.use('/jornadas', express.static(join(__dirname, 'public/jornadas')));
app.use('/standings', express.static(join(__dirname, 'public/standings')));

// Serve React app
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist/index.html'));
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

# Simulador de Clasificación - LaLiga 2

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

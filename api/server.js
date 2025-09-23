// api/server.js
import { createServer } from 'node:http';
import app from './src/app.js';
import { connectDB } from './src/db.js';
import { env } from './src/config.js';

const server = createServer(app);
// Render inyecta PORT; pon un fallback por si acaso en local:
const port = env.PORT || process.env.PORT || 8081;

connectDB().then(() => {
  server.listen(port, () => {
    console.log(`[API] Escuchando en http://0.0.0.0:${port}`);
  });
});

// opcional: manejo elegante de señales
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));


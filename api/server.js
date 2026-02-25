// api/server.js
import { createServer } from 'node:http';
import app from './src/app.js';
import { connectDB } from './src/db.js';
import { env } from './src/config.js';

const server = createServer(app);
// Render inyecta PORT; pon un fallback por si acaso en local:
const port = env.PORT || process.env.PORT || 8081;

function logStartupError(err) {
  if (err?.code === 'ENOTFOUND' && err?.syscall === 'querySrv') {
    console.error('[MongoDB] No se pudo resolver el host SRV de la URI.');
    console.error('[MongoDB] Revisa MONGODB_URI en api/.env (el cluster de Atlas cambió o la URI es inválida).');
    if (err?.hostname) console.error(`[MongoDB] Host SRV: ${err.hostname}`);
  } else {
    console.error('[API] Error al iniciar:', err);
  }
}

connectDB()
  .then(() => {
    server.listen(port, () => {
      console.log(`[API] Escuchando en http://0.0.0.0:${port}`);
    });
  })
  .catch((err) => {
    logStartupError(err);
    process.exit(1);
  });

// opcional: manejo elegante de señales
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

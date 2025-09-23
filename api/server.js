import { createServer } from 'node:http';
import app from './src/app.js';
import { connectDB } from './src/db.js';
import { env } from './src/config.js';

const server = createServer(app);
const port = env.PORT;

connectDB().then(() => {
  server.listen(port, () => {
    console.log(`[API] Escuchando en http://0.0.0.0:${port}`);
  });
});

// api/src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config.js';

import authRoutes from './routes/auth.js';
import reportsRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import usersRoutes from './routes/users.js';
import summariesRoutes from './routes/summaries.js';

const app = express();

/** CORS dinámico */
const allowed = new Set(
  (env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

const corsConfig = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);              // curl/Postman
    if (allowed.has(origin)) return cb(null, true);  // coincide con whitelist
    return cb(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204
};

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(corsConfig));
app.options('*', cors(corsConfig)); // preflight global

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use(limiter);

/** Health */
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

/** Rutas */
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/summaries', summariesRoutes);

/** 404 */
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

/** 500 */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

export default app;

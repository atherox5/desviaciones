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




const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));


const limiter = rateLimit({ windowMs: 60_000, max: 120 });
app.use(limiter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/upload', uploadRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// 500
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

export default app;

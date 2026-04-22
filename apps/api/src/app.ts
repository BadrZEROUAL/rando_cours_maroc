import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

// ── Routes ────────────────────────────────────────────────────
import walletRoutes      from './routes/wallet.routes';
import sessionRoutes     from './routes/session.routes';
import sessionsRoutes    from './routes/sessions.routes';
import authRoutes        from './routes/auth.routes';
import coachRoutes       from './routes/coach.routes';
import badgeRoutes       from './routes/badge.routes';
import cotisationRoutes  from './routes/cotisation.routes';

// ── Jobs ──────────────────────────────────────────────────────
import { startCotisationJob }    from './jobs/cotisationReminder.job';
import { startCoachAnalysisJob } from './jobs/coachAnalysis.job';

const app = express();

// ── Middlewares globaux ───────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'randocours-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    region: process.env.AWS_REGION || 'local',
  });
});

// ── Routes API v1 ─────────────────────────────────────────────
app.use('/api/v1/wallet',     walletRoutes);
app.use('/api/v1/sessions',  sessionsRoutes);
app.use('/api/v1/game',      sessionRoutes);
app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/coach',     coachRoutes);
app.use('/api/v1/badges',    badgeRoutes);
app.use('/api/v1/cotisation', cotisationRoutes);

// ── 404 handler ──────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route introuvable',
    code: 'NOT_FOUND',
  });
});

// ── Global error handler ──────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne' : err.message,
    code: 'INTERNAL_ERROR',
  });
});

// ── Start server ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`✅ RandoCours API démarrée sur http://localhost:${PORT}`);
    console.log(`   Environnement : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Région AWS    : ${process.env.AWS_REGION || 'locale'}`);

    // Démarrer les jobs planifiés
    startCotisationJob();
    startCoachAnalysisJob();
  });
}

export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import vendorRoutes from './routes/vendors.js';
import assessmentRoutes from './routes/assessments.js';
import questionRoutes from './routes/questions.js';
import invitationRoutes from './routes/invitations.js';
import evidenceRoutes from './routes/evidence.js';
import auditLogRoutes from './routes/audit-logs.js';
import remediationRoutes from './routes/remediation.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import aiRoutes from './routes/ai.js';

export function createApp({ dbReady = () => true } = {}) {
  const app = express();

  // Exactly one proxy hop in front (nginx in compose, which sets X-Forwarded-For).
  // Without this express ignores that header and every request is keyed to the
  // proxy's IP, so one user's traffic exhausts the shared rate limit for everyone
  // — the 20-per-window auth limit becomes a global login cap.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  // E2E runs log in dozens of times from one IP; the production limits would make
  // the suite fail on its own traffic rather than on a defect. test keeps the same
  // middleware shape, just with headroom.
  const isTest = process.env.NODE_ENV === 'test';

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTest ? 10_000 : 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTest ? 10_000 : 20, // limit auth requests to 20 per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/', limiter);
  app.use('/api/auth', authLimiter);

  // API Routes - always register them, they'll handle DB errors internally
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/vendors', vendorRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/invitations', invitationRoutes);
  app.use('/api/evidence', evidenceRoutes);
  app.use('/api/audit-logs', auditLogRoutes);
  app.use('/api/remediation', remediationRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/ai', aiRoutes);

  // Health check endpoint with API info
  app.get('/health', (req, res) => {
    const ready = typeof dbReady === 'function' ? dbReady() : dbReady;
    res.status(200).json({
      status: ready ? 'healthy' : 'degraded',
      database: ready ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });

  // Root endpoint with API info
  app.get('/', (req, res) => {
    const ready = typeof dbReady === 'function' ? dbReady() : dbReady;
    res.json({
      name: 'TrustGuard AI API',
      version: '1.0.0',
      database: ready ? 'connected' : 'disconnected',
      endpoints: [
        '/health',
        '/api/auth',
        '/api/users',
        '/api/vendors',
        '/api/assessments'
      ]
    });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  return app;
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import vendorRoutes from './routes/vendors.js';
import assessmentRoutes from './routes/assessments.js';
import questionRoutes from './routes/questions.js';
import invitationRoutes from './routes/invitations.js';
import evidenceRoutes from './routes/evidence.js';
import { checkSessionActivity } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool with retry logic
let dbReady = false;

// Support both DATABASE_URL and individual connection parameters
const connectionString = process.env.DATABASE_URL;
export const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        user: process.env.DB_USER || 'trustguard',
        host: process.env.DB_HOST || 'db',
        database: process.env.DB_NAME || 'trustguard',
        password: process.env.DB_PASSWORD || 'changeme_in_production',
        port: parseInt(process.env.DB_PORT || '5432'),
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

// Test database connection with retry
async function connectWithRetry(maxRetries = 5, delayMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await pool.connect();
      console.log('Connected to PostgreSQL database');
      client.release();
      dbReady = true;
      return true;
    } catch (err) {
      console.error(`Database connection attempt ${i + 1} failed:`, err.message);
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error('Failed to connect to database after all retries. Running in limited mode.');
  dbReady = false;
  return false;
}

connectWithRetry();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // limit auth requests to 20 per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

// Apply session activity check to all authenticated routes
app.use('/api', checkSessionActivity);

// Health check endpoint with API info
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: dbReady ? 'healthy' : 'degraded',
    database: dbReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString() 
  });
});

// API Routes - always register them, they'll handle DB errors internally
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/evidence', evidenceRoutes);

// Root endpoint with API info
app.get('/', (req, res) => {
  res.json({ 
    name: 'TrustGuard AI API', 
    version: '1.0.0',
    database: dbReady ? 'connected' : 'disconnected',
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TrustGuard AI API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

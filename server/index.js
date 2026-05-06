import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import vendorRoutes from './routes/vendors.js';
import assessmentRoutes from './routes/assessments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
export const pool = new Pool({
  user: process.env.DB_USER || 'trustguard',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'trustguard',
  password: process.env.DB_PASSWORD || 'changeme_in_production',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/assessments', assessmentRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    name: 'TrustGuard AI API', 
    version: '1.0.0',
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

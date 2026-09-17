// db.js loads dotenv itself, before it constructs the pool.
import { pool } from './db.js';
import { createApp } from './app.js';
import { initializeScheduler } from './services/scheduler.js';

const PORT = process.env.PORT || 3000;

// Database connection pool with retry logic
let dbReady = false;

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

const app = createApp({ dbReady: () => dbReady });

// Initialize email reminder scheduler after DB connection
connectWithRetry().then(() => {
  if (dbReady) {
    initializeScheduler();
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TrustGuard AI API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for testing
export { app, pool };

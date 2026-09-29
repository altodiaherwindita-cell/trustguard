// db.js loads dotenv itself, before it constructs the pool.
import { pool } from './db.js';
import { createApp } from './app.js';
import { initializeScheduler } from './services/scheduler.js';
import { loadSettings } from './services/settings.js';
import { initializeEmailTransporter } from './services/emailService.js';

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
connectWithRetry().then(async () => {
  if (!dbReady) return;
  // Settings first: the transporter is built at module load, before the DB was
  // reachable, so it saw only environment values. Rebuild it now that any
  // stored SMTP config can be read, then start the scheduler that uses it.
  try {
    await loadSettings();
    initializeEmailTransporter();
  } catch (error) {
    console.error('Failed to load saved settings, using environment values:', error.message);
  }
  initializeScheduler();
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TrustGuard AI API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for testing
export { app, pool };

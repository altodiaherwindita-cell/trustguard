// dotenv must load before the Pool below reads process.env. index.js used to
// call dotenv.config() before constructing the pool; now that the pool is
// constructed at import time, the config call has to live here too.
import 'dotenv/config';
import { Pool } from 'pg';

// Pool lives here rather than in index.js so routers can import it without
// pulling in index.js's app.listen()/connectWithRetry() side effects at import
// time (which is what made the test suite impossible to point at real routes).
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

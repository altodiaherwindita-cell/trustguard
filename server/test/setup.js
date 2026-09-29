import { Pool } from 'pg';

// Mock the database pool before any imports. Routers import { pool } from
// '../db.js', so mocking that module keeps index.js (and its app.listen /
// connectWithRetry side effects) out of the test process entirely.
jest.mock('../db.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  },
}));

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = 'test.smtp.com';
process.env.SMTP_USER = 'test';
process.env.SMTP_PASSWORD = 'test';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Restore console for debugging if needed
if (process.env.DEBUG_TESTS) {
  global.console = originalConsole;
}

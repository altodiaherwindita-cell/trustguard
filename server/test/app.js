import { createApp } from '../app.js';
import { pool } from '../db.js';

// Thin shim over the real app. This file used to be a 2,494-line re-implementation
// of every router, which meant the suite tested the harness instead of the server
// (collectCoverageFrom reported 0 for routes/ by construction). Now the specs
// exercise the same routers production serves.
//
// pool is mocked in test/setup.js, so no database is required.
export const app = createApp();
export const mockPool = pool;

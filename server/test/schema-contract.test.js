import fs from 'fs';
import path from 'path';

// Every route writes columns that init.sql must actually define. The mock pool in
// the other suites matches on SQL text and has no type checking, so a route that
// INSERTs a nonexistent column passes every test and 500s on a real database —
// this happened twice (evidence_documents, assessment_review_history.is_internal).
// This reads both files as text: no DB, no connection, so it runs anywhere.

// babel-jest transpiles to CJS, so `import.meta` is unavailable here.
const repoRoot = path.resolve(__dirname, '../..');
const initSql = fs.readFileSync(path.join(repoRoot, 'init.sql'), 'utf8');

/** table -> Set(column) from CREATE TABLE blocks, plus ALTER TABLE ADD COLUMN. */
function schemaColumns(sql) {
  const tables = {};
  for (const [, table, body] of sql.matchAll(
    /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g
  )) {
    const cols = new Set();
    for (const line of body.split('\n')) {
      const name = line.match(/^\s{2}([a-z_][a-z0-9_]*)\s+[A-Z]/i);
      if (name) cols.add(name[1]);
    }
    tables[table] = cols;
  }
  for (const [, table, body] of sql.matchAll(
    /ALTER TABLE (\w+)\s*([\s\S]*?);/g
  )) {
    if (!tables[table]) continue;
    for (const [, col] of body.matchAll(/ADD COLUMN (?:IF NOT EXISTS )?(\w+)/g)) {
      tables[table].add(col);
    }
  }
  return tables;
}

/** [table, column] pairs from `INSERT INTO t (a, b) VALUES ...` across the routes. */
function insertTargets(sql) {
  const pairs = [];
  for (const [, table, cols] of sql.matchAll(
    /INSERT INTO (\w+)\s*\(([^)]*)\)/g
  )) {
    for (const col of cols.split(',')) {
      const name = col.trim();
      if (/^[a-z_][a-z0-9_]*$/i.test(name)) pairs.push([table, name]);
    }
  }
  return pairs;
}

describe('schema contract', () => {
  const tables = schemaColumns(initSql);

  it('parses the schema it is checking', () => {
    // Guards the regexes themselves: if init.sql changes shape, this fails loudly
    // instead of silently asserting nothing.
    expect(Object.keys(tables).length).toBeGreaterThan(15);
    expect(tables.assessment_review_history.has('is_internal')).toBe(true);
  });

  it('every column a route INSERTs exists in init.sql', () => {
    const routesDir = path.join(repoRoot, 'server/routes');
    const missing = [];

    for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
      const sql = fs.readFileSync(path.join(routesDir, file), 'utf8');
      for (const [table, column] of insertTargets(sql)) {
        if (!tables[table]) {
          missing.push(`${file}: unknown table ${table}`);
        } else if (!tables[table].has(column)) {
          missing.push(`${file}: ${table}.${column} is not in init.sql`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

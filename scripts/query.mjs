#!/usr/bin/env node
/**
 * Run SQL against the built corpus.
 *
 *   npm run query -- "SELECT id, status FROM policy WHERE status = 'active'"
 *   npm run query                 # prints the schema and some starter queries
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './policies.mjs';

const DB_PATH = join(ROOT, 'db', 'policies.db');

if (!existsSync(DB_PATH)) {
  console.error('✗ db/policies.db not found — run `npm run build` first');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const sql = process.argv.slice(2).join(' ').trim();

if (!sql) {
  console.log('Tables: policy, tag, relation, reference\n');
  for (const { sql: ddl } of db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all()) {
    console.log(`${ddl};\n`);
  }
  console.log('Try:');
  console.log('  npm run query -- "SELECT id, title, status FROM policy ORDER BY updated DESC"');
  console.log('  npm run query -- "SELECT tag, COUNT(*) n FROM tag GROUP BY tag ORDER BY n DESC"');
  console.log('  npm run query -- "SELECT target, COUNT(*) n FROM relation GROUP BY target ORDER BY n DESC"');
  process.exit(0);
}

let rows;
try {
  rows = db.prepare(sql).all();
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

if (rows.length === 0) {
  console.log('(no rows)');
} else {
  console.table(rows);
  console.log(`${rows.length} row(s)`);
}

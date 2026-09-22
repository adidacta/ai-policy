#!/usr/bin/env node
/**
 * Check every policy against the schema and resolve cross-references.
 * Exits non-zero on the first corpus that would produce a broken graph.
 *
 *   npm run validate
 */

import { loadPolicies } from './policies.mjs';

const { policies, problems } = await loadPolicies();

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s) in ${policies.length} policies:\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`✓ ${policies.length} policies valid`);

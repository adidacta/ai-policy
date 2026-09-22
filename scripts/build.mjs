#!/usr/bin/env node
/**
 * Build the derived artifacts from policies/:
 *
 *   db/policies.db        SQLite, for querying the corpus
 *   web/data/graph.json   nodes + edges, for the D3 context graph
 *
 * Markdown is the source of truth. Both outputs are disposable and gitignored —
 * never edit them by hand, rebuild instead.
 *
 *   npm run build
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, RELATIONS, loadPolicies } from './policies.mjs';

const DB_PATH = join(ROOT, 'db', 'policies.db');
const GRAPH_PATH = join(ROOT, 'web', 'data', 'graph.json');

const { policies, problems } = await loadPolicies();

if (problems.length > 0) {
  console.error('✗ refusing to build — run `npm run validate` to see the problems:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

// ---------------------------------------------------------------- database ---

await mkdir(join(ROOT, 'db'), { recursive: true });
await rm(DB_PATH, { force: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE policy (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL,
    version    TEXT NOT NULL,
    updated    TEXT NOT NULL,
    owner      TEXT NOT NULL,
    domain     TEXT,
    file       TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    body       TEXT NOT NULL
  );

  CREATE TABLE tag (
    policy_id TEXT NOT NULL REFERENCES policy(id),
    tag       TEXT NOT NULL,
    PRIMARY KEY (policy_id, tag)
  );

  CREATE TABLE relation (
    source TEXT NOT NULL REFERENCES policy(id),
    target TEXT NOT NULL REFERENCES policy(id),
    kind   TEXT NOT NULL,
    PRIMARY KEY (source, target, kind)
  );

  CREATE TABLE reference (
    policy_id TEXT NOT NULL REFERENCES policy(id),
    source    TEXT NOT NULL
  );

  CREATE INDEX relation_target ON relation(target);
  CREATE INDEX tag_name        ON tag(tag);
`);

const insertPolicy = db.prepare(`
  INSERT INTO policy (id, title, status, version, updated, owner, domain, file, word_count, body)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertTag = db.prepare('INSERT INTO tag (policy_id, tag) VALUES (?, ?)');
const insertRelation = db.prepare('INSERT INTO relation (source, target, kind) VALUES (?, ?, ?)');
const insertReference = db.prepare('INSERT INTO reference (policy_id, source) VALUES (?, ?)');

db.exec('BEGIN');

// Every policy row first: relations carry foreign keys onto policy(id), and a
// document may reference one that sorts after it.
for (const p of policies) {
  insertPolicy.run(
    p.id, p.title, p.status, p.version, p.updated, p.owner,
    p.domain ?? null, p.file, p.wordCount, p.body,
  );
  for (const tag of p.tags) insertTag.run(p.id, tag);
  for (const source of p.references) insertReference.run(p.id, source);
}

for (const p of policies) {
  for (const kind of RELATIONS) {
    for (const target of p[kind]) insertRelation.run(p.id, target, kind);
  }
}

db.exec('COMMIT');
db.close();

// ------------------------------------------------------------------- graph ---

// Policies and tags share one node list so the graph shows how documents cluster
// around a theme, not just how they cite each other.
const nodes = policies.map((p) => ({
  id: p.id,
  type: 'policy',
  label: p.title,
  status: p.status,
  domain: p.domain ?? 'unassigned',
  version: p.version,
  updated: p.updated,
  owner: p.owner,
  tags: p.tags,
  wordCount: p.wordCount,
  file: p.file,
}));

const tags = [...new Set(policies.flatMap((p) => p.tags))].sort();
for (const tag of tags) {
  nodes.push({ id: `tag:${tag}`, type: 'tag', label: tag, status: 'tag', domain: 'tag' });
}

const links = [];
for (const p of policies) {
  for (const kind of RELATIONS) {
    for (const target of p[kind]) links.push({ source: p.id, target, kind });
  }
  for (const tag of p.tags) {
    links.push({ source: p.id, target: `tag:${tag}`, kind: 'tagged' });
  }
}

const graph = {
  generatedAt: new Date().toISOString(),
  stats: {
    policies: policies.length,
    tags: tags.length,
    links: links.length,
    byStatus: Object.fromEntries(
      Object.entries(
        policies.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {}),
      ).sort(),
    ),
  },
  nodes,
  links,
};

await mkdir(join(ROOT, 'web', 'data'), { recursive: true });
await writeFile(GRAPH_PATH, `${JSON.stringify(graph, null, 2)}\n`);

console.log(`✓ ${policies.length} policies, ${tags.length} tags, ${links.length} links`);
console.log(`  db/policies.db`);
console.log(`  web/data/graph.json`);

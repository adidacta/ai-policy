#!/usr/bin/env node
/**
 * Build a context graph for an archived jurisdiction.
 *
 *   npm run graph:hungary
 *
 * Merges policy/<jurisdiction>/sources.json (the documents) with
 * relations.json (the institutions they act on, and how they relate) into
 * web/data/<jurisdiction>.json.
 *
 * Colour is carried as a palette *slot*, never a hex value, so light and dark
 * stay the stylesheet's business. Slots 1-3 are the only categorical hues used:
 * they are the set that clears the all-pairs CVD and normal-vision floors in
 * both modes. Institutions and external instruments are not a fourth document
 * type, so they take neutral ink plus a distinct shape rather than a hue.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const jurisdiction = process.argv[2] ?? 'hungary';
const BASE = join(ROOT, 'policy', jurisdiction);

for (const file of ['sources.json', 'relations.json']) {
  if (!existsSync(join(BASE, file))) {
    console.error(`✗ policy/${jurisdiction}/${file} not found`);
    process.exit(1);
  }
}

const sources = JSON.parse(await readFile(join(BASE, 'sources.json'), 'utf8'));
const relations = JSON.parse(await readFile(join(BASE, 'relations.json'), 'utf8'));

const logPath = join(BASE, 'fetch-log.json');
const fetchLog = existsSync(logPath)
  ? JSON.parse(await readFile(logPath, 'utf8'))
  : { entries: [] };
const logByRef = new Map(fetchLog.entries.map((e) => [e.ref, e]));

/**
 * Instrument type drives colour. Only three categorical slots are in play, so
 * primary and secondary legislation share one: both are binding law, which is
 * the distinction a reader is actually making against strategies and decisions.
 */
function instrumentType(doc) {
  switch (doc.category) {
    case 'national-strategy': return { type: 'strategy', slot: 1, label: 'Strategy' };
    case 'primary-legislation':
    case 'secondary-legislation': return { type: 'legislation', slot: 2, label: 'Binding law' };
    case 'government-decision': return { type: 'decision', slot: 3, label: 'Government decision' };
    case 'parliamentary': return { type: 'legislation', slot: 2, label: 'Binding law' };
    default: return { type: 'other', slot: 0, label: 'Other' };
  }
}

const nodes = [];

for (const doc of sources.documents) {
  // D13 is the authority's own web page; the authority itself is an institution
  // node in relations.json, so the page rides along as its href rather than
  // appearing twice.
  if (doc.ref === 'D13') continue;

  // Entries marked partOf are the same instrument in another form — the
  // consolidated text, an explanatory memorandum, a second gazette copy. They
  // belong to their parent's node as extra files, not beside it as peers.
  if (doc.partOf) continue;

  const { type, slot, label: typeLabel } = instrumentType(doc);
  const entry = logByRef.get(doc.ref);
  const archived = entry?.status === 'downloaded' || entry?.status === 'present';

  const alsoAs = sources.documents
    .filter((other) => other.partOf === doc.ref)
    .map((other) => ({
      title: other.titleEn ?? other.title,
      path: logByRef.get(other.ref)?.path ?? null,
    }))
    .filter((f) => f.path);

  nodes.push({
    id: doc.ref,
    shape: 'circle',
    type,
    slot,
    typeLabel,
    label: doc.title,
    short: doc.short ?? doc.title,
    sublabel: doc.titleEn ?? null,
    date: doc.published ?? doc.inForce ?? null,
    archived,
    fields: {
      Reference: doc.ref,
      Type: typeLabel,
      Issuer: doc.issuer ?? null,
      Published: doc.published ?? null,
      'In force': doc.inForce ?? null,
      Language: doc.language,
      Archived: archived ? entry.path : 'not retrieved',
    },
    href: doc.landingPage ?? doc.url,
    file: archived ? entry.path : null,
    alsoAs,
    missingReason: archived ? null : doc.expectBlocked ?? null,
  });
}

for (const inst of relations.institutions) {
  nodes.push({
    id: inst.id,
    shape: inst.type === 'external' ? 'diamond' : 'square',
    type: inst.type,
    slot: 0,
    typeLabel: inst.type === 'external' ? 'External instrument' : 'Institution',
    label: inst.label,
    short: inst.short ?? inst.label,
    sublabel: inst.sublabel ?? null,
    date: inst.date ?? null,
    archived: true,
    fields: {
      Type: inst.type === 'external' ? 'External instrument' : 'Institution',
      Since: inst.date ?? null,
    },
    href: inst.href ?? null,
    file: null,
    missingReason: null,
  });
}

const byId = new Map(nodes.map((n) => [n.id, n]));

const links = [];
const problems = [];

for (const link of relations.links) {
  for (const end of ['source', 'target']) {
    if (!byId.has(link[end])) {
      problems.push(`link ${link.source} -> ${link.target}: ${end} "${link[end]}" is not a known node`);
    }
  }
  links.push(link);
}

const knownKinds = new Set(relations.linkKinds.map((k) => k.id));
for (const link of links) {
  if (!knownKinds.has(link.kind)) {
    problems.push(`link ${link.source} -> ${link.target}: unknown kind "${link.kind}"`);
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

const nodeTypes = [
  { id: 'strategy', label: 'Strategy', slot: 1, shape: 'circle' },
  { id: 'legislation', label: 'Binding law', slot: 2, shape: 'circle' },
  { id: 'decision', label: 'Government decision', slot: 3, shape: 'circle' },
  { id: 'institution', label: 'Institution', slot: 0, shape: 'square' },
  { id: 'external', label: 'External instrument', slot: 0, shape: 'diamond' },
].filter((t) => nodes.some((n) => n.type === t.id));

const years = nodes.map((n) => n.date).filter(Boolean).map((d) => Number(d.slice(0, 4)));

const graph = {
  id: jurisdiction,
  title: `${sources.jurisdiction} — AI policy`,
  generatedAt: new Date().toISOString(),
  stats: {
    documents: nodes.filter((n) => n.shape === 'circle').length,
    institutions: nodes.filter((n) => n.shape !== 'circle').length,
    links: links.length,
    missing: nodes.filter((n) => !n.archived).length,
  },
  timeline: { min: Math.min(...years), max: Math.max(...years) },
  legend: { nodeTypes, linkKinds: relations.linkKinds },
  nodes,
  links,
};

await mkdir(join(ROOT, 'web', 'data'), { recursive: true });
await writeFile(
  join(ROOT, 'web', 'data', `${jurisdiction}.json`),
  `${JSON.stringify(graph, null, 2)}\n`,
);

console.log(
  `✓ ${graph.stats.documents} documents, ${graph.stats.institutions} institutions, ` +
  `${graph.stats.links} links (${graph.timeline.min}–${graph.timeline.max})`,
);
console.log(`  web/data/${jurisdiction}.json`);

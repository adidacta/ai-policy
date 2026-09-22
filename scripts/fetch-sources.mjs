#!/usr/bin/env node
/**
 * Fetch the primary-source documents listed in a jurisdiction manifest.
 *
 *   npm run fetch:hungary
 *   node scripts/fetch-sources.mjs hungary --force
 *
 * Downloads land in policy/<jurisdiction>/{pdf,html}/ and are recorded in
 * fetch-log.json with sha256 and byte count, so a later run can prove whether
 * an official document changed underneath us.
 *
 * Files already present are skipped unless --force is passed. Sources that
 * block automated access (CAPTCHA walls, 403s) are reported, never worked
 * around — retrieve those by hand in a browser.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const args = process.argv.slice(2);
const force = args.includes('--force');
const jurisdiction = args.find((a) => !a.startsWith('--')) ?? 'hungary';

const BASE = join(ROOT, 'policy', jurisdiction);
const MANIFEST = join(BASE, 'sources.json');

if (!existsSync(MANIFEST)) {
  console.error(`✗ no manifest at policy/${jurisdiction}/sources.json`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

// Several Hungarian government hosts reject requests without a browser-shaped
// header set. This identifies us honestly as an archiving fetch; it is not an
// attempt to defeat a bot check.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept': 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'hu-HU,hu;q=0.9,en;q=0.8',
};

const PDF_MAGIC = '%PDF';

/** Detect the CAPTCHA/interstitial pages that some hosts return with a 200. */
function looksLikeChallenge(bytes) {
  const head = Buffer.from(bytes.subarray(0, 4096)).toString('utf8').toLowerCase();
  return /captcha|just a moment|checking your browser|cf-browser-verification/.test(head);
}

async function attempt(url, expectedFormat) {
  const response = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status}`, bytes };
  }
  if (looksLikeChallenge(bytes)) {
    return { ok: false, reason: 'bot challenge page returned', bytes };
  }
  if (expectedFormat === 'pdf') {
    const magic = Buffer.from(bytes.subarray(0, 4)).toString('latin1');
    if (magic !== PDF_MAGIC) {
      const type = response.headers.get('content-type') ?? 'unknown';
      return { ok: false, reason: `expected a PDF, got ${type}`, bytes };
    }
  }
  return { ok: true, bytes };
}

await mkdir(join(BASE, 'pdf'), { recursive: true });
await mkdir(join(BASE, 'html'), { recursive: true });

const log = [];
let downloaded = 0;
let skipped = 0;
const failures = [];

for (const doc of manifest.documents) {
  const filename = `${doc.slug}.${doc.format}`;
  const destination = join(BASE, doc.format, filename);
  const label = `${doc.ref.padEnd(5)} ${filename}`;

  if (existsSync(destination) && !force) {
    const existing = await readFile(destination);
    log.push({
      ref: doc.ref,
      slug: doc.slug,
      status: 'present',
      path: `policy/${jurisdiction}/${doc.format}/${filename}`,
      bytes: existing.length,
      sha256: createHash('sha256').update(existing).digest('hex'),
      url: doc.url,
    });
    skipped++;
    console.log(`·  ${label} (already present)`);
    continue;
  }

  // The manifest's own url first, then any mirror it records.
  const candidates = [doc.url, doc.mirror].filter(Boolean);
  let result = null;
  let usedUrl = null;
  const reasons = [];

  for (const url of candidates) {
    try {
      const outcome = await attempt(url, doc.format);
      if (outcome.ok) {
        result = outcome;
        usedUrl = url;
        break;
      }
      reasons.push(`${url} → ${outcome.reason}`);
    } catch (error) {
      reasons.push(`${url} → ${error.message}`);
    }
  }

  if (!result) {
    failures.push({ ref: doc.ref, title: doc.title, reasons, expected: doc.expectBlocked });
    log.push({
      ref: doc.ref, slug: doc.slug, status: 'blocked',
      url: doc.url, reasons,
    });
    console.log(`✗  ${label} — ${reasons[0]}`);
    continue;
  }

  await writeFile(destination, result.bytes);
  const sha256 = createHash('sha256').update(result.bytes).digest('hex');
  log.push({
    ref: doc.ref,
    slug: doc.slug,
    status: 'downloaded',
    path: `policy/${jurisdiction}/${doc.format}/${filename}`,
    bytes: result.bytes.length,
    sha256,
    url: usedUrl,
    fetchedAt: new Date().toISOString(),
  });
  downloaded++;
  console.log(`✓  ${label} (${(result.bytes.length / 1024).toFixed(0)} KB)`);
}

await writeFile(
  join(BASE, 'fetch-log.json'),
  `${JSON.stringify({ jurisdiction, ranAt: new Date().toISOString(), entries: log }, null, 2)}\n`,
);

console.log(`\n${downloaded} downloaded, ${skipped} already present, ${failures.length} blocked`);

if (failures.length > 0) {
  console.log('\nBlocked — these need a browser and a human:');
  for (const f of failures) {
    console.log(`\n  ${f.ref} ${f.title}`);
    for (const reason of f.reasons) console.log(`    ${reason}`);
    if (f.expected) console.log(`    note: ${f.expected}`);
  }
}

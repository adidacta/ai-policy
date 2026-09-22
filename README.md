# ai-policy

Two things live here, and they serve each other:

1. **Authored policy** — `policies/`, Markdown with structured frontmatter. The
   source of truth for what the organisation's AI rules actually are.
2. **Primary-source archive** — `policy/<jurisdiction>/`, official documents
   fetched from government and gazette hosts, unedited, with checksums.

From the first, a build step derives a **SQLite database** you can query and a
**D3 context graph** you can read — so that a policy set with real
cross-references stays legible as it grows.

## Quick start

```bash
npm run validate   # check frontmatter and cross-references
npm run build      # -> db/policies.db and web/data/graph.json
npm run serve      # build, then open the graph on :4173
```

No dependencies to install. Node 22.5+ is required, for the built-in
`node:sqlite`.

## Layout

```
policies/            authored policy documents (Markdown + frontmatter)
  _TEMPLATE.md       copy this to start a new one
schema/
  policy.schema.json the frontmatter contract
scripts/
  frontmatter.mjs    small, strict frontmatter reader
  policies.mjs       loading + validation, shared by everything below
  validate.mjs       npm run validate
  build.mjs          npm run build
  query.mjs          npm run query
  serve.mjs          npm run serve
  fetch-sources.mjs  npm run fetch:<jurisdiction>
web/                 the D3 context graph (static, no build step)
policy/hungary/      archived Hungarian primary sources — see its README
db/                  generated, gitignored
```

## Writing a policy

Copy `policies/_TEMPLATE.md`, name the file after its `id`, and fill in the
frontmatter:

```yaml
---
id: data-handling          # must equal the filename stem
title: Data Handling for AI Systems
status: active             # draft | review | active | superseded | retired
version: 1.1.0
updated: 2026-09-22
owner: adi@adidacta.com
domain: security
tags: [data, privacy]
depends_on: [ai-governance-charter]
relates_to: [acceptable-use]
supersedes: []
---
```

`npm run validate` enforces the schema and every cross-reference: a
`depends_on` pointing at a policy that does not exist is an error, as is a
`supersedes` whose target is not marked `superseded`. The build refuses to run
on an invalid corpus, so the graph can never show relationships that aren't real.

## The graph

`web/` is a force-directed view where policies **and their tags** are both
nodes — so a cluster is a genuine cluster of concern, not just a citation chain.
Edge style carries the relation kind: solid for `depends_on`, dashed for
`relates_to`, red for `supersedes`, faint for `tagged`. Node colour is status,
node size is document length.

Click a node to pin it and see its full frontmatter and both directions of every
relation. Filter by relation kind, by status, or by a text search over titles and
tags.

## Querying

```bash
npm run query                       # schema and starter queries
npm run query -- "SELECT id, title, status FROM policy ORDER BY updated DESC"
npm run query -- "SELECT target, COUNT(*) n FROM relation GROUP BY target ORDER BY n DESC"
```

Tables: `policy`, `tag`, `relation`, `reference`.

## Archiving primary sources

Each jurisdiction gets a folder under `policy/` with a `sources.json` manifest.
The fetcher downloads what the manifest lists, records sha256 and byte counts in
`fetch-log.json`, and skips anything already present.

```bash
npm run fetch:hungary
```

It follows mirrors when a primary URL fails, and it **reports** sources that
block automated access rather than working around them — CAPTCHA walls and
Cloudflare challenges are left for a human with a browser. Each jurisdiction's
README lists what is missing and where to put it.

Currently archived: [Hungary](policy/hungary/README.md) — 18 documents, 19 MB,
collected 2026-09-22.

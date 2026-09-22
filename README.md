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

## Jurisdiction context graphs

Each archived jurisdiction also gets a graph, at `context.html?j=<jurisdiction>`:
the instruments and the institutions they act on, with typed relations between
them — `implements`, `adopts`, `replaces`, `amends`, `assigns role to`,
`establishes`, `leads to`, `part of`. Every edge carries the basis for it,
quoted from the document, and shown in the detail panel.

```bash
npm run graph:hungary
```

The documents come from `sources.json`; the institutions and relations from a
hand-authored `relations.json` beside it. Adding a jurisdiction means adding
those two files — the page is generic and needs no change.

Two layouts, both computed rather than simulated — nothing drifts or jitters,
and the same data always draws the same picture:

- **structure** — a layered DAG (dagre). This corpus has direction: implements,
  adopts and replaces all flow one way. A force-directed layout renders that as
  spaghetti; a layered one shows it as depth.
- **chronology** — one band per year, oldest at the top. This is where a legal
  corpus becomes legible: the 2020 strategy, the long gap, the EU AI Act
  arriving in 2024, the 2025 implementing cluster, and the 2026 transfer of
  market surveillance to a new ministry.

**Topic filtering** cuts the corpus to one thread — education, market
surveillance, international cooperation, and so on. Institutions carry no topic
of their own: a ministry stays visible while anything attached to it is, and
drops out when nothing is, so filtering never strands the actors that give the
documents their meaning. The layout re-runs over whatever survives, so a
filtered graph uses the whole canvas.

Cards can be dragged; the position is remembered per layout and cleared by
Reset view. Both side panels collapse, which matters because the graph pane is
the scarce resource on a laptop.

Encoding: colour is instrument type, shape is structural kind (circle =
document, square = institution, diamond = external instrument), and a dashed
outline means the document is listed but was not retrieved. Only three
categorical hues are used — on an all-pairs form like a network graph, three is
the largest set that clears the colour-vision and normal-vision separation
floors in both light and dark, so structural kinds take shape rather than a
fourth hue. Every node is labelled, so identity never rests on colour alone.

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

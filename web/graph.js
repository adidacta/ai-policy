/**
 * Force-directed context graph over the policy corpus.
 *
 * Reads data/graph.json, which `npm run build` generates from policies/.
 * Policies and tags share one node space, so a cluster in the picture is a
 * genuine cluster of concern, not just a citation chain.
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const RELATION_KINDS = ['depends_on', 'relates_to', 'supersedes', 'tagged'];

const svg = d3.select('#graph');
const tooltip = d3.select('#tooltip');
const detail = d3.select('#detail');

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const graph = await fetch('data/graph.json').then((r) => {
  if (!r.ok) throw new Error('data/graph.json missing — run `npm run build`');
  return r.json();
});

d3.select('#summary').text(
  `${graph.stats.policies} policies · ${graph.stats.tags} tags · ` +
  `${graph.stats.links} links · built ${graph.generatedAt.slice(0, 10)}`,
);

// d3's force simulation mutates source/target into object references, so give it
// copies and keep the raw ids for lookups.
const nodes = graph.nodes.map((n) => ({ ...n }));
const links = graph.links.map((l) => ({ ...l }));
const byId = new Map(nodes.map((n) => [n.id, n]));

const radius = (n) =>
  n.type === 'tag' ? 4 : 6 + Math.sqrt(n.wordCount ?? 0) / 5;

// ------------------------------------------------------------------ layout ---

const { width, height } = svg.node().getBoundingClientRect();

svg.append('defs').selectAll('marker')
  .data(RELATION_KINDS)
  .join('marker')
    .attr('id', (kind) => `arrow-${kind}`)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
  .append('path')
    .attr('d', 'M0,-4L9,0L0,4')
    .attr('fill', (kind) => css(`--kind-${kind}`));

const zoomLayer = svg.append('g');

const linkSel = zoomLayer.append('g')
  .selectAll('line')
  .data(links)
  .join('line')
    .attr('class', 'link')
    .attr('stroke', (d) => css(`--kind-${d.kind}`))
    .attr('stroke-width', (d) => (d.kind === 'tagged' ? 0.8 : 1.6))
    .attr('stroke-dasharray', (d) => (d.kind === 'relates_to' ? '4 3' : null))
    .attr('marker-end', (d) => (d.kind === 'tagged' ? null : `url(#arrow-${d.kind})`));

const nodeSel = zoomLayer.append('g')
  .selectAll('g')
  .data(nodes)
  .join('g')
    .attr('class', 'node');

nodeSel.append('circle')
  .attr('r', radius)
  .attr('fill', (d) => css(`--status-${d.status}`))
  .attr('stroke', css('--bg'))
  .attr('stroke-width', 1.5);

nodeSel.append('text')
  .attr('x', (d) => radius(d) + 4)
  .attr('dy', '0.32em')
  .text((d) => (d.type === 'tag' ? `#${d.label}` : d.label));

const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id((d) => d.id)
    .distance((d) => (d.kind === 'tagged' ? 55 : 110))
    .strength((d) => (d.kind === 'tagged' ? 0.35 : 0.8)))
  .force('charge', d3.forceManyBody().strength((d) => (d.type === 'tag' ? -180 : -520)))
  .force('collide', d3.forceCollide((d) => radius(d) + 12))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .on('tick', () => {
    linkSel
      .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

const zoom = d3.zoom()
  .scaleExtent([0.25, 4])
  .on('zoom', (event) => zoomLayer.attr('transform', event.transform));

svg.call(zoom);

nodeSel.call(
  d3.drag()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    })
    .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }),
);

// -------------------------------------------------------------- highlights ---

/** Ids one hop from `id`, plus `id` itself. */
function neighbourhood(id) {
  const near = new Set([id]);
  for (const link of links) {
    if (link.source.id === id) near.add(link.target.id);
    if (link.target.id === id) near.add(link.source.id);
  }
  return near;
}

let pinned = null;

function highlight(id) {
  if (id === null) {
    nodeSel.classed('dimmed', false);
    linkSel.classed('dimmed', false);
    return;
  }
  const near = neighbourhood(id);
  nodeSel.classed('dimmed', (d) => !near.has(d.id));
  linkSel.classed('dimmed', (d) => d.source.id !== id && d.target.id !== id);
}

nodeSel
  .on('mouseenter', (event, d) => {
    if (!pinned) highlight(d.id);
    const [x, y] = d3.pointer(event, svg.node());
    tooltip
      .attr('hidden', null)
      .style('left', `${x + 14}px`)
      .style('top', `${y + 14}px`)
      .html(
        d.type === 'tag'
          ? `<strong>#${d.label}</strong><span>tag</span>`
          : `<strong>${d.label}</strong><span>${d.status} · v${d.version} · ${d.domain}</span>`,
      );
  })
  .on('mouseleave', () => {
    tooltip.attr('hidden', true);
    if (!pinned) highlight(null);
  })
  .on('click', (event, d) => {
    event.stopPropagation();
    pinned = pinned === d.id ? null : d.id;
    highlight(pinned);
    showDetail(pinned ? d : null);
  });

svg.on('click', () => {
  pinned = null;
  highlight(null);
  showDetail(null);
});

// ------------------------------------------------------------------ detail ---

function relationList(id, kind, direction) {
  const matches = links.filter((l) =>
    l.kind === kind &&
    (direction === 'out' ? l.source.id === id : l.target.id === id));
  return matches.map((l) => (direction === 'out' ? l.target.id : l.source.id));
}

function linkTo(id) {
  const node = byId.get(id);
  const label = node?.type === 'tag' ? `#${node.label}` : node?.label ?? id;
  return `<li><a data-goto="${id}">${label}</a></li>`;
}

function section(heading, ids) {
  if (ids.length === 0) return '';
  return `<h4>${heading}</h4><ul>${ids.map(linkTo).join('')}</ul>`;
}

function showDetail(node) {
  if (!node) {
    detail.html('<p class="placeholder">Select a node to inspect it.</p>');
    return;
  }

  if (node.type === 'tag') {
    const tagged = relationList(node.id, 'tagged', 'in');
    detail.html(`
      <h3>#${node.label}</h3>
      <p class="id">tag · ${tagged.length} policies</p>
      ${section('Applied to', tagged)}
    `);
  } else {
    detail.html(`
      <h3>${node.label}</h3>
      <p class="id">${node.id}</p>
      <dl>
        <dt>Status</dt><dd>${node.status}</dd>
        <dt>Version</dt><dd>${node.version}</dd>
        <dt>Updated</dt><dd>${node.updated}</dd>
        <dt>Domain</dt><dd>${node.domain}</dd>
        <dt>Owner</dt><dd>${node.owner}</dd>
        <dt>Length</dt><dd>${node.wordCount} words</dd>
        <dt>File</dt><dd><code>policies/${node.file}</code></dd>
      </dl>
      ${section('Depends on', relationList(node.id, 'depends_on', 'out'))}
      ${section('Depended on by', relationList(node.id, 'depends_on', 'in'))}
      ${section('Relates to', relationList(node.id, 'relates_to', 'out'))}
      ${section('Supersedes', relationList(node.id, 'supersedes', 'out'))}
      ${section('Superseded by', relationList(node.id, 'supersedes', 'in'))}
      ${section('Tags', node.tags.map((t) => `tag:${t}`))}
    `);
  }

  detail.selectAll('a[data-goto]').on('click', (event) => {
    const id = event.currentTarget.dataset.goto;
    pinned = id;
    highlight(id);
    showDetail(byId.get(id));
  });
}

// ----------------------------------------------------------------- filters ---

const hiddenKinds = new Set();
let statusFilter = new Set();
let query = '';

function applyFilters() {
  linkSel.attr('display', (d) => (hiddenKinds.has(d.kind) ? 'none' : null));

  nodeSel.attr('display', (d) => {
    if (d.type === 'policy' && statusFilter.size > 0 && !statusFilter.has(d.status)) return 'none';
    if (query) {
      const haystack = `${d.label} ${(d.tags ?? []).join(' ')}`.toLowerCase();
      if (!haystack.includes(query)) return 'none';
    }
    return null;
  });
}

d3.selectAll('#controls input[data-kind]').on('change', function () {
  if (this.checked) hiddenKinds.delete(this.dataset.kind);
  else hiddenKinds.add(this.dataset.kind);
  applyFilters();
});

// Status checkboxes are derived from the data — a new status in the schema shows
// up here without touching this file.
const statuses = [...new Set(nodes.filter((n) => n.type === 'policy').map((n) => n.status))].sort();

d3.select('#status-filters').selectAll('label')
  .data(statuses)
  .join('label')
  .html((status) => `
    <input type="checkbox" value="${status}" checked>
    <span class="dot" style="background:${css(`--status-${status}`)}"></span>
    ${status} (${graph.stats.byStatus[status] ?? 0})
  `);

d3.selectAll('#status-filters input').on('change', () => {
  const checked = [...document.querySelectorAll('#status-filters input:checked')]
    .map((input) => input.value);
  // All checked means no filter at all, which keeps tag nodes visible.
  statusFilter = checked.length === statuses.length ? new Set() : new Set(checked);
  applyFilters();
});

d3.select('#search').on('input', function () {
  query = this.value.trim().toLowerCase();
  applyFilters();
});

d3.select('#reset').on('click', () => {
  document.querySelectorAll('#controls input[type="checkbox"]').forEach((i) => { i.checked = true; });
  document.querySelector('#search').value = '';
  hiddenKinds.clear();
  statusFilter = new Set();
  query = '';
  pinned = null;
  applyFilters();
  highlight(null);
  showDetail(null);
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
});

window.addEventListener('resize', () => {
  const box = svg.node().getBoundingClientRect();
  simulation.force('center', d3.forceCenter(box.width / 2, box.height / 2)).alpha(0.3).restart();
});

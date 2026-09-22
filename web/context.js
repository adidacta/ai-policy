/**
 * Context graph for an archived jurisdiction.
 *
 *   context.html?j=hungary
 *
 * Generic over any web/data/<jurisdiction>.json that build-jurisdiction.mjs
 * produces — the data declares its own node types and relation kinds, and the
 * legend and filters are built from that, so a new jurisdiction needs no
 * change here.
 *
 * Encoding: colour carries instrument type (three validated slots), shape
 * carries structural kind (document / institution / external). Every node is
 * labelled, so identity never rests on colour alone.
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const jurisdiction = new URLSearchParams(location.search).get('j') ?? 'hungary';

const svg = d3.select('#graph');
const tooltip = d3.select('#tooltip');
const detail = d3.select('#detail');

const graph = await fetch(`data/${jurisdiction}.json`).then((r) => {
  if (!r.ok) throw new Error(`data/${jurisdiction}.json missing — run \`npm run graph:${jurisdiction}\``);
  return r.json();
});

document.title = graph.title;
d3.select('#title').text(graph.title);
d3.select('#summary').text(
  `${graph.stats.documents} documents · ${graph.stats.institutions} institutions · ` +
  `${graph.stats.links} relations · ${graph.timeline.min}–${graph.timeline.max}` +
  (graph.stats.missing ? ` · ${graph.stats.missing} not retrieved` : ''),
);

const nodes = graph.nodes.map((n) => ({ ...n }));
const links = graph.links.map((l) => ({ ...l }));
const byId = new Map(nodes.map((n) => [n.id, n]));
const kindById = new Map(graph.legend.linkKinds.map((k) => [k.id, k]));

const colour = (node) => `var(--cat-${node.slot ?? 0})`;
const SIZE = (node) => (node.shape === 'circle' ? 8 : 7);

// --------------------------------------------------------------------- marks ---

/** Path for a node's shape, centred on the origin. */
function shapePath(node) {
  const r = SIZE(node);
  if (node.shape === 'square') return `M${-r},${-r}H${r}V${r}H${-r}Z`;
  if (node.shape === 'diamond') {
    const d = r * 1.3;
    return `M0,${-d}L${d},0L0,${d}L${-d},0Z`;
  }
  return d3.arc()({ innerRadius: 0, outerRadius: r, startAngle: 0, endAngle: Math.PI * 2 });
}

const { width, height } = svg.node().getBoundingClientRect();

svg.append('defs').selectAll('marker')
  .data(graph.legend.linkKinds)
  .join('marker')
    .attr('id', (k) => `head-${k.id}`)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 16)
    .attr('markerWidth', 4.5)
    .attr('markerHeight', 4.5)
    .attr('orient', 'auto')
  .append('path')
    .attr('d', 'M0,-4L9,0L0,4')
    .attr('fill', 'var(--edge)');

const zoomLayer = svg.append('g');

const linkSel = zoomLayer.append('g')
  .selectAll('line')
  .data(links)
  .join('line')
    .attr('class', 'link')
    .attr('stroke', 'var(--edge)')
    .attr('stroke-width', (d) => kindById.get(d.kind)?.width ?? 1.4)
    .attr('stroke-dasharray', (d) => kindById.get(d.kind)?.dash ?? null)
    .attr('marker-end', (d) => `url(#head-${d.kind})`);

const nodeSel = zoomLayer.append('g')
  .selectAll('g')
  .data(nodes)
  .join('g')
    .attr('class', 'node');

nodeSel.append('path')
  .attr('class', (d) => `node-shape${d.archived ? '' : ' missing'}`)
  .attr('d', shapePath)
  .attr('fill', (d) => (d.archived ? colour(d) : 'transparent'))
  .attr('stroke', (d) => (d.archived ? 'var(--bg)' : colour(d)))
  .attr('stroke-width', (d) => (d.archived ? 1.5 : 1.8));

nodeSel.append('text')
  .attr('x', (d) => SIZE(d) + 5)
  .attr('dy', '0.32em')
  .text((d) => d.short);

// ------------------------------------------------------------------ simulation ---

/** Room for the shape plus its label, which is drawn to the right of the mark. */
const PAD = { top: 34, right: 190, bottom: 26, left: 26 };

const year = (node) => (node.date ? Number(node.date.slice(0, 4)) : null);

// Rebuilt from the live canvas each time chronological mode is entered, so the
// axis spans the pane it is actually drawn in rather than the width at load.
let yearScale = d3.scaleLinear().domain([graph.timeline.min, graph.timeline.max]);

function rescaleYears() {
  const box = svg.node().getBoundingClientRect();
  yearScale.range([PAD.left + 34, box.width - 130]);
}
rescaleYears();

const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id((d) => d.id).distance(125).strength(0.55))
  .force('charge', d3.forceManyBody().strength(-950))
  .force('collide', d3.forceCollide(46))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .on('tick', () => {
    // Keep every node inside the canvas. A force-directed layout with this much
    // charge will otherwise push peripheral nodes past the edge, where they are
    // unreachable without zooming out. Labels extend to the right, so the right
    // margin is wider than the left.
    const box = svg.node().getBoundingClientRect();
    for (const d of nodes) {
      d.x = Math.max(PAD.left, Math.min(box.width - PAD.right, d.x));
      d.y = Math.max(PAD.top, Math.min(box.height - PAD.bottom, d.y));
    }

    linkSel
      .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
    nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

const axis = zoomLayer.insert('g', ':first-child').attr('opacity', 0);

function drawYearAxis() {
  const box = svg.node().getBoundingClientRect();
  const ticks = d3.range(graph.timeline.min, graph.timeline.max + 1);
  const g = axis.selectAll('g').data(ticks).join('g')
    .attr('transform', (y) => `translate(${yearScale(y)},0)`);
  g.selectAll('line').data((y) => [y]).join('line')
    .attr('y1', 28).attr('y2', box.height - 16)
    .attr('stroke', 'var(--border)');
  g.selectAll('text').data((y) => [y]).join('text')
    .attr('y', 18).attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted)').attr('font-size', 11)
    .text((y) => y);
}

/** Chronological mode pins x to the document's year and lets y settle freely. */
function setTimeline(on) {
  // Labels sit to the right of each mark; in chronological mode the columns are
  // tight, so the right margin shrinks to give the axis its full span.
  PAD.right = on ? 120 : 190;
  axis.attr('opacity', on ? 1 : 0);
  if (on) {
    rescaleYears();
    drawYearAxis();
    simulation
      .force('center', null)
      .force('x', d3.forceX((d) => (year(d) ? yearScale(year(d)) : width / 2)).strength(1))
      .force('y', d3.forceY(height / 2).strength(0.06))
      .force('charge', d3.forceManyBody().strength(-260));
  } else {
    simulation
      .force('x', null)
      .force('y', null)
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('charge', d3.forceManyBody().strength(-780));
  }
  simulation.alpha(0.8).restart();
}

const zoom = d3.zoom().scaleExtent([0.2, 4])
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
      // In chronological mode the x force re-pins it; otherwise let it float.
      d.fx = null; d.fy = null;
    }),
);

// ------------------------------------------------------------------ interaction ---

let pinned = null;

function highlight(id) {
  if (id === null) {
    nodeSel.classed('dimmed', false);
    linkSel.classed('dimmed', false);
    return;
  }
  const near = new Set([id]);
  for (const l of links) {
    if (l.source.id === id) near.add(l.target.id);
    if (l.target.id === id) near.add(l.source.id);
  }
  nodeSel.classed('dimmed', (d) => !near.has(d.id));
  linkSel.classed('dimmed', (d) => d.source.id !== id && d.target.id !== id);
}

nodeSel
  .on('mouseenter', (event, d) => {
    if (!pinned) highlight(d.id);
    const [x, y] = d3.pointer(event, svg.node());
    tooltip.attr('hidden', null)
      .style('left', `${x + 14}px`).style('top', `${y + 14}px`)
      .html(`<strong>${d.label}</strong><span>${d.typeLabel}${d.date ? ` · ${d.date}` : ''}</span>`);
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

svg.on('click', () => { pinned = null; highlight(null); showDetail(null); });

// ----------------------------------------------------------------------- detail ---

const escape = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function relationsFor(id) {
  const out = [];
  for (const l of links) {
    const label = kindById.get(l.kind)?.label ?? l.kind;
    if (l.source.id === id) out.push({ dir: '→', label, other: l.target.id, basis: l.basis });
    else if (l.target.id === id) out.push({ dir: '←', label, other: l.source.id, basis: l.basis });
  }
  return out;
}

function showDetail(node) {
  if (!node) {
    detail.html('<p class="placeholder">Select a node to inspect it.</p>');
    return;
  }

  const fields = Object.entries(node.fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`)
    .join('');

  const rels = relationsFor(node.id).map((r) => {
    const other = byId.get(r.other);
    return `<div class="rel">
      <div>${r.dir} <em>${escape(r.label)}</em> <a data-goto="${r.other}">${escape(other?.label ?? r.other)}</a></div>
      ${r.basis ? `<p class="basis">${escape(r.basis)}</p>` : ''}
    </div>`;
  }).join('');

  const alsoAs = (node.alsoAs ?? []).length
    ? `<h4>Also archived as</h4><ul>${node.alsoAs
        .map((f) => `<li>${escape(f.title)}<br><code>${escape(f.path)}</code></li>`).join('')}</ul>`
    : '';

  detail.html(`
    <h3>${escape(node.label)}</h3>
    ${node.sublabel ? `<p class="sublabel">${escape(node.sublabel)}</p>` : ''}
    <dl>${fields}</dl>
    ${node.missingReason
      ? `<p class="warn"><strong>Not retrieved.</strong> ${escape(node.missingReason)}</p>`
      : ''}
    ${node.href ? `<p><a href="${escape(node.href)}" target="_blank" rel="noopener">Official source ↗</a></p>` : ''}
    ${alsoAs}
    ${rels ? `<h4>Relations</h4>${rels}` : ''}
  `);

  detail.selectAll('a[data-goto]').on('click', (event) => {
    const id = event.currentTarget.dataset.goto;
    pinned = id;
    highlight(id);
    showDetail(byId.get(id));
  });
}

// ---------------------------------------------------------------------- filters ---

// A legend swatch drawn in the node's own shape and colour, so the legend is a
// specimen of the mark rather than a generic square.
function swatch(type) {
  const r = 6;
  const path = type.shape === 'square'
    ? `M${-r},${-r}H${r}V${r}H${-r}Z`
    : type.shape === 'diamond'
      ? `M0,${-r * 1.3}L${r * 1.3},0L0,${r * 1.3}L${-r * 1.3},0Z`
      : `M0,${-r}A${r},${r} 0 1,1 0,${r}A${r},${r} 0 1,1 0,${-r}Z`;
  return `<svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">
    <path d="${path}" fill="var(--cat-${type.slot})"/></svg>`;
}

d3.select('#type-filters').selectAll('label')
  .data(graph.legend.nodeTypes)
  .join('label')
  .attr('class', 'legend-row')
  .html((t) => `<input type="checkbox" value="${t.id}" checked>${swatch(t)}${t.label}`);

d3.select('#kind-filters').selectAll('label')
  .data(graph.legend.linkKinds)
  .join('label')
  .attr('class', 'legend-row')
  .html((k) => `<input type="checkbox" value="${k.id}" checked>
    <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
      <line x1="1" y1="5" x2="19" y2="5" stroke="var(--edge)"
        stroke-width="${k.width}" ${k.dash ? `stroke-dasharray="${k.dash}"` : ''}/>
    </svg>${k.label}`);

let query = '';

function checked(selector) {
  return new Set([...document.querySelectorAll(`${selector} input:checked`)].map((i) => i.value));
}

function applyFilters() {
  const types = checked('#type-filters');
  const kinds = checked('#kind-filters');

  const visible = new Set();
  nodeSel.attr('display', (d) => {
    const shown = types.has(d.type) &&
      (!query || d.label.toLowerCase().includes(query) ||
        (d.sublabel ?? '').toLowerCase().includes(query));
    if (shown) visible.add(d.id);
    return shown ? null : 'none';
  });

  linkSel.attr('display', (d) =>
    kinds.has(d.kind) && visible.has(d.source.id) && visible.has(d.target.id) ? null : 'none');
}

d3.selectAll('#type-filters input, #kind-filters input').on('change', applyFilters);
d3.select('#search').on('input', function () {
  query = this.value.trim().toLowerCase();
  applyFilters();
});
d3.select('#timeline').on('change', function () { setTimeline(this.checked); });

d3.select('#reset').on('click', () => {
  document.querySelectorAll('#controls input[type="checkbox"]').forEach((i) => { i.checked = true; });
  document.querySelector('#timeline').checked = false;
  document.querySelector('#search').value = '';
  query = '';
  pinned = null;
  setTimeline(false);
  applyFilters();
  highlight(null);
  showDetail(null);
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
});

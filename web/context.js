/**
 * Context graph for an archived jurisdiction.
 *
 *   context.html?j=hungary
 *
 * Two deterministic layouts, no force simulation:
 *
 *   structure   layered DAG (dagre). This corpus has direction — implements,
 *               adopts and replaces all flow one way — and a layered layout
 *               shows that as depth. A force layout renders the same data as
 *               spaghetti, which is why it is not used here.
 *   chronology  one column per year, nodes stacked within the column.
 *
 * Both are computed, so nothing drifts, jitters, or escapes the canvas, and
 * the same input always produces the same picture.
 *
 * Encoding: colour is instrument type (three validated slots), the glyph on
 * each card is structural kind, and the label lives inside the card so labels
 * cannot collide.
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import dagre from 'https://cdn.jsdelivr.net/npm/@dagrejs/dagre@1/+esm';

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
const links = graph.links.map((l, i) => ({ ...l, i }));
const byId = new Map(nodes.map((n) => [n.id, n]));

/** Ids currently passing the filters. The layouts lay out only these. */
let visibleIds = new Set(nodes.map((n) => n.id));
const shownNodes = () => nodes.filter((n) => visibleIds.has(n.id));
const shownLinks = () => links.filter((l) => visibleIds.has(l.source) && visibleIds.has(l.target));
const kindById = new Map(graph.legend.linkKinds.map((k) => [k.id, k]));

// ------------------------------------------------------------------- cards ---

const CARD_H = 42;
const GAP_X = 70;
const GAP_Y = 18;

// Real text metrics, so a card is exactly as wide as its content needs.
const ruler = document.createElement('canvas').getContext('2d');
function textWidth(text, font) {
  ruler.font = font;
  return ruler.measureText(text).width;
}

const LABEL_FONT = '600 12.5px ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif';
const META_FONT = '10.5px ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif';

for (const node of nodes) {
  node.meta = [node.typeLabel, node.date?.slice(0, 4)].filter(Boolean).join(' · ');
  const w = Math.max(textWidth(node.short, LABEL_FONT), textWidth(node.meta, META_FONT));
  node.w = Math.min(250, Math.max(112, Math.ceil(w) + 46));
  node.h = CARD_H;
}

/** The structural-kind glyph drawn inside each card. */
function glyphPath(shape) {
  const r = 5;
  if (shape === 'square') return `M${-r},${-r}H${r}V${r}H${-r}Z`;
  if (shape === 'diamond') {
    const d = r * 1.35;
    return `M0,${-d}L${d},0L0,${d}L${-d},0Z`;
  }
  return `M0,${-r}A${r},${r} 0 1,1 0,${r}A${r},${r} 0 1,1 0,${-r}Z`;
}

// ----------------------------------------------------------------- layouts ---

const line = d3.line().x((p) => p.x).y((p) => p.y).curve(d3.curveBasis);

/**
 * A curve between two cards, leaving from whichever face points at the other,
 * so an edge never crosses the card it starts from.
 *
 * Also used while dragging: a dragged node invalidates the layout engine's own
 * routing, so its edges are re-routed with this on every frame.
 */
function routeEdge(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (Math.abs(dy) >= Math.abs(dx)) {
    const sy = Math.sign(dy) || 1;
    const y1 = a.y + sy * (a.height / 2);
    const y2 = b.y - sy * (b.height / 2);
    const bend = Math.max(26, Math.abs(y2 - y1) * 0.4);
    return `M${a.x},${y1}C${a.x},${y1 + sy * bend} ${b.x},${y2 - sy * bend} ${b.x},${y2}`;
  }
  const sx = Math.sign(dx) || 1;
  const x1 = a.x + sx * (a.width / 2);
  const x2 = b.x - sx * (b.width / 2);
  const bend = Math.max(26, Math.abs(x2 - x1) * 0.4);
  return `M${x1},${a.y}C${x1 + sx * bend},${a.y} ${x2 - sx * bend},${b.y} ${x2},${b.y}`;
}

/** Layered DAG. Returns {x,y} per node id and a path per link. */
function layoutStructure() {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: GAP_Y, ranksep: GAP_X, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  const use = shownNodes();
  const edges = shownLinks();

  for (const n of use) g.setNode(n.id, { width: n.w, height: n.h });
  for (const l of edges) g.setEdge(l.source, l.target, {}, String(l.i));

  dagre.layout(g);

  const pos = new Map(use.map((n) => {
    const p = g.node(n.id);
    return [n.id, { x: p.x, y: p.y, width: n.w, height: n.h }];
  }));
  const paths = new Map(
    edges.map((l) => [l.i, line(g.edge({ v: l.source, w: l.target, name: String(l.i) }).points)]),
  );
  return { pos, paths, size: g.graph() };
}

/**
 * One horizontal band per year, oldest at the top, cards flowing left to right
 * and wrapping within the band.
 *
 * Bands rather than columns because a chronology is read top-to-bottom, and
 * because columns force the drawing as wide as the number of years — which no
 * pane is shaped for. Bands stay near the pane's width and grow downwards,
 * where scrolling is natural.
 */
function layoutChronology() {
  const box = svg.node().getBoundingClientRect();
  const LABEL_COL = 62;
  const contentWidth = Math.max(520, box.width / MIN_LEGIBLE_SCALE - 90);

  const years = d3.range(graph.timeline.min, graph.timeline.max + 1);
  const columns = new Map(years.map((y) => [y, []]));
  const undated = [];
  for (const n of use) {
    const y = n.date ? Number(n.date.slice(0, 4)) : null;
    if (y !== null && columns.has(y)) columns.get(y).push(n);
    else undated.push(n);
  }

  const pos = new Map();
  const bands = [];
  let cursorY = 54;

  const placeBand = (label, members) => {
    members.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.short.localeCompare(b.short));
    const top = cursorY;
    let x = LABEL_COL;
    let rows = members.length ? 1 : 0;

    for (const n of members) {
      if (x > LABEL_COL && x + n.w > contentWidth) {
        x = LABEL_COL;
        rows++;
      }
      pos.set(n.id, {
        x: x + n.w / 2,
        y: cursorY + (rows - 1) * (CARD_H + GAP_Y) + CARD_H / 2,
        width: n.w,
        height: n.h,
      });
      x += n.w + 16;
    }

    // A year with nothing in it still belongs on the timeline — the gap between
    // the 2020 strategy and the 2024 EU regulation is part of the story — but it
    // does not need a full band's height.
    const height = members.length === 0 ? 30 : rows * (CARD_H + GAP_Y) + 14;
    bands.push({ label, top: top - 12, height, rows, empty: members.length === 0 });
    cursorY = top + height;
  };

  for (const [year, members] of columns) placeBand(String(year), members);
  if (undated.length) placeBand('undated', undated);

  const paths = new Map(shownLinks().map((l) => [l.i, routeEdge(pos.get(l.source), pos.get(l.target))]));

  return {
    pos,
    paths,
    bands,
    contentWidth,
    size: { width: contentWidth + 20, height: cursorY + 20 },
  };
}

// ------------------------------------------------------------------ drawing ---

const zoomLayer = svg.append('g');
const axisLayer = zoomLayer.append('g');
const linkLayer = zoomLayer.append('g');
const nodeLayer = zoomLayer.append('g');

svg.append('defs').selectAll('marker')
  .data(['default', 'active'])
  .join('marker')
    .attr('id', (m) => `tip-${m}`)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 9)
    .attr('markerWidth', 4.5)
    .attr('markerHeight', 4.5)
    .attr('orient', 'auto')
  .append('path')
    .attr('d', 'M0,-4L9,0L0,4')
    .attr('fill', (m) => (m === 'active' ? 'var(--accent)' : 'var(--edge)'));

const linkSel = linkLayer.selectAll('path')
  .data(links)
  .join('path')
    .attr('class', 'link')
    .attr('fill', 'none')
    .attr('stroke', 'var(--edge)')
    .attr('stroke-width', (d) => kindById.get(d.kind)?.width ?? 1.4)
    .attr('stroke-dasharray', (d) => kindById.get(d.kind)?.dash ?? null)
    .attr('marker-end', 'url(#tip-default)');

const nodeSel = nodeLayer.selectAll('g')
  .data(nodes)
  .join('g')
    .attr('class', 'node card');

nodeSel.append('rect')
  .attr('class', (d) => `card-bg${d.archived ? '' : ' missing'}`)
  .attr('x', (d) => -d.w / 2).attr('y', -CARD_H / 2)
  .attr('width', (d) => d.w).attr('height', CARD_H)
  .attr('rx', 7);

nodeSel.append('path')
  .attr('class', 'glyph')
  .attr('d', (d) => glyphPath(d.shape))
  .attr('transform', (d) => `translate(${-d.w / 2 + 17},0)`)
  .attr('fill', (d) => (d.archived ? `var(--cat-${d.slot})` : 'transparent'))
  .attr('stroke', (d) => `var(--cat-${d.slot})`)
  .attr('stroke-width', 1.5);

nodeSel.append('text')
  .attr('class', 'card-label')
  .attr('x', (d) => -d.w / 2 + 30).attr('y', -2)
  .text((d) => d.short);

nodeSel.append('text')
  .attr('class', 'card-meta')
  .attr('x', (d) => -d.w / 2 + 30).attr('y', 12)
  .text((d) => d.meta);

const zoom = d3.zoom().scaleExtent([0.2, 3])
  .on('zoom', (event) => zoomLayer.attr('transform', event.transform));
svg.call(zoom);

let current = null;

/**
 * Positions the reader has overridden by dragging, kept per layout mode so that
 * switching modes and switching back does not lose their arrangement.
 * Cleared by Reset view.
 */
const manual = { structure: new Map(), chronology: new Map() };

function drawYearAxis(layout) {
  if (!layout.bands) {
    axisLayer.selectAll('*').remove();
    return;
  }
  const g = axisLayer.selectAll('g').data(layout.bands).join('g')
    .attr('transform', (b) => `translate(0,${b.top})`);

  g.selectAll('rect').data((b) => [b]).join('rect')
    .attr('class', (b) => `band${b.empty ? ' band-empty' : ''}`)
    .attr('x', 8).attr('y', 0)
    .attr('width', layout.contentWidth).attr('height', (b) => b.height - 8)
    .attr('rx', 8);

  g.selectAll('text').data((b) => [b]).join('text')
    .attr('class', (b) => `band-label${b.empty ? ' band-label-empty' : ''}`)
    .attr('x', 20).attr('y', (b) => (b.empty ? 16 : 26))
    .text((b) => b.label);
}

// Below this, the 10.5px meta line stops being readable. A graph that does not
// fit is better panned than shrunk into illegibility.
const MIN_LEGIBLE_SCALE = 0.75;

/** Scale and centre the drawing, never shrinking past legibility. */
function fitToView(layout, animate) {
  const box = svg.node().getBoundingClientRect();
  const fit = Math.min(
    1,
    box.width / (layout.size.width + 60),
    box.height / (layout.size.height + 60),
  );
  const scale = Math.max(fit, MIN_LEGIBLE_SCALE);

  // When it fits, centre it. When it does not, anchor to the top-left so the
  // reader starts where the flow starts rather than in the middle of it.
  const fits = scale <= fit;
  const tx = fits ? (box.width - layout.size.width * scale) / 2 : 24;
  const ty = fits ? (box.height - layout.size.height * scale) / 2 : 24;

  d3.select('#hint').classed('shown', !fits);

  const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
  (animate ? svg.transition().duration(600) : svg).call(zoom.transform, transform);
}

function render(mode, animate = true) {
  const layout = mode === 'chronology' ? layoutChronology() : layoutStructure();

  // Re-apply anything the reader moved by hand in this mode, then re-route the
  // edges those nodes touch.
  for (const [id, at] of manual[mode]) {
    const p = layout.pos.get(id);
    if (p) { p.x = at.x; p.y = at.y; }
  }
  for (const l of shownLinks()) {
    if (manual[mode].has(l.source) || manual[mode].has(l.target)) {
      layout.paths.set(l.i, routeEdge(layout.pos.get(l.source), layout.pos.get(l.target)));
    }
  }

  current = { mode, layout };

  drawYearAxis(layout);

  const shown = nodeSel.filter((d) => layout.pos.has(d.id));
  const n = animate ? shown.transition().duration(650) : shown;
  n.attr('transform', (d) => {
    const p = layout.pos.get(d.id);
    return `translate(${p.x},${p.y})`;
  });

  const withPath = linkSel.filter((d) => layout.paths.has(d.i));
  const l = animate ? withPath.transition().duration(650) : withPath;
  l.attr('d', (d) => layout.paths.get(d.i));

  fitToView(layout, animate);
}

render('structure', false);

// -------------------------------------------------------------- interaction ---

let pinned = null;

function highlight(id) {
  if (id === null) {
    nodeSel.classed('dimmed', false).classed('focus', false);
    linkSel.classed('dimmed', false).classed('active', false)
      .attr('marker-end', 'url(#tip-default)');
    return;
  }
  const near = new Set([id]);
  for (const l of links) {
    if (l.source === id) near.add(l.target);
    if (l.target === id) near.add(l.source);
  }
  nodeSel.classed('dimmed', (d) => !near.has(d.id)).classed('focus', (d) => d.id === id);
  linkSel
    .classed('dimmed', (d) => d.source !== id && d.target !== id)
    .classed('active', (d) => d.source === id || d.target === id)
    .attr('marker-end', (d) =>
      d.source === id || d.target === id ? 'url(#tip-active)' : 'url(#tip-default)');
}

nodeSel
  .on('mouseenter', (event, d) => {
    if (!pinned) highlight(d.id);
    const [x, y] = d3.pointer(event, svg.node());
    tooltip.attr('hidden', null)
      .style('left', `${x + 14}px`).style('top', `${y + 14}px`)
      .html(`<strong>${d.label}</strong>${d.sublabel ? `<span>${d.sublabel}</span>` : ''}`);
  })
  .on('mouseleave', () => {
    tooltip.attr('hidden', true);
    if (!pinned) highlight(null);
  })
  .on('click', (event, d) => {
    event.stopPropagation();
    // d3-drag marks the event when a drag actually moved; a click that ends a
    // drag should not also toggle selection.
    if (event.defaultPrevented) return;
    pinned = pinned === d.id ? null : d.id;
    highlight(pinned);
    showDetail(pinned ? d : null);
  });

svg.on('click', () => { pinned = null; highlight(null); showDetail(null); });

// ------------------------------------------------------------------- dragging ---

/**
 * Cards can be dragged. The layouts are deterministic, so a drag is an override
 * the reader owns: the position is remembered per layout mode and survives
 * filtering and selection, and Reset view clears it.
 *
 * Only the dragged node's own edges are re-routed — the layout engine's routing
 * for everything else stays valid, and recomputing all of it per frame would
 * make the drag stutter.
 */
function edgesTouching(id) {
  return links.filter((l) => l.source === id || l.target === id);
}

function redrawEdges(subset) {
  const { pos } = current.layout;
  linkSel
    .filter((d) => subset.includes(d))
    .attr('d', (d) => {
      const path = routeEdge(pos.get(d.source), pos.get(d.target));
      current.layout.paths.set(d.i, path);
      return path;
    });
}

nodeSel.call(
  d3.drag()
    .on('start', function () {
      d3.select(this).classed('dragging', true).raise();
    })
    .on('drag', function (event, d) {
      // The pointer is in screen space; the drawing is zoomed and panned.
      const scale = d3.zoomTransform(svg.node()).k;
      const p = current.layout.pos.get(d.id);
      p.x += event.dx / scale;
      p.y += event.dy / scale;

      d3.select(this).attr('transform', `translate(${p.x},${p.y})`);
      redrawEdges(edgesTouching(d.id));
    })
    .on('end', function (event, d) {
      d3.select(this).classed('dragging', false);
      const p = current.layout.pos.get(d.id);
      manual[current.mode].set(d.id, { x: p.x, y: p.y });
    }),
);

// ----------------------------------------------------------------------- detail ---

const escape = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function relationsFor(id) {
  const out = [];
  for (const l of links) {
    const label = kindById.get(l.kind)?.label ?? l.kind;
    if (l.source === id) out.push({ dir: '→', label, other: l.target, basis: l.basis });
    else if (l.target === id) out.push({ dir: '←', label, other: l.source, basis: l.basis });
  }
  return out;
}

function showDetail(node) {
  if (!node) {
    detail.html('<p class="placeholder">Select a node to inspect it.</p>');
    return;
  }

  const fields = Object.entries(node.fields).filter(([, v]) => v)
    .map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('');

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
    ${node.missingReason ? `<p class="warn"><strong>Not retrieved.</strong> ${escape(node.missingReason)}</p>` : ''}
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

function swatch(type) {
  const r = 5.5;
  const path = type.shape === 'square'
    ? `M${-r},${-r}H${r}V${r}H${-r}Z`
    : type.shape === 'diamond'
      ? `M0,${-r * 1.35}L${r * 1.35},0L0,${r * 1.35}L${-r * 1.35},0Z`
      : `M0,${-r}A${r},${r} 0 1,1 0,${r}A${r},${r} 0 1,1 0,${-r}Z`;
  return `<svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">
    <path d="${path}" fill="var(--cat-${type.slot})"/></svg>`;
}

d3.select('#type-filters').selectAll('label')
  .data(graph.legend.nodeTypes)
  .join('label').attr('class', 'legend-row')
  .html((t) => `<input type="checkbox" value="${t.id}" checked>${swatch(t)}${t.label}`);

d3.select('#kind-filters').selectAll('label')
  .data(graph.legend.linkKinds)
  .join('label').attr('class', 'legend-row')
  .html((k) => `<input type="checkbox" value="${k.id}" checked>
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
      <line x1="1" y1="5" x2="21" y2="5" stroke="var(--edge)"
        stroke-width="${k.width}" ${k.dash ? `stroke-dasharray="${k.dash}"` : ''}/>
    </svg>${k.label}`);

d3.select('#topic-filters').selectAll('label')
  .data(graph.legend.topics)
  .join('label').attr('class', 'legend-row')
  .html((t) => {
    const n = nodes.filter((x) => (x.topics ?? []).includes(t)).length;
    return `<input type="checkbox" value="${t}" checked>
      <span class="topic-name">${t.replace(/-/g, ' ')}</span>
      <span class="count">${n}</span>`;
  });

let query = '';

const checked = (sel) =>
  new Set([...document.querySelectorAll(`${sel} input:checked`)].map((i) => i.value));

function applyFilters() {
  const types = checked('#type-filters');
  const kinds = checked('#kind-filters');
  const topics = checked('#topic-filters');
  const allTopics = topics.size === graph.legend.topics.length;

  const matches = (d) => {
    if (!types.has(d.type)) return false;
    if (query && !(
      d.label.toLowerCase().includes(query) ||
      d.short.toLowerCase().includes(query) ||
      (d.sublabel ?? '').toLowerCase().includes(query)
    )) return false;
    // An institution carries no topic of its own — it is kept below if something
    // still visible is attached to it, so filtering by topic does not strand the
    // ministries and authorities that give the documents their meaning.
    if (d.topics === null) return true;
    return allTopics || d.topics.some((t) => topics.has(t));
  };

  const visible = new Set(nodes.filter(matches).map((n) => n.id));

  // Drop institutions that nothing visible points at any more.
  if (!allTopics || query) {
    for (const n of nodes) {
      if (n.topics !== null || !visible.has(n.id)) continue;
      const attached = links.some((l) =>
        (l.source === n.id && visible.has(l.target) && byId.get(l.target).topics !== null) ||
        (l.target === n.id && visible.has(l.source) && byId.get(l.source).topics !== null));
      if (!attached) visible.delete(n.id);
    }
  }

  nodeSel.attr('display', (d) => (visible.has(d.id) ? null : 'none'));
  linkSel.attr('display', (d) =>
    kinds.has(d.kind) && visible.has(d.source) && visible.has(d.target) ? null : 'none');

  d3.select('#summary-filtered')
    .text(visible.size === nodes.length ? '' : ` · showing ${visible.size} of ${nodes.length}`);

  // Re-run the layout over what survived, so a filtered graph uses the whole
  // canvas instead of leaving the survivors scattered across the old positions.
  const changed = visible.size !== visibleIds.size ||
    [...visible].some((id) => !visibleIds.has(id));
  if (changed) {
    visibleIds = visible;
    if (current) render(current.mode);
  }
}

d3.selectAll('#type-filters input, #kind-filters input, #topic-filters input')
  .on('change', applyFilters);

function setAllTopics(on) {
  document.querySelectorAll('#topic-filters input').forEach((i) => { i.checked = on; });
  applyFilters();
}
d3.select('#topics-all').on('click', () => setAllTopics(true));
d3.select('#topics-none').on('click', () => setAllTopics(false));
d3.select('#search').on('input', function () {
  query = this.value.trim().toLowerCase();
  applyFilters();
});

d3.selectAll('input[name="mode"]').on('change', function () { render(this.value); });

d3.select('#reset').on('click', () => {
  document.querySelectorAll('#type-filters input, #kind-filters input, #topic-filters input')
    .forEach((i) => { i.checked = true; });
  document.querySelector('#search').value = '';
  document.querySelector('input[name="mode"][value="structure"]').checked = true;
  query = '';
  pinned = null;
  manual.structure.clear();
  manual.chronology.clear();
  applyFilters();
  highlight(null);
  showDetail(null);
  render('structure');
});

window.addEventListener('resize', () => current && fitToView(current.layout, false));

// ------------------------------------------------------------------- panels ---

// Collapsing a panel changes the canvas width, and the chronology layout is
// measured from it — so the graph is laid out again once the transition ends.
function setPanel(side, collapsed) {
  document.body.dataset[side] = collapsed ? 'collapsed' : 'open';
  const button = document.querySelector(`#toggle-${side}`);
  button.setAttribute('aria-expanded', String(!collapsed));
  button.textContent = side === 'left'
    ? (collapsed ? '›' : '‹')
    : (collapsed ? '‹' : '›');
  button.setAttribute('aria-label',
    `${collapsed ? 'Show' : 'Hide'} ${side === 'left' ? 'filters' : 'details'}`);
  try {
    localStorage.setItem(`panel-${side}`, collapsed ? 'collapsed' : 'open');
  } catch { /* private mode, or storage blocked — the panel still works */ }
}

for (const side of ['left', 'right']) {
  let stored = null;
  try { stored = localStorage.getItem(`panel-${side}`); } catch { /* ignore */ }
  setPanel(side, stored === 'collapsed');

  d3.select(`#toggle-${side}`).on('click', () => {
    setPanel(side, document.body.dataset[side] !== 'collapsed');
    setTimeout(() => current && render(current.mode), 240);
  });
}

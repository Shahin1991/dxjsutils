// Mind map model: { id, text, children: Node[], collapsed? }. All operations are immutable.

export const BRANCH_COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#e03131', '#5f3dc4'];

let counter = 0;
export const newId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;
export const createNode = (text = '') => ({ id: newId(), text, children: [] });

export function createMap(title = 'Central idea') {
  return { ...createNode(title), children: ['Idea 1', 'Idea 2', 'Idea 3'].map((t) => createNode(t)) };
}

export function findNode(node, id, parent = null, depth = 0) {
  if (node.id === id) return { node, parent, depth };
  for (const c of node.children) {
    const r = findNode(c, id, node, depth + 1);
    if (r) return r;
  }
  return null;
}

function mapTree(node, fn) {
  const next = fn(node);
  if (next !== node) return next;
  let changed = false;
  const children = node.children.map((c) => {
    const n = mapTree(c, fn);
    if (n !== c) changed = true;
    return n;
  });
  return changed ? { ...node, children } : node;
}

export function updateNode(tree, id, patch) {
  return mapTree(tree, (n) => (n.id === id ? { ...n, ...patch } : n));
}

export function addChild(tree, parentId, text = '') {
  const child = createNode(text);
  return { tree: mapTree(tree, (n) => (n.id === parentId ? { ...n, collapsed: false, children: [...n.children, child] } : n)), id: child.id };
}

export function addSibling(tree, id, text = '') {
  const found = findNode(tree, id);
  if (!found?.parent) return addChild(tree, id, text);
  const sib = createNode(text);
  const t = mapTree(tree, (n) => {
    if (n.id !== found.parent.id) return n;
    const i = n.children.findIndex((c) => c.id === id);
    const children = [...n.children];
    children.splice(i + 1, 0, sib);
    return { ...n, children };
  });
  return { tree: t, id: sib.id };
}

export function removeNode(tree, id) {
  if (tree.id === id) return { tree, id };
  const found = findNode(tree, id);
  if (!found) return { tree, id: tree.id };
  const siblings = found.parent.children;
  const i = siblings.findIndex((c) => c.id === id);
  const nextSel = siblings[i + 1]?.id || siblings[i - 1]?.id || found.parent.id;
  return { tree: mapTree(tree, (n) => (n.id === found.parent.id ? { ...n, children: n.children.filter((c) => c.id !== id) } : n)), id: nextSel };
}

// Move a node (with its subtree) under a new parent. Refuses to move a node into itself.
export function moveNode(tree, id, newParentId) {
  if (id === tree.id || id === newParentId) return tree;
  const found = findNode(tree, id);
  if (!found || findNode(found.node, newParentId)) return tree;
  const without = removeNode(tree, id).tree;
  return mapTree(without, (n) => (n.id === newParentId ? { ...n, collapsed: false, children: [...n.children, found.node] } : n));
}

// Reorder among siblings: dir -1 (up) or +1 (down).
export function shiftNode(tree, id, dir) {
  const found = findNode(tree, id);
  if (!found?.parent) return tree;
  return mapTree(tree, (n) => {
    if (n.id !== found.parent.id) return n;
    const i = n.children.findIndex((c) => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= n.children.length) return n;
    const children = [...n.children];
    [children[i], children[j]] = [children[j], children[i]];
    return { ...n, children };
  });
}

export const countNodes = (n) => 1 + n.children.reduce((s, c) => s + countNodes(c), 0);

// ---------- layout ----------

const H_GAP = 44;
const V_GAP = 10;
export const approxWidth = (text, depth) => Math.max(depth === 0 ? 120 : 60, Math.min(320, text.length * (depth === 0 ? 9.5 : 7.6) + 28));

// Returns { nodes: [{ id, text, x, y, w, h, depth, side, color, collapsed, childCount }], edges: [...], bounds }
// x/y are node centres; the root is at (0, 0). measure(text, depth) -> width in px.
export function layoutMap(tree, measure = approxWidth) {
  const sizes = new Map();
  const size = (n, depth) => {
    const s = { w: measure(n.text || ' ', depth), h: depth === 0 ? 46 : depth === 1 ? 36 : 30 };
    sizes.set(n.id, s);
    return s;
  };
  const subH = new Map();
  const measureTree = (n, depth) => {
    const s = size(n, depth);
    const kids = n.collapsed ? [] : n.children;
    const total = kids.reduce((sum, c, i) => sum + measureTree(c, depth + 1) + (i ? V_GAP : 0), 0);
    const h = Math.max(s.h, total);
    subH.set(n.id, h);
    return h;
  };
  measureTree(tree, 0);

  const nodes = [];
  const edges = [];
  const place = (n, cx, cy, depth, side, color) => {
    const s = sizes.get(n.id);
    nodes.push({ id: n.id, text: n.text, x: cx, y: cy, w: s.w, h: s.h, depth, side, color, collapsed: Boolean(n.collapsed), childCount: n.children.length });
    if (n.collapsed) return;
    const kids = n.children;
    const total = kids.reduce((sum, c, i) => sum + subH.get(c.id) + (i ? V_GAP : 0), 0);
    let y = cy - total / 2;
    kids.forEach((c) => {
      const ch = subH.get(c.id);
      const cs = sizes.get(c.id);
      const ccx = cx + side * (s.w / 2 + H_GAP + cs.w / 2);
      const ccy = y + ch / 2;
      edges.push({ from: n.id, to: c.id, color, x1: cx + side * (s.w / 2), y1: cy, x2: ccx - side * (cs.w / 2), y2: ccy, depth: depth + 1 });
      place(c, ccx, ccy, depth + 1, side, color);
      y += ch + V_GAP;
    });
  };

  const rootSize = sizes.get(tree.id);
  nodes.push({ id: tree.id, text: tree.text, x: 0, y: 0, w: rootSize.w, h: rootSize.h, depth: 0, side: 0, color: null, collapsed: Boolean(tree.collapsed), childCount: tree.children.length });
  if (!tree.collapsed) {
    // Fill the right side first, then the left, keeping the two sides about the same height.
    const kids = tree.children.map((c, i) => ({ c, i, h: subH.get(c.id) }));
    const all = kids.reduce((s, k) => s + k.h, 0);
    const right = [];
    let acc = 0;
    kids.forEach((k) => {
      if (acc < all / 2 || right.length === 0) {
        right.push(k);
        acc += k.h;
      }
    });
    const left = kids.filter((k) => !right.includes(k));
    [[right, 1], [left, -1]].forEach(([list, side]) => {
      const total = list.reduce((s, k, i) => s + k.h + (i ? V_GAP * 2 : 0), 0);
      let y = -total / 2;
      list.forEach((k) => {
        const cs = sizes.get(k.c.id);
        const cx = side * (rootSize.w / 2 + H_GAP * 1.4 + cs.w / 2);
        const cy = y + k.h / 2;
        const color = BRANCH_COLORS[k.i % BRANCH_COLORS.length];
        edges.push({ from: tree.id, to: k.c.id, color, x1: side * (rootSize.w / 2 - 6), y1: 0, x2: cx - side * (cs.w / 2), y2: cy, depth: 1 });
        place(k.c, cx, cy, 1, side, color);
        y += k.h + V_GAP * 2;
      });
    });
  }
  const bounds = nodes.reduce((b, n) => ({
    minX: Math.min(b.minX, n.x - n.w / 2), maxX: Math.max(b.maxX, n.x + n.w / 2),
    minY: Math.min(b.minY, n.y - n.h / 2), maxY: Math.max(b.maxY, n.y + n.h / 2),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  return { nodes, edges, bounds };
}

export function edgePath({ x1, y1, x2, y2 }) {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

// Nearest node in a direction ('left'|'right'|'up'|'down') from the node with `id`.
export function neighbour(layout, id, dir) {
  const from = layout.nodes.find((n) => n.id === id);
  if (!from) return null;
  let best = null;
  let bestScore = Infinity;
  layout.nodes.forEach((n) => {
    if (n.id === id) return;
    const dx = n.x - from.x;
    const dy = n.y - from.y;
    const along = { left: -dx, right: dx, up: -dy, down: dy }[dir];
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) return;
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = n.id;
    }
  });
  return best;
}

// ---------- import / export ----------

export function toMarkdown(node, depth = 0) {
  const line = depth === 0 ? `# ${node.text}` : `${'  '.repeat(depth - 1)}- ${node.text}`;
  return [line, ...node.children.map((c) => toMarkdown(c, depth + 1))].join('\n');
}

// Accepts "# Title" + "- bullets" (any indent), or plain indented lines (tabs or spaces).
export function fromOutline(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error('The outline is empty');
  // Level: headings rank above any bullet (# < ## < bullets), bullets by indentation.
  const items = lines.map((l) => {
    const expanded = l.replace(/\t/g, '  ');
    const t = expanded.trim();
    const heading = t.match(/^(#{1,6})\s+(.*)$/);
    const bullet = t.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    return {
      level: heading ? heading[1].length - 10 : expanded.match(/^ */)[0].length,
      text: (heading ? heading[2] : bullet ? bullet[1] : t).trim(),
    };
  });
  const [first] = items;
  const rootIsFirst = items.slice(1).every((it) => it.level > first.level);
  const root = createNode(rootIsFirst ? first.text : 'Central idea');
  const stack = [{ node: root, level: -Infinity }];
  (rootIsFirst ? items.slice(1) : items).forEach((it) => {
    const n = createNode(it.text);
    while (stack.length > 1 && stack[stack.length - 1].level >= it.level) stack.pop();
    stack[stack.length - 1].node.children.push(n);
    stack.push({ node: n, level: it.level });
  });
  return root;
}

export function validateTree(v, depth = 0) {
  if (!v || typeof v !== 'object' || typeof v.text !== 'string' || !Array.isArray(v.children) || depth > 64) throw new Error('This is not a mind map file');
  return { id: newId(), text: v.text.slice(0, 500), collapsed: Boolean(v.collapsed), children: v.children.map((c) => validateTree(c, depth + 1)) };
}

export function toJson(tree) {
  const strip = (n) => ({ text: n.text, ...(n.collapsed ? { collapsed: true } : {}), children: n.children.map(strip) });
  return JSON.stringify({ format: 'dxjsutils-mindmap', version: 1, root: strip(tree) }, null, 2);
}

export function fromJson(text) {
  let v;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new Error('This is not a mind map file');
  }
  return validateTree(v.root || v);
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function toSvg(layout, { background = '#ffffff', text = '#1a1a2e', node = '#ffffff', accent = '#af0e20', font = 'Inter, Segoe UI, Arial, sans-serif' } = {}) {
  const pad = 30;
  const { minX, minY, maxX, maxY } = layout.bounds;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const ox = -minX + pad;
  const oy = -minY + pad;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${esc(font)}">`, `<rect width="100%" height="100%" fill="${background}"/>`];
  layout.edges.forEach((e) => {
    parts.push(`<path d="${edgePath({ x1: e.x1 + ox, y1: e.y1 + oy, x2: e.x2 + ox, y2: e.y2 + oy })}" fill="none" stroke="${e.color}" stroke-width="${e.depth === 1 ? 3 : 2}" stroke-linecap="round"/>`);
  });
  layout.nodes.forEach((n) => {
    const x = n.x - n.w / 2 + ox;
    const y = n.y - n.h / 2 + oy;
    const root = n.depth === 0;
    const fill = root ? accent : node;
    const stroke = root ? accent : n.color;
    parts.push(`<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${n.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${n.depth === 1 ? 2 : 1.5}"/>`);
    parts.push(`<text x="${n.x + ox}" y="${n.y + oy}" dominant-baseline="central" text-anchor="middle" font-size="${root ? 17 : n.depth === 1 ? 14.5 : 13}" font-weight="${n.depth <= 1 ? 600 : 400}" fill="${root ? '#ffffff' : text}">${esc(n.text)}${n.collapsed && n.childCount ? ` (+${n.childCount})` : ''}</text>`);
  });
  parts.push('</svg>');
  return parts.join('');
}

/*!
 * Net Flow Map columns: finds out what each column of the data holds (a number, a date, a category, free text), guesses what it
 * should do on the map (link width, item size, color, label), reads numbers the way people write them, and evaluates small
 * formulas for calculated columns. No DOM; runs in the page or in Node. Copyright (c) 2026 LFC Foundry. MIT License.
 *
 * Channels (strings) say where a number comes from:
 *   ''                no channel
 *   'weight'          the link's weight field
 *   'col:<name>'      a column of the items or links (the data's own, or a calculated one)
 *   'sys:<name>'      worked out from the links: degree, in, out, inW, outW (items); count (links);
 *                     flow, visits, traffic, sim (set by the engine)
 */
var NFMColumns = (function () {
  'use strict';

  /* ---------------------------------------------------------------- reading numbers and dates */
  var NUM_PLAIN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i, NUM_COMMA = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/;
  /** A number as people write it: 1,234.5  $12  (300)  12%  -4. Anything else gives NaN. */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v === undefined || v === null || typeof v === 'boolean') return NaN;
    var s = String(v).trim();
    if (!s || s.length > 40) return NaN;
    var neg = false;
    if (s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') { neg = true; s = s.slice(1, -1).trim(); }
    s = s.replace(/[$€£¥]/g, '').replace(/\s*%$/, '').trim();
    if (NUM_COMMA.test(s)) s = s.replace(/,/g, '');
    if (!NUM_PLAIN.test(s)) return NaN;
    var x = parseFloat(s);
    return isFinite(x) ? (neg ? -x : x) : NaN;
  }
  var DATE_RE = /^\d{4}-\d{1,2}(-\d{1,2})?([ T]\d{1,2}:\d{2}(:\d{2})?)?(Z|[+-]\d{2}:?\d{2})?$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  function dateMs(v) {
    if (typeof v !== 'string') return NaN;
    var s = v.trim();
    if (!DATE_RE.test(s)) return NaN;
    var t = Date.parse(/^\d{4}-\d{1,2}$/.test(s) ? s + '-01' : s);
    return isFinite(t) ? t : NaN;
  }
  function isEmpty(v) { return v === undefined || v === null || v === ''; }

  /* ---------------------------------------------------------------- number formats */
  function fmt(v) {
    if (v === undefined || v === null || !isFinite(v)) return '';
    var a = Math.abs(v), s;
    if (a >= 1e9) s = (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
    else if (a >= 1e6) s = (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    else if (a >= 1e4) s = (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
    else if (a >= 1000) s = Math.round(v).toLocaleString('en-US');
    else if (a >= 100) s = String(Math.round(v * 10) / 10);
    else if (a >= 1) s = String(Math.round(v * 100) / 100);
    else if (a === 0) s = '0';
    else if (a >= 0.01) s = String(Math.round(v * 1000) / 1000);
    else s = v.toExponential(1);
    return s.replace(/\.0(?=[kMB]|$)/, '');
  }
  function fmtFull(v) {
    if (v === undefined || v === null || !isFinite(v)) return '';
    return Number(v).toLocaleString('en-US', { maximumFractionDigits: 3 });
  }

  /* ---------------------------------------------------------------- profile: what is in each column */
  var NODE_BUILTIN = [['label', 'Label'], ['group', 'Group'], ['valence', 'Outcome mark']];
  var EDGE_BUILTIN = [['weight', 'Weight'], ['label', 'Label'], ['kind', 'Kind']];
  function makeCol(scope, key, name, builtin) {
    return { scope: scope, key: key, name: name, builtin: !!builtin, n: 0, numN: 0, dateN: 0, min: Infinity, max: -Infinity, sum: 0, distinct: 0, cats: null, sample: [], kind: 'empty', _d: new Map() };
  }
  function feed(c, v) {
    if (isEmpty(v)) return;
    c.n++;
    var x = num(v);
    if (x === x) { c.numN++; if (x < c.min) c.min = x; if (x > c.max) c.max = x; c.sum += x; }
    else if (!isNaN(dateMs(v))) c.dateN++;
    if (c._d.size < 400 || c._d.has(v)) c._d.set(v, (c._d.get(v) || 0) + 1);
    if (c.sample.length < 3 && c.sample.indexOf(v) < 0) c.sample.push(v);
  }
  function finish(c) {
    c.distinct = c._d.size;
    var capped = c._d.size >= 400;
    if (c.n === 0) c.kind = 'empty';
    else if (c.numN >= 0.9 * c.n) c.kind = 'number';
    else if (c.dateN >= 0.9 * c.n) c.kind = 'date';
    else if (!capped && c.distinct <= 40 && (c.distinct <= c.n * 0.6 || c.distinct <= 4)) c.kind = 'category';
    else c.kind = 'text';
    if (c.kind === 'category') c.cats = Array.from(c._d.entries()).sort(function (a, b) { return b[1] - a[1] || (String(a[0]) < String(b[0]) ? -1 : 1); }).slice(0, 40).map(function (e) { return [String(e[0]), e[1]]; });
    if (c.numN === 0) { c.min = c.max = c.sum = 0; }
    c.mean = c.numN ? c.sum / c.numN : 0;
    delete c._d;
    return c;
  }
  /** { nodes: [column], edges: [column] } for a graph. Cheap enough to run on every change. */
  function profile(g) {
    var out = { nodes: [], edges: [] }, nc = new Map(), ec = new Map(), i, k, c;
    NODE_BUILTIN.forEach(function (b) { nc.set(b[0], makeCol('nodes', b[0], b[1], true)); });
    EDGE_BUILTIN.forEach(function (b) { ec.set(b[0], makeCol('edges', b[0], b[1], true)); });
    for (i = 0; i < g.nodes.length; i++) {
      var n = g.nodes[i];
      feed(nc.get('label'), n.label === n.id ? '' : n.label); feed(nc.get('group'), n.group); feed(nc.get('valence'), n.valence);
      var at = n.attrs;
      if (at) for (k in at) { c = nc.get(k); if (!c) { c = makeCol('nodes', k, k, false); nc.set(k, c); } feed(c, at[k]); }
    }
    for (i = 0; i < g.edges.length; i++) {
      var e = g.edges[i];
      feed(ec.get('weight'), e.weight); feed(ec.get('label'), e.label); feed(ec.get('kind'), e.kind);
      var ea = e.attrs;
      if (ea) for (k in ea) { c = ec.get(k); if (!c) { c = makeCol('edges', k, k, false); ec.set(k, c); } feed(c, ea[k]); }
    }
    nc.forEach(function (col) { finish(col); if (col.kind !== 'empty') out.nodes.push(col); });
    ec.forEach(function (col) { finish(col); if (col.kind !== 'empty') out.edges.push(col); });
    // the label column is only interesting when it differs from the name; the weight is a number even when sparse
    out.edges.forEach(function (col) { if (col.key === 'weight' && col.numN) col.kind = 'number'; });
    return out;
  }
  function findCol(list, key) { for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i]; return null; }

  /* ---------------------------------------------------------------- reading a channel from an item or link */
  function split(ch) {
    if (!ch) return null;
    if (ch === 'weight') return { t: 'weight' };
    var i = ch.indexOf(':');
    return i < 0 ? { t: ch } : { t: ch.slice(0, i), key: ch.slice(i + 1) };
  }
  /** Number from a channel for one item or link (NaN when missing). */
  function numOf(obj, ch) {
    var c = typeof ch === 'string' ? split(ch) : ch;
    if (!c) return NaN;
    if (c.t === 'weight') return num(obj.weight);
    if (c.t !== 'col') return NaN;
    var at = obj.attrs;
    if (at && c.key in at) return num(at[c.key]);
    return num(obj[c.key]);
  }
  function catOf(obj, ch) {
    var c = typeof ch === 'string' ? split(ch) : ch;
    if (!c || c.t !== 'col') return c && c.t === 'weight' ? '' : '';
    var at = obj.attrs, v = at && c.key in at ? at[c.key] : obj[c.key];
    return isEmpty(v) ? '' : String(v);
  }

  /* ---------------------------------------------------------------- guessing what each column is for */
  var SIZE_NAMES = /(^|[^a-z])(size|value|amount|revenue|sales|total|population|count|volume|spend|budget|mass|score|rank|qty|quantity)([^a-z]|$)/i;
  var WIDTH_NAMES = /(^|[^a-z])(amount|flow|value|volume|count|qty|quantity|cost|spend|revenue|total|traffic|trips|transfers?|calls?|messages?|strength|weight)([^a-z]|$)/i;
  /** Sensible starting choices for the map from what the data holds. */
  function guessRoles(prof, g) {
    var r = { colorBy: 'group', sizeBy: '', widthBy: '', edgeColorBy: '', linkLabels: '' };
    var w = findCol(prof.edges, 'weight'), best = null;
    if (w && w.kind === 'number' && w.numN >= 1) r.widthBy = 'weight';
    else {
      prof.edges.forEach(function (c) { if (!best && !c.builtin && c.kind === 'number' && WIDTH_NAMES.test(c.name)) best = c; });
      if (!best) prof.edges.forEach(function (c) { if (!best && !c.builtin && c.kind === 'number') best = c; });
      if (best) r.widthBy = 'col:' + best.key;
    }
    var grp = findCol(prof.nodes, 'group'), sz = null;
    prof.nodes.forEach(function (c) { if (!sz && !c.builtin && c.kind === 'number' && SIZE_NAMES.test(c.name)) sz = c; });
    if (sz) r.sizeBy = 'col:' + sz.key;
    if (!grp || grp.kind === 'empty') {
      var cat = null; prof.nodes.forEach(function (c) { if (!cat && !c.builtin && c.kind === 'category' && c.distinct >= 2 && c.distinct <= 12) cat = c; });
      r.colorBy = cat ? 'col:' + cat.key : 'found';
    }
    var kind = findCol(prof.edges, 'kind');
    if (kind && kind.kind === 'category' && kind.distinct >= 2 && kind.distinct <= 8) r.edgeColorBy = 'col:kind';
    return r;
  }
  /** True when the data is a story (a choose-your-own-adventure) and the story wording makes sense. */
  function isStory(g) {
    if (!g) return false;
    if (g.flavor === 'story') return true;
    if (g.flavor === 'data') return false;
    for (var i = 0; i < g.nodes.length; i++) if (g.nodes[i].valence === 'good' || g.nodes[i].valence === 'bad') return true;
    return false;
  }

  /* ---------------------------------------------------------------- formulas for calculated columns */
  var FUNCS = {
    abs: Math.abs, sqrt: Math.sqrt, ln: Math.log, log10: Math.log10, log2: Math.log2, log: Math.log10, exp: Math.exp,
    floor: Math.floor, ceil: Math.ceil, sign: Math.sign, pow: Math.pow, sin: Math.sin, cos: Math.cos,
    round: function (x, d) { var f = Math.pow(10, d || 0); return Math.round(x * f) / f; },
    min: function () { var m = Infinity, a = arguments; for (var i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; },
    max: function () { var m = -Infinity, a = arguments; for (var i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; },
    clamp: function (x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  };
  var ARITY = { abs: 1, sqrt: 1, ln: 1, log10: 1, log2: 1, log: 1, exp: 1, floor: 1, ceil: 1, sign: 1, pow: 2, sin: 1, cos: 1, clamp: 3 };
  function tokenize(src) {
    var t = [], i = 0, n = src.length, m;
    while (i < n) {
      var ch = src.charAt(i);
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '[') {
        var j = src.indexOf(']', i + 1);
        if (j < 0) throw new Error('A [ is not closed with ]');
        t.push({ k: 'id', v: src.slice(i + 1, j).trim(), at: i }); i = j + 1; continue;
      }
      if (/[0-9.]/.test(ch)) {
        m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
        if (!m) throw new Error('A number looks wrong near "' + src.slice(i, i + 6) + '"');
        t.push({ k: 'num', v: parseFloat(m[0]), at: i }); i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
        var w = m[0], lw = w.toLowerCase();
        if (lw === 'and' || lw === 'or' || lw === 'not') t.push({ k: 'op', v: lw, at: i });
        else t.push({ k: 'id', v: w, at: i });
        i += w.length; continue;
      }
      m = /^(<=|>=|==|!=|<>|&&|\|\||[-+*\/%^(),<>=!])/.exec(src.slice(i));
      if (!m) throw new Error('I do not understand "' + ch + '"');
      var op = m[0]; if (op === '=') op = '=='; if (op === '<>') op = '!='; if (op === '&&') op = 'and'; if (op === '||') op = 'or';
      t.push({ k: 'op', v: op, at: i }); i += m[0].length;
    }
    return t;
  }
  /** Parses a formula. Returns { fn(get), vars }, where get(name) gives the number for a column name. Throws a plain-words error. */
  function compile(src) {
    var t = tokenize(String(src || '')), p = 0, vars = [];
    if (!t.length) throw new Error('The formula is empty');
    var peek = function () { return t[p]; }, isOp = function (v) { return t[p] && t[p].k === 'op' && t[p].v === v; };
    var expect = function (v) { if (!isOp(v)) throw new Error('Expected "' + v + '"' + (t[p] ? ' near "' + (t[p].v) + '"' : ' at the end')); p++; };
    var orE = function () { var a = andE(); while (isOp('or')) { p++; var b = andE(); a = (function (x, y) { return function (g) { return (x(g) && 1) || (y(g) && 1) ? 1 : 0; }; })(a, b); } return a; };
    var andE = function () { var a = cmpE(); while (isOp('and')) { p++; var b = cmpE(); a = (function (x, y) { return function (g) { return x(g) && y(g) ? 1 : 0; }; })(a, b); } return a; };
    var cmpE = function () {
      var a = addE();
      while (t[p] && t[p].k === 'op' && ['<', '<=', '>', '>=', '==', '!='].indexOf(t[p].v) >= 0) {
        var op = t[p++].v, b = addE();
        a = (function (x, y, o) { return function (g) { var u = x(g), v = y(g); return (o === '<' ? u < v : o === '<=' ? u <= v : o === '>' ? u > v : o === '>=' ? u >= v : o === '==' ? u === v : u !== v) ? 1 : 0; }; })(a, b, op);
      }
      return a;
    };
    var addE = function () {
      var a = mulE();
      while (isOp('+') || isOp('-')) { var op = t[p++].v, b = mulE(); a = (function (x, y, o) { return o === '+' ? function (g) { return x(g) + y(g); } : function (g) { return x(g) - y(g); }; })(a, b, op); }
      return a;
    };
    var mulE = function () {
      var a = powE();
      while (isOp('*') || isOp('/') || isOp('%')) { var op = t[p++].v, b = powE(); a = (function (x, y, o) { return o === '*' ? function (g) { return x(g) * y(g); } : o === '/' ? function (g) { var d = y(g); return d === 0 ? NaN : x(g) / d; } : function (g) { return x(g) % y(g); }; })(a, b, op); }
      return a;
    };
    var powE = function () { var a = unE(); if (isOp('^')) { p++; var b = powE(); return function (g) { return Math.pow(a(g), b(g)); }; } return a; };
    var unE = function () {
      if (isOp('-')) { p++; var a = unE(); return function (g) { return -a(g); }; }
      if (isOp('+')) { p++; return unE(); }
      if (isOp('not')) { p++; var b = unE(); return function (g) { return b(g) ? 0 : 1; }; }
      return prim();
    };
    var prim = function () {
      var k = peek();
      if (!k) throw new Error('The formula ends too early');
      if (k.k === 'num') { p++; var v = k.v; return function () { return v; }; }
      if (k.k === 'op' && k.v === '(') { p++; var e = orE(); expect(')'); return e; }
      if (k.k === 'id') {
        p++;
        if (isOp('(')) {
          p++;
          var name = k.v.toLowerCase(), args = [];
          if (!isOp(')')) { do { args.push(orE()); if (isOp(',')) p++; else break; } while (true); }
          expect(')');
          if (name === 'if') {
            if (args.length !== 3) throw new Error('if needs three parts: if(test, then, else)');
            return function (g) { return args[0](g) ? args[1](g) : args[2](g); };
          }
          var f = FUNCS[name];
          if (!f) throw new Error('I do not know the function "' + k.v + '"');
          if (ARITY[name] && args.length !== ARITY[name]) throw new Error(name + ' needs ' + ARITY[name] + ' value' + (ARITY[name] === 1 ? '' : 's'));
          return function (g) { var a = new Array(args.length); for (var i = 0; i < args.length; i++) a[i] = args[i](g); return f.apply(null, a); };
        }
        if (k.v.toLowerCase() === 'pi') return function () { return Math.PI; };
        var id = k.v; if (vars.indexOf(id) < 0) vars.push(id);
        return function (g) { return g(id); };
      }
      throw new Error('Unexpected "' + k.v + '"');
    };
    var fn = orE();
    if (p < t.length) throw new Error('Unexpected "' + t[p].v + '"');
    return { fn: fn, vars: vars };
  }

  /* ---------------------------------------------------------------- derived graph: calculated columns written into the attributes */
  var memo = { g: null, key: '', out: null };
  function round6(x) { return isFinite(x) ? Math.round(x * 1e6) / 1e6 : ''; }
  function nodeSys(g) {
    var n = g.nodes.length, idx = new Map(), deg = new Float64Array(n), ins = new Float64Array(n), outs = new Float64Array(n), inW = new Float64Array(n), outW = new Float64Array(n), i;
    for (i = 0; i < n; i++) idx.set(g.nodes[i].id, i);
    for (i = 0; i < g.edges.length; i++) {
      var e = g.edges[i], a = idx.get(e.from), b = idx.get(e.to);
      if (a === undefined || b === undefined) continue;
      var w = num(e.weight); if (w !== w) w = 1;
      outs[a]++; ins[b]++; deg[a]++; deg[b]++; outW[a] += w; inW[b] += w;
    }
    return { idx: idx, degree: deg, 'in': ins, out: outs, inW: inW, outW: outW };
  }
  function nodeGetter(node, i, sys, calcVals) {
    return function (name) {
      var k = name.toLowerCase();
      if (k === 'degree') return sys.degree[i]; if (k === 'in') return sys['in'][i]; if (k === 'out') return sys.out[i]; if (k === 'inw') return sys.inW[i]; if (k === 'outw') return sys.outW[i];
      if (calcVals && Object.prototype.hasOwnProperty.call(calcVals, name)) return calcVals[name];
      var at = node.attrs, key = name;
      if (at && !Object.prototype.hasOwnProperty.call(at, key)) { var lk = key.toLowerCase(); for (var q in at) if (q.toLowerCase() === lk) { key = q; break; } }
      if (at && Object.prototype.hasOwnProperty.call(at, key)) return num(at[key]);
      if (key === 'group' || key === 'label') return num(node[key]);
      return NaN;
    };
  }
  /** The graph with calculated columns filled in (new objects only where something was added). Same graph back when there are none. */
  function derive(g) {
    if (!g || !g.calc || !g.calc.length) return g;
    var key = JSON.stringify(g.calc);
    if (memo.g === g && memo.key === key) return memo.out;
    var out = { name: g.name, start: g.start, flavor: g.flavor, states: g.states, calc: g.calc, roles: g.roles, nodes: g.nodes.slice(), edges: g.edges.slice(), errors: [] };
    var sys = nodeSys(g), nodeCalcs = [], edgeCalcs = [];
    g.calc.forEach(function (c) {
      try { var cc = compile(c.formula); (c.scope === 'edges' ? edgeCalcs : nodeCalcs).push({ name: c.name, fn: cc.fn }); } catch (err) { out.errors.push(c.name + ': ' + err.message); }
    });
    var i;
    if (nodeCalcs.length) {
      for (i = 0; i < out.nodes.length; i++) {
        var nd = out.nodes[i], vals = {}, attrs = Object.assign({}, nd.attrs), get = nodeGetter(nd, i, sys, vals);
        nodeCalcs.forEach(function (c) { var v; try { v = c.fn(get); } catch (e) { v = NaN; } vals[c.name] = v; attrs[c.name] = round6(v); });
        out.nodes[i] = Object.assign({}, nd, { attrs: attrs });
      }
    }
    if (edgeCalcs.length) {
      var byId = new Map(); out.nodes.forEach(function (n, k) { byId.set(n.id, k); });
      for (i = 0; i < out.edges.length; i++) {
        var ed = out.edges[i], ev = {}, eattrs = Object.assign({}, ed.attrs), fi = byId.get(ed.from), ti = byId.get(ed.to);
        var fg = fi === undefined ? function () { return NaN; } : nodeGetter(out.nodes[fi], fi, sys, null), tg = ti === undefined ? function () { return NaN; } : nodeGetter(out.nodes[ti], ti, sys, null);
        var eget = function (name) {
          if (Object.prototype.hasOwnProperty.call(ev, name)) return ev[name];
          var dot = name.indexOf('.');
          if (dot > 0) { var pre = name.slice(0, dot).toLowerCase(), rest = name.slice(dot + 1); if (pre === 'from') return fg(rest); if (pre === 'to') return tg(rest); }
          var k = name.toLowerCase();
          if (k === 'weight') { var w = num(ed.weight); return w; }
          var at = eattrs, kk = name;
          if (!Object.prototype.hasOwnProperty.call(at, kk)) for (var q in at) if (q.toLowerCase() === k) { kk = q; break; }
          return Object.prototype.hasOwnProperty.call(at, kk) ? num(at[kk]) : NaN;
        };
        edgeCalcs.forEach(function (c) { var v; try { v = c.fn(eget); } catch (e) { v = NaN; } ev[c.name] = v; eattrs[c.name] = round6(v); });
        out.edges[i] = Object.assign({}, ed, { attrs: eattrs });
      }
    }
    memo = { g: g, key: key, out: out };
    return out;
  }

  /* ---------------------------------------------------------------- states: ways to split data into baseline / year 1 / year 2 ... */
  /**
   * Looks for ways the data could hold several states.
   * Returns { rows: [{key, name, values}], cols: [{keys, names}] }:
   *   rows  = a column on the links whose few distinct values repeat the same from-to pairs (one row per state)
   *   cols  = number columns on the links that look like one column per state (years, "Year 1", "Baseline"...)
   */
  function suggestStates(g, prof) {
    var out = { rows: [], cols: [] };
    prof = prof || profile(g);
    var pairs = new Map();
    for (var i = 0; i < g.edges.length && i < 50000; i++) { var k = g.edges[i].from + '\u0001' + g.edges[i].to; pairs.set(k, (pairs.get(k) || 0) + 1); }
    var repeated = 0; pairs.forEach(function (c) { if (c > 1) repeated++; });
    if (pairs.size && repeated / pairs.size > 0.3) {
      prof.edges.forEach(function (c) {
        if (c.key === 'weight' || c.kind === 'number' && c.distinct > 12) return;
        if ((c.kind === 'category' || c.kind === 'date' || c.kind === 'number') && c.distinct >= 2 && c.distinct <= 24) out.rows.push({ key: c.key, name: c.name, values: c.kind === 'category' && c.cats ? c.cats.map(function (x) { return x[0]; }) : null });
      });
    }
    var nums = prof.edges.filter(function (c) { return c.kind === 'number' && !c.builtin; });
    var STATE_NAME = /(19|20)\d\d|year\s*\d|^y\d+$|baseline|base|end|final|start|phase\s*\d|q[1-4]|scenario|period|t\d+|^t[-_ ]?\d+$|month|week/i;
    var likely = nums.filter(function (c) { return STATE_NAME.test(c.name); });
    if (likely.length >= 2) out.cols.push({ keys: likely.map(function (c) { return c.key; }), names: likely.map(function (c) { return c.name; }) });
    else if (nums.length >= 2 && !out.rows.length) out.cols.push({ keys: nums.map(function (c) { return c.key; }), names: nums.map(function (c) { return c.name; }) });
    return out;
  }

  /**
   * Turns a table into states. spec: { mode: 'cols', keys: [edge column keys], names: [state names] }
   *   or { mode: 'rows', key: edge column key, order?: [values in the order wanted] }.
   * Returns a new graph with g.states = { names } and every link carrying vals (one number per state, or null when absent).
   */
  function buildStates(g, spec) {
    var out = Object.assign({}, g), ns, i, e;
    var attr = function (ed, k) { var v = ed.attrs && k in ed.attrs ? ed.attrs[k] : ed[k]; return v; };
    if (spec.mode === 'cols') {
      var keys = spec.keys.slice(0, 60); ns = keys.length;
      if (ns < 2) throw new Error('Pick at least two columns.');
      out.states = { names: keys.map(function (k, j) { var nm = spec.names && spec.names[j]; return String(nm === undefined || nm === '' ? k : nm).slice(0, 60); }) };
      var flat = g.edges.every(function (ed) { return !(Number(ed.weight) !== 1); });
      out.edges = g.edges.map(function (ed) {
        var vals = keys.map(function (k) { var v = num(attr(ed, k)); return v === v ? v : null; }), c = Object.assign({}, ed, { vals: vals });
        if (flat) { var sum = 0, cnt = 0; vals.forEach(function (v) { if (v !== null) { sum += v; cnt++; } }); if (cnt) c.weight = sum / cnt; }
        return c;
      });
      return out;
    }
    if (spec.mode === 'rows') {
      var key = spec.key, seen = [], vset = {};
      g.edges.forEach(function (ed) { var v = String(attr(ed, key) === undefined || attr(ed, key) === null ? '' : attr(ed, key)); if (!(v in vset)) { vset[v] = 1; seen.push(v); } });
      var order = spec.order && spec.order.length ? spec.order.map(String) : seen.slice();
      if (!spec.order) {
        var allNum = seen.every(function (v) { return v !== '' && num(v) === num(v); }), allDate = !allNum && seen.every(function (v) { return v !== '' && dateMs(v) === dateMs(v); });
        if (allNum) order.sort(function (a, b) { return num(a) - num(b); }); else if (allDate) order.sort(function (a, b) { return dateMs(a) - dateMs(b); });
      }
      order = order.slice(0, 60); ns = order.length;
      if (ns < 2) throw new Error('That column has only one value, so there is nothing to compare.');
      out.states = { names: order.map(function (v) { return v === '' ? '(none)' : v.slice(0, 60); }) };
      var byPair = new Map(), list = [];
      g.edges.forEach(function (ed) {
        var si = order.indexOf(String(attr(ed, key) === undefined || attr(ed, key) === null ? '' : attr(ed, key)));
        if (si < 0) return;
        var pk = ed.from + '\u0001' + ed.to + '\u0001' + (ed.kind || ''), t = byPair.get(pk);
        if (!t) { t = Object.assign({}, ed, { vals: new Array(ns).fill(null), attrs: Object.assign({}, ed.attrs || {}) }); if (t.attrs) delete t.attrs[key]; byPair.set(pk, t); list.push(t); }
        var w = num(ed.weight); if (!(w === w)) w = 1;
        t.vals[si] = (t.vals[si] || 0) + w;
      });
      list.forEach(function (t) { var sum = 0, cnt = 0; t.vals.forEach(function (v) { if (v !== null) { sum += v; cnt++; } }); t.weight = cnt ? sum / cnt : 1; });
      out.edges = list;
      return out;
    }
    throw new Error('Unknown way of making states.');
  }
  function clearStates(g) {
    var out = Object.assign({}, g); delete out.states;
    out.edges = g.edges.map(function (e) { if (!e.vals) return e; var c = Object.assign({}, e); delete c.vals; return c; });
    return out;
  }

  return { buildStates: buildStates, clearStates: clearStates, num: num, dateMs: dateMs, fmt: fmt, fmtFull: fmtFull, profile: profile, findCol: findCol, numOf: numOf, catOf: catOf, split: split, guessRoles: guessRoles, isStory: isStory, compile: compile, derive: derive, suggestStates: suggestStates, nodeSys: nodeSys, FUNCS: Object.keys(FUNCS).concat(['if']) };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMColumns;

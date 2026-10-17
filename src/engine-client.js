/*!
 * Net Flow Map engine client: runs the engine in a Web Worker made from the page's own text (no extra files), and falls back
 * to running it on the page if workers are not allowed. Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMEngineClient = (function () {
  'use strict';
  /**
   * What the engine does for each kind of job. It runs inside the worker (its text is copied there) or on the page, so it may only
   * use its arguments: st = { G, ver, P, sim }, API = { E, SIM, CHK, C }.
   */
  function dispatch(d, st, API) {
    var E = API.E, i;
    switch (d.type) {
      case 'build': {
        var gp = d.opts && d.opts.gpuPicture;   // a finished picture of the big piece, made on the graphics card: the engine goes on with its own clean-up
        if (!gp) return E.build(st.G, d.opts);
        var o2 = Object.assign({}, d.opts); delete o2.gpuPicture;
        E.stressTuning.external = function (X, k) { if (k !== gp.k) return false; for (var q = 0; q < 2 * k; q++) X[q] = gp.X[q]; return true; };
        try { return E.build(st.G, o2); } finally { E.stressTuning.external = null; }
      }
      case 'gpuPiece': {   // the hop structure of the big piece (what the graphics card needs), found by running the build up to that point
        var cap = null;
        E.stressTuning.external = function (X, k, off, nbr, edge) { if (cap) return false; cap = { k: k, off: Int32Array.from(off), nbr: Int32Array.from(nbr), edge: edge }; throw new Error('nfm-captured'); };
        try { E.build(st.G, d.opts); } catch (err) { if (!cap) throw err; } finally { E.stressTuning.external = null; }
        return { gpuPiece: cap };
      }
      case 'compare': return E.compare(st.G, d.opts);
      case 'check': return API.CHK.run(st.G, d.opts);
      case 'simStart': {
        st.P = E.prepare(st.G, d.prep || {});
        st.cfg = API.SIM.fromSpec(st.P, d.spec);
        st.sim = API.SIM.create(st.P, st.cfg);
        return { K: st.sim.K, ends: st.sim.ends.map(function (v) { return st.P.nodes[v].id; }), sources: st.cfg.sources ? st.cfg.sources.length : 1 };
      }
      case 'simRun': {
        if (!st.sim) throw new Error('Start the simulation first.');
        var r = st.sim.run(d.trials || 200, d.budgetMs || 120), snap = st.sim.snapshot(), vo = new Float64Array(st.G.nodes.length), mo = new Float64Array(st.G.edges.length);
        for (i = 0; i < st.P.n; i++) vo[st.P.norig[i]] = snap.visits[i];
        for (i = 0; i < st.P.m; i++) mo[st.P.eorig[i]] = snap.moves[i];
        snap.visits = vo; snap.moves = mo;
        return { done: r.done, snap: snap };
      }
      case 'simExact': {
        var P1 = E.prepare(st.G, d.prep || {}), cfg1 = API.SIM.fromSpec(P1, d.spec), ex = API.SIM.exactSummary(P1, cfg1);
        if (!ex) return null;
        var vo2 = new Float64Array(st.G.nodes.length), mo2 = new Float64Array(st.G.edges.length);
        for (i = 0; i < P1.n; i++) vo2[P1.norig[i]] = ex.visits[i];
        for (i = 0; i < P1.m; i++) mo2[P1.eorig[i]] = ex.moves[i];
        ex.visits = vo2; ex.moves = mo2;
        return ex;
      }
      case 'sweep': {
        var P2 = E.prepare(st.G, d.prep || {}), cfg2 = API.SIM.fromSpec(P2, d.spec);
        return API.SIM.sweep(P2, cfg2, d.sweep || {});
      }
      case 'distinfo': return API.SIM.DISTS;
      default: throw new Error('Unknown job: ' + d.type);
    }
  }
  var WORKER_MAIN = '\nvar dispatch = ' + dispatch.toString() + '\nvar __st={G:null,ver:-1,P:null,sim:null};var __API={E:NFMEngine,SIM:NFMSim,CHK:NFMCheck,C:NFMColumns};self.onmessage=function(e){var d=e.data;try{' +
    'if(d.type==="graph"){__st.G=NFMColumns.derive(d.graph);__st.ver=d.ver;__st.sim=null;self.postMessage({id:d.id,ok:true,result:true});return;}' +
    'if(d.type==="ping"){self.postMessage({id:d.id,ok:true,result:"pong"});return;}' +
    'if(d.ver!==__st.ver)throw new Error("The worker has an older copy of the data.");' +
    'var t0=Date.now();var r=dispatch(d,__st,__API);var tr=[];' +
    'try{var pk=NFMPack.packResult(r,tr);r=pk;}catch(pe){tr=[];}' +   // big layouts travel as typed arrays (src/pack.js); any trouble: send the objects as they are
    'self.postMessage({id:d.id,ok:true,result:r,ms:Date.now()-t0},tr);' +
    '}catch(err){self.postMessage({id:d.id,ok:false,error:String(err&&err.message||err)});}};';

  function Client(engineSrc, onMain) {
    this.src = engineSrc; this.onMain = onMain; this.w = null; this.mode = 'starting'; this.seq = 0; this.pending = new Map();
    this.ver = 0; this.graph = null; this.queue = null; this.busy = null; this.why = '';
  }
  Client.prototype.start = function () {
    var self = this;
    return new Promise(function (resolve) {
      var fallback = function (why) { self.mode = 'page'; self.why = why; if (self.w) { try { self.w.terminate(); } catch (e) { /* gone */ } self.w = null; } resolve(self); };
      try {
        var blob = new Blob([self.src + WORKER_MAIN], { type: 'text/javascript' }), url = URL.createObjectURL(blob);
        self.w = new Worker(url);
        URL.revokeObjectURL(url);
        self.w.onerror = function (ev) { if (self.mode === 'starting') fallback('The worker could not start (' + (ev && ev.message || 'blocked') + ').'); else self.died('The background engine stopped (' + (ev && ev.message || 'unknown reason') + ').'); };
        self.w.onmessageerror = function () { if (self.mode !== 'starting') self.died('The background engine sent something the page could not read.'); };
        self.w.onmessage = function (e) { self.onMsg(e.data); };
        var t = setTimeout(function () { if (self.mode === 'starting') fallback('The worker did not answer in time.'); }, 3000);
        self.call({ type: 'ping' }).then(function () { clearTimeout(t); if (self.mode === 'starting') { self.mode = 'worker'; resolve(self); } }, function () { clearTimeout(t); fallback('The worker test failed.'); });
      } catch (err) { fallback(String(err && err.message || err)); }
    });
  };
  /** The worker died or broke while jobs were out: every job waiting for it fails with a plain-words message (the one running frees the line), and from now on the page does the work itself, as when a worker cannot start. */
  Client.prototype.died = function (why) {
    if (this.mode === 'page') return;
    var self = this, waiting = Array.from(this.pending.values());
    this.mode = 'page'; this.why = why; this.st = null;
    if (this.w) { try { this.w.terminate(); } catch (e) { /* gone */ } this.w = null; }
    this.pending.clear();
    waiting.forEach(function (p) { if (p.type === 'graph') p.resolve(true); else p.reject(new Error('The background engine stopped, so that step was canceled. Try again: the page will do the work itself now.')); });
  };
  Client.prototype.onMsg = function (d) {
    var p = this.pending.get(d.id);
    if (!p) return;
    this.pending.delete(d.id);
    if (d.ok) p.resolve(d.result === true || d.result === 'pong' ? d.result : { L: typeof NFMPack !== 'undefined' ? NFMPack.unpackResult(d.result) : d.result, ms: d.ms }); else p.reject(new Error(d.error));
  };
  Client.prototype.call = function (msg) {
    var self = this, id = ++this.seq;
    return new Promise(function (resolve, reject) { self.pending.set(id, { resolve: resolve, reject: reject, type: msg.type }); msg.id = id; try { self.w.postMessage(msg); } catch (err) { self.pending.delete(id); reject(err); } });
  };
  /** Gives the engine a new graph. Call whenever the data changes. */
  Client.prototype.setGraph = function (graph) {
    this.graph = graph; this.ver++; this.st = null;
    if (this.mode === 'worker') return this.call({ type: 'graph', graph: graph, ver: this.ver });
    return Promise.resolve(true);
  };
  /** Runs a job (build, compare, check, simStart, simRun, simExact, sweep). If a newer request of the same kind arrives while one waits, only the newest waits its turn. */
  Client.prototype.run = function (type, opts, extra) {
    var self = this;
    return new Promise(function (resolve, reject) {
      self.queues = self.queues || {};
      var key = type === 'build' || type === 'compare' || type === 'gpuPiece' ? 'view' : type;
      if (self.queues[key]) self.queues[key].reject(new Error('superseded'));
      self.queues[key] = { type: type, opts: opts, extra: extra || {}, resolve: resolve, reject: reject };
      self.pump();
    });
  };
  Client.prototype.pump = function () {
    var self = this;
    if (self.busy || !self.queues) return;
    var key = null, order = ['view', 'check', 'simStart', 'simRun', 'simExact', 'sweep'], i;
    for (i = 0; i < order.length; i++) if (self.queues[order[i]]) { key = order[i]; break; }
    if (!key) return;
    var job = self.queues[key]; self.queues[key] = null; self.busy = job;
    var done = function () { self.busy = null; self.pump(); };
    var t0 = Date.now(), ver = self.ver, msg = Object.assign({ type: job.type, opts: job.opts, ver: ver }, job.extra);
    if (self.mode === 'worker') {
      self.call(msg).then(function (r) { r.total = Date.now() - t0; r.res = r.L; job.resolve(r); }, function (err) { job.reject(err); }).then(done);
    } else {
      setTimeout(function () {
        try {
          var E = self.onMain(), API = { E: E, SIM: NFMSim, CHK: NFMCheck, C: NFMColumns };
          if (!self.st || self.st.ver !== ver) self.st = { G: NFMColumns.derive(self.graph), ver: ver, P: null, sim: null };
          var r = dispatch(msg, self.st, API); job.resolve({ L: r, res: r, ms: Date.now() - t0, total: Date.now() - t0 });
        } catch (err) { job.reject(err); }
        done();
      }, 0);
    }
  };
  /** Cancels a running Monte Carlo simulation (it simply stops being asked for more). */
  /** Start-up test of the graphics card, once (resolves the card record: { state: 'ready' | 'none', max, info, why, layout }). Needs NFMGpuStress on the page. */
  Client.prototype.cardProbe = function () {
    var self = this;
    if (!this.cardP) this.cardP = (typeof NFMGpuStress === 'undefined' ? Promise.resolve({ state: 'none', why: 'No graphics-card code on this page.' }) : NFMGpuStress.probe()).then(function (c) { self.card = c; if (c.state === 'ready' && self.tune && self.tune.card) c.prof = self.tune.card; if (c.state === 'none') { self.cardWhy = c.why || ''; if (c.retry && (self.probeTries = (self.probeTries || 0) + 1) < 3) self.cardP = null; } return c; });   // a card that was only slow to answer is asked again next time
    return this.cardP;
  };
  /** What advice text and builds may assume right now: { max } when the card passed its test (and the tuning test, if it ran, did not rule it out), otherwise null. */
  Client.prototype.cardInfo = function () { return this.card && this.card.state === 'ready' && !(this.tune && this.tune.card && this.tune.card.use === false) ? { max: this.card.max, info: this.card.info, min: this.tune && this.tune.card && this.tune.card.minItems || 0 } : null; };
  /** Saved results of the tuning test (or null): the page sets this at start-up and after a test. */
  Client.prototype.setTune = function (t) { this.tune = t || null; if (this.card && this.card.state === 'ready') this.card.prof = t && t.card || null; };
  /** "Distances, best quality" on a big piece: the card makes the picture, the engine finishes it. Any problem: the processor does it as before. */
  Client.prototype.build = function (opts) {
    var self = this, tok = this.buildTok = (this.buildTok || 0) + 1, big = false, E = null;
    try { E = this.onMain(); big = opts && opts.arrange === 'stressBest' && this.graph && this.graph.nodes.length > E.stressTuning.fullMax && !this.cardOff && !(this.tune && this.tune.card && this.tune.card.use === false) && !(this.card && this.card.state !== 'ready'); } catch (e) { big = false; }
    if (!big) return this.run('build', opts);
    var stale = function () { return tok !== self.buildTok; }, plain = function () { if (stale()) throw new Error('superseded'); return self.run('build', opts); };
    return this.cardProbe().then(function (card) {
      if (stale()) throw new Error('superseded');
      if (card.state !== 'ready') return self.run('build', opts);
      return self.run('gpuPiece', opts).then(function (r) {
        if (stale()) throw new Error('superseded');
        var cap = r.L && r.L.gpuPiece;
        if (!cap || cap.k <= E.stressTuning.fullMax || cap.k > card.max || (self.tune && self.tune.card && cap.k < (self.tune.card.minItems || 0))) return self.run('build', opts);
        var t0 = Date.now();
        return card.layout(cap).then(function (res) {
          if (stale()) throw new Error('superseded');
          if (!res || res.error) { self.cardWhy = res && res.error || 'no answer'; if (res && (res.oom || res.insane || res.thrown || /lost|adapter/i.test(res.error))) self.cardOff = true; return self.run('build', opts); }
          var o2 = Object.assign({}, opts, { gpuPicture: { k: cap.k, X: res.X } });
          return self.run('build', o2).then(function (b) { b.card = { ms: Date.now() - t0, k: cap.k, method: res.method === 'sgd' ? 'parallel pair sweeps' : 'majorization steps', info: card.info }; self.cardWhy = ''; return b; });
        });
      });
    }).catch(function (err) {
      if (err && err.message === 'superseded') throw err;
      self.cardWhy = String(err && err.message || err).slice(0, 160); self.cardOff = true;
      return plain();
    });
  };
  Client.prototype.compare = function (opts) { return this.run('compare', opts); };
  Client.prototype.check = function (opts) { return this.run('check', opts || {}); };
  Client.prototype.simStart = function (spec, prep) { return this.run('simStart', null, { spec: spec, prep: prep }); };
  Client.prototype.simRun = function (trials, budgetMs) { return this.run('simRun', null, { trials: trials, budgetMs: budgetMs }); };
  Client.prototype.simExact = function (spec, prep) { return this.run('simExact', null, { spec: spec, prep: prep }); };
  Client.prototype.sweep = function (spec, prep, sweep) { return this.run('sweep', null, { spec: spec, prep: prep, sweep: sweep }); };
  return { Client: Client };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMEngineClient;

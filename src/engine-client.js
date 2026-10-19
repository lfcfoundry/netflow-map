/*!
 * Netflow Map engine client: runs the engine in a Web Worker made from the page's own text (no extra files), and falls back
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
      case 'layoutKey': return { layoutKey: E.layoutKey(st.G, d.opts) };
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
  /* A small made-up network (600 items, six communities) laid out once in an idle worker so the browser has already sped up the layout code (the WebAssembly Force rounds take about 300 to 400 ms to speed up in Chromium) before the first real map arrives. It never touches the worker's real graph. */
  function warmBuild(API) {
    var s = 7, r = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }, n = 600, per = 100, nodes = [], edges = [], seen = {}, i, j, k, t;
    var add = function (a, b) { if (a === b || seen[a + '>' + b]) return; seen[a + '>' + b] = 1; edges.push({ from: 'w' + a, to: 'w' + b, label: '', kind: '', attrs: {} }); };
    for (i = 0; i < n; i++) nodes.push({ id: 'w' + i, label: 'w' + i, group: '', valence: '', ghost: false, attrs: {} });
    for (j = 0; j < n; j++) {
      k = 2 + Math.floor(r() * 3);
      while (k--) { t = Math.floor(j / per) * per + Math.floor(r() * per); add(j, t); }
      if (r() < 0.12) add(j, Math.floor(r() * n));
    }
    return API.E.build(API.C.derive({ name: 'warm', start: null, nodes: nodes, edges: edges }), { view: 'network', colorBy: 'group' });
  }
  var WORKER_MAIN = '\nvar warmBuild = ' + warmBuild.toString() + '\nfunction __warm(){warmBuild(__API);}\nvar dispatch = ' + dispatch.toString() + '\nvar __st={G:null,ver:-1,P:null,sim:null};var __API={E:NFMEngine,SIM:NFMSim,CHK:NFMCheck,C:NFMColumns};self.onmessage=function(e){var d=e.data;try{' +
    'if(d.type==="graph"){__st.G=NFMColumns.derive(d.graph);__st.ver=d.ver;__st.sim=null;self.postMessage({id:d.id,ok:true,result:true});return;}' +
    'if(d.type==="ping"){self.postMessage({id:d.id,ok:true,result:"pong"});return;}' +
    'if(d.type==="warm"){var w0=Date.now();__warm();self.postMessage({id:d.id,ok:true,result:"warm",ms:Date.now()-w0});return;}' +
    'if(d.ver!==__st.ver)throw new Error("The worker has an older copy of the data.");' +
    'var t0=Date.now();var r=dispatch(d,__st,__API);var tr=[];' +
    'try{var pk=NFMPack.packResult(r,tr);r=pk;}catch(pe){tr=[];}' +   // big layouts travel as typed arrays (src/pack.js); any trouble: send the objects as they are
    'self.postMessage({id:d.id,ok:true,result:r,ms:Date.now()-t0},tr);' +
    '}catch(err){self.postMessage({id:d.id,ok:false,error:String(err&&err.message||err)});}};';

  function Client(engineSrc, onMain) {
    this.src = engineSrc; this.onMain = onMain; this.w = null; this.mode = 'starting'; this.seq = 0; this.pending = new Map();
    this.ver = 0; this.graph = null; this.queue = null; this.busy = null; this.why = '';
    /* Parking (off unless the page sets parkAfter): when nothing has been asked for parkAfter ms, a big graph's worker is ended, which frees the graph copy and everything else it holds; the next job starts a fresh worker and sends the graph again. */
    this.parkAfter = 0; this.parkMin = 20000; this.parked = false; this.parks = 0; this.unparks = 0; this.unparkMs = 0; this.parkTimer = null; this.holdIf = null; this.keepWarm = false;
    this.warmAfter = 1500; this.warmed = false; this.warmTimer = null;
  }
  Client.prototype.start = function () {
    var self = this;
    return new Promise(function (resolve) {
      var fallback = function (why) { self.mode = 'page'; self.why = why; if (self.w) { try { self.w.terminate(); } catch (e) { /* gone */ } self.w = null; } resolve(self); };
      try {
        var blob = new Blob([self.src + WORKER_MAIN], { type: 'text/javascript' }), url = URL.createObjectURL(blob);
        self.w = new Worker(url);
        URL.revokeObjectURL(url);
        self.attach(self.w, function (ev) { fallback('The worker could not start (' + (ev && ev.message || 'blocked') + ').'); });
        var t = setTimeout(function () { if (self.mode === 'starting') fallback('The worker did not answer in time.'); }, 3000);
        self.call({ type: 'ping' }).then(function () { clearTimeout(t); if (self.mode === 'starting') { self.mode = 'worker'; self.armWarm(); resolve(self); } }, function () { clearTimeout(t); fallback('The worker test failed.'); });
      } catch (err) { fallback(String(err && err.message || err)); }
    });
  };
  /** Once, a little after the worker starts, if it is still idle: lay out a small made-up map in it so the first real map does not pay for the browser speeding the layout code up. A real job that arrives first simply does that speeding up itself. */
  Client.prototype.armWarm = function (delay) {
    var self = this;
    if (this.warmed || this.warmTimer || !(this.warmAfter > 0 || delay > 0)) return;
    this.warmTimer = setTimeout(function () {
      self.warmTimer = null;
      if (self.warmed || self.mode !== 'worker' || !self.w || self.parked || self.busy || self.pending.size) return;
      self.warmed = true;
      self.rawCall({ type: 'warm' }).then(function () { /* done */ }, function () { /* the warm-up is only a help */ });
    }, delay || this.warmAfter);
  };
  /** Hooks a worker's events up to this client. startFail is called for an error while the client is still starting. */
  Client.prototype.attach = function (w, startFail) {
    var self = this;
    w.onerror = function (ev) { if (self.mode === 'starting' && startFail) startFail(ev); else self.died('The background engine stopped (' + (ev && ev.message || 'unknown reason') + ').'); };
    w.onmessageerror = function () { if (self.mode !== 'starting') self.died('The background engine sent something the page could not read.'); };
    w.onmessage = function (e) { self.onMsg(e.data); };
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
    if (d.ok) p.resolve(d.result === true || d.result === 'pong' || d.result === 'warm' ? d.result : { L: typeof NFMPack !== 'undefined' ? NFMPack.unpackResult(d.result) : d.result, ms: d.ms }); else p.reject(new Error(d.error));
  };
  Client.prototype.call = function (msg) {
    var self = this;
    if (this.parked) return this.unpark().then(function () { return self.call(msg); });
    return this.rawCall(msg);
  };
  Client.prototype.rawCall = function (msg) {
    var self = this, id = ++this.seq;
    return new Promise(function (resolve, reject) { self.pending.set(id, { resolve: resolve, reject: reject, type: msg.type }); msg.id = id; try { self.w.postMessage(msg); } catch (err) { self.pending.delete(id); reject(err); } });
  };
  /** Gives the engine a new graph. Call whenever the data changes. */
  Client.prototype.setGraph = function (graph) {
    this.graph = graph; this.ver++; this.st = null;
    if (this.parked) return Promise.resolve(true);   // the fresh worker gets this graph when the next job starts it
    if (this.mode === 'worker') return this.call({ type: 'graph', graph: graph, ver: this.ver });
    return Promise.resolve(true);
  };
  /** Runs a job (build, compare, check, simStart, simRun, simExact, sweep). If a newer request of the same kind arrives while one waits, only the newest waits its turn. */
  Client.prototype.run = function (type, opts, extra) {
    var self = this;
    if (this.parkTimer) { clearTimeout(this.parkTimer); this.parkTimer = null; }
    return new Promise(function (resolve, reject) {
      self.queues = self.queues || {};
      var key = type === 'build' || type === 'compare' || type === 'gpuPiece' || type === 'layoutKey' ? 'view' : type;
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
    var done = function () { self.busy = null; self.pump(); if (!self.busy) self.armPark(); };
    var t0 = Date.now(), ver = self.ver, msg = Object.assign({ type: job.type, opts: job.opts, ver: ver }, job.extra);
    if (self.mode === 'worker') {
      self.call(msg).then(function (r) { r.total = Date.now() - t0; r.res = r.L; self.keepWarm = job.type === 'gpuPiece' || !!(r.L && r.L.rough); job.resolve(r); }, function (err) { job.reject(err); }).then(done);
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
  /** Starts the idle timer; when it fires, park() runs. */
  Client.prototype.armPark = function () {
    var self = this;
    if (this.parkTimer) { clearTimeout(this.parkTimer); this.parkTimer = null; }
    if (!(this.parkAfter > 0) || this.mode !== 'worker' || this.parked) return;
    this.parkTimer = setTimeout(function () { self.parkTimer = null; self.park(); }, this.parkAfter);
  };
  /** Ends the worker if nothing needs it: no job out or waiting, holdIf() (set by the page) not true, no rough picture waiting to be finished, and a graph big enough (parkMin items) to be worth it. Returns true when it parked. */
  Client.prototype.park = function () {
    var q = this.queues, k;
    if (this.mode !== 'worker' || !this.w || this.parked || this.busy || this.pending.size || this.keepWarm || (this.holdIf && this.holdIf())) return false;
    if (q) for (k in q) if (q[k]) return false;
    if (!this.graph || !this.graph.nodes || this.graph.nodes.length < this.parkMin) return false;
    try { this.w.terminate(); } catch (e) { /* gone already */ }
    this.w = null; this.parked = true; this.parks++;
    return true;
  };
  /** Starts a fresh worker and gives it the graph again (called by the next job). */
  Client.prototype.unpark = function () {
    var self = this;
    if (this.unparkP) return this.unparkP;
    var t0 = Date.now();
    this.unparkP = new Promise(function (resolve, reject) {
      var fail = function (why) { self.unparkP = null; self.parked = false; self.died(why); reject(new Error(why)); };
      try {
        var blob = new Blob([self.src + WORKER_MAIN], { type: 'text/javascript' }), url = URL.createObjectURL(blob);
        self.w = new Worker(url);
        URL.revokeObjectURL(url);
        self.attach(self.w);
        self.parked = false;
        self.rawCall({ type: 'graph', graph: self.graph, ver: self.ver }).then(function () { self.unparkMs = Date.now() - t0; self.unparks++; self.unparkP = null; resolve(true); }, function (err) { fail('The background engine could not restart (' + (err && err.message || err) + ').'); });
      } catch (err) { fail('The background engine could not restart (' + String(err && err.message || err) + ').'); }
    });
    return this.unparkP;
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
  /** Builds a map: from the browser's saved pictures when the same map was laid out before, with the graphics card for "Distances, best quality" on a big piece, otherwise on the processor. */
  Client.prototype.build = function (opts, onPreview) {
    var self = this, tok = this.buildTok = (this.buildTok || 0) + 1, big = false, E = null;
    try { E = this.onMain(); big = opts && opts.arrange === 'stressBest' && this.graph && this.graph.nodes.length > E.stressTuning.fullMax && !this.cardOff && !(this.tune && this.tune.card && this.tune.card.use === false) && !(this.card && this.card.state !== 'ready'); } catch (e) { big = false; }
    if (!big) {
      var St = this.store, Tn0 = E && E.stressTuning;
      /* Saved layouts: a Network map of a few thousand items or more that was laid out before is put back from the browser's storage (nothing is sent anywhere); a new one is laid out as usual and then saved. */
      if (St && E && opts && opts.view === 'network' && !opts.previewOnly && !opts.gpuPicture && !opts.saved && this.graph && this.graph.nodes.length >= (this.storeMin || 1500) && /^(stress|stressBest|force|radial|closeness)$/.test(opts.arrange || 'stress')) {
        var gone = function () { if (tok !== self.buildTok) throw new Error('superseded'); };
        return this.run('layoutKey', opts).then(function (kr) {
          gone();
          var key = kr && kr.L && kr.L.layoutKey;
          if (!key) return self.buildPlain(opts, onPreview, tok, Tn0, false);
          return St.get(key).then(function (rec) {
            gone();
            if (rec) return self.run('build', Object.assign({}, opts, { saved: rec, saveKey: key })).then(function (r) { r.fromSaved = !!(r.L && r.L.fromSaved); return r; });
            return self.buildPlain(Object.assign({}, opts, { saveKey: key }), onPreview, tok, Tn0, true).then(function (r) { if (r && r.L && r.L.saveLayout) St.put(r.L.saveLayout.key, r.L.saveLayout); return r; });
          });
        }, function (err) { if (err && err.message === 'superseded') throw err; return self.buildPlain(opts, onPreview, tok, Tn0, false); });
      }
      return this.buildPlain(opts, onPreview, tok, Tn0, false);
    }
    return this.buildBig(opts, tok, E);
  };
  /** The ordinary build: a big Network map first gets a rough picture, then the finished build. wantSave asks the engine to hand back the finished picture so the page can keep it. */
  Client.prototype.buildPlain = function (opts, onPreview, tok, Tn, wantSave) {
    var self = this;
    if (wantSave) opts = Object.assign({}, opts, { wantSave: true });
    /* A big Network map first gets a rough picture (the start of the layout, grown back but not yet polished or cleaned of touching items), handed to onPreview; the finished build follows and continues from it. */
    if (!onPreview || !Tn || !opts || opts.view !== 'network' || opts.arrange !== 'stress' || !this.graph || this.graph.nodes.length < Tn.previewMin) return this.run('build', opts);
    return this.run('build', Object.assign({}, opts, { previewOnly: true })).then(function (r) {
      if (!r.L || !r.L.rough) return r;   // nothing to polish later: this already is the finished picture
      if (tok !== self.buildTok) throw new Error('superseded');
      try { onPreview(r); } catch (err) { /* a preview that cannot be shown must not stop the real build */ }
      return self.run('build', opts);
    });
  };
  /** "Distances, best quality" on a big piece: the card makes the picture, the engine finishes it. Any problem: the processor does it as before. */
  Client.prototype.buildBig = function (opts, tok, E) {
    var self = this;
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
  return { Client: Client, workerMain: WORKER_MAIN };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMEngineClient;

/*!
 * Net Flow Map engine client: runs the engine in a Web Worker made from the page's own text (no extra files), and falls back
 * to running it on the page if workers are not allowed. Copyright (c) 2026 JNFoo. MIT License.
 */
var NFMEngineClient = (function () {
  'use strict';
  var WORKER_MAIN = '\nvar __G=null,__ver=-1;self.onmessage=function(e){var d=e.data;try{' +
    'if(d.type==="graph"){__G=d.graph;__ver=d.ver;self.postMessage({id:d.id,ok:true,result:true});return;}' +
    'if(d.type==="ping"){self.postMessage({id:d.id,ok:true,result:"pong"});return;}' +
    'if(d.ver!==__ver)throw new Error("The worker has an older copy of the data.");' +
    'var t0=Date.now();var r=d.type==="compare"?NFMEngine.compare(__G,d.opts):NFMEngine.build(__G,d.opts);' +
    'self.postMessage({id:d.id,ok:true,result:r,ms:Date.now()-t0});' +
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
        self.w.onerror = function (ev) { if (self.mode === 'starting') fallback('The worker could not start (' + (ev && ev.message || 'blocked') + ').'); };
        self.w.onmessage = function (e) { self.onMsg(e.data); };
        var t = setTimeout(function () { if (self.mode === 'starting') fallback('The worker did not answer in time.'); }, 3000);
        self.call({ type: 'ping' }).then(function () { clearTimeout(t); if (self.mode === 'starting') { self.mode = 'worker'; resolve(self); } }, function () { clearTimeout(t); fallback('The worker test failed.'); });
      } catch (err) { fallback(String(err && err.message || err)); }
    });
  };
  Client.prototype.onMsg = function (d) {
    var p = this.pending.get(d.id);
    if (!p) return;
    this.pending.delete(d.id);
    if (d.ok) p.resolve(d.result === true || d.result === 'pong' ? d.result : { L: d.result, ms: d.ms }); else p.reject(new Error(d.error));
  };
  Client.prototype.call = function (msg) {
    var self = this, id = ++this.seq;
    return new Promise(function (resolve, reject) { self.pending.set(id, { resolve: resolve, reject: reject }); msg.id = id; try { self.w.postMessage(msg); } catch (err) { self.pending.delete(id); reject(err); } });
  };
  /** Gives the engine a new graph. Call whenever the data changes. */
  Client.prototype.setGraph = function (graph) {
    this.graph = graph; this.ver++;
    if (this.mode === 'worker') return this.call({ type: 'graph', graph: graph, ver: this.ver });
    return Promise.resolve(true);
  };
  /** Runs build or compare; if a newer request arrives while one is running, only the newest waits its turn. */
  Client.prototype.run = function (type, opts) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (self.queue) self.queue.reject(new Error('superseded'));
      self.queue = { type: type, opts: opts, resolve: resolve, reject: reject };
      self.pump();
    });
  };
  Client.prototype.pump = function () {
    var self = this;
    if (self.busy || !self.queue) return;
    var job = self.queue; self.queue = null; self.busy = job;
    var done = function () { self.busy = null; self.pump(); };
    var t0 = Date.now(), ver = self.ver;
    if (self.mode === 'worker') {
      self.call({ type: job.type, opts: job.opts, ver: ver }).then(function (r) { r.total = Date.now() - t0; job.resolve(r); }, function (err) { job.reject(err); }).then(done);
    } else {
      setTimeout(function () {
        try { var E = self.onMain(), r = job.type === 'compare' ? E.compare(self.graph, job.opts) : E.build(self.graph, job.opts); job.resolve({ L: r, ms: Date.now() - t0, total: Date.now() - t0 }); }
        catch (err) { job.reject(err); }
        done();
      }, 0);
    }
  };
  Client.prototype.build = function (opts) { return this.run('build', opts); };
  Client.prototype.compare = function (opts) { return this.run('compare', opts); };
  return { Client: Client };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMEngineClient;

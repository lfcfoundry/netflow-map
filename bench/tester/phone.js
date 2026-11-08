/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Phone steps for the Netflow Map Tester: facts about the phone, the real app run inside this page (every view and chart, timed),
 * then a short list of touch checks the person does by hand. Added only in the phone build (window.__NFM_APP_B64 is the app, base64).
 * Needs the tester's hook (window.__NFM_TESTER_HOOK) and runs before the tester starts. */
(function () {
  'use strict';
  var H = window.__NFM_TESTER_HOOK, B64 = window.__NFM_APP_B64;
  if (!H || !B64) return;
  var $ = function (id) { return document.getElementById(id); }, now = H.now, r1 = H.r1, STEPS = H.STEPS, ctx = H.ctx;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var VIEWS = ['flow', 'network', 'sankey', 'down', 'treemap', 'sunburst', 'chord', 'bundles'];
  var phone = ctx.phone = { facts: {}, views: [], charts: [], touch: [], errors: [] };
  var frame = null, win = null;

  function appHtml() { var bin = atob(B64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  async function mountApp(host) {
    var moved = !!frame;   /* moving an iframe in the page starts it again, so wait for it to load each time */
    if (!frame) {
      frame = document.createElement('iframe'); frame.setAttribute('title', 'Netflow Map, running inside the tester');
      frame.style.cssText = 'width:100%;height:' + Math.max(420, Math.min(640, Math.round(innerHeight * 0.72))) + 'px;border:1px solid var(--line);border-radius:8px;background:#fff';
      frame.srcdoc = appHtml();
    } else if (frame.parentNode === host) return;
    var loaded = new Promise(function (r) { frame.addEventListener('load', r, { once: true }); });
    host.appendChild(frame); await loaded; win = frame.contentWindow; var t = now();
    while (!(win.NFM && win.NFM.setGraph && win.NFMExamples) && now() - t < 20000) await sleep(20);
    if (!(win.NFM && win.NFM.setGraph)) throw new Error('the app did not start inside the tester');
    if (moved) await sleep(300);
  }
  async function settle(limit) {
    var t = now();
    while ((win.NFM.pending() || !win.NFM.state.sceneOk) && now() - t < (limit || 30000)) await sleep(15);
    await new Promise(function (r) { win.requestAnimationFrame(function () { win.requestAnimationFrame(r); }); });
    return now() - t;
  }
  function hostCard(s) { var d = document.createElement('div'); d.style.cssText = 'margin:8px 0'; s.card.appendChild(d); return d; }

  /* 1 ------------------------------------------------------------- the phone itself */
  STEPS.unshift({ name: 'Your phone', run: async function () {
    var s = H.addSection('Your phone'), f = phone.facts, rows = [], mm = function (q) { try { return matchMedia(q).matches; } catch (e) { return false; } };
    f.ua = navigator.userAgent; f.screen = screen.width + ' x ' + screen.height; f.window = innerWidth + ' x ' + innerHeight; f.dpr = devicePixelRatio;
    f.orientation = (screen.orientation && screen.orientation.type) || (innerWidth > innerHeight ? 'landscape' : 'portrait'); f.touchPoints = navigator.maxTouchPoints || 0;
    f.coarse = mm('(pointer: coarse)'); f.hover = mm('(hover: hover)'); f.dark = mm('(prefers-color-scheme: dark)'); f.reduced = mm('(prefers-reduced-motion: reduce)');
    f.threads = navigator.hardwareConcurrency || null; f.mem = navigator.deviceMemory || null;
    f.wasm = typeof WebAssembly === 'object'; f.worker = typeof Worker === 'function'; f.offscreen = typeof OffscreenCanvas === 'function'; f.idb = !!window.indexedDB; f.clip = !!(navigator.clipboard && navigator.clipboard.writeText);
    try { var cv = document.createElement('canvas'), gl = cv.getContext('webgl2'); f.webgl2 = !!gl; if (gl) { var x = gl.getExtension('WEBGL_debug_renderer_info'); f.glRenderer = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'hidden by the browser'; f.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE); } } catch (e) { f.webgl2 = false; }
    try { f.webgpu = !!navigator.gpu; } catch (e) { f.webgpu = false; }
    try { if (navigator.getBattery) { var b = await navigator.getBattery(); f.battery = Math.round(b.level * 100) + '%' + (b.charging ? ' charging' : ' on battery'); } } catch (e) { /* not shared */ }
    try { if (navigator.storage && navigator.storage.estimate) { var q = await navigator.storage.estimate(); f.storageMB = Math.round((q.quota || 0) / 1048576); } } catch (e) { /* not shared */ }
    rows.push(['Browser', f.ua], ['Screen / page area', f.screen + ' / ' + f.window + ' (pixel ratio ' + f.dpr + ')'], ['Orientation', f.orientation], ['Touch points', String(f.touchPoints) + (f.coarse ? ', touch is the main pointer' : ', touch is not the main pointer')], ['Dark mode on', f.dark ? 'yes' : 'no'], ['Reduce-motion on', f.reduced ? 'yes' : 'no'], ['Processor threads', String(f.threads || '?')], ['Memory hint (GB)', String(f.mem || 'not shared')], ['WebAssembly / Worker / OffscreenCanvas / IndexedDB / Clipboard', [f.wasm, f.worker, f.offscreen, f.idb, f.clip].map(function (v) { return v ? 'yes' : 'NO'; }).join(' / ')], ['WebGL 2', f.webgl2 ? 'yes (' + f.glRenderer + ', largest texture ' + f.maxTex + ')' : 'NO'], ['WebGPU', f.webgpu ? 'yes' : 'no'], ['Battery', f.battery || 'not shared'], ['Storage allowed (MB)', f.storageMB != null ? String(f.storageMB) : 'not shared']);
    var miss = []; if (!f.wasm) miss.push('WebAssembly'); if (!f.worker) miss.push('Worker'); if (!f.idb) miss.push('IndexedDB');
    s.head = ['Item', 'Value']; s.rows = rows;
    s.finish(miss.length ? 'bad' : f.webgl2 ? 'ok' : 'warn', miss.length ? 'This browser is missing ' + miss.join(', ') + ', which the app needs.' : f.webgl2 ? 'This phone has what the app needs, and WebGL 2 for the fast drawing path.' : 'This phone has what the app needs; there is no WebGL 2, so the app will draw with the slower Canvas 2D path.');
    return {};
  } });

  /* 2 ------------------------------------------------------------- the real app, every map view */
  STEPS.push({ name: 'The app: first open of every map view', run: async function () {
    var s = H.addSection('The app: first open of every map view'), rows = [], host = hostCard(s);
    var t0 = now(); await mountApp(host); var boot = now() - t0;
    var loaf = [], po = null, watching = false;   /* Chrome's long-animation-frame entries: where a slow first open goes (our code, forced layout, drawing) */
    var take = function (l) { l.getEntries().forEach(function (e) { if (!watching) return; loaf.push({ dur: Math.round(e.duration), scripts: Math.round((e.renderStart || e.startTime + e.duration) - e.startTime - (e.blockingDuration ? 0 : 0)), render: Math.round(Math.max(0, (e.styleAndLayoutStart || 0) ? e.startTime + e.duration - e.styleAndLayoutStart : 0)), forced: Math.round((e.scripts || []).reduce(function (a, x) { return a + (x.forcedStyleAndLayoutDuration || 0); }, 0)), top: (e.scripts || []).slice().sort(function (a, b) { return b.duration - a.duration; }).slice(0, 3).map(function (x) { return (x.invoker || x.sourceFunctionName || '?') + ' ' + Math.round(x.duration) + ' ms'; }).join('; ') });; }); };
    try { po = new PerformanceObserver(take); po.observe({ type: 'long-animation-frame', buffered: false }); } catch (e) { po = null; }
    var sets = [['Small example (systems)', function () { return win.NFMExamples.LIST.filter(function (x) { return x.id === 'systems'; })[0].load().graph; }], ['1,000 items', function () { return win.NFMExamples.bigNetwork(1000, 9, 7); }]];
    var worstMs = 0, slow = [];
    for (var si = 0; si < sets.length; si++) {
      win.NFM.showTab('map'); win.NFM.setGraph(sets[si][1]()); await settle(40000);
      for (var vi = 0; vi < VIEWS.length; vi++) {
        H.setStatus('The app: ' + sets[si][0] + ', ' + VIEWS[vi] + '…'); await H.yieldUI();
        if (si === 0 && vi === 0) { watching = true; }
        var t = now(), err = ''; try { win.NFM.setV({ view: VIEWS[vi] }); var ms = await settle(40000); } catch (e) { err = String(e && e.message || e); ms = now() - t; }
        var frames = 0, last = 0, worst = 0, t1 = now();   /* a short idle watch: does the page keep drawing smoothly after the first frame */
        await new Promise(function (res) { var tick = function (ts) { if (last) { frames++; worst = Math.max(worst, ts - last); } last = ts; if (now() - t1 < 1000) win.requestAnimationFrame(tick); else res(); }; win.requestAnimationFrame(tick); });
        if (si === 0 && vi === 0 && po) { await sleep(120); take({ getEntries: function () { return po.takeRecords(); } }); watching = false; }
        var row = { data: sets[si][0], view: VIEWS[vi], openMs: r1(ms), idleFps: frames, worstGapMs: Math.round(worst), error: err };
        phone.views.push(row); rows.push([row.data, row.view, String(row.openMs), String(row.idleFps), String(row.worstGapMs), err || (win.NFM.state.sceneOk ? 'ok' : 'NOT DRAWN')]);
        if (err || !win.NFM.state.sceneOk) slow.push(row.view + ' (' + row.data + '): ' + (err || 'not drawn')); worstMs = Math.max(worstMs, ms);
      }
    }
    if (po) { try { po.disconnect(); } catch (e) { /* done */ } }
    phone.loaf = loaf.slice(0, 12); if (loaf.length) { s.notes.push('Long frames during the very first view open (Chrome long-animation-frame): ' + loaf.length + '. The slowest: ' + loaf.slice().sort(function (a, b) { return b.dur - a.dur; }).slice(0, 4).map(function (x) { return x.dur + ' ms (' + x.scripts + ' ms our code and waiting, ' + x.render + ' ms style, layout and drawing, ' + x.forced + ' ms forced layout; ' + (x.top || 'no script') + ')'; }).join(' | ') + '.'); }
    phone.bootMs = r1(boot); rows.unshift(['App starts inside this page', '-', String(phone.bootMs), '-', '-', 'ok']);
    s.head = ['Data', 'View', 'Open (ms)', 'Frames in 1 s', 'Slowest frame (ms)', 'Result']; s.rows = rows;
    s.notes.push('Open is the time from asking for the view until it is drawn and settled. Frames in 1 s is the page refresh while the map sits still (it can be low when nothing needs to move). On a phone, 1,000 items should open in well under a second or two.');
    s.finish(slow.length ? 'bad' : worstMs > 4000 ? 'warn' : 'ok', slow.length ? 'These did not draw: ' + slow.join('; ') + '.' : 'All 8 views drew on both data sets. Slowest open: ' + r1(worstMs) + ' ms.');
    return {};
  } });

  /* 3 ------------------------------------------------------------- charts */
  STEPS.push({ name: 'The app: every chart type', run: async function () {
    var s = H.addSection('The app: every chart type'), rows = [], host = hostCard(s);
    await mountApp(host); win.NFM.showTab('map'); win.NFM.setGraph(win.NFMExamples.LIST.filter(function (x) { return x.id === 'systems'; })[0].load().graph); await settle(40000);
    var types = Object.keys(win.NetflowPlot.NEEDS), bad = [], tot = 0;
    for (var i = 0; i < types.length; i++) {
      H.setStatus('The app: chart ' + types[i] + '…'); await H.yieldUI();
      var t = now(), err = '';
      try {
        win.NFM.showTab('charts'); var c = win.NFM.state.V.chart || (win.NFM.state.V.chart = { rows: 'nodes', type: 'bar' }); c.type = types[i]; c.x = c.y = c.color = c.size = ''; c.cols = []; c.rowsPicked = false;
        win.NFM.drawChart(true); await new Promise(function (r) { win.requestAnimationFrame(function () { win.requestAnimationFrame(function () { win.requestAnimationFrame(r); }); }); });
        var st = win.document.getElementById('charts-stage'); if (!st || !st.firstChild) err = 'nothing drawn';
      } catch (e) { err = String(e && e.message || e); }
      var ms = now() - t; tot += ms; phone.charts.push({ type: types[i], ms: r1(ms), error: err }); rows.push([types[i], String(r1(ms)), err || 'ok']); if (err) bad.push(types[i] + ': ' + err);
    }
    s.head = ['Chart', 'Draw (ms)', 'Result']; s.rows = rows;
    s.finish(bad.length ? 'bad' : 'ok', bad.length ? 'These charts failed: ' + bad.join('; ') + '.' : 'All ' + types.length + ' chart types drew. Total ' + Math.round(tot) + ' ms.');
    win.NFM.showTab('map'); return {};
  } });

  /* 4 ------------------------------------------------------------- touch checks, by hand */
  var CHECKS = [
    ['Tap a box or dot in the Map', 'It highlights and its details show.'],
    ['Drag one finger on the Map', 'The map follows the finger smoothly; the page itself does not scroll.'],
    ['Pinch to zoom the Map', 'It zooms around the fingers, smoothly, and stops at sensible limits.'],
    ['Double-tap the Map', 'It zooms in (or fits), as in the help text.'],
    ['Open the side panel / menus', 'Every button is easy to hit with a thumb; nothing is cut off at the screen edge.'],
    ['Switch between the 8 views', 'Each one draws; no blank or half-drawn picture.'],
    ['Turn the phone sideways, then back', 'The layout changes cleanly; nothing overlaps; the map keeps its place.'],
    ['Press the half-moon button (top right of the app) to switch light and dark', 'The app flips between light and dark and stays readable in both. (The phone itself may stay in dark mode; judge the app only.)'],
    ['Search for a name: open the menu button (three lines, top left of the map), tap Find, type a name', 'The search box stays visible above the keyboard; typing is not laggy. Note how many taps it took to find the box.'],
    ['Open the Charts tab and change the chart type', 'Charts fit the width; labels do not overlap; text is readable without zooming.'],
    ['Load a CSV or JSON file from the phone', 'The file picker opens and the file loads.'],
    ['Save a map file, then open it again', 'The file saves (or downloads) and opens back to the same map.'],
    ['Use the 3D arrangement and turn it by dragging', 'It turns smoothly with one finger; two fingers do not break it.'],
    ['Leave the page idle for 20 seconds, then touch it', 'It responds right away; no frozen or blank screen.'],
    ['Overall feel on this phone', 'Fast enough that you would not wait on it.']
  ];
  STEPS.push({ name: 'Touch checks (you do these)', run: async function () {
    var s = H.addSection('Touch checks (you do these)'), host = hostCard(s), results = CHECKS.map(function () { return { r: '', note: '' }; }), done = null;
    await mountApp(host); win.NFM.showTab('map'); win.NFM.setGraph(win.NFMExamples.LIST.filter(function (x) { return x.id === 'systems'; })[0].load().graph); await settle(40000);
    var intro = document.createElement('p'); intro.className = 'note'; intro.textContent = 'The app is above. Try each action in it, then press OK, Problem or Skip. Add a few words if something is wrong. Press "Finish" at the bottom when done; Skip is fine for anything you cannot try.';
    host.insertBefore(intro, host.firstChild);
    var list = document.createElement('div'); host.appendChild(list);
    CHECKS.forEach(function (c, i) {
      var row = document.createElement('div'); row.style.cssText = 'border-top:1px solid var(--line);padding:8px 0';
      var h = document.createElement('div'); h.innerHTML = '<b></b><div class="note"></div>'; h.firstChild.textContent = (i + 1) + '. ' + c[0]; h.lastChild.textContent = 'Expect: ' + c[1]; row.appendChild(h);
      var bs = document.createElement('div'), note = document.createElement('input'); note.type = 'text'; note.placeholder = 'What went wrong (optional)'; note.style.cssText = 'width:100%;margin-top:4px;font:inherit;padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)'; note.oninput = function () { results[i].note = note.value; };
      ['OK', 'Problem', 'Skip'].forEach(function (lab) { var b = document.createElement('button'); b.textContent = lab; b.style.minWidth = '84px'; b.style.minHeight = '44px'; b.onclick = function () { results[i].r = lab; Array.prototype.forEach.call(bs.children, function (x) { x.className = x === b ? 'p' : ''; }); }; bs.appendChild(b); });
      row.appendChild(bs); row.appendChild(note); list.appendChild(row);
    });
    var fin = document.createElement('button'); fin.className = 'p'; fin.textContent = 'Finish the touch checks'; fin.style.minHeight = '48px'; host.appendChild(fin);
    H.setStatus('Your turn: try the touch checks above, then press Finish.');
    $('top').scrollIntoView(); host.scrollIntoView();
    await new Promise(function (r) { fin.onclick = r; }); fin.disabled = true;
    var probs = [], skipped = 0, rows = CHECKS.map(function (c, i) { var r = results[i].r || 'Skip'; if (r === 'Problem') probs.push((i + 1) + '. ' + c[0] + (results[i].note ? ' (' + results[i].note + ')' : '')); if (r === 'Skip') skipped++; phone.touch.push({ n: i + 1, check: c[0], result: r, note: results[i].note }); return [String(i + 1), c[0], r, results[i].note]; });
    s.head = ['#', 'Check', 'Result', 'Note']; s.rows = rows;
    s.finish(probs.length ? 'bad' : skipped > 5 ? 'warn' : 'ok', probs.length ? 'Problems: ' + probs.join('; ') + '.' : skipped > 5 ? 'No problems, but ' + skipped + ' checks were skipped.' : 'All tried checks passed' + (skipped ? ' (' + skipped + ' skipped)' : '') + '.');
    return {};
  } });
})();

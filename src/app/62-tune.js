/*!
 * Netflow Map app, part 9: the tuning test (a question at first start, a card on the Advanced tab, and the saved results used by the graphics-card path).
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var TUNE_KEY = 'nfm-tune', TUNE_ASK = 'nfm-tune-ask', SAVE_LAYOUTS_KEY = 'nfm-save-layouts';
function loadTune() { try { var t = JSON.parse(LS.get(TUNE_KEY) || 'null'); return t && t.v === NFMTune.VERSION ? t : null; } catch (e) { return null; } }
S.tune = loadTune();
/** The advice text for an arrangement, using what is known about this computer's graphics card and the saved timings. */
function adviceFor(arr, n) {
  var t = S.tune, est = t && t.secs ? { cpu: t.secs.cpu ? function (x) { return NFMTune.lawAt(t.secs.cpu, x); } : null, card: t.secs.card ? function (x) { return NFMTune.lawAt(t.secs.card, x); } : null } : null;
  return getEngine().arrangeAdvice(arr, n, client && client.cardInfo(), est);
}
function applyTune(t) { S.tune = t; if (client) client.setTune(t); }
function saveTune(t) { LS.set(TUNE_KEY, JSON.stringify(t)); LS.del(TUNE_ASK); applyTune(t); }
function tuneMakeGraph(n) { return NFMExamples.bigNetwork(n, Math.max(6, Math.round(n / 800)), 11); }
function tuneSizes() { var m = /[?&]tunesizes=([\d,]+)/.exec(location.search); return m ? m[1].split(',').map(Number).filter(function (x) { return x > 0; }) : null; }   // for the automatic tests: small sizes

/** Runs the test with a progress display inside `box`; resolves the result (or { cancelled }). */
function runTuning(box, onDone, token) {
  var bar = h('progress', { max: 100, value: 0, style: { width: '100%' } }), say = h('p', { class: 'muted small', id: 'tune-step' }, 'Starting…'), tok = token || { stop: false };   /* a token from the dialog lets closing the dialog (Escape) stop the run */
  var cancel = h('button', { onclick: function () { tok.stop = true; cancel.disabled = true; say.textContent = 'Stopping…'; } }, 'Stop');
  mount(box, [bar, say, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [cancel])]);
  var sizes = tuneSizes();
  return NFMTune.run({ Client: NFMEngineClient.Client, engineSrc: engineSrc, getEngine: getEngine, makeGraph: tuneMakeGraph, sizes: sizes ? sizes.slice(0, 2) : null, big: sizes ? (sizes[2] || 0) : undefined,
    onStep: function (text, f) { say.textContent = text; bar.value = Math.round(f * 100); }, cancelled: function () { return tok.stop; } }).then(function (r) {
    if (r.cancelled) { onDone(null, 'The test was stopped. Nothing was changed.'); return; }
    if (r.profile) saveTune(r.profile);
    onDone(r, r.verdict);
  }, function (err) { onDone(null, 'The test ran into a problem (' + String(err && err.message || err).slice(0, 120) + '). Nothing was changed.'); });
}
/** A distance error as colored text: green is excellent, through yellow, to red for poor (lower is truer). */
function errSpan(v) {
  var b = NFMTune.errBand(v); if (!b) return h('span', null, String(v));
  return h('span', { class: b.cls, title: 'Distance error ' + v + ': ' + b.word + ' (lower is truer)' }, String(v));
}
/** Text with every "distance error 0.159" (and "against 0.164") number colored. Returns an array of strings and spans. */
function tintErrors(text) {
  var out = [], re = /(distance error )(\d\.\d+)( against )?(\d\.\d+)?/g, at = 0, m;
  while ((m = re.exec(text))) {
    out.push(text.slice(at, m.index) + m[1], errSpan(m[2])); if (m[3] && m[4]) out.push(m[3], errSpan(m[4]));
    at = m.index + m[0].length;
  }
  out.push(text.slice(at)); return out;
}
function tuneResultTable(r) {
  if (!r || !r.rows || !r.rows.length) return null;
  var sec = function (ms) { return ms === null || ms === undefined ? '–' : ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : ms + ' ms'; };
  var th = function (t) { return h('th', { style: { textAlign: 'left', padding: '2px 8px 2px 0' } }, t); }, td = function (t) { return h('td', { style: { padding: '2px 8px 2px 0' } }, t); };
  var err = function (v) { return v === null || v === undefined ? '–' : errSpan(v); };
  return h('table', { class: 'small', style: { borderCollapse: 'collapse', width: '100%' } }, [h('tr', null, ['Items', 'Processor', 'Graphics card', 'Distance error (processor / card)'].map(th))].concat(
    r.rows.map(function (x) { return h('tr', null, [td(nfmt(x.n)), td(sec(x.cpuMs)), td(sec(x.cardMs)), td([err(x.cpuTruth), ' / ', err(x.cardTruth)])]); })));
}
/** The question at first start (mode 'ask'), or the same dialog started from a button (mode 'again'). */
function tuneDialog(mode) {
  var dlg = $('dlg'), body = $('dlg-body'); if (dlg.open) return;
  var close = function () { try { dlg.close(); } catch (e) { /* closed */ } };
  var tok = { stop: false };   /* shared with the run: closing the dialog any way at all (Escape too) stops it, and a stopped run saves nothing */
  var finish = function (r, text) {
    mount(body, [h('h3', { id: 'dlg-h' }, r && r.profile ? 'Done: settings saved' : 'The test did not change anything'), h('p', null, text), tuneResultTable(r), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [h('button', { class: 'primary', onclick: function () { close(); if (S.tab === 'adv') renderAdv(); if (S.tab === 'map') refreshMap('tune'); } }, 'Done')])]);
  };
  var start = function () {
    mount(body, [h('h3', { id: 'dlg-h' }, 'Testing this computer…'), h('div', { id: 'tune-run' })]);
    runTuning($('tune-run'), finish, tok);
  };
  mount(body, [h('h3', { id: 'dlg-h' }, mode === 'ask' ? 'Make Netflow Map faster on this computer?' : 'Test this computer'),
    h('p', null, 'Netflow Map can run a short test (about 20 seconds) to find the quickest way to arrange big networks on this computer: it tries your processor and, if you have one that works, your graphics card, then saves the best settings in this browser.'),
    h('p', { class: 'muted small' }, 'The test uses made-up networks. Your data is not touched, nothing is sent anywhere, and you can stop it at any time. You can run it again from the Advanced tab.'),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } }, [
      mode === 'ask' ? h('button', { onclick: function () { LS.set(TUNE_ASK, 'never'); close(); } }, 'Don\'t ask again') : null,
      h('button', { onclick: function () { if (mode === 'ask') LS.set(TUNE_ASK, String(Date.now())); close(); } }, mode === 'ask' ? 'Not now' : 'Cancel'),
      h('button', { class: 'primary', onclick: start }, 'Run the test')])]);
  dlg.onclose = function () { dlg.onclose = null; tok.stop = true; };
  dlg.showModal();
}
/** The card on the Advanced tab. */
function tuneCard() {
  var t = S.tune, out = h('div', { id: 'tune-out' }), btn = h('button', { class: 'primary' }, t ? 'Run the test again' : 'Test this computer');
  btn.addEventListener('click', function () { tuneDialog('again'); });
  var kids = [h('h2', null, 'Tune for this computer'), h('p', { class: 'muted small', style: { margin: 0 } }, 'A short test of your processor and graphics card that finds the quickest way to arrange big networks here. One button.')];
  if (t) { kids.push(h('div', { class: 'verdict ok' }, t.verdict || 'Settings saved.')); var tb = tuneResultTable({ rows: t.rows }); if (tb) kids.push(tb); kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'Tested ' + (t.when || '').slice(0, 10) + (S.tune.key !== NFMTune.deviceKey(t.card && t.card.info) ? ' (this browser or computer looks different now: running the test again is a good idea)' : '') + '.')); }
  else kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'Not tested yet. Without a test the built-in guesses are used.'));
  kids.push(h('div', { class: 'row' }, [btn, t ? h('button', { onclick: function () { LS.del(TUNE_KEY); applyTune(null); renderAdv(); } }, 'Forget the results') : null]), out);
  return h('div', { class: 'card' }, kids);
}
/** The card on the Advanced tab for saved pictures of big Network maps (kept in this browser only; one switch and one button). */
function savedLayoutsCard() {
  var info = h('p', { class: 'muted small', style: { margin: 0 } }, ''), st = client && client.store;
  var kids = [h('h2', null, 'Saved pictures of big maps'),
    h('p', { class: 'muted small', style: { margin: 0 } }, 'A Network map of 1,500 items or more takes a moment to arrange. The finished picture is kept in this browser, so opening the same map again is quick. Nothing leaves this computer.'),
    check('Keep pictures of big maps in this browser', LS.get(SAVE_LAYOUTS_KEY) !== '0', function (on) { LS.set(SAVE_LAYOUTS_KEY, on ? '1' : '0'); client.store = on && typeof NFMLayoutStore !== 'undefined' ? NFMLayoutStore.open() : null; renderAdv(); }), info];
  if (st) st.info().then(function (i) { info.textContent = i.error ? 'This browser does not allow saving here.' : i.count ? i.count + (i.count === 1 ? ' picture' : ' pictures') + ' saved, ' + (i.bytes / 1048576).toFixed(1) + ' MB.' : 'No pictures saved yet.'; });
  kids.push(h('div', { class: 'row' }, [h('button', { onclick: function () { var s2 = client.store || (typeof NFMLayoutStore !== 'undefined' ? NFMLayoutStore.open() : null); (s2 ? s2.clear() : Promise.resolve()).then(renderAdv); } }, 'Forget saved pictures')]));
  return h('div', { class: 'card' }, kids);
}
/** At start-up: ask once (not in automatic test runs unless ?tune=ask). */
function maybeAskTune() {
  var force = /[?&]tune=ask/.test(location.search), auto = !!navigator.webdriver || /[?&]notune/.test(location.search);
  if (!force && (auto || LS.get(TUNE_ASK) === 'never')) return;
  var t = S.tune;
  if (!force && t) return;   // already tuned; the Advanced tab says if the computer looks different
  setTimeout(function () { if (!$('dlg').open) tuneDialog('ask'); }, 1200);
}

/** The device check's graphics-card test (see NFMProbe.check): { lines, problem, data }. Uses the tuning test's sizes in automatic runs. */
function cardCheckForDevice() {
  var sz = tuneSizes(), sec = function (ms) { return ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : ms + ' ms'; };
  return NFMTune.checkCard({ Client: NFMEngineClient.Client, engineSrc: engineSrc, getEngine: getEngine, makeGraph: tuneMakeGraph, n: sz ? sz[0] : 6000, onStep: function (t) { var el = $('chk-step'); if (el) el.textContent = t; } }).then(function (r) {
    var n = r.row ? r.row.n.toLocaleString('en-US') : '', lines = [], problem = '';
    if (r.state !== 'ready') {
      lines.push({ ok: null, text: 'Graphics-card arrangement is not available here (' + String(r.why).replace(/\.$/, '') + '), so big arrangements use the processor' + (r.row ? ': ' + sec(r.row.cpuMs) + ' for ' + n + ' items at best quality' : '') + '.' });
    } else if (r.verdict === 'good') {
      lines.push({ ok: true, text: 'Graphics-card arrangement works (' + r.info + '): best quality for ' + n + ' items took ' + sec(r.row.cardMs) + ' with the card against ' + sec(r.row.cpuMs) + ' on the processor (' + r.speedup.toFixed(1) + ' times faster), with the same accuracy (distance error ' + r.row.cardTruth + ' against ' + r.row.cpuTruth + ').' });
    } else if (r.verdict === 'slower') {
      lines.push({ ok: null, text: 'The graphics card (' + r.info + ') works but was ' + (r.speedup < 0.9 ? 'slower' : 'not clearly faster') + ' here: ' + sec(r.row.cardMs) + ' against ' + sec(r.row.cpuMs) + ' on the processor for ' + n + ' items. The tuning test decides which to use.' });
    } else if (r.verdict === 'worse') {
      lines.push({ ok: false, text: 'The graphics card (' + r.info + ') made a less accurate picture than the processor (distance error ' + r.row.cardTruth + ' against ' + r.row.cpuTruth + ').' }); problem = 'The graphics card gave a less accurate arrangement; best quality should stay on the processor.';
    } else {
      lines.push({ ok: false, text: 'The graphics card (' + r.info + ') passed its start-up test, but the arrangement fell back to the processor' + (r.why ? ' (' + String(r.why).replace(/\.$/, '') + ')' : '') + '.' }); problem = 'Graphics-card arrangement fell back to the processor.';
    }
    if (r.state === 'ready' && S.tune && S.tune.card && S.tune.card.use === false && r.verdict === 'good') lines.push({ ok: null, text: 'Your saved tuning says to keep the processor, but the card is faster now. Run "Tune for this computer" again to update it.' });
    if (r.state === 'ready' && S.tune && S.tune.card && S.tune.card.use === true && (r.verdict === 'slower' || r.verdict === 'unused')) lines.push({ ok: null, text: 'Your saved tuning says to use the card, but it did not pay off just now. Run "Tune for this computer" again to update it.' });
    return { lines: lines, problem: problem, data: { state: r.state, verdict: r.verdict || null, speedup: r.speedup || null, row: r.row || null, info: r.info || '' } };
  });
}

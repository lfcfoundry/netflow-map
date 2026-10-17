/*!
 * Netflow Map app, part 7: the Check tab. Copyright (c) 2026 LFC Foundry. MIT License.
 */
var CHK = { res: null, busy: false, ignore: new Set(), filter: 'all', gver: -1, err: '' };
function runCheck() {
  if (!S.graph.nodes.length) { CHK.res = null; renderCheck(); return; }
  if (CHK.busy || !client || client.mode === 'starting') { setTimeout(runCheck, 200); return; }
  CHK.busy = true; CHK.err = ''; renderCheck();
  var g = S.gver;
  client.check({}).then(function (r) { CHK.res = r.L; CHK.gver = g; }).catch(function (err) { if (err.message !== 'superseded') CHK.err = err.message; }).then(function () { CHK.busy = false; renderCheck(); updateBadge(); });
}
function updateBadge() {
  var b = $('chk-badge'); if (!b) return;
  var r = CHK.res; if (!r || CHK.gver !== S.gver) { b.hidden = true; return; }
  var n = r.counts.error + r.counts.warn; b.hidden = false; b.className = 'badge' + (r.counts.error ? '' : n ? ' look' : ' ok'); b.textContent = n ? String(n) : '✓';
}
TAB_HOOKS.check = function () { if (CHK.gver !== S.gver && !CHK.busy) runCheck(); else renderCheck(); };
HOOKS.graph.push(function () { CHK.ignore = new Set(); if (S.tab === 'check') runCheck(); else { CHK.res = null; updateBadge(); if (S.graph.nodes.length) setTimeout(function () { if (S.tab !== 'check' && !CHK.busy && S.graph.nodes.length < 20000) runCheck(); }, 800); } });
var SEV = { error: ['Problem', 'error'], warn: ['Look at', 'warn'], note: ['Note', 'note'], insight: ['Insight', 'insight'] };
function findingCard(f) {
  var kids = [h('h3', null, [f.title, h('span', { class: 'pill' }, SEV[f.sev][0]), h('span', { class: 'pill' }, f.sure === 'certain' ? 'certain' : f.sure === 'likely' ? 'likely' : 'possible')]), h('p', { style: { margin: 0 } }, f.text), f.why ? h('p', { class: 'why', style: { margin: 0 } }, [h('b', null, 'Why it matters: '), f.why]) : null];
  if (f.rows && f.rows.length) {
    var keys = Object.keys(f.rows[0]).slice(0, 6);
    kids.push(h('div', { class: 'tablewrap', style: { maxHeight: '190px' } }, h('table', { class: 't' }, [h('thead', null, h('tr', null, keys.map(function (k) { return h('th', null, k); }))), h('tbody', null, f.rows.slice(0, 12).map(function (r) { return h('tr', null, keys.map(function (k) { return h('td', null, r[k] === undefined ? '' : String(r[k]).slice(0, 80)); })); }))])));
    if (f.count > f.rows.length || f.rows.length > 12) kids.push(h('span', { class: 'muted small' }, 'Showing the first ' + Math.min(12, f.rows.length) + ' of ' + nfmt(f.count || f.rows.length) + '.'));
  }
  var acts = [];
  if (f.items && f.items.length) acts.push(h('button', { class: 'sm', onclick: function () { showTab('map'); setTimeout(function () { setSel(f.items.filter(function (id) { return S.byId.has(id); }), { center: true }); }, 60); } }, 'Show on the map'));
  if (f.items && f.items.length) acts.push(h('button', { class: 'sm', onclick: function () { S.sel = new Set(f.items.filter(function (id) { return S.byId.has(id); })); NT.filter = ''; showTab('nodes'); } }, 'See in the table'));
  if (f.fix) acts.push(h('button', { class: 'sm primary', onclick: function () { var r = NFMCheck.applyFix(S.graph, f.fix); if (!r) { toast('Nothing to change.'); return; } setGraph(r.graph, true, true); toast('Done: ' + r.text + '. ' + T('Ctrl+Z', 'Undo on the Data tab') + ' undoes it.'); } }, f.fix.label || 'Fix it'));
  acts.push(h('button', { class: 'sm quiet', onclick: function () { CHK.ignore.add(f.id); renderCheck(); } }, 'Ignore'));
  kids.push(h('div', { class: 'row tight' }, acts));
  return h('div', { class: 'find ' + f.sev }, kids);
}
function renderCheck() {
  var box = $('check-body'); if (!box) return;
  if (!S.graph.nodes.length) { mount(box, h('div', { class: 'card' }, [h('h2', null, 'Check'), h('p', { class: 'muted' }, 'Bring in data first, then I will look for mistakes and tell you what stands out.')])); return; }
  var r = CHK.res, kids = [];
  var top = h('div', { class: 'card' }, [h('h2', null, 'Check the data'), h('p', { class: 'muted small', style: { margin: 0 } }, 'Looks for broken links, messy names, odd numbers, categories spelled several ways, and what stands out. "Certain" means it is a fact about the data; "likely" and "possible" are judgment calls you should confirm.')]);
  kids.push(top);
  if (CHK.busy) { top.appendChild(h('p', null, 'Looking…')); mount(box, kids); return; }
  if (CHK.err) { top.appendChild(h('p', { style: { color: 'var(--bad)' } }, 'The check ran into a problem: ' + CHK.err)); }
  if (!r) { top.appendChild(h('button', { class: 'primary', onclick: runCheck }, 'Check now')); mount(box, kids); return; }
  var vtxt = { clean: 'Nothing wrong found.', look: 'A few things to look at.', attention: 'Some things need your attention.' }[r.verdict];
  top.appendChild(h('div', { class: 'verdict ' + r.verdict }, vtxt + ' ' + plural(r.stats.items, 'item') + ', ' + plural(r.stats.links, 'link') + ' checked in ' + Math.round(r.ms) + ' ms.'));
  var shown = r.findings.filter(function (f) { return !CHK.ignore.has(f.id); }), cnt = { all: shown.length }; ['error', 'warn', 'note', 'insight'].forEach(function (s) { cnt[s] = shown.filter(function (f) { return f.sev === s; }).length; });
  var chips = [['all', 'All'], ['error', 'Problems'], ['warn', 'Look at'], ['note', 'Notes'], ['insight', 'Insights']].map(function (c) { return h('button', { class: 'chip' + (CHK.filter === c[0] ? ' on' : ''), onclick: function () { CHK.filter = c[0]; renderCheck(); } }, c[1] + ' ' + cnt[c[0]]); });
  top.appendChild(h('div', { class: 'row tight' }, chips.concat([h('span', { class: 'spacer' }), h('button', { class: 'sm', onclick: runCheck }, 'Check again'), h('button', { class: 'sm', onclick: function () { download(fname('-check.md'), NFMCheck.toMarkdown(r, S.graph), 'text/markdown'); } }, 'Save the report')])));
  if (CHK.ignore.size) top.appendChild(h('button', { class: 'sm', onclick: function () { CHK.ignore = new Set(); renderCheck(); } }, 'Show the ' + CHK.ignore.size + ' ignored'));
  if (r.skipped && r.skipped.length) top.appendChild(h('p', { class: 'muted small', style: { margin: 0 } }, 'Skipped for speed on this much data: ' + r.skipped.join(', ') + '.'));
  var list = shown.filter(function (f) { return CHK.filter === 'all' || f.sev === CHK.filter; });
  if (!list.length) kids.push(h('div', { class: 'card' }, h('p', { class: 'muted' }, CHK.filter === 'all' ? 'Nothing to report.' : 'Nothing in this group.')));
  list.forEach(function (f) { kids.push(findingCard(f)); });
  mount(box, kids);
}

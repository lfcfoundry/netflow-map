/*!
 * Netflow Map app, part 6b: the Colors tab (colors and type of every part of the map, ready-made looks, your own looks saved in this browser, a file to share). Copyright (c) 2026 LFC Foundry. MIT License.
 */
var LOOKS_KEY = 'nfm-looks', LK = { timer: 0, name: '' };
/** Names for NFMScene.make (theme, palette, ramp) from this map's look; also sets the label type family. */
function lookNames() {
  var f = S.V && S.V.fmt ? S.V.fmt : NFMLook.defaults(), r = NFMLook.register(NFMScene, f, themeName());
  NFMRender.setFont(NFMLook.fontStack(f.font));
  return r;
}
function myLooks() { var a = []; try { a = JSON.parse(LS.get(LOOKS_KEY) || '[]'); } catch (e) { /* none */ } return Array.isArray(a) ? a.slice(0, 40).filter(function (x) { return x && typeof x.name === 'string'; }).map(function (x) { return { name: x.name.slice(0, 60), look: NFMLook.clean(x.look) }; }) : []; }
function saveLooks(a) { if (!LS.set(LOOKS_KEY, JSON.stringify(a.slice(0, 40)))) toast('Your looks could not be saved in this browser (storage is full or blocked).'); }
/** Changes the look; the picture follows a moment later so dragging a color stays smooth. */
function setFmt(next, now) {
  S.V.fmt = NFMLook.clean(next); saveView();
  var go = function () { S.styleMap = null; makeScene(false); renderKey(); };
  clearTimeout(LK.timer); if (now) go(); else LK.timer = setTimeout(go, 90);
}
function fmtCopy() { return JSON.parse(JSON.stringify(S.V.fmt)); }
function effectiveTheme() { var f = S.V.fmt; return NFMLook.resolve(NFMScene.THEMES, f, themeName()); }
function swatchStrip(look) {
  var t = NFMLook.resolve(NFMScene.THEMES, look, look.base === 'auto' ? themeName() : look.base);
  var cols = [t.bg, t.box, t.fg, t.accent].concat(t.groups.slice(0, 4));
  return h('span', { class: 'lkstrip', 'aria-hidden': 'true' }, cols.map(function (c) { return h('i', { style: { background: c } }); }));
}
function colorRow(label, hint, value, overridden, onchange, onreset) {
  var inp = h('input', { type: 'color', value: value, 'aria-label': label });
  inp.addEventListener('input', function () { onchange(inp.value); });
  return h('div', { class: 'lkrow' }, [inp, h('span', { class: 'lkname' }, [h('b', null, label), h('span', { class: 'muted small' }, hint)]), overridden ? h('button', { class: 'sm quiet', title: 'Put back the normal color', 'aria-label': 'Reset ' + label, onclick: onreset }, '↺') : h('span')]);
}
function panelColors() {
  var V = S.V, f = V.fmt, kids = [], t = effectiveTheme();
  kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'Change the colors and type of any part of the map. The picture updates as you go. Your choices are saved with this map in this browser; "My looks" below keeps them for other maps and for sharing.'));
  /* ready-made looks */
  kids.push(section('Ready-made looks', [h('div', { class: 'lkgrid' }, NFMLook.PRESETS.map(function (p) {
    return h('button', { class: 'lkcard', title: p.note, onclick: function () { var n = fmtCopy(), q = p.look; n.base = q.base; n.slots = q.slots; n.groups = q.groups; n.ramp = q.ramp; n.font = q.font; setFmt(n, true); renderRail(true); } }, [swatchStrip(p.look), h('span', null, p.name)]);
  }))]));
  kids.push(field('Light or dark base', seg([['auto', 'Like the app'], ['light', 'Light'], ['dark', 'Dark']], f.base, function (v) { var n = fmtCopy(); n.base = v; setFmt(n, true); renderRail(true); }), 'The colors you did not change come from this base.'));
  /* every part */
  kids.push(section('Colors of each part', NFMLook.SLOTS.map(function (s) {
    return colorRow(s[1], s[2], t[s[0]], !!f.slots[s[0]], function (v) { var n = fmtCopy(); n.slots[s[0]] = v; setFmt(n); }, function () { var n = fmtCopy(); delete n.slots[s[0]]; setFmt(n, true); renderRail(true); });
  })));
  var ws = NFMLook.warnings(t); if (ws.length) kids.push(h('div', { class: 'rule' }, ws.map(function (w) { return h('p', { class: 'small', style: { margin: 0, color: 'var(--gold)' } }, w); })));
  /* group colors */
  var gs = h('div', { class: 'lkgroups' }, t.groups.map(function (c, i) {
    var inp = h('input', { type: 'color', value: c, 'aria-label': 'Group color ' + (i + 1), title: 'Group color ' + (i + 1) + (f.groups[i] ? ' (changed)' : '') });
    inp.addEventListener('input', function () { var n = fmtCopy(); while (n.groups.length < 12) n.groups.push(''); n.groups[i] = inp.value; setFmt(n); });
    return inp;
  }));
  kids.push(acc('Group colors (the first twelve groups)', [gs, h('p', { class: 'muted small', style: { margin: 0 } }, 'Groups after the twelfth reuse these in order. A single group can still get its own color in the Style tab.'), f.groups.length ? h('button', { class: 'sm', onclick: function () { var n = fmtCopy(); n.groups = []; setFmt(n, true); renderRail(true); } }, 'Back to the normal group colors') : null]));
  /* number scale */
  var stops = f.ramp.length ? f.ramp : (NFMScene.RAMPS[V.ramp] || NFMScene.RAMPS.warm);
  kids.push(acc('Color scale for numbers', [h('p', { class: 'muted small', style: { margin: 0 } }, 'Used when items are colored by a number. Low is the first color, high the last.'),
    h('div', { class: 'lkgroups' }, stops.map(function (c, i) {
      var inp = h('input', { type: 'color', value: c, 'aria-label': 'Scale color ' + (i + 1) });
      inp.addEventListener('input', function () { var n = fmtCopy(); if (!n.ramp.length) n.ramp = stops.slice(); n.ramp[i] = inp.value; setFmt(n); });
      return inp;
    })),
    h('div', { class: 'row tight' }, [h('button', { class: 'sm', disabled: stops.length >= 6, onclick: function () { var n = fmtCopy(); if (!n.ramp.length) n.ramp = stops.slice(); n.ramp.push(n.ramp[n.ramp.length - 1]); setFmt(n, true); renderRail(true); } }, 'Add a stop'), h('button', { class: 'sm', disabled: stops.length <= 2, onclick: function () { var n = fmtCopy(); if (!n.ramp.length) n.ramp = stops.slice(); n.ramp.pop(); setFmt(n, true); renderRail(true); } }, 'Remove a stop'), f.ramp.length ? h('button', { class: 'sm', onclick: function () { var n = fmtCopy(); n.ramp = []; setFmt(n, true); renderRail(true); } }, 'Back to the chosen scale') : null])]));
  /* type and sizes */
  var lab = V.lab;
  kids.push(section('Type and sizes', [
    field('Type family', select(Object.keys(NFMLook.FONTS).map(function (k) { return [k, NFMLook.FONTS[k][0]]; }), f.font, function (v) { var n = fmtCopy(); n.font = v; setFmt(n, true); }), 'Uses fonts already on the device, so it can look different on another computer.'),
    slider(cap(word('item')) + ' names', lab.items.scale, 0.5, 3, 0.1, function (x) { lab.items.scale = x; saveView(); scheduleScene(); }, function (x) { return Math.round(x * 100) + '%'; }),
    slider('Link names', lab.links.scale, 0.5, 3, 0.1, function (x) { lab.links.scale = x; saveView(); scheduleScene(); }, function (x) { return Math.round(x * 100) + '%'; }),
    slider('Group names', lab.groups.scale || 1, 0.5, 3, 0.1, function (x) { lab.groups.scale = x; saveView(); scheduleScene(); }, function (x) { return Math.round(x * 100) + '%'; }),
    slider('All ' + word('items') + ' (size)', f.nodeScale, 0.4, 3, 0.05, function (x) { var n = fmtCopy(); n.nodeScale = x; setFmt(n); }, function (x) { return Math.round(x * 100) + '%'; }),
    slider('All lines (width)', V.widthMul, 0.3, 3, 0.1, function (x) { V.widthMul = x; saveView(); scheduleScene(); }, function (x) { return Math.round(x * 100) + '%'; })]));
  /* my looks */
  var mine = myLooks(), nameIn = h('input', { type: 'text', placeholder: 'Name this look', value: LK.name, maxlength: 60, 'aria-label': 'Name for this look' });
  nameIn.addEventListener('input', function () { LK.name = nameIn.value; });
  var fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fileIn.addEventListener('change', function () { var file = fileIn.files && fileIn.files[0]; if (file) importLooks(file); fileIn.value = ''; });
  kids.push(section('My looks', [
    h('div', { class: 'row tight' }, [nameIn, h('button', { class: 'sm primary', onclick: function () { var nm = (LK.name || '').trim() || 'My look ' + (mine.length + 1), a = myLooks().filter(function (x) { return x.name !== nm; }); a.unshift({ name: nm, look: fmtCopy() }); saveLooks(a); LK.name = ''; toast('Saved "' + nm + '".'); renderRail(true); } }, 'Save this look')]),
    mine.length ? h('div', { class: 'lkgrid' }, mine.map(function (m, i) {
      return h('div', { class: 'lkmine' }, [h('button', { class: 'lkcard', onclick: function () { var n = fmtCopy(), q = m.look; n.base = q.base; n.slots = q.slots; n.groups = q.groups; n.ramp = q.ramp; n.font = q.font; n.nodeScale = q.nodeScale; setFmt(n, true); renderRail(true); } }, [swatchStrip(m.look), h('span', null, m.name)]),
        h('button', { class: 'sm quiet', 'aria-label': 'Delete ' + m.name, title: 'Delete', onclick: function () { var a = myLooks(); a.splice(i, 1); saveLooks(a); renderRail(true); } }, '✕')]);
    })) : h('p', { class: 'muted small', style: { margin: 0 } }, 'Nothing saved yet.'),
    h('div', { class: 'row tight' }, [h('button', { class: 'sm', onclick: function () { download(fname('-colors.json'), JSON.stringify({ 'netflow-map-colors': 1, name: S.graph.name || 'Map', look: fmtCopy() }, null, 1), 'application/json'); } }, 'Save this look as a file'), h('button', { class: 'sm', disabled: !mine.length, onclick: function () { download('netflow-map-my-looks.json', JSON.stringify({ 'netflow-map-colors': 1, looks: myLooks() }, null, 1), 'application/json'); } }, 'Save all my looks'), h('button', { class: 'sm', onclick: function () { fileIn.click(); } }, 'Open a file…'), fileIn])]));
  kids.push(h('div', { class: 'row tight' }, [h('button', { class: 'sm', disabled: NFMLook.isDefault(f), onclick: function () { setFmt(NFMLook.defaults(), true); renderRail(true); } }, 'Back to the normal look')]));
  return kids;
}
/** Reads a look file (one look, or a list of looks). Anything unknown is dropped; size is limited. */
function importLooks(file) {
  if (file.size > 400000) { toast('That file is too big to be a look file.'); return; }
  file.text().then(function (txt) {
    var j; try { j = JSON.parse(txt); } catch (e) { toast('That file is not a look file.'); return; }
    if (!j || typeof j !== 'object' || !j['netflow-map-colors']) { toast('That file is not a look file.'); return; }
    var list = Array.isArray(j.looks) ? j.looks : (j.look ? [{ name: j.name, look: j.look }] : []);
    list = list.slice(0, 40).filter(function (x) { return x && typeof x === 'object' && x.look && typeof x.look === 'object'; }).map(function (x) { return { name: String(x.name || 'Imported look').slice(0, 60), look: NFMLook.clean(x.look) }; });
    if (!list.length) { toast('No looks found in that file.'); return; }
    var cur = myLooks(); list.forEach(function (x) { cur = cur.filter(function (c) { return c.name !== x.name; }); }); saveLooks(list.concat(cur).slice(0, 40));
    if (list.length === 1) { setFmt(list[0].look, true); toast('Opened "' + list[0].name + '" and added it to My looks.'); } else toast('Added ' + plural(list.length, 'look') + ' to My looks.');
    renderRail(true);
  });
}

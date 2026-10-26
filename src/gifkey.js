/*!
 * Netflow Map: the key and the caption drawn on a picture (shared by the page and the drawing workers; needs NFMScene and NFMLook). Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMGifKey = (function () {
  'use strict';
function drawKey(ctx, sc, W, H, o, fontName) {
  if (!sc.legend || !sc.legend.length) return;
  o = o || {};
  var fs = Math.max(11, Math.round(W / 90)), pad = fs * 0.8, rowH = fs * 1.55, font = NFMLook.fontStack(fontName), fg = NFMScene.css(sc.theme.fg), muted = NFMScene.css(NFMScene.alpha(sc.theme.fg, 0.72));
  /* A key for a big map would run the height of the picture. The first six groups stay (swatches, larger), the rest become one "+ N more" line, and the size, line width and marker lines go in a smaller block below, so the key stays short and tidy. */
  var cats = [], info = [], more = 0, MAXC = o.full ? 99 : 6;
  sc.legend.forEach(function (l) {
    if (l.k === 'swatch') cats.push(l);
    else if (l.k === 'text' && /^\+ \d+ more/.test(l.t || '')) more += parseInt(l.t.slice(2), 10) || 0;
    else if (l.k === 'mark' || l.k === 'ramp' || l.k === 'size' || l.k === 'width' || l.k === 'text') info.push(l);
  });
  if (cats.length > MAXC + (o.full ? 0 : 2)) { more += cats.length - MAXC; cats = cats.slice(0, MAXC); }
  var maxPx = fs * 15, cut = function (t) { t = String(t || ''); if (ctx.measureText(t).width <= maxPx) return t; while (t.length > 1 && ctx.measureText(t + '…').width > maxPx) t = t.slice(0, -1); return t + '…'; };
  ctx.save(); ctx.textBaseline = 'middle'; ctx.font = fs + 'px ' + font;
  var infoText = function (l) { return String(l.t || '') + (l.k === 'ramp' ? ' ' + (l.lo || '') + ' to ' + (l.hi || '') : l.lo ? ' (' + l.lo + ' to ' + l.hi + ')' : ''); };
  var rows = [], wMax = 0, w;
  if (sc.legendTitle) { ctx.font = 'bold ' + fs + 'px ' + font; w = ctx.measureText(sc.legendTitle).width; wMax = Math.max(wMax, w); ctx.font = fs + 'px ' + font; }
  cats.forEach(function (l) { var t = cut(l.t); rows.push({ l: l, t: t, cat: true }); wMax = Math.max(wMax, fs * 1.6 + ctx.measureText(t).width); });
  if (more) { var mt = '+ ' + more + ' more'; rows.push({ t: mt, more: true }); wMax = Math.max(wMax, fs * 1.6 + ctx.measureText(mt).width); }
  var infoFs = Math.round(fs * 0.92 * 10) / 10; ctx.font = infoFs + 'px ' + font;
  info.forEach(function (l) { var t = cut(infoText(l)); rows.push({ l: l, t: t, info: true }); wMax = Math.max(wMax, (l.k === 'ramp' ? infoFs * 5.5 : l.k === 'mark' ? fs * 1.6 : 0) + ctx.measureText(t).width); });
  var boxW = Math.ceil(wMax + pad * 2), nInfo = info.length, sep = nInfo && rows.length > nInfo ? pad * 0.5 : 0;
  var boxH = Math.ceil((rows.length + (sc.legendTitle ? 1 : 0)) * rowH + pad * 2 + sep);
  var pos = o.pos || 'bl', x0 = pos.charAt(1) === 'r' ? W - boxW - pad : pad, y0 = pos.charAt(0) === 't' ? pad : H - boxH - pad;
  ctx.fillStyle = NFMScene.css(NFMScene.alpha(sc.theme.box, 0.94)); ctx.strokeStyle = NFMScene.css(NFMScene.alpha(sc.theme.boxLine, 0.8)); ctx.lineWidth = 1;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, boxW, boxH, 10); else ctx.rect(x0, y0, boxW, boxH); ctx.fill(); ctx.stroke();
  var y = y0 + pad + rowH / 2, x = x0 + pad, sw = fs * 1.05, drewSep = false;
  if (sc.legendTitle) { ctx.fillStyle = fg; ctx.font = 'bold ' + fs + 'px ' + font; ctx.fillText(sc.legendTitle, x, y); y += rowH; }
  rows.forEach(function (r) {
    var l = r.l;
    if (r.info && !drewSep && sep) { drewSep = true; ctx.strokeStyle = NFMScene.css(NFMScene.alpha(sc.theme.boxLine, 0.8)); ctx.beginPath(); ctx.moveTo(x, y - rowH / 2 + sep / 2 - 1); ctx.lineTo(x0 + boxW - pad, y - rowH / 2 + sep / 2 - 1); ctx.stroke(); y += sep; }
    if (r.cat) { ctx.fillStyle = NFMScene.css(l.c); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y - sw / 2, sw, sw, 3); else ctx.rect(x, y - sw / 2, sw, sw); ctx.fill(); ctx.fillStyle = fg; ctx.font = fs + 'px ' + font; ctx.fillText(r.t, x + fs * 1.6, y); }
    else if (r.more) { ctx.fillStyle = muted; ctx.font = fs + 'px ' + font; ctx.fillText(r.t, x + fs * 1.6, y); }
    else if (l.k === 'mark') { ctx.fillStyle = NFMScene.css(l.c); ctx.beginPath(); ctx.arc(x + sw / 2, y, sw * 0.42, 0, 7); ctx.fill(); ctx.fillStyle = muted; ctx.font = infoFs + 'px ' + font; ctx.fillText(r.t, x + fs * 1.6, y); }
    else if (l.k === 'ramp') { var g = ctx.createLinearGradient(x, 0, x + infoFs * 5, 0); for (var q = 0; q <= 4; q++) g.addColorStop(q / 4, NFMScene.css(l.ramp ? NFMScene.rampAt(l.ramp, q / 4) : NFMScene.mix(l.a, l.b, q / 4))); ctx.fillStyle = g; ctx.fillRect(x, y - infoFs * 0.35, infoFs * 5, infoFs * 0.7); ctx.fillStyle = muted; ctx.font = infoFs + 'px ' + font; ctx.fillText(r.t, x + infoFs * 5.5, y); }
    else { ctx.fillStyle = muted; ctx.font = infoFs + 'px ' + font; ctx.fillText(r.t, x, y); }
    y += rowH;
  });
  ctx.restore();
}
function drawCaption(ctx, sc, text, W, H, fontName) {
  if (!text) return;
  var fs = Math.max(14, Math.round(H / 16)), pad = fs * 0.55;
  ctx.save(); ctx.font = '700 ' + fs + 'px ' + NFMLook.fontStack(fontName); ctx.textBaseline = 'middle';
  var tw = ctx.measureText(text).width, x = fs * 0.6, y = fs * 0.6;
  ctx.fillStyle = NFMScene.css(NFMScene.alpha(sc.theme.box, 0.92)); ctx.strokeStyle = NFMScene.css(NFMScene.alpha(sc.theme.boxLine, 0.8));
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, tw + pad * 2, fs + pad * 1.4, fs * 0.4); else ctx.rect(x, y, tw + pad * 2, fs + pad * 1.4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = NFMScene.css(sc.theme.fg); ctx.fillText(text, x + pad, y + (fs + pad * 1.4) / 2); ctx.restore();
}
  return { drawKey: drawKey, drawCaption: drawCaption };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMGifKey;

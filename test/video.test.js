/* Copyright (c) 2026 LFC Foundry. MIT License. The MP4 and WebM writers in src/video.js: header flags and WebM seek positions. node test/video.test.js */
'use strict';
const V = require('../src/video.js'); let bad = 0;
const say = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) bad++; };
const mk = (n) => Array.from({ length: n }, (_, i) => ({ data: new Uint8Array(3000 + (i % 7) * 50), ms: 40, key: i % 50 === 0 }));
/* MP4: find a box by type inside a byte range */
const find = (b, type, from, to) => { for (let i = from; i + 8 <= to; i++) if (String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === type) return i; return -1; };
const mp = V.writeMp4(mk(5).map((s) => s), 64, 48, new Uint8Array([1, 100, 0, 40]));
const flags = (type) => { const at = find(mp, type, 0, mp.length); return at < 0 ? null : [mp[at + 8], mp[at + 9] * 65536 + mp[at + 10] * 256 + mp[at + 11]]; };
say(JSON.stringify(flags('tkhd')) === '[0,3]', 'tkhd: version 0, flags 3 (a strict parser, as in Firefox, rejects a version 3): ' + JSON.stringify(flags('tkhd')));
say(JSON.stringify(flags('vmhd')) === '[0,1]', 'vmhd: version 0, flags 1: ' + JSON.stringify(flags('vmhd')));
say(JSON.stringify(flags('url ')) === '[0,1]', 'url: version 0, flags 1 (media in this file): ' + JSON.stringify(flags('url ')));
say(['mvhd', 'mdhd', 'stts', 'stss', 'stsc', 'stsz', 'stco', 'stsd', 'hdlr'].every((t) => flags(t) && flags(t)[0] === 0 && flags(t)[1] === 0), 'every other full box has version 0 and no flags');
/* WebM: every cue points at the first byte of a cluster, for short and long clips (a longer clip made the cue numbers longer, which moved everything by a few bytes) */
const vint = (b, at) => { let n = 0; for (let i = 1; i < 8; i++) n = n * 256 + b[at + 1 + i - 1 + 0]; return n; };
for (const n of [10, 150, 400, 3000]) {
  const w = V.writeWebm(mk(n), 64, 64); let at = 0;
  const idLen = (b0) => b0 >= 0x80 ? 1 : b0 >= 0x40 ? 2 : b0 >= 0x20 ? 3 : 4;
  const readEl = (p) => { const il = idLen(w[p]), id = Array.from(w.slice(p, p + il)).map((x) => x.toString(16)).join(''); const sl = Math.clz32(w[p + il]) - 24 + 1; let sz = w[p + il] & (0xff >> sl); for (let i = 1; i < sl; i++) sz = sz * 256 + w[p + il + i]; return { id, il, sl, sz, body: p + il + sl }; };
  const head = readEl(0), seg = readEl(head.body + head.sz), segStart = seg.body;
  let p = segStart, cues = null, firstCluster = -1; const cluster = [];
  while (p < w.length) { const e = readEl(p); if (e.id === '1c53bb6b') cues = e; if (e.id === '1f43b675') cluster.push(p - segStart); p = e.body + e.sz; }
  const pos = []; if (cues) { let q = cues.body; while (q < cues.body + cues.sz) { const cp = readEl(q); let r = cp.body; while (r < cp.body + cp.sz) { const e = readEl(r); if (e.id === 'b7') { let s = e.body; while (s < e.body + e.sz) { const t = readEl(s); if (t.id === 'f1') { let v = 0; for (let i = 0; i < t.sz; i++) v = v * 256 + w[t.body + i]; pos.push(v); } s = t.body + t.sz; } } r = e.body + e.sz; } q = cp.body + cp.sz; } }
  say(pos.length > 0 && pos.every((v) => cluster.indexOf(v) >= 0), n + ' pictures: all ' + pos.length + ' seek positions point at the start of a cluster');
}
console.log(bad ? 'video: ' + bad + ' failed' : 'video: all passed'); process.exit(bad ? 1 : 0);

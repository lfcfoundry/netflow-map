/* Copyright (c) 2026 LFC Foundry. MIT License. Random damage to zips and workbooks, run inside the real page of a real browser, plus a memory loop.
 * Run: node test/fuzz.browser.js <chromium|firefox> [seconds=60]      (uses the same browser programs as bench/driver.js) */
'use strict';
const fs = require('fs'), path = require('path'), { open } = require('../bench/driver.js');
const which = process.argv[2] || 'chromium', seconds = Number(process.argv[3]) || 60, marker = which === 'firefox' ? 'puppeteer_dev_firefox_profile' : 'playwright_chromiumdev_profile';
function rssMB() {
  const ppid = new Map(), rss = new Map(), roots = [];
  for (const p of fs.readdirSync('/proc')) { if (!/^\d+$/.test(p)) continue; try { const st = fs.readFileSync(`/proc/${p}/status`, 'latin1'), pp = /PPid:\s+(\d+)/.exec(st), m = /VmRSS:\s+(\d+)/.exec(st); ppid.set(+p, pp ? +pp[1] : 0); rss.set(+p, m ? +m[1] : 0); if (fs.readFileSync(`/proc/${p}/cmdline`, 'latin1').includes(marker)) roots.push(+p); } catch (e) { /* gone */ } }
  const mine = new Set(roots); let grew = true; while (grew) { grew = false; for (const [pid, par] of ppid) if (!mine.has(pid) && mine.has(par)) { mine.add(pid); grew = true; } }
  let kb = 0; for (const pid of mine) kb += rss.get(pid) || 0; return Math.round(kb / 1024);
}
async function inPage(arg) {
  const budget = arg.seconds * 1000, t0 = performance.now();
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, ri = (n) => Math.floor(rnd() * n);
  const enc = new TextEncoder(), crc = NFMUnpack.crc32;
  const deflate = async (u8) => { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(u8); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); };
  const cat = (parts) => { let n = 0; parts.forEach((p) => { n += p.length; }); const o = new Uint8Array(n); let at = 0; parts.forEach((p) => { o.set(p, at); at += p.length; }); return o; };
  const le = (v, n) => { const o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = Math.floor(v / Math.pow(256, i)) & 255; return o; };
  async function zip(files) {
    const parts = [], cd = []; let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, body = await deflate(data), c = crc(data);
      const lh = cat([le(0x04034b50, 4), le(20, 2), le(0x800, 2), le(8, 2), le(0, 4), le(c, 4), le(body.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), name, body]);
      cd.push(cat([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x800, 2), le(8, 2), le(0, 4), le(c, 4), le(body.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), name]));
      parts.push(lh); off += lh.length;
    }
    const cdb = cat(cd);
    return cat(parts.concat([cdb, le(0x06054b50, 4), le(0, 4), le(files.length, 2), le(files.length, 2), le(cdb.length, 4), le(off, 4), le(0, 2)]));
  }
  const csv = 'source,target,weight\n' + Array.from({ length: 300 }, (_, i) => 'n' + (i % 50) + ',n' + ((i * 7) % 50) + ',' + (i % 5)).join('\n');
  const sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>source</t></is></c><c r="B1" t="inlineStr"><is><t>target</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>a</t></is></c><c r="B2" t="inlineStr"><is><t>b</t></is></c></row></sheetData></worksheet>';
  const book = await zip([{ name: '[Content_Types].xml', data: '<a/>' }, { name: 'xl/workbook.xml', data: '<workbook><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>' }, { name: 'xl/_rels/workbook.xml.rels', data: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' }, { name: 'xl/worksheets/sheet1.xml', data: sheet }]);
  const bases = [await zip([{ name: 'a.csv', data: csv }, { name: 'd/b.json', data: '{"nodes":[{"id":"Q"}],"edges":[]}' }, { name: 'c.graphml', data: '<graphml><graph><node id="a"/><node id="b"/><edge source="a" target="b"/></graph></graphml>' }]), book];
  let opened = 0, refused = 0, bad = [], slow = 0;
  while (arg.part !== 'bombs' && performance.now() - t0 < budget) {
    let b = bases[ri(2)].slice();
    const mode = ri(4);
    if (mode === 0) for (let k = 1 + ri(8); k > 0; k--) b[ri(b.length)] = ri(256);
    else if (mode === 1) b = b.subarray(0, ri(b.length));
    else if (mode === 2) { const p = ri(b.length), q = Math.min(b.length, p + ri(40)); b = cat([b.subarray(0, p), b.subarray(q)]); }
    else { const p = ri(b.length - 4), v = [0, 1, 0xffffffff, 0x7fffffff, 100, 65536][ri(6)]; b.set(le(v, 4), p); }
    const s = performance.now();
    try { const r = await NFMUnpack.expand(b, 'f.zip'); for (const f of r.files) { try { NFMImport.importAny([f]); } catch (e) { if (!(e instanceof Error) || e instanceof TypeError || e instanceof RangeError) throw e; } } opened++; }
    catch (e) { if (!(e instanceof Error) || e instanceof TypeError || e instanceof RangeError || e instanceof ReferenceError) bad.push(e.name + ': ' + e.message); else refused++; }
    if (performance.now() - s > 2000) slow++;
  }
  if (arg.part === 'fuzz') return { opened, refused, bad: bad.slice(0, 5), badCount: bad.length, slow, bombs: [], heapMB: null };
  // bombs: declared small, really large; and honestly large
  const bigBody = await deflate(new Uint8Array(150e6)), lie = (usize, c) => { const name = enc.encode('a.csv'), lh = cat([le(0x04034b50, 4), le(20, 2), le(0x800, 2), le(8, 2), le(0, 4), le(c, 4), le(bigBody.length, 4), le(usize, 4), le(name.length, 2), le(0, 2), name, bigBody]); const cdr = cat([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x800, 2), le(8, 2), le(0, 4), le(c, 4), le(bigBody.length, 4), le(usize, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(0, 4), name]); return cat([lh, cdr, le(0x06054b50, 4), le(0, 4), le(1, 2), le(1, 2), le(cdr.length, 4), le(lh.length, 4), le(0, 2)]); };
  const bombs = [];
  for (const [label, z] of [['claims 100 bytes', lie(100, 0)], ['admits 150 MB', lie(150e6, 0)]]) { const s = performance.now(); let out; try { out = (await NFMUnpack.expand(z, 'bomb.zip')).files.length + ' files'; } catch (e) { out = 'refused: ' + e.message.slice(0, 60); } bombs.push(label + ': ' + out + ' in ' + Math.round(performance.now() - s) + ' ms'); }
  return { opened, refused, bad: bad.slice(0, 5), badCount: bad.length, slow, bombs, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
}
async function leakLoop(D, laps) {
  return D.page.evaluate(async (n) => {
    const csv = 'source,target\n' + Array.from({ length: 4000 }, (_, i) => 'n' + (i % 700) + ',n' + ((i * 7) % 700)).join('\n');
    const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); const data = new TextEncoder().encode(csv); w.write(data); w.close();
    const body = new Uint8Array(await new Response(cs.readable).arrayBuffer()), crc = NFMUnpack.crc32(data), name = new TextEncoder().encode('e.csv');
    const le = (v, k) => { const o = new Uint8Array(k); for (let i = 0; i < k; i++) o[i] = Math.floor(v / Math.pow(256, i)) & 255; return o; };
    const cat = (parts) => { let m = 0; parts.forEach((p) => { m += p.length; }); const o = new Uint8Array(m); let at = 0; parts.forEach((p) => { o.set(p, at); at += p.length; }); return o; };
    const lh = cat([le(0x04034b50, 4), le(20, 2), le(0x800, 2), le(8, 2), le(0, 4), le(crc, 4), le(body.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), name, body]);
    const cdr = cat([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x800, 2), le(8, 2), le(0, 4), le(crc, 4), le(body.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(0, 4), name]);
    const z = cat([lh, cdr, le(0x06054b50, 4), le(0, 4), le(1, 2), le(1, 2), le(cdr.length, 4), le(lh.length, 4), le(0, 2)]);
    for (let i = 0; i < n; i++) { const r = await NFMUnpack.expand(z, 'z.zip'); const g = NFMImport.importAny(r.files).graph; NFMEngine; void g; }
    return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  }, laps);
}
(async () => {
  const D = await open(which, { timeout: 1800000 });
  try {
    await D.goto('file://' + path.resolve(__dirname, '..', process.env.NFM_PAGE || 'index.html'));
    await D.page.waitForFunction(() => window.NFMUnpack && window.NFMImport, null, { timeout: 30000 }).catch(() => {});
    const base = rssMB(), rss = [], heap = [];
    // memory first, on a quiet page: the same work 150 times, four rounds; browser process memory (and JS heap where the browser reports it)
    for (let r = 0; r < 4; r++) { heap.push(await leakLoop(D, 150)); await new Promise((ok) => setTimeout(ok, 800)); rss.push(rssMB()); }
    console.log(`  memory loop: 4 x 150 unzip+read laps, browser memory ${base} (start) -> ${rss.join(' -> ')} MB` + (heap[0] !== null ? `, JS heap ${heap.join(' -> ')} MB` : ''));
    const res = await D.page.evaluate(inPage, { seconds, part: 'fuzz' });
    console.log(`  after the random damage: ${rssMB()} MB`);
    const res2 = await D.page.evaluate(inPage, { seconds, part: 'bombs' }); res.bombs = res2.bombs;
    console.log(`${which} ${D.version}: ${res.opened} zips opened, ${res.refused} refused in plain words, ${res.badCount} unexpected errors, ${res.slow} slow (>2 s)`);
    res.bombs.forEach((b) => console.log('  bomb ' + b));
    if (res.bad.length) console.log('  unexpected:', res.bad);
    await new Promise((ok) => setTimeout(ok, 12000)); const settled = rssMB(); console.log(`  after the fuzz and the two 150 MB bombs, once the browser tidied up (12 s): ${settled} MB`);
    const growth = rss[3] - rss[1];
    const ok = res.badCount === 0 && res.slow === 0 && growth < 150 && settled - base < 500;
    console.log(ok ? '  PASS' : '  FAIL (growth over the last 2 rounds: ' + growth + ' MB)');
    process.exitCode = ok ? 0 : 1;
  } catch (e) { console.log('crash', e.message); process.exitCode = 1; }
  await D.close();
})();

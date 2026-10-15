/* Copyright (c) 2026 LFC Foundry. MIT License.
 *   node bench/run.js <firefox|chromium> <plan> [--only=suite] [--out=file.jsonl]
 * Runs every job of the plan in its own fresh page of one browser, with a time limit; a crash or time-out is recorded and the browser is restarted.
 * Writes one JSON line per job to bench/results/<browser>-<plan>.jsonl and prints a short line as it goes. */
'use strict';
const fs = require('fs'), path = require('path'), { open } = require('./driver.js');
const which = process.argv[2], planName = process.argv[3], flag = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const plans = require('./plans.js'); const jobs = plans[planName] && plans[planName](); if (!jobs) { console.error('plans:', Object.keys(plans).join(', ')); process.exit(1); }
const outFile = flag('out') || path.join(__dirname, 'results', `${which}-${planName}.jsonl`); fs.mkdirSync(path.dirname(outFile), { recursive: true });
const only = flag('only'), skipDone = process.argv.includes('--resume');
const marker = which === 'firefox' ? 'puppeteer_dev_firefox_profile' : 'playwright_chromiumdev_profile';
function rssMB() {   // memory of the browser and everything it started (Firefox keeps the page in a separate process)
  const ppid = new Map(), rss = new Map(), roots = [];
  for (const p of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(p)) continue;
    try {
      const st = fs.readFileSync(`/proc/${p}/status`, 'latin1'), pp = /PPid:\s+(\d+)/.exec(st), m = /VmRSS:\s+(\d+)/.exec(st);
      ppid.set(+p, pp ? +pp[1] : 0); rss.set(+p, m ? +m[1] : 0);
      if (fs.readFileSync(`/proc/${p}/cmdline`, 'latin1').includes(marker)) roots.push(+p);
    } catch (e) { /* gone */ }
  }
  const mine = new Set(roots); let grew = true;
  while (grew) { grew = false; for (const [pid, par] of ppid) if (!mine.has(pid) && mine.has(par)) { mine.add(pid); grew = true; } }
  let kb = 0; for (const pid of mine) kb += rss.get(pid) || 0;
  return Math.round(kb / 1024);
}
const groups = new Map(), done = new Set(); if (skipDone && fs.existsSync(outFile)) fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean).forEach((l) => { try { done.add(JSON.parse(l).key); } catch (e) { /* skip */ } });
(async () => {
  let D = null, version = '';
  const launch = async () => { D = await open(which, { timeout: 3600000 }); version = D.version; };
  await launch();
  for (const job of jobs) {
    if (only && job.suite !== only) continue;
    const key = job.suite + ':' + JSON.stringify(job.args); if (done.has(key)) continue;
    const rec = { key, suite: job.suite, args: job.args, browser: version, label: job.label || '' };
    // a bigger size of the same kind of job is skipped when the smaller one already failed, or when even a straight-line projection passes the time limit
    const lim = job.timeout || 600000, prev = job.group && groups.get(job.group);
    if (prev && job.args.n > prev.n && (prev.failed || prev.wallMs * (job.args.n / prev.n) > lim)) {
      rec.skipped = prev.failed ? 'the smaller size did not finish' : 'projected ' + Math.round(prev.wallMs * (job.args.n / prev.n) / 1000) + ' s, over the ' + Math.round(lim / 1000) + ' s limit';
      groups.set(job.group, { n: job.args.n, wallMs: lim, failed: true });
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n'); console.log(`${which} ${job.suite} ${JSON.stringify(job.args).slice(0, 70)} -> skipped: ${rec.skipped}`); continue;
    }
    let peak = 0, base = 0, timer = null, sampler = null, pg = null;
    try {
      pg = await (async () => { if (which === 'firefox') return await D.b.newPage(); return await D.page.context().newPage(); })();
      pg.setDefaultTimeout && pg.setDefaultTimeout(job.timeout || 600000);
      await pg.goto('file://' + path.join(__dirname, 'page.html'), { waitUntil: 'load' });
      await new Promise((r) => setTimeout(r, 300)); base = rssMB(); peak = base; sampler = setInterval(() => { peak = Math.max(peak, rssMB()); }, 400);
      const t0 = Date.now();
      const res = await Promise.race([pg.evaluate(async (j) => { try { return { ok: await SUITES[j.suite](j.args) }; } catch (e) { return { error: String(e && e.message || e).slice(0, 200) }; } }, { suite: job.suite, args: job.args }), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('time limit ' + Math.round((job.timeout || 600000) / 1000) + ' s')), job.timeout || 600000); })]);
      Object.assign(rec, res, { wallMs: Date.now() - t0 });
    } catch (e) {
      rec.error = String(e && e.message || e).slice(0, 160); rec.crashed = true;
      clearInterval(sampler); clearTimeout(timer); try { await D.close(); } catch (e2) { /* ignore */ } await launch(); pg = null;
    }
    clearInterval(sampler); clearTimeout(timer); rec.rssBaseMB = base; rec.rssPeakMB = peak;
    if (pg) { try { await pg.close(); } catch (e) { /* ignore */ } }
    if (job.group) groups.set(job.group, { n: job.args.n, wallMs: rec.wallMs || lim, failed: !!(rec.crashed || rec.error || (rec.ok && rec.ok.stages && Object.values(rec.ok.stages).some((x) => x && x.error))) });
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    const brief = rec.ok ? JSON.stringify(rec.ok).slice(0, 170) : rec.error;
    console.log(`${which} ${job.suite} ${JSON.stringify(job.args).slice(0, 70)} -> ${brief} [peak ${peak} MB]`);
  }
  await D.close();
})().catch((e) => { console.error('runner crash', e); process.exit(2); });

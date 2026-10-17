/* Copyright (c) 2026 LFC Foundry. MIT License. Opens a page in Firefox 158 (Puppeteer over WebDriver BiDi), ungoogled-chromium 155 (Playwright) or WebKitGTK 2.52.6 / GNOME Web (webkit-driver.js).
 * NFM_FIREFOX, NFM_CHROME, NFM_PUPPETEER, NFM_PLAYWRIGHT name the programs and packages (defaults are this machine's). */
'use strict';
const CHROME = process.env.NFM_CHROME || (process.env.HOME || '/root') + '/browsers/ungoogled-chromium-155.0.8059.39-1-x86_64_linux/chrome';
const FIREFOX = process.env.NFM_FIREFOX || (process.env.HOME || '/root') + '/browsers/firefox/firefox';
async function open(which, opts) {
  opts = opts || {};
  if (which === 'webkit' || which === 'epiphany') {   /* WebKitGTK / GNOME Web through webkit-driver.js (software drawing, a virtual screen) */
    const WD = require('./webkit-driver.js'), b = await WD.launch({ browser: which === 'epiphany' ? 'epiphany' : 'webkitgtk', width: 1280, height: 800, timeout: opts.timeout || 600000 });
    return { b, page: b.page, version: b.version, close: () => b.close().catch(() => {}), eval: (fn, arg) => b.page.evaluate(fn, arg), goto: (u) => b.page.goto(u) };
  }
  if (which === 'firefox') {
    const pp = require(process.env.NFM_PUPPETEER || '/tmp/pptr/node_modules/puppeteer-core');
    const b = await pp.launch({ browser: 'firefox', executablePath: FIREFOX, headless: true, protocol: 'webDriverBiDi', timeout: 120000, protocolTimeout: opts.timeout || 600000, extraPrefsFirefox: Object.assign({ 'dom.max_script_run_time': 0, 'dom.max_chrome_script_run_time': 0 }, opts.prefs || {}) });
    const page = await b.newPage();
    return { b, page, version: await b.version(), close: () => b.close().catch(() => {}), eval: (fn, arg) => page.evaluate(fn, arg), goto: (u) => page.goto(u, { waitUntil: 'load', timeout: 120000 }) };
  }
  const pw = require(process.env.NFM_PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright-core');
  const b = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--js-flags=--max-old-space-size=8192', '--enable-precise-memory-info'].concat((process.env.NFM_CHROME_ARGS || '').split(' ').filter(Boolean), opts.args || []) });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); page.setDefaultTimeout(opts.timeout || 600000);
  return { b, page, version: 'chromium ' + b.version(), close: () => b.close().catch(() => {}), eval: (fn, arg) => page.evaluate(fn, arg), goto: (u) => page.goto(u, { waitUntil: 'load', timeout: 120000 }) };
}
module.exports = { open, CHROME, FIREFOX };

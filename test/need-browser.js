/* Copyright (c) 2026 LFC Foundry. MIT License. Says whether the four-browser test is needed for what changed, so a words-only, benchmark-only or Node-test-only change skips about 275 s of browser time (Chromium 73 s, Firefox 69 s, WebKitGTK 62 s, GNOME Web 70 s, one at a time).
 *   node test/need-browser.js [--since REF]     prints "yes: ..." or "no: ..." and exits 0 either way (default: changes since HEAD, plus new files; with --since origin/main, everything the branch changed)
 * "yes" when anything the page is built from changed (src/, vendor/, wasm/, the build tools, the baseline) or a file is not recognized; "no" for CHANGELOG, README, AGENTS, docs/, bench/ and Node-only tests. */
'use strict';
const { execSync } = require('child_process'), path = require('path');
const i = process.argv.indexOf('--since'), ref = i > 0 ? process.argv[i + 1] : 'HEAD';
const out = (c) => { try { return execSync(c, { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { return null; } };
const ch = out('git diff --name-only ' + ref), un = out('git ls-files --others --exclude-standard');
if (ch === null || un === null) { console.log('yes: git is not available, so every change is assumed to need it'); process.exit(0); }
const changed = ch.concat(un);
if (!changed.length) { console.log('no: nothing changed'); process.exit(0); }
const words = (c) => /^(CHANGELOG|README|AGENTS|HANDOFF[\w-]*)\.md$|^docs\//.test(c) || /^bench\//.test(c) && !/^bench\/(tester|then-and-now)\//.test(c) && c !== 'bench/gen.js' || /^test\/[\w.-]+\.test\.m?js$/.test(c) && c !== 'test/browser.test.js' || c === 'index.html' || c === 'test/need-browser.js' || /^tools\/build-(tester|force-lab|then-and-now|race)[\w.-]*\.mjs$/.test(c) || /^index\.(fast|packed)\.html$/.test(c);
const need = changed.filter((c) => !words(c));
console.log(need.length ? 'yes: ' + need.slice(0, 6).join(', ') + (need.length > 6 ? ' and ' + (need.length - 6) + ' more' : '') + ' changed' : 'no: only ' + changed.length + ' words, benchmark or Node-test files changed (' + changed.slice(0, 4).join(', ') + (changed.length > 4 ? ', ...' : '') + ')');

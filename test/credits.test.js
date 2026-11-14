/* Copyright (c) 2026 LFC Foundry. MIT License. The in-app Credits list (src/app/64-credits.js) and docs/CREDITS.md name the same links, and every link is https. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(root, 'src/app/64-credits.js'), 'utf8');
const doc = fs.readFileSync(path.join(root, 'docs/CREDITS.md'), 'utf8');
const app = new Set([...src.matchAll(/\['[^']*', '(https:\/\/[^']+)'\]/g)].map((m) => m[1]));
const md = new Set([...doc.matchAll(/\]\((https:\/\/[^)\s]+(?:\([^)]*\)[^)\s]*)*)\)/g)].map((m) => m[1]));
const inDoc = [...md].filter((u) => !app.has(u)), inApp = [...app].filter((u) => !md.has(u));
ok(app.size >= 20, 'the app lists ' + app.size + ' links');
ok([...app].every((u) => /^https:\/\//.test(u)), 'every link is https');
ok([...src].every((c) => c.charCodeAt(0) <= 255), 'no character above U+00FF in the credits file');
ok(!inApp.length, 'in the app but not in docs/CREDITS.md: ' + inApp.join(' '));
/* the docs also link the tools measured against and JS-modules; those are not rows of the list */
const extra = inDoc.filter((u) => !/graphviz\.org|eclipse\.dev|dagrejs|lfcfoundry|d3\/d3-sankey|d3-force|echarts|wikipedia/.test(u));
ok(!extra.length, 'in docs/CREDITS.md but not in the app: ' + extra.join(' '));
console.log(fails ? fails + ' failed' : 'all ' + checks + ' credits checks passed');
process.exit(fails ? 1 : 0);

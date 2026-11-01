// Copyright (c) 2026 LFC Foundry. MIT License.
// The GitHub Pages play page (docs/play/index.html) must be the latest build, byte for byte. tools/build.mjs writes both.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const a = fs.readFileSync(path.join(root, 'index.html')), b = fs.readFileSync(path.join(root, 'docs', 'play', 'index.html'));
if (!a.equals(b)) { console.error('FAIL docs/play/index.html is not the latest build: run node tools/build.mjs'); process.exit(1); }
const land = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
if (!/href="play\/"/.test(land)) { console.error('FAIL docs/index.html has no link to play/'); process.exit(1); }
if (/claude\.ai\/artifact/.test(land)) { console.error('FAIL docs/index.html links to an artifact'); process.exit(1); }
console.log('ok play page is the latest build (' + a.length + ' bytes) and the landing links to it');

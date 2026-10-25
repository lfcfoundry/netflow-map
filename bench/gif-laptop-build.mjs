/* Copyright (c) 2026 LFC Foundry. MIT License. Builds the one-file laptop test page: node bench/gif-laptop-build.mjs [out.html] [lfc-pack-section.js] */
import fs from 'node:fs';
const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\n?if \(typeof module !== 'undefined' && module\.exports\)[^\n]*/g, '');
let t = fs.readFileSync(new URL('./gif-laptop-test.template.html', import.meta.url), 'utf8');
const gx = rd('src/gifx.js'), gg = rd('src/gifgl.js');
if (/<\/script/i.test(gx + gg)) throw new Error('script end tag inside a source');
t = t.split('@@GIFX@@').join(gx).split('@@GIFGL@@').join(gg);
const lp = process.argv[3] && fs.existsSync(process.argv[3]) ? fs.readFileSync(process.argv[3], 'utf8') : '/* no LFC-pack section in this build */';
if (/<\/script/i.test(lp)) throw new Error('script end tag inside the LFC-pack section');
t = t.split('@@LFCPACK@@').join(lp);
const out = process.argv[2] || 'bench/netflow-gif-laptop-test.html';
fs.writeFileSync(out, t); console.log(out, (t.length / 1024).toFixed(0) + ' KB');

#!/usr/bin/env node
// Checks every link in docs/CREDITS.md. Copyright (c) 2026 LFC Foundry. MIT License.
// DOI links: asked through the Crossref API; the row's first author must appear in the answer. Other links: GET, 200 to 399 passes.
// 202, 403, 429 and network errors are reported as "could not confirm" (exit code 0 unless a link answered 404 or 410 or a DOI is not found).
import { readFileSync } from 'node:fs';
const here = new URL('../../docs/CREDITS.md', import.meta.url);
const text = readFileSync(here, 'utf8');
const links = [...new Set([...text.matchAll(/\]\((https?:\/\/[^)\s]+(?:\([^)]*\)[^)\s]*)*)\)/g)].map((m) => m[1]))];
const rows = text.split('\n').filter((l) => l.startsWith('|'));
let bad = 0, unsure = 0, ok = 0;
const get = async (u) => { try { const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (credits-check)' }, signal: AbortSignal.timeout(25000) }); return r.status; } catch (e) { return 0; } };
for (const u of links) {
  const d = decodeURIComponent(u).match(/^https:\/\/doi\.org\/(10\..+)$/);
  if (d) {
    const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(d[1]), { signal: AbortSignal.timeout(25000) }).catch(() => null);
    if (!r) { unsure++; console.log('could not confirm (Crossref unreachable):', u); continue; }
    if (r.status === 404) { bad++; console.log('NOT FOUND in Crossref:', u); continue; }
    if (r.status !== 200) { unsure++; console.log('could not confirm (' + r.status + '):', u); continue; }
    const m = (await r.json()).message, fam = ((m.author || [])[0] || {}).family || '', row = rows.find((l) => l.includes(u)) || '';
    if (fam && !row.includes(fam)) { bad++; console.log('first author "' + fam + '" is not in the row for', u); continue; }
    ok++; continue;
  }
  const s = await get(u);
  if (s === 404 || s === 410) { bad++; console.log('DEAD (' + s + '):', u); } else if (s >= 200 && s < 400 && s !== 202) ok++; else { unsure++; console.log('could not confirm (' + s + '):', u); }
}
console.log(ok + ' confirmed, ' + unsure + ' could not be confirmed, ' + bad + ' wrong or dead, of ' + links.length + ' links');
process.exit(bad ? 1 : 0);

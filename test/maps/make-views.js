/* Copyright (c) 2026 LFC Foundry. MIT License. Prints the shared-view texts (NFM-VIEW1:...) for the test map. */
'use strict';
const rules = [
  { target: 'links', on: true, when: { type: 'kind', value: 'backup' }, set: { dash: 'dot' } },
  { target: 'links', on: true, when: { type: 'kind', value: 'alert' }, set: { color: '#d62839', arrow: true, w: 2.5 } },
  { target: 'links', on: true, when: { type: 'between' }, set: { bend: 0.25 } }
];
const enc = (snap) => 'NFM-VIEW1:' + Buffer.from(JSON.stringify(snap), 'utf8').toString('base64');
const views = {
  'A. 3D, just turn it': { view: 'network', arrange: 'force3d', colorBy: 'group' },
  'B. 3D with rules (dotted, arrows, bent)': { view: 'network', arrange: 'force3d', colorBy: 'group', rules },
  'C. Flat with rules (dotted, arrows, bent)': { view: 'network', arrange: 'stress', colorBy: 'group', rules }
};
for (const k of Object.keys(views)) console.log('### ' + k + '\n\n```\n' + enc(views[k]) + '\n```\n');

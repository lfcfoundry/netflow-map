/* Copyright (c) 2026 LFC Foundry. MIT License. Run: node test/plot-rest-wedges.test.js. netflow-plot 2.17.0 checks on the vendor copy: the folded rest of a
   long list never takes a real category's rows or name (row and value conservation), and every positive donut share has area after SVG rounding. */
'use strict';
global.NetflowScene = require('../vendor/netflow-scene.js');
let fails = 0, checks = 0;
require('./plot-checks/rest-and-wedges.js')(require('../vendor/netflow-plot.js'), global.NetflowScene, (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } });
console.log(fails ? fails + ' of ' + checks + ' checks failed' : checks + ' checks passed');
process.exit(fails ? 1 : 0);

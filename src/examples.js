/*!
 * Netflow Map example data. Everything here is made up for the examples. Copyright (c) 2026 LFC Foundry. MIT License.
 */
var NFMExamples = (function () {
  'use strict';
  function rng(seed) { var s = seed | 0; return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  var STORY = { start: 'wake', passages: [
    { id: 'wake', name: 'Wake on the shore', group: 'Shore', choices: [{ to: 'path', label: 'Follow the cliff path' }, { to: 'boat', label: 'Check the rowboat' }] },
    { id: 'path', name: 'The cliff path', group: 'Shore', choices: [{ to: 'door', label: 'Climb to the door' }, { to: 'cave', label: 'Peek into the cave' }] },
    { id: 'boat', name: 'The rowboat', group: 'Shore', choices: [{ to: 'door', label: 'Row to the jetty' }, { to: 'storm', label: 'Row out to sea' }] },
    { id: 'cave', name: 'The sea cave', group: 'Shore', choices: [{ to: 'door', label: 'Climb out' }, { to: 'tide', label: 'Go deeper' }] },
    { id: 'tide', name: 'Rising tide', group: 'Shore', ending: true, valence: 'bad', choices: [] },
    { id: 'storm', name: 'Caught in the storm', group: 'Sea', ending: true, valence: 'bad', choices: [] },
    { id: 'door', name: 'The lighthouse door', group: 'Lighthouse', choices: [{ to: 'hall', label: 'Knock and enter' }, { to: 'hall', label: 'Pick the lock' }] },
    { id: 'hall', name: 'The round hall', group: 'Lighthouse', choices: [{ to: 'stairs', label: 'Climb the stairs' }, { to: 'cellar', label: 'Open the cellar' }, { to: 'study', label: 'Enter the study' }] },
    { id: 'cellar', name: 'The cellar', group: 'Lighthouse', choices: [{ to: 'hall', label: 'Back upstairs' }, { to: 'lens', label: 'Take the spare lens' }] },
    { id: 'lens', name: 'A spare lens', group: 'Lighthouse', choices: [{ to: 'stairs', label: 'Carry it up' }] },
    { id: 'study', name: 'The keeper\'s study', group: 'Lighthouse', choices: [{ to: 'log', label: 'Read the logbook' }, { to: 'stairs', label: 'Go up' }] },
    { id: 'log', name: 'The logbook', group: 'Lighthouse', choices: [{ to: 'stairs', label: 'Go up' }, { to: 'hall', label: 'Search the hall again' }] },
    { id: 'stairs', name: 'The long stairs', group: 'Tower', choices: [{ to: 'lamp', label: 'Reach the lamp room' }] },
    { id: 'lamp', name: 'The lamp room', group: 'Tower', choices: [{ to: 'light', label: 'Light the lamp' }, { to: 'dark', label: 'Leave it dark' }, { to: 'signal', label: 'Signal the ship' }] },
    { id: 'light', name: 'The beam sweeps out', group: 'Tower', choices: [{ to: 'saved', label: 'Wait' }] },
    { id: 'signal', name: 'Signal the ship', group: 'Tower', choices: [{ to: 'saved', label: 'Wait' }, { to: 'wreck', label: 'Signal the wrong way' }] },
    { id: 'dark', name: 'Darkness falls', group: 'Tower', choices: [{ to: 'wreck', label: 'Wait' }] },
    { id: 'saved', name: 'The ship is safe', group: 'Tower', ending: true, valence: 'good', choices: [] },
    { id: 'wreck', name: 'The ship is lost', group: 'Tower', ending: true, valence: 'bad', choices: [] }
  ] };

  var PIPELINE = 'from,to,weight,source_group,target_group,label\n' +
    'Idea,Design,1,Plan,Plan,approved\nDesign,Build,3,Plan,Make,spec\nDesign,Prototype,2,Plan,Make,sketch\nPrototype,Build,2,Make,Make,feedback\nPrototype,Design,1,Make,Plan,rework\n' +
    'Build,Review,5,Make,Check,pull request\nReview,Build,2,Check,Make,changes\nReview,Test,4,Check,Check,approved\nTest,Build,2,Check,Make,bug\nTest,Stage,3,Check,Ship,passed\n' +
    'Stage,Approve,2,Ship,Ship,ready\nApprove,Release,2,Ship,Ship,go\nStage,Build,1,Ship,Make,fix\nRelease,Monitor,2,Ship,Run,live\nMonitor,Support,1,Run,Run,alert\nMonitor,Idea,1,Run,Plan,learning\nSupport,Build,1,Run,Make,hotfix\nSupport,Idea,1,Run,Plan,request\n';

  var NOTES = [
    { name: 'Garden.md', path: 'Garden/Garden.md', text: '---\ntags: [hub]\n---\n# Garden\nStart here. Plan in [[Seeds]], then [[Soil]], then [[Watering]].\n' },
    { name: 'Seeds.md', path: 'Garden/Seeds.md', text: '---\ntags: [plan]\n---\n# Seeds\nBuy early. Needs [[Soil]] ready first. Ideas: [[Tomatoes]], [[Herbs]].\n' },
    { name: 'Soil.md', path: 'Garden/Soil.md', text: '---\ntags: [prep]\n---\n# Soil\nCompost in autumn. Then [[Watering]]. See also [[Tools]].\n' },
    { name: 'Watering.md', path: 'Garden/Watering.md', text: '---\ntags: [care]\n---\n# Watering\nMornings are best. Check [[Weather]] first. Feeds [[Tomatoes]] and [[Herbs]].\n' },
    { name: 'Tomatoes.md', path: 'Garden/Plants/Tomatoes.md', text: '---\ntags: [plants]\naliases: [tomato]\n---\n# Tomatoes\nNeed stakes from [[Tools]]. Harvest in [[Kitchen]].\n' },
    { name: 'Herbs.md', path: 'Garden/Plants/Herbs.md', text: '---\ntags: [plants]\n---\n# Herbs\nBasil likes sun. Harvest in [[Kitchen]]. Dry some for [[Winter]].\n' },
    { name: 'Tools.md', path: 'Garden/Tools.md', text: '---\ntags: [prep]\n---\n# Tools\nSpade, rake, stakes, hose.\n' },
    { name: 'Kitchen.md', path: 'Garden/Kitchen.md', text: '---\ntags: [harvest]\n---\n# Kitchen\nSauce, salad, tea. Save seeds back to [[Seeds]].\n' }
  ];

  var OUTLINE = '# Weekend trip\n- Plan\n  - Pick dates [[Book travel]]\n  - Choose place\n    - Coast [[Pack bag]]\n    - Mountains [[Pack bag]]\n- Book travel\n  - Train\n  - Hotel\n- Pack bag\n  - Clothes\n  - Snacks\n- Go\n  - Arrive [[Plan]]\n  - Explore\n';

  function bigNetwork(n, comms, seed) {
    var r = rng(seed), nodes = [], edges = [], per = Math.ceil(n / comms), names = ['Atlas', 'Birch', 'Cedar', 'Delta', 'Ember', 'Fjord'];
    for (var i = 0; i < n; i++) nodes.push({ id: 'p' + i, label: names[Math.floor(i / per) % names.length] + ' ' + (i % per + 1), group: '', valence: '', ghost: false, attrs: { community: Math.floor(i / per) } });
    var seen = new Set();
    var add = function (a, b) { if (a === b) return; var k = a + '>' + b; if (seen.has(k)) return; seen.add(k); edges.push({ from: 'p' + a, to: 'p' + b, label: '', kind: '', attrs: {} }); };
    for (var j = 0; j < n; j++) {
      var c = Math.floor(j / per), m = 2 + Math.floor(r() * 3);
      for (var q = 0; q < m; q++) { var t = c * per + Math.floor(r() * per); if (t < n) add(j, t); }
      if (r() < 0.12) add(j, Math.floor(r() * n));
    }
    return { name: 'Six communities', start: null, nodes: nodes, edges: edges };
  }

  var SUPPLY = { name: 'A supply chain over four states', start: 'orders', roles: { view: 'flow', colorBy: 'group', widthBy: 'weight' }, states: { names: ['Baseline', 'Year 1', 'Year 2', 'End state'] },
    nodes: [
      { id: 'orders', label: 'Purchase orders', group: 'Start' }, { id: 'iron', label: 'Ironworks', group: 'Suppliers' }, { id: 'poly', label: 'Polymer Co', group: 'Suppliers' }, { id: 'chip', label: 'Chip Fab', group: 'Suppliers' },
      { id: 'north', label: 'North Plant', group: 'Plants' }, { id: 'south', label: 'South Plant', group: 'Plants' }, { id: 'east', label: 'East Plant (opens in year 1)', group: 'Plants' },
      { id: 'alpha', label: 'Hub Alpha', group: 'Hubs' }, { id: 'beta', label: 'Hub Beta', group: 'Hubs' }, { id: 'gamma', label: 'Hub Gamma (opens in year 2)', group: 'Hubs' },
      { id: 'ra', label: 'Coast market', group: 'Markets' }, { id: 'rb', label: 'Inland market', group: 'Markets' }, { id: 'rc', label: 'Lakeside market', group: 'Markets' }],
    edges: [
      { from: 'orders', to: 'iron', weight: 120, vals: [100, 120, 120, 110] },
      { from: 'orders', to: 'poly', weight: 95, vals: [80, 95, 95, 100] },
      { from: 'orders', to: 'chip', weight: 75, vals: [20, 50, 75, 90] },
      { from: 'iron', to: 'north', weight: 40, vals: [60, 55, 40, 30] },
      { from: 'iron', to: 'south', weight: 35, vals: [40, 40, 35, 25] },
      { from: 'iron', to: 'east', weight: 45, vals: [null, 25, 45, 55] },
      { from: 'poly', to: 'north', weight: 25, vals: [30, 30, 25, 20] },
      { from: 'poly', to: 'south', weight: 30, vals: [50, 45, 30, 20] },
      { from: 'poly', to: 'east', weight: 40, vals: [null, 20, 40, 60] },
      { from: 'chip', to: 'north', weight: 45, vals: [20, 35, 45, 40] },
      { from: 'chip', to: 'east', weight: 30, vals: [null, 15, 30, 50] },
      { from: 'north', to: 'alpha', weight: 60, vals: [70, 75, 60, 40] },
      { from: 'north', to: 'beta', weight: 50, vals: [40, 45, 50, 50] },
      { from: 'south', to: 'beta', weight: 50, vals: [80, 70, 50, 30] },
      { from: 'south', to: 'alpha', weight: 15, vals: [10, 15, 15, 15] },
      { from: 'east', to: 'beta', weight: 60, vals: [null, 60, 60, 70] },
      { from: 'east', to: 'gamma', weight: 55, vals: [null, null, 55, 95] },
      { from: 'alpha', to: 'ra', weight: 55, vals: [60, 65, 55, 45] },
      { from: 'alpha', to: 'rb', weight: 20, vals: [20, 25, 20, 10] },
      { from: 'beta', to: 'rb', weight: 80, vals: [70, 85, 80, 75] },
      { from: 'beta', to: 'rc', weight: 60, vals: [30, 65, 60, 60] },
      { from: 'beta', to: 'ra', weight: 20, vals: [20, 25, 20, 15] },
      { from: 'gamma', to: 'rc', weight: 30, vals: [null, null, 30, 60] },
      { from: 'gamma', to: 'rb', weight: 25, vals: [null, null, 25, 35] }] };

  var ITSELF = { name: 'How this app turns data into a picture', start: 'file', roles: { view: 'flow', colorBy: 'group', widthBy: 'weight' },
    nodes: [
      { id: 'file', label: 'Your data (file, paste or folder)', group: 'Bring in' },
      { id: 'read', label: 'Read it (CSV, JSON, notes, outline, zip)', group: 'Bring in' },
      { id: 'limits', label: 'Limits and safe text', group: 'Bring in' },
      { id: 'check', label: 'Data check (plain-words report)', group: 'Check' },
      { id: 'fix', label: 'You fix what the check found', group: 'Check' },
      { id: 'prep', label: 'Prepare flat arrays', group: 'Prepare' },
      { id: 'imp', label: 'Find the choke points', group: 'Prepare' },
      { id: 'flowa', label: 'Follow the flow: exact odds', group: 'Prepare' },
      { id: 'flows', label: 'Follow the flow: dice', group: 'Prepare' },
      { id: 'view', label: 'Choose a view', group: 'Arrange' },
      { id: 'lay', label: 'Lanes, Sankey and rings', group: 'Arrange' },
      { id: 'net', label: 'Network arrangement', group: 'Arrange' },
      { id: 'quick', label: 'Quick sample of pairs', group: 'Arrange' },
      { id: 'exact', label: 'Every pair on the processor', group: 'Arrange' },
      { id: 'probe', label: 'Test the graphics card', group: 'Graphics card' },
      { id: 'sketch', label: '60-item sketch', group: 'Graphics card' },
      { id: 'hop', label: 'Hop table of every pair', group: 'Graphics card' },
      { id: 'sweep', label: 'Parallel pair sweeps', group: 'Graphics card' },
      { id: 'clean', label: 'Overlap clean-up', group: 'Arrange' },
      { id: 'pack', label: 'Pack the pieces', group: 'Arrange' },
      { id: 'scene', label: 'Build the scene (colors, sizes, labels)', group: 'Draw' },
      { id: 'gpu', label: 'Draw with WebGPU', group: 'Draw' },
      { id: 'gl', label: 'Draw with WebGL 2', group: 'Draw' },
      { id: 'c2d', label: 'Draw with plain canvas', group: 'Draw' },
      { id: 'screen', label: 'The map on your screen', group: 'Draw' },
      { id: 'exp', label: 'Export or keep working (picture, GIF, table, saved file)', group: 'Share' }],
    edges: [
      { from: 'file', to: 'read', weight: 100 },
      { from: 'read', to: 'limits', weight: 112 },
      { from: 'limits', to: 'check', weight: 112 },
      { from: 'check', to: 'fix', weight: 12 },
      { from: 'fix', to: 'read', weight: 12 },
      { from: 'check', to: 'prep', weight: 100 },
      { from: 'prep', to: 'imp', weight: 100 },
      { from: 'imp', to: 'flowa', weight: 65 },
      { from: 'imp', to: 'flows', weight: 35 },
      { from: 'flowa', to: 'view', weight: 65 },
      { from: 'flows', to: 'view', weight: 35 },
      { from: 'view', to: 'lay', weight: 55 },
      { from: 'view', to: 'net', weight: 75 },
      { from: 'net', to: 'quick', weight: 40 },
      { from: 'net', to: 'exact', weight: 20 },
      { from: 'net', to: 'probe', weight: 15 },
      { from: 'probe', to: 'sketch', weight: 11 },
      { from: 'probe', to: 'exact', weight: 4 },
      { from: 'sketch', to: 'hop', weight: 11 },
      { from: 'hop', to: 'sweep', weight: 11 },
      { from: 'quick', to: 'clean', weight: 40 },
      { from: 'exact', to: 'clean', weight: 24 },
      { from: 'sweep', to: 'clean', weight: 11 },
      { from: 'clean', to: 'pack', weight: 75 },
      { from: 'lay', to: 'scene', weight: 55 },
      { from: 'pack', to: 'scene', weight: 75 },
      { from: 'scene', to: 'gpu', weight: 80 },
      { from: 'scene', to: 'gl', weight: 40 },
      { from: 'scene', to: 'c2d', weight: 10 },
      { from: 'gpu', to: 'screen', weight: 80 },
      { from: 'gl', to: 'screen', weight: 40 },
      { from: 'c2d', to: 'screen', weight: 10 },
      { from: 'screen', to: 'exp', weight: 100 },
      { from: 'screen', to: 'view', weight: 30 }] };

  var LIST = [
    { id: 'story', title: 'A short adventure (story)', blurb: 'Eighteen pages with choices, endings and a few loops. Try Sankey, Choke-point spine and Story shape.', load: function () { var r = NFMImport.importJSON(JSON.stringify(STORY), 'The Old Lighthouse', {}); return r; } },
    { id: 'pipeline', title: 'How work moves through a team (table)', blurb: 'A table of handoffs with weights and groups. Try Given lanes.', load: function () { return NFMImport.importDelimited(PIPELINE, 'Release pipeline', {}); } },
    { id: 'notes', title: 'A folder of linked notes (Markdown)', blurb: 'Eight notes that link to each other with [[double brackets]], with tags and one folder.', load: function () { return NFMImport.importNotes(NOTES, 'Garden notes', {}); } },
    { id: 'outline', title: 'A bulleted outline with cross links', blurb: 'An indented list; lines with [[brackets]] add links back across the outline.', load: function () { return NFMImport.importOutline(OUTLINE, 'Weekend trip', {}); } },
    { id: 'states', title: 'A supply chain over four states (changes over time)', blurb: 'The same chain at baseline, year 1, year 2 and an end state; plants and hubs open and flows shift. Open the Map and press play.', load: function () { return NFMImport.importJSON(JSON.stringify(SUPPLY), SUPPLY.name, {}); } },
    { id: 'network', title: 'A network with no story (600 items)', blurb: 'Six hidden communities. Try Network view and color by Found groups.', load: function () { var g = bigNetwork(600, 6, 7); return { graph: g, report: { format: 'built in', nodes: g.nodes.length, edges: g.edges.length, ghosts: 0, notes: ['Made up for the example: 600 items in six clusters with a few links between clusters. No groups are named, so try "Found groups".'], counts: {} } }; } },
    { id: 'itself', title: 'How this app turns your data into a picture (the app itself)', blurb: 'The app\'s own steps from a file to the map on screen: reading, checking, preparing, arranging (with the graphics-card detour), drawing and sharing. Widths are roughly how many times each step happens per 100 files (illustrative figures, balanced so nothing is lost on the way). Try Flow, then Network.', load: function () { return NFMImport.importJSON(JSON.stringify(ITSELF), ITSELF.name, {}); } }
  ];
  return { LIST: LIST, bigNetwork: bigNetwork, STORY: STORY, ITSELF: ITSELF, PIPELINE: PIPELINE, NOTES: NOTES, OUTLINE: OUTLINE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMExamples;

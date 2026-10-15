/*!
 * Net Flow Map example data. Everything here is made up for the examples. Copyright (c) 2026 JNFoo. MIT License.
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

  var LIST = [
    { id: 'story', title: 'A short adventure (story)', blurb: 'Eighteen pages with choices, endings and a few loops. Try River, Choke-point spine and Story shape.', load: function () { var r = NFMImport.importJSON(JSON.stringify(STORY), 'The Old Lighthouse', {}); return r; } },
    { id: 'pipeline', title: 'How work moves through a team (table)', blurb: 'A table of handoffs with weights and groups. Try Given lanes.', load: function () { return NFMImport.importDelimited(PIPELINE, 'Release pipeline', {}); } },
    { id: 'notes', title: 'A folder of linked notes (Markdown)', blurb: 'Eight notes that link to each other with [[double brackets]], with tags and one folder.', load: function () { return NFMImport.importNotes(NOTES, 'Garden notes', {}); } },
    { id: 'outline', title: 'A bulleted outline with cross links', blurb: 'An indented list; lines with [[brackets]] add links back across the outline.', load: function () { return NFMImport.importOutline(OUTLINE, 'Weekend trip', {}); } },
    { id: 'network', title: 'A network with no story (600 items)', blurb: 'Six hidden communities. Try Network view and color by Found groups.', load: function () { var g = bigNetwork(600, 6, 7); return { graph: g, report: { format: 'built in', nodes: g.nodes.length, edges: g.edges.length, ghosts: 0, notes: ['Made up for the example: 600 items in six clusters with a few links between clusters. No groups are named, so try "Found groups".'], counts: {} } }; } }
  ];
  return { LIST: LIST, bigNetwork: bigNetwork, STORY: STORY, PIPELINE: PIPELINE, NOTES: NOTES, OUTLINE: OUTLINE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMExamples;

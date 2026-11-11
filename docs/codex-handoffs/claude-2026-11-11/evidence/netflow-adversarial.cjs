// Copyright (c) 2026 LFC Foundry. MIT License.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = __dirname;
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'netflow-review-'));
const candidate = path.resolve(__dirname, '../../../../vendor');
const versions = [
  ['baseline', require(path.join(root, 'netflow-plot-baseline.js')), require(path.join(root, 'netflow-scene-baseline.js'))],
  ['candidate', require(path.join(candidate, 'netflow-plot.js')), require(path.join(candidate, 'netflow-scene.js'))],
];
function marks(P, S, rows, spec, options = {}) {
  const scene = P.make(rows, spec, { width: 600, height: 400, ...options }, S);
  return scene.marks.map(m => ({ name: m.t, rows: m.rows }));
}
const cases = [
  ['real-only', [{cat:'Other',v:100},{cat:'A',v:90}], {type:'bar',x:'cat',y:'v',top:2}],
  ['both-top-ranked', [{cat:'Other',v:100},{cat:'A',v:90},{cat:'B',v:80},{cat:'C',v:70}], {type:'bar',x:'cat',y:'v',top:2}],
  ['both-real-low-ranked', [{cat:'Other',v:1},{cat:'A',v:100},{cat:'B',v:90},{cat:'C',v:80}], {type:'bar',x:'cat',y:'v',top:2}],
  ['top-one', [{cat:'Other',v:100},{cat:'A',v:90},{cat:'B',v:80},{cat:'C',v:70}], {type:'bar',x:'cat',y:'v',top:1}],
  ['top-three', [{cat:'Other',v:100},{cat:'A',v:90},{cat:'B',v:80},{cat:'C',v:70}], {type:'bar',x:'cat',y:'v',top:3}],
  ['top-four-no-overflow', [{cat:'Other',v:100},{cat:'A',v:90},{cat:'B',v:80},{cat:'C',v:70}], {type:'bar',x:'cat',y:'v',top:4}],
  ['overflow-without-real', [{cat:'A',v:100},{cat:'B',v:90},{cat:'C',v:80},{cat:'D',v:70}], {type:'bar',x:'cat',y:'v',top:2}],
  ['empty-and-missing', [{cat:'Other',v:100},{cat:'',v:90},{v:80},{cat:'C',v:70}], {type:'bar',x:'cat',y:'v',top:2}],
  ['real-other-and-others', [{cat:'Other',v:100},{cat:'Others',v:90},{cat:'A',v:80},{cat:'B',v:70}], {type:'bar',x:'cat',y:'v',top:2}],
  ['grouped', [{cat:'Other',color:'red',v:100},{cat:'A',color:'red',v:90},{cat:'B',color:'blue',v:80},{cat:'C',color:'blue',v:70}], {type:'bar',x:'cat',y:'v',color:'color',stack:'group',top:2}],
  ['count-other-and-others', [...Array(3)].map(()=>({cat:'Other'})).concat([...Array(2)].map(()=>({cat:'Others'})),[{cat:'A'},{cat:'B'}]), {type:'bar',x:'cat',top:2}],
];
for (const [name, rows, spec] of cases) {
  for (const [version, P, S] of versions) {
    const result = marks(P, S, rows, spec);
    const covered = result.flatMap(m => m.rows || []);
    console.log(JSON.stringify({section:'bar',case:name,version,marks:result,distinctCoverage:new Set(covered).size,rows:rows.length}));
  }
}
for (const [version,P,S] of versions) {
  const z='\0', rows=[{x:'a'+z+'b',color:'c',v:1},{x:'a',color:'b'+z+'c',v:10}];
  console.log(JSON.stringify({section:'nul',version,marks:marks(P,S,rows,{type:'bar',x:'x',color:'color',y:'v',stack:'group'})}));
}
const valid = '\t\n\r A<&"\uD7FF\uE000\uFFFD\u{10000}\u{10FFFF}';
const invalid = '\u0000\u0001\u0008\u000B\u000C\u000E\u001F\uD800 X \uDC00\uFFFE\uFFFF';
for (const [version,,S] of versions) {
  const scene = S.make({kind:'network',view:'network',dir:'none',nodes:[],edges:[],width:200,height:100},{});
  scene.labels = [{x:10,y:20,size:12,t:valid+invalid,color:scene.theme.fg}];
  const svg=S.toSvg(scene, valid+invalid);
  const file=path.join(outputDir, `svg-${version}.svg`); fs.writeFileSync(file,svg);
  console.log(JSON.stringify({section:'svg',version,file:path.basename(file),hasValidSupplementary:svg.includes('\u{10000}')&&svg.includes('\u{10FFFF}'),hasEscapedInvalid:svg.includes('\\u{0}')&&svg.includes('\\u{D800}')&&svg.includes('\\u{DC00}')&&svg.includes('\\u{FFFF}')}));
}
function area(pts) {let a=0;for(let i=0;i<pts.length;i+=2){const j=(i+2)%pts.length;a+=pts[i]*pts[j+1]-pts[j]*pts[i+1]}return Math.abs(a/2)}
for (const [version,P,S] of versions) {
  for(const big of [1e3,1e6,1e9,1e12,1e16,1e20]){
    const scene=P.make([{cat:'large',v:big},{cat:'tiny',v:1}],{type:'donut',x:'cat',y:'v'},{width:600,height:400},S);
    const tiny=scene.marks.find(m=>m.rows?.includes(1));
    const p=scene.polys.at(-1);
    const width=tiny?.wedge?.[5]-tiny?.wedge?.[4];
    const rawArea=p?area(p.pts):0, roundedArea=p?area(p.pts.map(x=>Number(x.toFixed(2)))):0;
    console.log(JSON.stringify({section:'donut',version,big,angle:width,polyCount:scene.polys.length,rawArea,roundedArea}));
  }
  const zero=P.make([{cat:'large',v:100},{cat:'zero',v:0}],{type:'donut',x:'cat',y:'v'},{width:600,height:400},S);
  const many=P.make([{cat:'large',v:1e6},...Array.from({length:11},(_,i)=>({cat:'tiny'+i,v:1}))],{type:'donut',x:'cat',y:'v'},{width:600,height:400},S);
  console.log(JSON.stringify({section:'donut-controls',version,zeroMarks:zero.marks.map(m=>m.t),manyMarks:many.marks.map(m=>m.t),manyPolys:many.polys.length}));
}
fs.rmSync(outputDir, { recursive: true, force: true });

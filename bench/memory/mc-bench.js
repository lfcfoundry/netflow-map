// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map at 100,000 items: what the memory-compression module does to the real layout and scene.
// Run:  node --expose-gc bench/memory/mc-bench.js [items]
// Needs a checkout of https://github.com/lfcfoundry/JS-modules next to this repository, or set JSM to its folder:
//   JSM=/path/to/JS-modules node --expose-gc bench/memory/mc-bench.js 100000
// (Node 22. For the jso module use a checkout of its main branch, version 1.1.1 or later.)
const PATH=require('path'), R=PATH.resolve(__dirname,'..','..')+'/', JSM=process.env.JSM||PATH.resolve(R,'..','JS-modules');
const J=JSM+'/modules/memory-compression/';
global.NFMColumns=require(R+'src/columns.js'); const E=require(R+'src/engine.js'); global.NFMEngine=E; const SC=require(R+'vendor/netflow-scene.js', 'src/scene-alias.js'); const GEN=require(R+'bench/gen.js'), C=global.NFMColumns;
const MC=require(J+'memory-compression.js'); const N=Number(process.argv[2])||100000;
const heap=()=>{global.gc();global.gc();return process.memoryUsage().heapUsed/1048576;};
const t=(f)=>{const a=process.hrtime.bigint();const r=f();return [r,Number(process.hrtime.bigint()-a)/1e6];};
(async()=>{ try{await MC.ready();}catch(e){} console.log('wasm accelerated:',MC.accelerated&&MC.accelerated());
 const h0=heap(); let g=GEN.graph('moderate',N,11); let dg=C.derive(JSON.parse(JSON.stringify(g))); g=null; const h1=heap();
 let L=E.build(dg,{view:'network',arrange:'sphere',colorBy:'group'}); const h2=heap();
 let S=SC.make(L,{plan:{},rig:false,colorBy:'group',theme:'light',cam:{yaw:.6,pitch:.35,persp:2.4}}); const h3=heap();
 console.log(`items ${L.nodes.length}, links ${L.edges.length}; heap MB: graph ${(h1-h0).toFixed(0)}, layout ${(h2-h1).toFixed(0)}, scene ${(h3-h2).toFixed(0)}`);
 // generic columnar encoder for an array of flat records
 function encode(arr,name){ const keys=Object.keys(arr[0]||{}), n=arr.length, num=[],txt=[],col={};
  keys.forEach(k=>{const v=arr[0][k]; if(typeof v==='number'||typeof v==='boolean')num.push(k); else txt.push(k);});
  const F=new Float64Array(n*num.length); // row-major records
  for(let i=0;i<n;i++){const o=arr[i];for(let j=0;j<num.length;j++){const v=o[num[j]];F[i*num.length+j]=typeof v==='number'?v:(v?1:0);}}
  const T=[];for(let i=0;i<n;i++){const o=arr[i],row=[];for(let j=0;j<txt.length;j++)row.push(o[txt[j]]);T.push(JSON.stringify(row));} const text=Buffer.from(T.join('\n'));
  return {name,n,num,txt,F,text};}
 const parts=[encode(L.nodes,'layout nodes'),encode(L.edges,'layout links'),encode(S.curves,'scene links'),encode(S.dots,'scene dots'),encode(S.labels,'scene labels')];
 let totRaw=0,totFast=0,totSmall=0,packT=0,unT=0;
 for(const p of parts){ const rawN=p.F.byteLength, rawT=p.text.length; totRaw+=rawN+rawT;
  const w=p.num.length*8; const row=[p.name+` (${p.n} x ${p.num.length} numbers, ${p.txt.length} text fields)`, ((rawN+rawT)/1048576).toFixed(1)+' MB raw'];
  for(const mode of ['fast','small']){ const [a,ta]=t(()=>MC.pack(p.F,{width:w,mode})), [b,tb]=t(()=>MC.pack(new Uint8Array(p.text.buffer,p.text.byteOffset,p.text.length),{mode}));
   const [u1,tu1]=t(()=>MC.unpack(a)), [u2,tu2]=t(()=>MC.unpack(b)); const sz=a.length+b.length; if(mode==='fast')totFast+=sz; else totSmall+=sz; packT+=0;
   row.push(`${mode}: ${(sz/1048576).toFixed(1)} MB (${(100*sz/(rawN+rawT)).toFixed(0)}%) pack ${(ta+tb).toFixed(0)} ms, restore ${(tu1+tu2).toFixed(0)} ms`); }
  console.log(row.join(' | ')); }
 console.log(`columns total raw ${(totRaw/1048576).toFixed(1)} MB; fast ${(totFast/1048576).toFixed(1)} MB; small ${(totSmall/1048576).toFixed(1)} MB`);
 // rebuilding objects from columns = the cost of "unpack and make the objects again"
 const nodes=parts[0], [,tb]=t(()=>{const o=new Array(nodes.n);for(let i=0;i<nodes.n;i++){const r={};for(let j=0;j<nodes.num.length;j++)r[nodes.num[j]]=nodes.F[i*nodes.num.length+j];o[i]=r;}return o;});
 const ed=parts[1],[,te]=t(()=>{const o=new Array(ed.n);for(let i=0;i<ed.n;i++){const r={};for(let j=0;j<ed.num.length;j++)r[ed.num[j]]=ed.F[i*ed.num.length+j];o[i]=r;}return o;});
 console.log(`making the numeric parts of ${nodes.n} item and ${ed.n} link objects again from columns: ${(tb+te).toFixed(0)} ms (text fields extra)`);
 const [js,tj]=t(()=>JSON.stringify(L)); console.log(`whole layout as JSON text: ${(js.length/1048576).toFixed(0)} MB in ${tj.toFixed(0)} ms`); const [,tp]=t(()=>JSON.parse(js)); console.log(`JSON.parse back: ${tp.toFixed(0)} ms`);
 const buf=Buffer.from(js); for(const mode of ['fast','small']){const [a,ta]=t(()=>MC.pack(new Uint8Array(buf.buffer,buf.byteOffset,buf.length),{mode})),[,tu]=t(()=>MC.unpack(a)); console.log(`layout JSON packed ${mode}: ${(a.length/1048576).toFixed(0)} MB (${(100*a.length/buf.length).toFixed(0)}%), pack ${ta.toFixed(0)} ms, restore ${tu.toFixed(0)} ms`);}
})();

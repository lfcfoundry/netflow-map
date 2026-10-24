// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map at 100,000 items: what the memory-compression-jso module does to the real layout and scene.
// Run:  node --expose-gc bench/memory/jso-bench.js [items]
// Needs a checkout of https://github.com/lfcfoundry/JS-modules next to this repository, or set JSM to its folder:
//   JSM=/path/to/JS-modules node --expose-gc bench/memory/jso-bench.js 100000
// (Node 22. For the jso module use a checkout of its main branch, version 1.1.1 or later.)
const PATH=require('path'), R=PATH.resolve(__dirname,'..','..')+'/', JSM=process.env.JSM||PATH.resolve(R,'..','JS-modules');
const J=JSM+'/modules/memory-compression-jso/';
global.NFMColumns=require(R+'src/columns.js'); const E=require(R+'src/engine.js'); global.NFMEngine=E; const SC=require(R+'vendor/netflow-scene.js', 'src/scene-alias.js'); const GEN=require(R+'bench/gen.js'), C=global.NFMColumns;
const M=require(J+'memory-compression-jso.js'); const assert=require('assert'); const N=Number(process.argv[2])||100000;
const heap=()=>{global.gc();global.gc();return process.memoryUsage().heapUsed/1048576;};
const t=(f)=>{const a=process.hrtime.bigint();let r;try{r=f();}catch(e){r={err:e};}return [r,Number(process.hrtime.bigint()-a)/1e6];};
(async()=>{ try{await M.ready();}catch(e){} console.log('wasm:',M.accelerated());
 let g=GEN.graph('moderate',N,11), dg=C.derive(JSON.parse(JSON.stringify(g))); g=null;
 let L=E.build(dg,{view:'network',arrange:'sphere',colorBy:'group'});
 let S=SC.make(L,{plan:{},rig:false,colorBy:'group',theme:'light',cam:{yaw:.6,pitch:.35,persp:2.4}});
 const hL=(()=>{const a=heap(); const b=heap(); return 0;})();
 console.log(`items ${L.nodes.length}, links ${L.edges.length}`);
 const fnKeys=Object.keys(S).filter(k=>typeof S[k]==='function'); console.log('scene function members:',fnKeys.length,fnKeys.slice(0,5).join(','));
 // a plain-data copy of the scene (functions left out) so it can be packed
 const Sd={}; Object.keys(S).forEach(k=>{if(typeof S[k]!=='function')Sd[k]=S[k];});
 for(const [name,X] of [['layout L',L],['scene S (data members)',Sd]]){
  for(const mode of ['fast','small']){
   for(const refs of [false,true]){
    const [p,tp]=t(()=>M.pack(X,{mode,refs})); if(p.err){console.log(`${name} ${mode} refs=${refs}: pack failed: ${String(p.err.message).slice(0,140)}`);continue;}
    const [b,tu]=t(()=>M.unpack(p)); if(b.err){console.log(`${name} ${mode} refs=${refs}: unpack failed: ${String(b.err.message).slice(0,140)}`);continue;}
    let same='?'; try{assert.deepStrictEqual(b,X);same='exact';}catch(e){same='DIFFERS: '+String(e.message).split('\n')[0].slice(0,100);}
    console.log(`${name} | ${mode}${refs?' +refs':''}: ${(p.length/1048576).toFixed(1)} MB packed, pack ${tp.toFixed(0)} ms, unpack ${tu.toFixed(0)} ms, ${same}`);
   }}
 }
 // live heap of the objects vs packed
 const h0=heap(); const [pk]=t(()=>M.pack(L,{mode:'fast'})); const packedMB=pk.length/1048576; const Lref=L; L=null; S=null; 
 const hAfterDrop=(()=>{ /* L still referenced by dg? */ return heap();})();
 console.log(`heap now ${hAfterDrop.toFixed(0)} MB (was ${h0.toFixed(0)}) after dropping L and S references; the packed layout is ${packedMB.toFixed(1)} MB`);
 const v=(()=>{const a=process.hrtime.bigint(); const vv=M.view(pk.length?M.pack(Lref.edges,{mode:'fast'}):null); return [vv,Number(process.hrtime.bigint()-a)/1e6];})();
 const pe=M.pack(Lref.edges,{mode:'fast'}); const [vw,tv]=t(()=>M.view(pe)); console.log(`view of ${Lref.edges.length} links: open ${tv.toFixed(2)} ms, lazy=${vw.lazy}`);
 const [,tg]=t(()=>{for(let i=0;i<1000;i++)vw.get((i*997)%vw.length);}); console.log(`1000 single links read: ${tg.toFixed(1)} ms`);
})();

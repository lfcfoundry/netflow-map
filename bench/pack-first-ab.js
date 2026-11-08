// node packab.js browser reps old.js new.js : fresh page per run, first init+pack+unpack of a 2000-node graph
const fs=require('fs');process.env.NFM_PLAYWRIGHT='/opt/node22/lib/node_modules/playwright';process.env.NFM_PUPPETEER='/tmp/pp/node_modules/puppeteer-core';
const gen=fs.readFileSync('/tmp/w/nfm/bench/gen.js','utf8');
(async()=>{const [,,which,reps,A,B]=process.argv;const T=[A,B].map(f=>fs.readFileSync(f,'utf8'));
const D=await require('/tmp/w/nfm/bench/driver.js').open(which,{timeout:600000});
const once=async(t)=>{await D.goto('about:blank');return D.page.evaluate(async({t,gen})=>{const ev=(c)=>(0,eval)(c);ev(gen.replace(/if \(typeof module[^\n]*\n?/,'')+'\n;globalThis.NFMGen=NFMGen;');ev(t);
 const g=globalThis.NFMGen.graph('simple',2000,5),doc={nodes:g.nodes,links:g.edges||g.links};
 let t0=performance.now();await LfcPack.init();const init=performance.now()-t0;
 t0=performance.now();const u=await LfcPack.packTables(doc);const pack=performance.now()-t0;
 t0=performance.now();await LfcPack.unpackTables(u);const unpack=performance.now()-t0;
 t0=performance.now();const u2=await LfcPack.packTables(doc);const pack2=performance.now()-t0;
 return{init,pack,unpack,pack2,bytes:u.length};},{t,gen});};
await once(T[0]);await once(T[1]);const r=[[],[]];
for(let i=0;i<+reps;i++){const o=i%2?[1,0]:[0,1];for(const k of o)r[k].push(await once(T[k]));}
const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];
for(const k of ['init','pack','unpack','pack2','bytes']){const a=med(r[0].map(x=>x[k])),b=med(r[1].map(x=>x[k]));console.log(which,k,a.toFixed(1),'->',b.toFixed(1),'ratio old/new',(a/b).toFixed(2));}
await D.close();process.exit(0);})();

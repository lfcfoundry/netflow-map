/* Copyright (c) 2026 LFC Foundry. MIT License. Graphics-card looks vs the JavaScript twin: node bench/gif-gl-parity.js chromium|firefox */
const fs=require('fs'),path=require('path');
const which=process.argv[2]||'chromium';
(async()=>{
 const D=await require('./driver.js').open(which,{timeout:120000});
 try{
  const html='<!doctype html><meta charset=utf-8><script>'+fs.readFileSync(path.resolve(__dirname,'../src/gifx.js'),'utf8')+'\n'+fs.readFileSync(path.resolve(__dirname,'../src/gifgl.js'),'utf8')+'</script>';
  const pg=path.join(require('os').tmpdir(),'nfm-gl-parity.html');fs.writeFileSync(pg,html);
  await D.goto('file://'+pg);
  const out=await D.page.evaluate(()=>{
   const w=960,h=540,rgba=new Uint8ClampedArray(w*h*4);
   let s=1;const rnd=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4;rgba[o]=x/w*255;rgba[o+1]=y/h*255;rgba[o+2]=128+127*Math.sin(x/30);rgba[o+3]=255;}
   for(let i=0;i<400;i++){const x=rnd()*w|0,y=rnd()*h|0,r=3+rnd()*12|0,c=[rnd()*255,rnd()*255,rnd()*255];for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<w&&Y<h&&dx*dx+dy*dy<=r*r){const o=(Y*w+X)*4;rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];}}}
   const g=NFMGifGl.create(); if(!g) return {err:'no webgl2'};
   const res=[]; const full={glow:0.6,blur:1,vignette:0.4,sharpen:0.3,saturation:0.2};
   const cases=NFMGifFx.FILTER_PRESETS.filter(p=>p[0]!=='Normal').concat([['Full chain',full]]);
   for(const [name,f] of cases){
    const a=new Uint8ClampedArray(rgba),b=new Uint8ClampedArray(rgba);
    NFMGifFx.applyJs(a,w,h,f); const r=g.apply(b,w,h,f);
    if(!r){res.push({name,err:'null'});continue;}
    let same=0,max=0,n=w*h*4,close=0;for(let i=0;i<n;i++){if(i%4==3)continue;const d=Math.abs(a[i]-b[i]);if(d===0)same++;if(d<=2)close++;if(d>max)max=d;}
    res.push({name,exact:+(same/(n*0.75)*100).toFixed(2),within2:+(close/(n*0.75)*100).toFixed(2),max});
   }
   const n=4,pics=[];for(let k=0;k<n;k++){const a=new Uint8ClampedArray(rgba);for(let i=0;i<a.length;i++)if((i&3)!==3)a[i]=(a[i]+k*37)&255;pics.push(a);}
   const one=pics.map(a=>g.apply(new Uint8ClampedArray(a),w,h,full)),big=new Uint8ClampedArray(w*h*4*n);pics.forEach((a,k)=>big.set(a,k*w*h*4));
   const r4=g.apply(big,w,h,full,n);let bdiff=0;if(!r4)bdiff=-1;else for(let k=0;k<n;k++)for(let i=0;i<w*h*4;i++)if(one[k][i]!==big[k*w*h*4+i])bdiff++;
   return {res,sw:g.software(),batchDiffValues:bdiff,maxBatch:g.maxBatch(h)};
  });
  console.log(D.version,JSON.stringify(out,null,0).replace(/\},/g,'},\n'));
 }finally{await D.close();}
})().catch(e=>{console.error(e);process.exit(1)});

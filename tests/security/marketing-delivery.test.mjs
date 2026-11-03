import test from 'node:test';
import assert from 'node:assert/strict';
import {quadMatrix,mount} from '../../js/marketing-motion.mjs';
import {monitorCorners,imageGeometry} from '../../js/marketing-monitor-geometry.mjs';
const readMatrix=s=>s.slice(9,-1).split(',').map(Number);
test('live page perspective maps all four corners without losing projection precision',()=>{
 for(const q of [[[120,80],[740,60],[720,480],[100,430]],[[0,0],[350,0],[350,780],[0,780]],monitorCorners])for(const w of [480,1000]){
  const m=readMatrix(quadMatrix(q,w,700));for(const [i,[x,y]]of [[0,[0,0]],[1,[w,0]],[2,[w,700]],[3,[0,700]]]){const d=m[3]*x+m[7]*y+m[15];assert(Math.abs((m[0]*x+m[4]*y+m[12])/d-q[i][0])<.01);assert(Math.abs((m[1]*x+m[5]*y+m[13])/d-q[i][1])<.01);}
 }
});
test('perspective calculation is deterministic and does not mutate source corners',()=>{const q=structuredClone(monitorCorners),first=quadMatrix(q);for(let n=0;n<20;n++)assert.equal(quadMatrix(q),first);assert.deepEqual(q,monitorCorners)});

test('obsolete motion mount performs no DOM or GSAP initialization after delayed image decoding',async()=>{
 const saved=Object.fromEntries(['window','document','matchMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let release,decoding=false,current=true,registrations=0;
 const decoded=new Promise(resolve=>{release=resolve});
 try{
  globalThis.window={gsap:{registerPlugin(){registrations++;throw Error('stale mount initialized GSAP')}},ScrollTrigger:{}};
  globalThis.document={fonts:{ready:Promise.resolve()},querySelectorAll(selector){assert.equal(selector,'.studio img,.site-image img');return [{decode(){decoding=true;return decoded}}]}};
  globalThis.matchMedia=()=>({matches:false});
  const pending=mount({isCurrent:()=>current});
  await Promise.resolve();assert.equal(decoding,true);
  current=false;release();const cleanup=await pending;assert.equal(typeof cleanup,'function');cleanup();
  assert.equal(registrations,0);
 }finally{for(const [key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
});

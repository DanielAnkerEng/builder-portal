import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sceneAt, progressAt, zoomAt, mobilePhaseAt, installScenes } from '../../js/marketing-scenes.mjs';

const closeTo=(actual,expected)=>assert(Math.abs(Number(actual)-expected)<1e-10,`expected ${actual} to equal ${expected}`);
const scales=h=>h.scenes.map(scene=>Number(scene.style['--scene-zoom']));

test('scroll timeline has four readable holds and three bounded transitions', () => {
  for (const [p, active] of [[0,0],[.1,0],[.3,1],[.4,1],[.6,2],[.7,2],[.85,3],[1,3]]) {
    const state=sceneAt(p);assert.equal(state.active,active);assert.equal(state.mix,0);
  }
  for(const p of [.22,.49,.76]){const s=sceneAt(p);assert(s.mix>0&&s.mix<1);assert.equal(s.to,s.from+1);}
});
test('direct jumps, reverse scroll and bad inputs have no history-dependent state',()=>{
  const positions=[0,.22,.6,1,.4,.22,0,1];
  for(const p of positions)assert.deepEqual(sceneAt(p),sceneAt(p));
  assert.equal(sceneAt(1).active,3);assert.equal(sceneAt(0).active,0);
  for(const input of [NaN,Infinity,undefined,-10])assert.deepEqual(sceneAt(input),sceneAt(0));
  assert.deepEqual(sceneAt(10),sceneAt(1));
});
test('progress depends on current geometry, including resized track and viewport',()=>{
  assert.equal(progressAt(100,4400,1000),0);assert.equal(progressAt(-3400,4400,1000),1);
  assert.equal(progressAt(-1700,4400,1000),.5);assert.equal(progressAt(-1360,3520,800),.5);
  assert.equal(progressAt(-1,500,500),0);assert.equal(progressAt(-99999,4400,1000),1);
});
test('photo zoom holds, advances, and reaches its maximum before the wipe',()=>{
  for(const phase of [-1,0,.06,.12])assert.equal(zoomAt(phase),1);
  closeTo(zoomAt(.41),1.175);
  for(const phase of [.7,.78,.9,1,2])closeTo(zoomAt(phase),1.35);
  for(const input of [NaN,Infinity,undefined])assert.equal(zoomAt(input),1);
  closeTo(zoomAt(.41,1.18),1.09);closeTo(zoomAt(1,1.18),1.18);
  for(let index=0;index<3;index++){
    closeTo(sceneAt((index+.78)/3.7).mix,0);
    closeTo(sceneAt((index+.89)/3.7).mix,.5);
    assert.equal(sceneAt((index+1)/3.7).active,index+1);
  }
});
test('mobile photo progress is bounded by unscaled viewport geometry',()=>{
  assert.equal(mobilePhaseAt(1000,1000),0);assert.equal(mobilePhaseAt(800,1000),0);
  closeTo(mobilePhaseAt(460,1000),.5);closeTo(mobilePhaseAt(120,1000),1);
  assert.equal(mobilePhaseAt(-1000,1000),1);
  for(const viewport of [0,-100])assert.equal(mobilePhaseAt(-100,viewport),0);
  for(const top of [NaN,Infinity,undefined])assert.equal(mobilePhaseAt(top,1000),0);
});

function harness({matches=true,motionMatches=true,top=1500,navigation='navigate',failImage=false}={}) {
  const node=()=>({attrs:{},listeners:{},classes:new Set(),style:{setProperty(k,v){this[k]=v;}},inert:false,
    setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},hasAttribute(k){return k in this.attrs;},addEventListener(k,v){this.listeners[k]=v;},getBoundingClientRect(){return{top:0};},
    get classList(){const n=this;return{toggle(k,on){on?n.classes.add(k):n.classes.delete(k);},contains(k){return n.classes.has(k);}};}
  });
  let resolveImages,rejectImages;
  const decoded=new Promise((resolve,reject)=>{resolveImages=resolve;rejectImages=reject;});
  const images=Array.from({length:4},()=>{const image=node();image.setAttribute('data-full-srcset','synthetic-640.webp 640w, synthetic-1600.webp 1600w');image.decode=()=>decoded;image.getBoundingClientRect=()=>assert.fail('scroll progress must not read the transformed image');return image;});
  const photoGeometry=images.map((_,index)=>({top:1600+index*900,height:540,bottom:2140+index*900}));
  const mediaBoxes=photoGeometry.map(geometry=>{const mediaBox=node();mediaBox.getBoundingClientRect=()=>geometry;return mediaBox;});
  const scenes=images.map((image,index)=>{const scene=node();scene.querySelector=selector=>{
    if(selector==='img[data-full-srcset]')return image;
    if(selector==='.demo-hero-media')return mediaBoxes[index];
    assert.fail(`unexpected scene selector: ${selector}`);
  };return scene;});
  const track=node(),toggle=node(),count=node(),bars=Array.from({length:4},node),story=node();
  const geometry={top,height:4136,bottom:top+4136};track.getBoundingClientRect=()=>geometry;
  story.querySelector=selector=>({'.scene-track':track,'#chapterCount':count,'#motionToggle':toggle}[selector]);
  story.querySelectorAll=selector=>{
    if(selector==='[data-scene]')return scenes;
    if(selector==='.chapter-line i')return bars;
    if(selector==='[data-scene-demo] .demo-hero img')return images;
    assert.fail(`unexpected story selector: ${selector}`);
  };
  const media={matches,addEventListener(_,fn){this.change=fn;}},motion={matches:motionMatches,addEventListener(_,fn){this.change=fn;}},frames=[],events={};
  const win={innerHeight:940,matchMedia(query){
    if(query==='(min-width: 900px) and (min-height: 640px)')return media;
    if(query==='(prefers-reduced-motion: no-preference)')return motion;
    assert.fail(`unexpected media query: ${query}`);
  },requestAnimationFrame(fn){frames.push(fn);},addEventListener(k,fn,opts){events[k]={fn,opts};},scrollBy(){},performance:{getEntriesByType:()=>[{type:navigation}]},setTimeout(){assert.fail('scene movement must not use timers');},setInterval(){assert.fail('scene movement must not use timers');},get localStorage(){assert.fail('scene movement must not use storage');}};
  installScenes(story,{window:win});
  const flush=()=>{while(frames.length)frames.shift()();};
  const atPhase=phase=>{geometry.top=-(geometry.height-win.innerHeight)*phase/3.7;geometry.bottom=geometry.top+geometry.height;events.scroll.fn();flush();};
  const photoAt=(index,top)=>{photoGeometry[index].top=top;photoGeometry[index].bottom=top+photoGeometry[index].height;};
  return{story,scenes,track,toggle,count,bars,images,mediaBoxes,photoGeometry,media,motion,win,frames,events,geometry,flush,atPhase,photoAt,async ready(){failImage?rejectImages(new Error('synthetic unavailable image')):resolveImages();await new Promise(resolve=>setImmediate(resolve));flush();}};
}
test('all scene thumbnails decode before sticky enhancement; only next large image is prepared',async()=>{
  const h=harness();assert(!h.story.classes.has('is-scroll'));await h.ready();assert(h.story.classes.has('is-scroll'));
  h.geometry.top=-100;h.geometry.bottom=4036;h.events.scroll.fn();h.flush();
  assert.equal(h.images.filter(i=>i.hasAttribute('srcset')).length,2);
  assert.equal(h.scenes.filter(s=>!s.inert).length,1);assert.equal(h.scenes[0].attrs['aria-hidden'],'false');
  assert.equal(h.events.scroll.opts.passive,true);assert(!h.events.wheel);
});
test('desktop zoom advances only each current photograph and holds outgoing zoom through the wipe',async()=>{
  const h=harness();await h.ready();assert(h.story.classes.has('is-photo-zoom'));
  for(let index=0;index<3;index++){
    for(const [phase,expected] of [[.06,1],[.12,1],[.41,1.175],[.7,1.35],[.78,1.35],[.89,1.35],[.999,1.35]]){
      h.atPhase(index+phase);closeTo(scales(h)[index],expected);
      assert.equal(scales(h)[index+1],1,'incoming scene starts without zoom');
      assert.equal(scales(h)[3],1,'phone composition never zooms');
      if(phase>.78){
        assert(h.scenes[index].classes.has('is-visible'));
        assert(h.scenes[index+1].classes.has('is-visible'));
        assert.notEqual(h.scenes[index+1].style['--mask'],'0%');
      }
    }
  }
  h.atPhase(3.7);assert.deepEqual(scales(h),[1.35,1.35,1.35,1]);
  for(const phase of [2.41,.41,1.41,0,2.89,.41]){
    h.atPhase(phase);
    const index=Math.floor(phase);
    closeTo(scales(h)[index],phase%1>.78?1.35:phase===0?1:1.175);
    assert.equal(scales(h)[index+1],1);
  }
  for(const node of [...h.mediaBoxes,...h.images])assert.equal(node.style.transform,undefined);
});
test('rapid scroll coalesces in one frame and reads the latest geometry',async()=>{
  const h=harness();await h.ready();h.geometry.top=-100;h.events.scroll.fn();h.geometry.top=-3196;h.events.scroll.fn();
  assert.equal(h.frames.length,1);h.flush();assert.equal(h.count.textContent,'04 / 04');
  h.geometry.top=0;h.events.scroll.fn();h.flush();assert.equal(h.count.textContent,'01 / 04');
  assert.deepEqual(scales(h),[1,1,1,1]);assert.equal(h.frames.length,0);
});
test('transition has two visual layers but exactly one readable/focusable caption',async()=>{
  const h=harness();await h.ready();h.geometry.top=-3196*.22;h.events.scroll.fn();h.flush();
  assert.equal(h.scenes.filter(s=>s.classes.has('is-visible')).length,2);
  assert.equal(h.scenes.filter(s=>s.classes.has('is-caption')).length,1);
  assert.equal(h.scenes.filter(s=>!s.inert).length,1);
  assert.notEqual(h.scenes[1].style['--mask'],'0%');
});
test('narrow or short screen exposes every scene; resize restores the right scene and photo scale',async()=>{
  const h=harness({matches:false});await h.ready();assert(!h.story.classes.has('is-scroll'));
  assert(h.scenes.every(s=>!s.inert&&s.attrs['aria-hidden']===undefined));
  h.media.matches=true;h.geometry.top=-2000;h.media.change();h.flush();assert(h.story.classes.has('is-scroll'));assert.equal(h.count.textContent,'03 / 04');
  h.media.matches=false;h.media.change();assert(h.scenes.every(s=>!s.inert));
  h.photoAt(0,h.win.innerHeight*(.8-.68*.41));h.flush();closeTo(scales(h)[0],1.09);
  h.media.matches=true;h.geometry.top=-(h.geometry.height-h.win.innerHeight)*1.41/3.7;h.media.change();h.flush();
  closeTo(scales(h)[0],1.35);closeTo(scales(h)[1],1.175);assert.equal(scales(h)[2],1);
  h.win.innerHeight=800;h.geometry.height=3520;h.geometry.top=-(3520-800)*2.41/3.7;
  h.events.resize.fn();h.flush();closeTo(scales(h)[2],1.175);assert.equal(h.count.textContent,'03 / 04');
});
test('mobile photographs zoom from 1 to 1.18 with normal scrolling and prepare only nearby photos',async()=>{
  const h=harness({matches:false});await h.ready();
  assert(h.story.classes.has('is-photo-zoom'));assert(!h.story.classes.has('is-scroll'));
  assert.deepEqual(scales(h),[1,1,1,1]);assert(h.images.every(image=>!image.hasAttribute('srcset')));
  for(const [phase,expected] of [[0,1],[.12,1],[.41,1.09],[.7,1.18],[1,1.18],[.41,1.09],[0,1]]){
    h.photoAt(0,h.win.innerHeight*(.8-.68*phase));
    h.events.scroll.fn();h.events.scroll.fn();assert.equal(h.frames.length,1);h.flush();
    closeTo(scales(h)[0],expected);assert.deepEqual(scales(h).slice(1),[1,1,1]);
    assert(!h.story.classes.has('is-scroll'));assert(h.scenes.every(s=>!s.inert&&s.attrs['aria-hidden']===undefined));
  }
  assert.deepEqual(h.images.map(image=>image.hasAttribute('srcset')),[true,false,false,false]);
  assert.equal(h.images[0].attrs.sizes,'(max-width: 899px) 118vw, 100vw');assert.equal(h.images[0].attrs.loading,'eager');
  h.photoAt(0,-600);h.photoAt(1,h.win.innerHeight*.8);h.photoAt(3,0);h.events.scroll.fn();h.flush();
  assert.deepEqual(h.images.map(image=>image.hasAttribute('srcset')),[true,true,false,false]);
  assert.equal(scales(h)[3],1);assert.equal(h.frames.length,0);assert(!h.events.wheel);
});
test('reduced motion disables pinning and all photo zoom from initial load',async()=>{
  for(const matches of [true,false]){
    const h=harness({matches,motionMatches:false});h.photoAt(0,0);await h.ready();
    assert(!h.story.classes.has('is-scroll'));assert(!h.story.classes.has('is-photo-zoom'));
    assert.deepEqual(scales(h),[1,1,1,1]);assert(h.scenes.every(s=>!s.inert&&s.attrs['aria-hidden']===undefined));
    h.events.scroll.fn();h.events.resize.fn();assert.equal(h.frames.length,0);
  }
});
test('changing reduced motion immediately resets zoom and pending frames cannot restore it',async()=>{
  for(const matches of [true,false]){
    const h=harness({matches});await h.ready();
    if(matches)h.atPhase(.7);else{h.photoAt(0,0);h.events.scroll.fn();h.flush();}
    assert(scales(h)[0]>1);h.events.scroll.fn();assert.equal(h.frames.length,1);
    h.motion.matches=false;h.motion.change();
    assert.deepEqual(scales(h),[1,1,1,1]);assert(!h.story.classes.has('is-photo-zoom'));assert(!h.story.classes.has('is-scroll'));
    h.flush();assert.deepEqual(scales(h),[1,1,1,1]);assert(h.scenes.every(s=>!s.inert));
    h.motion.matches=true;h.motion.change();h.flush();closeTo(scales(h)[0],matches?1.35:1.18);
  }
});
test('calm-view button releases sticky and all scene links without storage',async()=>{
  const h=harness();await h.ready();h.toggle.listeners.click();assert.equal(h.toggle.attrs['aria-pressed'],'true');
  assert(!h.story.classes.has('is-scroll'));assert(h.scenes.every(s=>!s.inert));
  h.toggle.listeners.click();h.flush();assert(h.story.classes.has('is-scroll'));
});
test('calm view immediately clears desktop and mobile zoom despite a pending frame',async()=>{
  for(const matches of [true,false]){
    const h=harness({matches});await h.ready();
    if(matches)h.atPhase(.7);else{h.photoAt(0,0);h.events.scroll.fn();h.flush();}
    assert(scales(h)[0]>1);h.events.scroll.fn();assert.equal(h.frames.length,1);
    h.toggle.listeners.click();assert.equal(h.toggle.attrs['aria-pressed'],'true');
    assert.deepEqual(scales(h),[1,1,1,1]);assert(!h.story.classes.has('is-photo-zoom'));
    h.flush();assert.deepEqual(scales(h),[1,1,1,1]);assert(!h.story.classes.has('is-scroll'));
    h.toggle.listeners.click();h.flush();closeTo(scales(h)[0],matches?1.35:1.18);
  }
});
test('late / failed images retain stacked content rather than abruptly pinning after entry',async()=>{
  const late=harness();late.geometry.top=-200;await late.ready();assert(!late.story.classes.has('is-scroll'));assert(late.scenes.every(s=>!s.inert));
  const failed=harness({failImage:true});await failed.ready();assert(!failed.story.classes.has('is-scroll'));
  assert(!late.story.classes.has('is-photo-zoom'));assert.deepEqual(scales(late),[1,1,1,1]);
  for(const matches of [true,false]){
    const failed=harness({matches,failImage:true});failed.photoAt(0,0);await failed.ready();
    assert(!failed.story.classes.has('is-photo-zoom'));assert.deepEqual(scales(failed),[1,1,1,1]);
    failed.events.scroll.fn();assert.equal(failed.frames.length,0);
  }
});
test('reload and back navigation retain timeline geometry at restored positions',async()=>{
  for(const navigation of ['reload','back_forward']){const h=harness({top:-1136,navigation});await h.ready();assert(h.story.classes.has('is-scroll'));assert.equal(h.count.textContent,'02 / 04');}
  for(const navigation of ['reload','back_forward']){
    const h=harness({top:-3196*1.41/3.7,navigation});await h.ready();
    closeTo(scales(h)[0],1.35);closeTo(scales(h)[1],1.175);assert.deepEqual(scales(h).slice(2),[1,1]);
    h.atPhase(.41);closeTo(scales(h)[0],1.175);assert.deepEqual(scales(h).slice(1),[1,1,1]);
  }
});
test('HTML has usable photographs, captions and six demo links before any script runs',()=>{
  const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/class="scene-fallback"/g)||[]).length,4);
  assert.equal((html.match(/class="exhibition-card"/g)||[]).length,6);
  assert(html.includes('Se alle nettsidene'));
  const css=readFileSync(new URL('../../css/marketing.css',import.meta.url),'utf8');
  assert.match(css,/\.is-scroll \.scene-sticky\{position:sticky/);
  assert.match(css,/@media\(max-width:899px\),\(max-height:639px\),\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/scroll-snap/);
});

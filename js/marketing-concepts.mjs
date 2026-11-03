const reel=document.querySelector('.concept-reel');
const scenes=[...reel.querySelectorAll('.concept-scene')];
const choices=[...reel.querySelectorAll('[data-concept]')];
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const footer=reel.querySelector('.concept-current');
const small=matchMedia('(max-width:700px)');
let trigger,observer,frame=0,active=-1,progress=0,near=false;
const clamp=(x)=>Math.max(0,Math.min(1,x));
// Settled positions are separated by a readable hold, then a scroll-distance-driven reveal.
export const stages=[{start:0,hold:.18,length:.65},{start:.65,hold:.48,length:1},{start:1.65,hold:.48,length:1},{start:2.65,hold:.65,length:.65}];
export const duration=3.3;
export function sceneState(p){const x=clamp(p)*duration;let from=0;for(let i=1;i<stages.length;i++)if(x>=stages[i].start)from=i;const stage=stages[from];const blend=from===3?0:clamp((x-stage.start-stage.hold)/(stage.length-stage.hold));return {from,to:Math.min(3,from+1),blend,active:blend>.5?Math.min(3,from+1):from};}
function activateImage(i){const img=scenes[i]?.querySelector('img');if(!img)return;img.loading='eager';if(img.dataset.sceneSrcset){img.srcset=img.dataset.sceneSrcset;delete img.dataset.sceneSrcset;}}
for(const scene of scenes){const img=scene.querySelector('img');img.addEventListener('error',()=>img.parentElement.dataset.imageFailed='true');if(img.complete&&!img.naturalWidth)img.parentElement.dataset.imageFailed='true';}
function render(p){progress=p;const s=sceneState(p);const changed=active!==s.active;
 if(changed){footer.querySelector('.current-name').textContent=scenes[s.active].querySelector('.concept-caption h3').textContent;footer.querySelector('.current-destination').textContent=footer.querySelector('.current-name').textContent;footer.querySelector('.current-kind').textContent=scenes[s.active].querySelector('.concept-caption p').textContent;const target=scenes[s.active].querySelector('.concept-open');footer.querySelector('a').href=target.href;footer.querySelector('a').setAttribute('aria-label','Åpne konsept — '+footer.querySelector('.current-name').textContent);const focused=scenes.findIndex(el=>el.contains(document.activeElement));if(focused>=0&&focused!==s.active)choices[s.active].focus({preventScroll:true});active=s.active;if(near||trigger?.isActive){activateImage(active);if(active<3)activateImage(active+1);}}
 scenes.forEach((scene,i)=>{const paint=i===s.from||(s.blend>0&&i===s.to);scene.dataset.paint=String(paint);scene.dataset.active=String(i===active);scene.inert=i!==active;scene.setAttribute('aria-hidden',String(i!==active));
 scene.style.zIndex=String(i);scene.style.clipPath=i===s.to&&s.blend>0?`inset(${(1-s.blend)*100}% 0 0 0)`:'none';
 // Move only the incoming composition; outgoing text remains sharp and legible.
 scene.style.transform=i===s.to&&s.blend>0?`translateY(${(1-s.blend)*(small.matches?16:36)}px)`:'none';
 });choices.forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
 reel.dataset.progress=p.toFixed(5);
}
function go(index,hash=true){if(!trigger)return;const p=(stages[index].start+.08)/duration;if(hash)history.pushState(null,'',`#${scenes[index].id}`);scrollTo({top:trigger.start+(trigger.end-trigger.start)*p,behavior:'instant'});window.ScrollTrigger.update();render(p);}
choices.forEach((a,i)=>a.addEventListener('click',e=>{if(!trigger||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();go(i);}));
function hashJump(){const i=scenes.findIndex(s=>`#${s.id}`===location.hash);if(i>=0&&trigger)go(i,false);}
window.addEventListener('hashchange',hashJump);window.addEventListener('popstate',hashJump);
function reset(){trigger?.kill();trigger=null;observer?.disconnect();reel.classList.remove('concepts-motion');footer.hidden=true;scenes.forEach(s=>{s.inert=false;s.removeAttribute('aria-hidden');s.removeAttribute('data-paint');s.removeAttribute('data-active');s.style.removeProperty('transform');s.style.removeProperty('clip-path');s.style.removeProperty('z-index');});choices.forEach(a=>a.removeAttribute('aria-current'));active=-1;}
function start(){const was=!!trigger,old=progress,inView=was&&trigger.isActive;reset();
 if(reduced.matches||innerHeight<700||!window.ScrollTrigger||!window.gsap){scenes.forEach((_,i)=>activateImage(i));return;}
 window.gsap.registerPlugin(window.ScrollTrigger);
 // Static markup stays intact; only nonadjacent responsive sources are deferred.
 scenes.forEach((s,i)=>{const img=s.querySelector('img');if(i>1&&img.getAttribute('srcset')){img.dataset.sceneSrcset=img.getAttribute('srcset');img.removeAttribute('srcset');}});
 reel.classList.add('concepts-motion');footer.hidden=false;
 trigger=window.ScrollTrigger.create({trigger:reel,start:'top top',end:()=>`+=${reel.offsetHeight-innerHeight}`,onUpdate:self=>render(self.progress),onRefresh:self=>render(self.progress)});
 observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){near=true;activateImage(Math.max(0,active));if(active<3)activateImage(active+1);observer.disconnect();}},{rootMargin:'700px'});observer.observe(reel);
 if(inView){scrollTo({top:trigger.start+(trigger.end-trigger.start)*old,behavior:'instant'});window.ScrollTrigger.update();}else hashJump();render(trigger.progress);
}
await document.fonts.ready;
// Wait for the existing opening to finish its own geometry setup before calculating the sequence.
if(!document.documentElement.classList.contains('motion')&&!reduced.matches)await new Promise(resolve=>{let n=0;const id=setInterval(()=>{if(document.documentElement.classList.contains('motion')||++n>45){clearInterval(id);resolve();}},100);});
function safeStart(){try{start();delete reel.dataset.setupFailure;}catch{reset();reel.dataset.setupFailure='static-fallback';}}
safeStart();reduced.addEventListener('change',safeStart);let width=innerWidth,height=innerHeight;
window.addEventListener('resize',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(width!==innerWidth||Math.abs(height-innerHeight)>100){width=innerWidth;height=innerHeight;safeStart();}else window.ScrollTrigger?.refresh();});});
window.addEventListener('pageshow',()=>window.ScrollTrigger?.refresh());

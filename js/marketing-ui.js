const root=document.documentElement,toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('#mainNav'),mobile=matchMedia('(max-width:700px)');
function close(focus=false){toggle.setAttribute('aria-expanded','false');nav.hidden=mobile.matches;if(focus)toggle.focus()}
function sync(){toggle.hidden=!mobile.matches;close()}
root.classList.add('nav-ready');sync();clearTimeout(window.navigationWatchdog);root.classList.remove('js-pending');mobile.addEventListener('change',sync);toggle.addEventListener('click',()=>{let open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));nav.hidden=open});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')close(true)});nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});document.addEventListener('click',e=>{if(!e.target.closest('.marketing-header nav'))close()});document.addEventListener('focusin',e=>{if(!e.target.closest('.marketing-header nav'))close()});
const reduced=matchMedia('(prefers-reduced-motion:reduce)');let dispose,generation=0;
async function start(){
 const current=++generation;dispose?.();dispose=null;
 if(reduced.matches){clearTimeout(window.motionWatchdog);root.classList.remove('motion-pending');return}
 try{
  const m=await import('./marketing-motion.mjs');
  const isCurrent=()=>current===generation&&!reduced.matches;
  if(!isCurrent())return;
  // Image/font loading may outlive this preference change. Stale mounts must not touch the scene.
  const cleanup=await m.mount({isCurrent});
  if(!isCurrent()){cleanup();return}
  dispose=cleanup;clearTimeout(window.motionWatchdog);root.classList.remove('motion-pending');
 }catch{if(current===generation){root.classList.remove('motion','motion-pending');root.dataset.motion='static-fallback'}}
}
start();reduced.addEventListener('change',start);

// The homepage remains readable if this optional continuation cannot load.
import('./marketing-continuation.mjs').then(m=>m.mount()).catch(()=>{});

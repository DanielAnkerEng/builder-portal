export function mount(){
 const media=matchMedia('(prefers-reduced-motion: reduce)');let animations=[];
 function start(){animations.forEach(a=>a.kill());animations=[];const{gsap,ScrollTrigger}=window;if(!gsap||!ScrollTrigger||media.matches){document.querySelectorAll('.work-image>img').forEach(e=>e.style.removeProperty('transform'));return}
 gsap.registerPlugin(ScrollTrigger);
 // One continuous photograph framing gesture per work; text always stays still/readable.
 document.querySelectorAll('.work-image').forEach(frame=>{const tween=gsap.fromTo(frame.querySelector('img'),{scale:1.08},{scale:1.02,ease:'none',scrollTrigger:{trigger:frame,start:'top bottom',end:'bottom top',scrub:true}});animations.push({kill(){tween.scrollTrigger?.kill();tween.kill();}})});
 }
 start();media.addEventListener('change',start);return()=>{animations.forEach(a=>a.kill());media.removeEventListener('change',start)};
}

import {monitorCorners,visibleGlass,laptopOutline,imageGeometry,polygon} from './marketing-monitor-geometry.mjs';
// Map one live 1000 × 700 webpage from the illustrated monitor to a readable canvas.
export function quadMatrix(q,W=1000,H=700){
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q,dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
 const den=dx1*dy2-dx2*dy1,g=Math.abs(den)<1e-9?0:(dx3*dy2-dx2*dy3)/den,h=Math.abs(den)<1e-9?0:(dx1*dy3-dx3*dy1)/den;
 // Homogeneous scaling leaves every projected point unchanged. It avoids browser
 // CSS parsing quantization of the tiny perspective coefficients (g/W and h/H).
 const m=[(x1-x0+g*x1)/W,(y1-y0+g*y1)/W,0,g/W,(x3-x0+h*x3)/H,(y3-y0+h*y3)/H,0,h/H,0,0,1,0,x0,y0,0,1];
 return `matrix3d(${m.map(v=>v*1000).join(',')})`;
}
export async function mount({isCurrent=()=>true}={}){
 const{gsap,ScrollTrigger}=window;if(!gsap||!ScrollTrigger)throw Error('Motion unavailable');await document.fonts.ready;await Promise.all([...document.querySelectorAll('.studio img,.site-image img')].map(img=>img.decode()));if(!isCurrent()||matchMedia('(prefers-reduced-motion:reduce)').matches)return()=>{};gsap.registerPlugin(ScrollTrigger);
 const root=document.documentElement,stage=document.querySelector('.stage'),plane=document.querySelector('.delivery-plane'),intro=document.querySelector('.hero-copy'),cta=plane.querySelector('.site-cta'),nav=plane.querySelector('.site-nav'),labels=[...document.querySelectorAll('.delivery-stage')];
 const el=s=>plane.querySelector(s),pieces=[...plane.children],animated=[...pieces,...nav.querySelectorAll('a'),el('.site-image img'),el('.site-brand span'),...labels,...document.querySelectorAll('.studio,.studio-foreground,.hero-shade,.hero-copy')];let tl,trigger,raf;
 function clear(){trigger?.kill();tl?.kill();trigger=tl=null;gsap.set(animated,{clearProps:'all'});root.classList.remove('motion');intro.inert=false;intro.removeAttribute('aria-hidden');plane.inert=false;plane.removeAttribute('aria-hidden');nav.inert=false;cta.inert=false;labels.forEach(e=>e.removeAttribute('aria-hidden'));plane.removeAttribute('style');document.querySelector('.scene-anchor').removeAttribute('style');}
 function build(){clear();if(innerHeight<700){root.dataset.deliveryMode='static-short';return;}root.classList.add('motion');root.dataset.deliveryMode='animated';
 const w=stage.clientWidth,h=stage.clientHeight,small=w<=700,W=small?480:1000,H=700,px=(W-380)/2;
 const full=Math.min((w-(small?26:110))/W,(h-(small?290:300))/H,1.14);
 const fy=small?205:Math.max(205,(h-H*full)/2+20);
 // Keep the top edge below the explanation throughout the tablet/desktop morph.
 const phone=Math.min((w-34)/380,(small?h-280:h-fy-100)/H,1),py=small?190:fy;
 const geometry=imageGeometry(document.querySelector('.studio img'),stage);
 const start=monitorCorners.map(geometry.point);
 document.querySelector('.monitor-backing').style.clipPath=polygon(visibleGlass.map(geometry.point));
 document.querySelector('.studio-foreground img').style.clipPath=polygon(laptopOutline.map(geometry.point));
 const rect=(x,y,s)=>[[x,y],[x+W*s,y],[x+W*s,y+H*s],[x,y+H*s]];
 const middle=rect((w-W*full)/2,fy,full),end=rect(small?(w-W*phone)/2:w*.70-W*phone/2,py,phone),pos={assembly:0,phone:0,reveal:0};
 const map=()=>{const q=start.map((v,i)=>v.map((n,j)=>{const a=n+(middle[i][j]-n)*pos.assembly;return a+(end[i][j]-a)*pos.phone}));plane.style.transform=quadMatrix(q,W,H);document.querySelector('.studio-foreground').style.clipPath=polygon(q);};
 gsap.set(plane,{width:W,height:H});gsap.set(el('.site-image'),{width:W,height:H});gsap.set(el('.site-paper'),{width:W,height:H});
 const bodySize=Math.max(20,Math.ceil(14/Math.min(full,phone))),touch=Math.max(64,Math.ceil(45/Math.min(full,phone)));
 gsap.set(el('.site-copy'),{fontSize:bodySize});gsap.set(el('.delivery-service-copy'),{fontSize:bodySize});gsap.set(nav,{fontSize:Math.max(18,Math.ceil(13/Math.min(full,phone)))});gsap.set(nav.querySelectorAll('a'),{minHeight:touch});gsap.set(cta,{minHeight:touch,fontSize:Math.max(18,Math.ceil(14/Math.min(full,phone)))});
 // Layout reads/width changes occur only here. Scroll changes transforms, a crop, opacity and text color.
 const base=small?{brand:[28,25],nav:[28,70],title:[28,205],copy:[28,365],cta:[28,455],line:[28,548],serviceTitle:[28,565],serviceCopy:[28,615],foot:[28,680]}:{brand:[55,32],nav:[540,20],title:[65,220],copy:[65,345],cta:[65,432],line:[55,523],serviceTitle:[55,550],serviceCopy:[545,545],foot:[55,665]};
 const selectors={brand:'.site-brand',nav:'.site-nav',title:'.site-title',copy:'.site-copy',cta:'.site-cta',line:'.delivery-rule',serviceTitle:'.delivery-service-title',serviceCopy:'.delivery-service-copy',foot:'.site-footer'};
 for(const[k,[left,top]]of Object.entries(base))gsap.set(el(selectors[k]),{left,top});
 gsap.set(el('.site-title'),{width:small?424:650});
 // Counter the wider physical monitor while docked; restore the mobile layout during lift.
 if(small){gsap.set(el('.site-image img'),{width:1000,scaleX:.48,transformOrigin:'0 0'});}gsap.set(el('.delivery-rule'),{width:small?424:890});gsap.set(el('.site-footer'),{width:W-56});
 if(small){gsap.set(cta,{width:270});gsap.set(el('.site-footer'),{fontSize:12});}
 gsap.set(labels.slice(0,2),{top:small?104:fy-88});if(!small)gsap.set(labels[2],{top:py+H*phone*.30});
 const phaseTwoCrop=small?'inset(135px 25px 355px 275px)':'inset(106px 55px 190px 560px)';
 const phoneCrop=`inset(130px ${W-px-356}px 410px ${px+24}px)`;
 const phoneTargets={brand:[px+24,24],nav:[px+24,64],title:[px+24,300],copy:[px+24,410],cta:[px+24,482],line:[px+24,559],serviceTitle:[px+24,575],serviceCopy:[px+24,615]};
 tl=gsap.timeline({paused:true,defaults:{ease:'none'}});
 tl.to(pos,{assembly:1,duration:.23,onUpdate:map},.08).to('.hero-copy',{opacity:0,y:-25,duration:.05},.045).to('.studio,.studio-foreground',{opacity:0,duration:.25},.08).to('.hero-shade',{opacity:0,duration:.20},.08)

 .fromTo(el('.site-title'),{x:small?220:110,scaleX:small?.48:1},{x:0,scaleX:1,duration:.23},.08)
 .fromTo(el('.site-brand'),{scaleX:small?.48:1},{scaleX:1,duration:.23},.08)
 .fromTo(labels[0],{opacity:0,y:10},{opacity:1,y:0,duration:.06},.24)
 .to(el('.site-image'),{clipPath:phaseTwoCrop,duration:.14,ease:'power2.inOut'},.42).to(el('.site-shade'),{opacity:0,duration:.04},.56)
 .to(pos,{reveal:1,duration:.14,ease:'power2.inOut'},.42).to(el('.site-brand span'),{color:'#48632a',duration:.12},.42)
 .to(el('.site-title'),{x:0,y:small?-65:-86,scale:small?.55:.74,duration:.14,ease:'power2.inOut'},.42)
 .fromTo(nav,{opacity:0,y:-14},{opacity:1,y:0,duration:.05},.48).fromTo(el('.site-copy'),{opacity:0,y:15},{opacity:1,y:0,duration:.05},.49)
 .fromTo(cta,{opacity:0,y:16},{opacity:1,y:0,duration:.05},.51).fromTo([el('.delivery-rule'),el('.delivery-service-title'),el('.delivery-service-copy'),el('.site-footer')],{opacity:0,y:15},{opacity:1,y:0,duration:.05},.52)
 .set(labels[0],{opacity:0},.46).set(labels[1],{opacity:1,y:0},.46)
 .set(labels[1],{opacity:0},.80).set(labels[2],{opacity:1,y:0},.80)
 .to(pos,{phone:1,duration:.15,onUpdate:map,ease:'power2.inOut'},.70)
 .to(el('.site-paper'),{clipPath:`inset(0 ${px}px 0 ${px}px)`,duration:.07,ease:'power1.inOut'},.73)
 .to(el('.site-image'),{clipPath:small?'inset(130px 25px 410px 275px)':'inset(130px 55px 410px 560px)',duration:.03,ease:'power2.inOut'},.70)
 .to(el('.site-image'),{clipPath:phoneCrop,duration:.07,ease:'power1.inOut'},.73)
 .to(el('.site-image img'),{x:small?0:-170,y:-95,duration:.03,ease:'power2.inOut'},.70)
 .to(el('.site-footer'),{opacity:0,duration:.04},.70);
 for(const[k,[x,y]]of Object.entries(phoneTargets)){
  // First create a vertical lane below the cropped image, then align the narrow column.
  const early=k==='title'&&!small?{scale:.48}:{};
  const late=k==='title'&&small?{scale:.67}:k==='line'?{scaleX:332/(small?424:890)}:{};
  tl.to(el(selectors[k]),{y:y-base[k][1],...early,duration:.03,ease:'power2.inOut'},.70);
  tl.to(el(selectors[k]),{x:x-base[k][0],...late,duration:.07,ease:'power1.inOut'},.73);
 }
 if(small)tl.to(el('.site-image img'),{scaleX:1,duration:.23},.08);
 // Contact keeps a touch-sized area; its width is already within the phone column.
 tl.to({}, {duration:.15},.85);
 const update=s=>{const p=s.progress;
 // A two-tone ink mask follows the exact edge of the paper reveal. It is not a decorative gradient:
 // text over paper is dark, text over the still-shaded image stays light, including stopped frames.
 for(const [node,left,scale] of [[el('.site-title'),base.title[0],1+((small?.55:.74)-1)*pos.reveal],[el('.site-brand'),base.brand[0],1]]){
  if(p<=.42||p>=.56){node.style.color=p<=.42?'#f3f0e8':'#171b1b';node.style.removeProperty('background-image');node.style.removeProperty('background-clip');node.style.removeProperty('-webkit-background-clip');}
  else{const edge=((small?275:560)*pos.reveal-left)/scale;node.style.color='transparent';node.style.backgroundImage=`linear-gradient(90deg,#171b1b ${edge}px,#f3f0e8 ${edge}px)`;node.style.backgroundClip='text';node.style.webkitBackgroundClip='text';}
 }
root.dataset.progress=p.toFixed(5);intro.inert=p>=.095;intro.setAttribute('aria-hidden',String(p>=.095));plane.removeAttribute('aria-hidden');const enabled=p>=.56;if(!enabled&&plane.contains(document.activeElement))document.querySelector('.nav-contact').focus({preventScroll:true});nav.inert=!enabled;cta.inert=!enabled;
 const stageNumber=p<.42?0:p<.80?1:2;labels.forEach((node,i)=>{const visible=(i===0&&p>=.24&&p<.46)||(i===1&&p>=.46&&p<.80)||(i===2&&p>=.80);node.style.visibility=visible?'visible':'hidden';node.setAttribute('aria-hidden',String(!visible));});root.dataset.deliveryStage=p<.24?'opening':String(stageNumber+1);
 document.querySelector('.phase-label').textContent=p<.2?'Design, innhold og utvikling / Wreach':p<.46?'Et uttrykk som passer bedriften.':p<.76?'Innhold og en tydelig vei videre.':'Samme innhold. Tilpasset mobilen.';
 };
 document.querySelector('.scene-anchor').style.top=`${(document.querySelector('.sequence').offsetHeight-h)*.35}px`;
 map();trigger=ScrollTrigger.create({trigger:'.sequence',start:'top top',end:'bottom bottom',animation:tl,scrub:true,onUpdate:update});ScrollTrigger.refresh();ScrollTrigger.update();map();update(trigger);
 }
 function resize(){cancelAnimationFrame(raf);raf=requestAnimationFrame(build);}
 try{build();}catch(error){clear();throw error;}window.addEventListener('resize',resize);
 return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);clear();delete root.dataset.deliveryMode;delete root.dataset.deliveryStage;};
}

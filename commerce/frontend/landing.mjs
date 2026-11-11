// Public, explicitly limited sampler. The purchased 12-card game stays on the server.
export const samples=[
 {title:'Rask i replikken',text:'{name}: Nevn tre ting som alltid forsvinner på en fest. De andre teller rolig til ti. Klarte du det? Ta ett poeng.'},
 {title:'Hvem i rommet?',text:'Hvem ville laget den rareste spillelisten? Alle peker samtidig. Den som får flest stemmer, velger neste låt. Uavgjort? Velg sammen.'},
 {title:'Historien går',text:'{name} starter en historie med tre ord. Gå en runde; hver person legger til tre nye ord. Avslutt så dramatisk dere kan.'}
];
function sceneCard(i){return `<div class="bs-card bs-card-${i}" data-card="${i}"><div class="bs-card-turn"><div class="bs-card-face bs-card-back"><span class="bs-card-corner">Bli Støgg</span><strong>Bli<br>Støgg.</strong><span class="bs-card-bottom">Hele gjengen er med.</span></div><div class="bs-card-face bs-card-front"><span class="bs-card-corner">Et kort fra demospillet</span><h3>Hvem i<br>rommet?</h3><p>Hvem ville laget den rareste spillelisten?</p><p>Alle peker samtidig. Den som får flest stemmer, velger neste låt.</p><span class="bs-card-bottom">Uavgjort? Velg sammen.</span></div></div></div>`;}
export function landingMarkup(){return `
<section class="bs-story" id="story" aria-labelledby="story-title" data-scene="bli-stogg-cards">
 <div class="bs-stage">
  <div class="bs-opening bs-scene-copy"><h1 id="story-title">Dårlige svar.<br>God stemning.</h1><p>Drikkeleker for voksne. Én skjerm, hele gjengen. Med eller uten alkohol.</p><a class="button bs-primary" href="#demo">Prøv et demospill <span aria-hidden="true">↗</span></a><p class="bs-small">Tre kort. Ingen innlogging.</p></div>
  <div class="bs-reading bs-scene-copy" aria-hidden="true"><h2>Hvem tør å <br>svare først?</h2><p>Les høyt. Pek samtidig.<br>Det finnes ingen fasit.</p><p class="bs-sr-only">Hvem ville laget den rareste spillelisten? Alle peker samtidig. Den som får flest stemmer, velger neste låt. Uavgjort? Velg sammen.</p></div>
  <div class="bs-ending bs-scene-copy" aria-hidden="true"><h2>Samme gjeng.<br>Nytt format.</h2><p>Digitalt samles dere rundt én skjerm. <br>Med fysiske kort samles dere rundt bordet.</p><p class="bs-concept">Fysisk kortspill er et produktkonsept. <br>Utforming og innhold er ikke endelig.</p><a href="#products" class="bs-text-link">Se eksempelproduktene <span aria-hidden="true">↗</span></a></div>
  <div class="bs-world" aria-hidden="true">
   <div class="bs-phone"><div class="bs-phone-edge"></div><div class="bs-phone-screen"><div class="bs-camera"></div><div class="bs-phone-brand">Bli Støgg<span>Demospill</span></div><div class="bs-phone-bottom"><span>Alex · Sam · Kim</span><b>Neste kort <span>↗</span></b><span>Poeng eller alkoholfritt. Du velger.</span></div></div></div>
   <div class="bs-card-aperture">${Array.from({length:5},(_,i)=>sceneCard(i)).join('')}</div>
  </div>
  <p class="bs-scene-note">Én mobil. Hele gjengen.</p>
  <a class="bs-skip-scene" href="#demo">Gå rett til demoen <span aria-hidden="true">↓</span></a>
 </div>
 <div class="bs-static-story"><div><h2>Et kort setter<br>i gang kvelden.</h2><p>«Hvem ville laget den rareste spillelisten?» Alle peker samtidig. Den som får flest stemmer, velger neste låt.</p></div><div><h2>Skjerm eller<br>kortstokk.</h2><p>Det digitale spillet bruker én felles skjerm. Det fysiske kortspillet er et produktkonsept for bordet. Samme sosiale idé, to ulike formater.</p><a href="#products">Se eksempelproduktene</a></div></div>
</section>
<section class="bs-demo bs-section" id="demo" aria-labelledby="demo-title">
 <div class="bs-demo-intro"><h2 id="demo-title">Mindre smalltalk.<br>Mer sånn her.</h2><p>Tre kort fra pilotspillet. Samle et par venner, les høyt og se hvor det bærer.</p><noscript><p>Slå på JavaScript for å bruke navn og kortknapper. Eksempeloppgaven over kan leses uten.</p></noscript><details class="bs-demo-settings"><summary>Endre spillernavn <span aria-hidden="true">+</span></summary><form class="bs-demo-names"><label for="demo-names">Hvem spiller? Ett navn per linje.</label><textarea id="demo-names" rows="3" maxlength="371" disabled>Alex\nSam\nKim</textarea><button type="submit" class="button bs-primary" disabled>Bruk navnene</button><p class="bs-demo-feedback" role="status"></p></form></details><p class="bs-small">Navnene blir bare i denne fanen. Bruk poeng eller alkoholfritt. Alle kan hoppe over, uten å forklare.</p></div>
 <div class="bs-demo-game" data-ui><div class="bs-demo-counter"><span>Demospill</span><span data-demo-count>Kort 1 av 3</span></div><article class="bs-demo-card" aria-live="polite" aria-atomic="true"><span class="bs-card-corner">Bli Støgg</span><h3 data-demo-title>${samples[0].title}</h3><p data-demo-text>${samples[0].text.replace('{name}','Alex')}</p><span class="bs-card-bottom">Ingen fasit. Ingen plikt.</span></article><div class="bs-demo-actions"><button type="button" data-demo-next disabled>Neste kort <span aria-hidden="true">↗</span></button><button type="button" class="secondary" data-demo-skip disabled>Hopp over</button></div><p class="bs-demo-end" role="status"></p></div>
</section>
<section class="bs-how bs-section" id="how"><h2>Samle gjengen.<br>Tre enkle steg.</h2><ol><li><h3>Samle gjengen.</h3><p>To til tolv navn. Én mobil, ett nettbrett eller en større skjerm som alle kan se.</p></li><li><h3>Les høyt.</h3><p>Ta kortene på tur. Svar kjapt, tenk høyt eller la historien ta en helt annen retning.</p></li><li><h3>Spill på deres måte.</h3><p>Poeng, alkoholfritt eller det dere har i glasset. Et «pass» er alltid et helt greit svar.</p></li></ol></section>
<section class="bs-products bs-section" id="products"><div class="bs-section-heading"><h2>Skjerm eller bord.<br>Dere velger.</h2><p>Eksempelprodukter under utvikling.<br>Testpriser og produktkonsepter, ingen ekte salg.</p></div><div data-landing-products><p class="bs-catalog-message" role="status">Laster eksempelproduktene …</p></div></section>
<section class="bs-about bs-section" id="about"><h2>Slipp deg løs.<br>Med gjengen.</h2><div><p class="bs-statement">Bli Støgg lager en anledning til å si noe annet enn «hva driver du med om dagen?»</p><p>Vi utvikler digitale og fysiske drikkeleker for voksne. Litt frekke spørsmål, rare svar og god plass til å stå over. Du bestemmer selv hva som er i glasset.</p></div></section>
<section class="bs-faq bs-section" id="faq"><h2>Før dere setter i gang.</h2><div>
<details><summary>Må vi drikke alkohol?<span aria-hidden="true">+</span></summary><p>Nei. Spill med poeng, alkoholfri drikke eller bare for samtalen. Ingen oppgave krever alkohol, og alle kan hoppe over.</p></details>
<details><summary>Trenger alle sin egen mobil?<span aria-hidden="true">+</span></summary><p>Nei. Første digitale spill er laget for én felles skjerm. Skriv inn navnene og ta kortene på tur. Spillerrom med flere mobiler er ikke del av denne piloten.</p></details>
<details><summary>Kan vi kjøpe spillene nå?<span aria-hidden="true">+</span></summary><p>Dette er en lokal pilot. Produkter og priser er eksempler, Stripe er ikke koblet til, og ingen ekte betaling eller utsending kan gjennomføres.</p></details>
<details><summary>Hva er den fysiske kortstokken?<span aria-hidden="true">+</span></summary><p>Et produktkonsept. Endelig utforming, spillinnhold, pris, lager og levering er ikke bestemt.</p></details>
<details><summary>Hvor finner jeg et kjøpt digitalt spill?<span aria-hidden="true">+</span></summary><p>Under Mine spill, på kontoen som kjøpte spillet. Tilgangen krever bekreftet betaling. De eksisterende demokjøpene i denne lokale piloten er tydelig merket som simulerte.</p><a href="#account">Gå til Mine spill</a></details>
</div></section>
<section class="bs-finale bs-section"><h2>Greit. Hvem<br>begynner?</h2><a class="button" href="#demo">Prøv et demospill <span aria-hidden="true">↗</span></a><p>Samme skjerm. Helt ulike svar.</p></section>`;}

const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const mix=(a,b,t)=>a+(b-a)*t;
const phase=(p,a,b)=>clamp((p-a)/(b-a));
const blend=(a,b,t)=>a.map((point,i)=>point.map((v,j)=>mix(v,b[i][j],t)));
// Projective mapping adapted from the approved Wreach monitor-lift implementation.
// Both the single phone and its card origins share this exact mapping.
export function quadMap(q,W,H){
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q,dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
 const den=dx1*dy2-dx2*dy1,g=Math.abs(den)<1e-9?0:(dx3*dy2-dx2*dy3)/den,h=Math.abs(den)<1e-9?0:(dx1*dy3-dx3*dy1)/den;
 const a=(x1-x0+g*x1)/W,b=(y1-y0+g*y1)/W,c=(x3-x0+h*x3)/H,d=(y3-y0+h*y3)/H;
 return {css:`matrix3d(${[a,b,0,g/W,c,d,0,h/H,0,0,1,0,x0,y0,0,1].map(v=>v*1000).join(',')})`,point:(x,y)=>[(a*x+c*y+x0)/(g*x/W+h*y/H+1),(b*x+d*y+y0)/(g*x/W+h*y/H+1)]};
}
function plane(cx,cy,w,h,{scale=1,x=0,y=0,z=0,depth=0}={}){
 const rad=Math.PI/180,sx=Math.sin(x*rad),cxr=Math.cos(x*rad),sy=Math.sin(y*rad),cyr=Math.cos(y*rad),sz=Math.sin(z*rad),cz=Math.cos(z*rad);
 return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([u,v])=>{u*=scale;v*=scale;let yy=v*cxr,zz=v*sx;const xx=u*cyr+zz*sy;zz=-u*sy+zz*cyr;const rx=xx*cz-yy*sz,ry=xx*sz+yy*cz,f=1400/(1400-zz-depth);return[cx+rx*f,cy+ry*f];});
}
function cardInPhone(mapping,i){const angle=(i-2)*4*Math.PI/180,cx=150+(i-2)*4,cy=293+(i-2)*5;return [[-90,-127],[90,-127],[90,127],[-90,127]].map(([x,y])=>mapping.point(cx+x*Math.cos(angle)-y*Math.sin(angle),cy+x*Math.sin(angle)+y*Math.cos(angle)));}
function polygon(q){return `polygon(${q.map(([x,y])=>`${x.toFixed(3)}px ${y.toFixed(3)}px`).join(',')})`;}

export function mountLanding(root){
 const story=root.querySelector('.bs-story');if(!story)return()=>{};
 const stage=story.querySelector('.bs-stage'),phone=story.querySelector('.bs-phone'),aperture=story.querySelector('.bs-card-aperture'),cards=[...story.querySelectorAll('.bs-card')],turns=cards.map(c=>c.firstElementChild);
 const opening=story.querySelector('.bs-opening'),reading=story.querySelector('.bs-reading'),ending=story.querySelector('.bs-ending'),note=story.querySelector('.bs-scene-note');
 const media=matchMedia('(prefers-reduced-motion: reduce)');let geometry,raf=0,disposed=false,active=false,start=0,span=1,geometryVersion=0,lastFrameKey;
 function setup(){if(disposed)return;const w=stage.clientWidth,h=stage.clientHeight,small=w<700,tablet=w>=700&&w<1050,short=innerHeight<620;
  active=!media.matches&&!short;story.classList.toggle('is-motion',active);story.dataset.motion=active?'scroll':media.matches?'reduced':'short';
  start=story.getBoundingClientRect().top+scrollY;span=Math.max(1,story.offsetHeight-h);
  const phoneScale=small?Math.min((w-130)/300,(h-450)/650,.59):Math.min((h-150)/600,tablet?.86:1.02);
  const phoneCenter=small?[w*.60,h*.68]:[w*.72,h*(tablet?.66:.53)];
  const dock=plane(...phoneCenter,300,600,{scale:Math.max(.40,phoneScale),x:4,y:-13,z:small?6:8}),mapping=quadMap(dock,300,600);
  const screen=[[13,13],[287,13],[287,587],[13,587]].map(([x,y])=>mapping.point(x,y));
  const sx=small?Math.min(1,(w-72)/220):1.23;
  const fanSpecs=small?[[.10,.56,.65,-25,-22],[.24,.53,.61,-18,14],[.52,.62,sx,8,-13],[.82,.54,.62,25,-20],[.92,.72,.63,20,25]]:[[.18,.57,.94,-24,-18],[.34,.40,.90,-12,20],[.56,.59,1.25,9,-15],[.77,.37,.91,19,-22],[.87,.69,.88,25,22]];
  const holdSpecs=small?[[.07,.57,.58,-24,-20],[.18,.52,.59,-14,16],[.50,.61,sx,0,0],[.88,.53,.59,20,-15],[.94,.73,.56,23,15]]:[[.17,.59,.88,-24,-20],[.32,.43,.86,-12,16],[.53,.60,1.23,0,0],[.77,.40,.87,20,-15],[.87,.72,.80,23,15]];
  const pose=spec=>plane(w*spec[0],h*spec[1],220,310,{scale:spec[2],z:spec[3],y:spec[4],x:5,depth:60});
  const stack=cards.map((_,i)=>plane(w*(small?.55:.71)+(i-2)*3,h*(small?.68:tablet?.70:.56)+(i-2)*5,220,310,{scale:small?Math.min(.92,(w-116)/250):1.30,x:8,y:-18,z:-9,depth:65}));
  geometry={w,h,small,dock,screen,starts:cards.map((_,i)=>cardInPhone(mapping,i)),fan:fanSpecs.map(pose),hold:holdSpecs.map(pose),stack,phoneEnd:plane(w*(small?.17:.90),h*.67,300,600,{scale:small?.43:.64,x:12,y:-28,z:12}),full:[[0,0],[w,0],[w,h],[0,h]]};
  geometryVersion++;render();
 }
 function visible(node,opacity){node.style.opacity=String(opacity);const hidden=opacity<.02;if(hidden&&node.contains(document.activeElement))story.querySelector('.bs-skip-scene').focus({preventScroll:true});node.inert=hidden;node.style.visibility=hidden?'hidden':'visible';node.setAttribute('aria-hidden',String(hidden));}
 function render(){raf=0;if(disposed||!geometry)return;const {w,h,small,dock,screen,starts,fan,hold,stack,phoneEnd,full}=geometry,p=active?clamp((scrollY-start)/span):0;
  const frameKey=`${p}:${geometryVersion}`;if(frameKey===lastFrameKey)return;lastFrameKey=frameKey;
  story.dataset.progress=p.toFixed(5);story.dataset.phase=p<.12?'opening':p<.38?'lift':p<.52?'turn':p<.75?'read':p<.94?'gather':'deck';
  phone.style.transform=quadMap(blend(dock,phoneEnd,phase(p,.14,.80)),300,600).css;phone.style.opacity=String(1-phase(p,.24,.66)*.80);
  aperture.style.clipPath=polygon(blend(screen,full,phase(p,.12,.34)));
  cards.forEach((card,i)=>{const delay=i===2?0:Math.abs(i-2)*.012;let q=blend(starts[i],fan[i],phase(p,.12+delay,.38+delay));q=blend(q,hold[i],phase(p,.40,.52));q=blend(q,stack[i],phase(p,.75,.94));card.style.transform=quadMap(q,220,310).css;turns[i].style.transform=`rotateY(${i===2?180*(phase(p,.38,.52)-phase(p,.75,.89)):0}deg)`;});
  const o=1-phase(p,.07,.18),r=phase(p,.27,.38)*(1-phase(p,.73,.80)),e=phase(p,.80,.91);
  visible(opening,o);visible(reading,active?r:0);visible(ending,active?e:0);
  const noteText=p<.25?'Én mobil. Hele gjengen.':p<.75?'Ta den tiden dere vil. Alle kan hoppe over.':'Fysisk kortspill · produktkonsept';if(note.textContent!==noteText)note.textContent=noteText;
  note.style.opacity=String(p<.12?1:p<.30?1-phase(p,.12,.22):phase(p,.32,.40));
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(render);}
 let resizeFrame=0;function resize(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(setup);}
 const observer=new ResizeObserver(resize);observer.observe(stage);
 media.addEventListener('change',resize);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',resize,{passive:true});
 setup();story.classList.add('is-ready');
 // Keep geometry stable if a late font finishes; never create a second controller.
 document.fonts.ready.then(()=>{if(!disposed)resize();});
 let index=0,players=['Alex','Sam','Kim'],skipped=0;
 const demo=root.querySelector('.bs-demo'),title=demo.querySelector('[data-demo-title]'),text=demo.querySelector('[data-demo-text]'),count=demo.querySelector('[data-demo-count]'),next=demo.querySelector('[data-demo-next]'),skip=demo.querySelector('[data-demo-skip]');
 function show(){const complete=index>=samples.length;count.textContent=complete?'Demoen er ferdig':`Kort ${index+1} av ${samples.length}`;title.textContent=complete?'Der satt stemningen.':samples[index].title;text.textContent=complete?`Tre kort, ${skipped} hoppet over. Klar for en runde til?`:samples[index].text.replace('{name}',players[index%players.length]);next.innerHTML=complete?'Spill igjen':'Neste kort <span aria-hidden="true">↗</span>';skip.disabled=complete;demo.querySelector('.bs-demo-end').textContent=complete?'Dette var tre eksempler fra pilotspillet. Ingen kjøp eller betaling er startet.':'';}
 function click(event){const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-demo-next')){if(index>=samples.length){index=0;skipped=0;}else index++;show();}if(b.hasAttribute('data-demo-skip')&&index<samples.length){skipped++;index++;show();}}
 function submit(event){if(!event.target.matches('.bs-demo-names'))return;event.preventDefault();const field=demo.querySelector('#demo-names'),names=field.value.split('\n').map(n=>n.trim()).filter(Boolean),feedback=demo.querySelector('.bs-demo-feedback');if(names.length<2||names.length>12||names.some(n=>n.length>30||/[<>\x00-\x1f]/.test(n))||new Set(names.map(n=>n.toLowerCase())).size!==names.length){field.setAttribute('aria-invalid','true');feedback.textContent='Bruk 2–12 ulike navn, maksimalt 30 tegn per navn.';return;}field.removeAttribute('aria-invalid');players=names;index=skipped=0;show();feedback.textContent='Navnene er klare. Les det første kortet høyt.';}
 demo.querySelectorAll('button,textarea').forEach(control=>control.disabled=false);
 demo.addEventListener('click',click);demo.addEventListener('submit',submit);
 return()=>{disposed=true;cancelAnimationFrame(raf);cancelAnimationFrame(resizeFrame);observer.disconnect();media.removeEventListener('change',resize);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',resize);demo.removeEventListener('click',click);demo.removeEventListener('submit',submit);};
}

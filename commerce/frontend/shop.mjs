import {landingMarkup,mountLanding} from './landing.mjs';
import { createClient } from '/vendor/supabase.js';
const main=document.querySelector('main'),notice=document.querySelector('#notice');
let disposeLanding=mountLanding(main);
const config=await fetch('/api/config').then(r=>{if(!r.ok)throw Error('Konfigurasjon utilgjengelig');return r.json();}).catch(()=>{const target=main.querySelector('[data-landing-products]');target.innerHTML='<p role="alert">Butikktjenesten er utilgjengelig. Demospillet fungerer fortsatt. <a href="/">Last butikken på nytt</a>.</p>';document.querySelectorAll('.masthead a[href="#account"],.masthead a[href="#cart"]').forEach(a=>{a.href="#products";});return null;});
if(config){
const authReturn=location.hash.includes('access_token=');
const auth=createClient(config.supabaseUrl,config.anonKey,{auth:{storageKey:'bli-stogg-buyer',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let session=(await auth.auth.getSession()).data.session,products=[],cart=readCart(),poll,renderId=0;
let identityVersion = 0;
let requests = new AbortController();
let resumableOrder;
if(authReturn)history.replaceState(null,'','#account');
function readCart(){try{return JSON.parse(localStorage.getItem('bli-stogg-cart')||'[]').filter(i=>typeof i.product_id==='string'&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=10);}catch{return [];}}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('nb-NO',{style:'currency',currency:'NOK',minimumFractionDigits:0,maximumFractionDigits:2}).format(n/100);
const errors={LOCAL_MIGRATION_REQUIRED:'Butikken venter på en lokal databaseoppdatering før betaling kan starte.',CHECKOUT_UNCONFIRMED:'Betalingsforsøket er ikke avklart. Ingen betaling er bekreftet her. Se ordren under Mine spill, eller prøv samme handlekurv igjen.',PAYMENT_MODE_CONFLICT:'Betalingsmiljøet er endret. Last siden på nytt. Historiske demokjøp gir ikke Stripe-testtilgang.',AUTH_REQUIRED:'Logg inn for å se dine kjøp.',STRIPE_NOT_CONFIGURED:'Stripe-testmiljøet er ikke koblet til ennå. Ingen betaling er startet.',PRODUCT_UNAVAILABLE:'Et produkt er endret eller er ikke tilgjengelig. Oppdater handlekurven.',DIGITAL_QUANTITY:'Det digitale spillet kan kjøpes én gang per konto.',INVALID_CART:'Handlekurven er ugyldig. Fjern varen og legg den til igjen.',ALREADY_OWNED:'Du eier allerede spillet. Du finner det under Mine spill.',INVALID_PLAYERS:'Skriv 2–12 ulike navn, maksimalt 30 tegn per navn.',DUPLICATE_PLAYERS:'Bruk ulike navn på spillerne.',ROUND_CHANGED:'Runden ble endret i en annen fane. Last den inn på nytt.',ACCESS_REQUIRED:'Denne kontoen har ikke tilgang til spillet.',NOT_FOUND:'Dette kjøpet eller spillet er ikke tilgjengelig for kontoen din.',CHECKOUT_RECONCILIATION_REQUIRED:'Et tidligere betalingsforsøk må avstemmes før du prøver igjen. Ordren er bevart under Mine spill.',TRY_LATER:'For mange forsøk. Vent ett minutt og prøv igjen.'};
async function api(path, data) {
  const signal = requests.signal;
  const current = (await auth.auth.getSession()).data.session;
  signal.throwIfAborted();
  const response = await fetch(path, {
    signal, method: data ? 'POST' : 'GET',
    headers: {...(current ? {Authorization:'Bearer '+current.access_token} : {}),
      ...(data ? {'Content-Type':'application/json'} : {})},
    body: data ? JSON.stringify(data) : undefined
  });
  const result = await response.json();
  signal.throwIfAborted();
  if (!response.ok) {
    const error = new Error(errors[result.error] || 'Handlingen kunne ikke fullføres. Prøv igjen.');
    error.code = result.error;
    if (result.error === 'OPEN_DIGITAL_ORDER' && /^[a-f0-9-]{36}$/.test(result.order_id))
      error.orderId = result.order_id;
    throw error;
  }
  return result;
}
function toast(text){notice.textContent=text;notice.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>notice.hidden=true,6000);}
function persist(changed=true){localStorage.setItem('bli-stogg-cart',JSON.stringify(cart));document.querySelector('#cart-link').textContent=`Handlekurv (${cart.reduce((n,i)=>n+i.quantity,0)})`;if(changed) sessionStorage.removeItem('bli-stogg-checkout-key');}
function art(p){return `<div class="product-art ${p.kind}" aria-label="Illustrert ${p.kind==='digital'?'spillkort':'produktutkast'}"><div class="play-card"><strong>Bli<br>Støgg.</strong><span>${p.kind==='digital'?'På én skjerm':'På bordet'}<br>Hele gjengen er med.</span></div><p class="art-note">Produktkonsept · foreløpig utforming</p></div>`;}
function productRow(p){return `<article class="product-row">${art(p)}<div><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><p class="price">${money(p.unit_amount)}<small>Midlertidig testpris · ${p.kind==='digital'?'digitalt engangskjøp':'fysisk testprodukt'}</small></p><a class="button" href="#product/${p.id}">Se ${p.kind==='digital'?'spillet':'testproduktet'} →</a></div></article>`;}
function head(title,copy=''){return `<header class="page-head"><h1>${title}</h1>${copy?`<p>${copy}</p>`:''}</header>`;}
function empty(text){return `<div class="panel"><p>${text}</p><a href="#products">Se spillene →</a></div>`;}
const landingPages=new Set(['home','products','demo','how','about','faq','main']);
function home(){main.classList.add('bs-home');if(!main.querySelector('.bs-story')){main.innerHTML=landingMarkup();disposeLanding=mountLanding(main);}const target=main.querySelector('[data-landing-products]');if(products.length)target.innerHTML=products.map(productRow).join('');}

function product(id){const p=products.find(p=>p.id===id);if(!p){main.innerHTML=empty('Produktet finnes ikke i pilotbutikken.');return;}
 main.innerHTML=head(esc(p.name),p.kind==='digital'?'Et selskapsspill på én felles skjerm.':'Fysisk testprodukt. Ingen utsending i piloten.')+`<div class="split">${art(p)}<div class="panel"><h2>${p.kind==='digital'?'Klar for en runde?':'Kort på bordet.'}</h2><p>${esc(p.description)}</p><p class="price">${money(p.unit_amount)}<small>Midlertidig testpris</small></p><button data-add="${p.id}">Legg i handlekurv</button><p class="muted">${p.kind==='digital'?'Du må logge inn før testbetaling. Bekreftet betaling gir tilgang under Mine spill.':'Lager, fraktkostnad og leveringstid er ikke bestemt.'}</p></div></div>`;}
function cartRows() {
  return cart.map(i => ({i, p:products.find(p => p.id === i.product_id)}));
}
function cartView() {
  const rows = cartRows();
  const blocked = rows.some(({p}) => !p);
  const total = rows.reduce((sum,{i,p}) => sum + (p ? i.quantity * p.unit_amount : 0),0);
  main.innerHTML=head('Handlekurven.', 'Testpriser. Innhold og priser kontrolleres på serveren før betaling.')+(rows.length?`<div class="split"><div class="panel">${rows.map(({i,p})=>!p ? `<article class="cart-row"><div><h3>Utilgjengelig vare</h3><p>Fjern varen for å gå videre til betaling.</p></div><button class="text-action" data-remove="${esc(i.product_id)}">Fjern utilgjengelig vare</button></article>` : `<article class="cart-row"><div><h3>${esc(p.name)}</h3><p>${p.kind==='digital'?'Digital tilgang':'Fysisk testprodukt'}</p><p>${money(p.unit_amount)} per stk.</p></div><div><label for="qty-${p.id}">Antall</label><input id="qty-${p.id}" data-quantity="${p.id}" type="number" min="1" max="${p.kind==='digital'?1:10}" value="${i.quantity}"></div><button class="text-action" data-remove="${p.id}" aria-label="Fjern ${esc(p.name)}">Fjern</button></article>`).join('')}</div><div class="panel"><h2>Til betaling</h2><p class="price">${money(total)}<small>Foreløpig sum · NOK</small></p><p>${config.mode==='test'?'Stripe Checkout åpnes i testmodus. Bruk bare testkort.':'Stripe-testmiljøet er ikke koblet til ennå. Ingen betaling kan gjennomføres.'}</p>${blocked?'<p role="status">Fjern utilgjengelige varer før du fortsetter.</p>':session?'<button id="checkout">Gå til Stripe-testbetaling →</button>':'<a class="button" href="#login">Logg inn for å fortsette →</a>'}<p class="muted">Engangskjøp prøves i piloten. Endelig prismodell er ikke bestemt. Ingen ekte betalinger eller varer sendes.</p><div id="checkout-error" role="alert"></div></div></div>`:empty('Handlekurven er tom.'));}
function login(){main.innerHTML=head('Finn tilbake.','Logg inn med en e-postlenke. Kjøpene følger kontoen din.')+`<form id="login-form" class="panel narrow"><h2>Din e-postadresse</h2><p>Kun syntetiske adresser i denne lokale piloten, for eksempel gjest@test.invalid. E-posten havner i den lokale testinnboksen.</p><label for="email">E-post</label><input id="email" type="email" autocomplete="email" required placeholder="gjest@test.invalid"><div class="actions"><button>Send innloggingslenke</button><a class="button secondary" href="http://127.0.0.1:56324" target="_blank" rel="noopener">Åpne testinnboksen</a></div><p id="login-status" role="status"></p></form>`;}
const stateText={pending:'Venter på betalingsbekreftelse',paid:'Betaling bekreftet',failed:'Betalingen mislyktes',expired:'Betalingen utløp'};
async function account(ticket){if(!session)return login();const [library,orders]=await Promise.all([api('/api/library'),api('/api/orders')]);if(ticket!==renderId)return;
 main.innerHTML=head('Mine spill.','Her finner du spilltilgangen og ordrene som hører til denne kontoen.')+`<div class="actions"><a class="button secondary" href="#cart">Til handlekurven</a><button class="text-action" id="logout">Logg ut</button></div><section class="section"><h2>Spillbibliotek</h2>${library.length?library.map(e=>`<article class="panel order-row"><div><h3>${esc(e.name)}</h3><p>Digital tilgang for denne kontoen.</p></div><a class="button" href="#setup/${e.id}">Spill →</a></article>`).join(''):empty('Ingen spilltilgang ennå. Tilgang kommer først når betalingen er bekreftet.')}</section><section class="section"><h2>Ordrene dine</h2>${orders.length?orders.map(o=>`<article class="panel order-row"><div><h3>${stateText[o.status]}</h3><p>${o.commerce_order_items.map(i=>esc(i.name)).join(' + ')}</p><p>${money(o.total)} · ${new Date(o.created_at).toLocaleDateString('nb-NO')}</p>${o.commerce_payments?.provider==='simulation'?'<p class="muted">Simulert testhendelse – ikke Stripe-betaling</p>':''}</div><a href="#order/${o.id}">Se ordre →</a></article>`).join(''):empty('Du har ingen ordre ennå.')}</section>`;}
async function order(id,ticket){if(!session)return login();const o=await api('/api/orders/'+id);if(ticket!==renderId)return;
 if (['expired','failed'].includes(o.status)) sessionStorage.removeItem('bli-stogg-checkout-key');
 resumableOrder = o.status === 'pending' && config.mode === 'test' && o.payment_provider === 'stripe_test' ? o : null;
 const access = o.active_game_products?.length ? 'Aktiv spilltilgang: '+o.active_game_products.map(esc).join(', ')+'.' :
   o.status === 'paid' ? 'Ordren er registrert som betalt. Se gjeldende spilltilgang under Mine spill.' :
   'Ingen spilltilgang gis før serveren har bekreftet betaling.';
 const canceled=location.hash.includes('cancelled=1');main.innerHTML=head('Din ordre.',stateText[o.status])+`<div class="panel narrow"><p class="status">${stateText[o.status]}</p>${canceled&&o.status==='pending'?'<p>Du avbrøt Checkout. Ordren er fortsatt ubetalt. Et avbrutt nettleserbesøk bekrefter ingen betaling.</p>':''}${o.commerce_payments?.provider==='simulation'?'<p class="status">Simulert testhendelse. Ingen betaling er gjennomført hos Stripe.</p>':''}<h2>Dette ligger i ordren</h2>${o.commerce_order_items.map(i=>`<p>${esc(i.name)} × ${i.quantity} · ${money(i.unit_amount*i.quantity)}</p>`).join('')}<p class="price">${money(o.total)}</p><p>${access}</p>${o.fulfillment!=='not_required'?'<p>Fysisk levering: '+(o.fulfillment==='awaiting_payment'?'venter på betaling.':'testordre, ikke sendt.')+'</p>':''}<div class="actions"><a class="button" href="#account">Mine spill og kjøp →</a><button class="secondary" id="refresh">Oppdater status</button>${resumableOrder?'<button id="resume-checkout">Fortsett med denne ordren →</button>':''}</div></div>`;
 if(o.status==='pending')poll=setTimeout(()=>route(false),6000);}
function setup(id){if(!session)return login();main.innerHTML=head('Hvem er med?','To til tolv spillere. Én felles skjerm.')+`<form id="game-setup" class="panel narrow" data-entitlement="${esc(id)}"><h2>Spillere og regler</h2><label for="players">Ett navn per linje</label><textarea id="players" required placeholder="Alex&#10;Sam"></textarea><p>Ta tur etter tur. Bruk poeng, vann eller valgfri alkoholfri drikke. Alle kan stå over uten å forklare. Ingen oppgave krever alkohol eller fysisk kontakt.</p><p>Midlertidig pilotinnhold · 12 kort per runde.</p><button>Start spillet →</button><p id="game-error" role="alert"></p></form>`;}
async function game(id,ticket){const g=await api('/api/game/'+id);if(ticket!==renderId)return;main.innerHTML=`<div class="game-shell">${head(g.complete?'Takk for runden.':'Støgg på skjerm.')}<div class="game-progress"><span>${g.complete?'Runden er ferdig':`Kort ${g.position+1} av ${g.total}`}</span><span>${g.players.map(esc).join(' · ')}</span></div><article class="game-card">${g.complete?`<h2>Samme gjeng.<br>En runde til?</h2><p>${g.endedEarly?'Runden ble avsluttet før alle kortene var vist.':`Dere gikk gjennom ${g.total} kort. ${g.skipped} ble hoppet over.`} Håper dere fant noe å le av.</p>`:`<h2>${esc(g.card.title)}</h2><p>${esc(g.card.text)}</p>`}</article>${g.complete?'<div class="actions"><a class="button" href="#account">Start en ny runde →</a></div>':`<div class="game-actions"><button data-game="next" data-id="${g.id}" data-version="${g.version}">Neste kort →</button><button class="secondary" data-game="skip" data-id="${g.id}" data-version="${g.version}">Hopp over</button><button class="text-action" data-game="end" data-id="${g.id}" data-version="${g.version}">Avslutt</button></div>`}<p class="muted">Poeng og alkoholfritt fungerer like godt. Alle kan hoppe over.</p></div>`;}
async function route(focus=true){clearTimeout(poll);resumableOrder=null;const ticket=++renderId;const [page,id]=(location.hash.slice(1)||'home').split('/');const isLanding=landingPages.has(page)||!['product','cart','login','account','order','setup','game'].includes(page);try{
 if(isLanding){home();if(!products.length){try{products=(await api('/api/catalog')).products;if(ticket!==renderId)return;home();}catch(e){if(ticket!==renderId)return;main.querySelector('[data-landing-products]').innerHTML=`<p role="alert">Eksempelproduktene kunne ikke lastes. Demospillet fungerer fortsatt.</p><button id="refresh">Prøv igjen</button>`;}}
 if(focus){const target=main.querySelector('#'+page);if(target){target.scrollIntoView();target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}else{window.scrollTo(0,0);main.focus({preventScroll:true});}}return;}
 disposeLanding?.();disposeLanding=null;main.classList.remove('bs-home');
 if(!products.length || page === 'cart') {
   const fresh = await api('/api/catalog');
   if(ticket!==renderId)return;
   products = fresh.products;
 }
 if(ticket!==renderId)return;
 if(page==='product')product(id);else if(page==='cart')cartView();else if(page==='login')login();else if(page==='account')await account(ticket);else if(page==='order')await order(id?.split('?')[0],ticket);else if(page==='setup')setup(id);else if(page==='game')await game(id,ticket);else{home();}
 if(focus){window.scrollTo(0,0);main.focus({preventScroll:true});}
 }catch(e){if(ticket!==renderId)return;main.innerHTML=head('Det stoppet opp.')+`<div class="panel"><p role="alert">${esc(e.message)}</p><button id="refresh">Prøv igjen</button> <a href="#account">Mine spill</a></div>`;}}

main.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||b.closest('.bs-demo'))return;const identity=identityVersion;try{
 if(b.dataset.add){const p=products.find(p=>p.id===b.dataset.add),existing=cart.find(i=>i.product_id===p.id);if(existing){if(p.kind==='physical')existing.quantity=Math.min(10,existing.quantity+1);}else cart.push({product_id:p.id,quantity:1});persist();toast('Lagt i handlekurven.');return;}
 if(b.dataset.remove){cart=cart.filter(i=>i.product_id!==b.dataset.remove);persist();cartView();return;}
 if(b.id==='refresh')return route(false);if(b.id==='logout'){await auth.auth.signOut();return;}
 if (b.id === 'checkout' || b.id === 'resume-checkout') {
   let input;
   if (b.id === 'resume-checkout') {
     if (!resumableOrder) return;
     input = {request_key:resumableOrder.request_key, items:resumableOrder.cart};
   } else {
     const rows = cartRows();
     if (!rows.length || rows.some(({p}) => !p)) return cartView();
     let key = sessionStorage.getItem('bli-stogg-checkout-key');
     if (!key) {key=crypto.randomUUID();sessionStorage.setItem('bli-stogg-checkout-key',key);}
     input = {request_key:key, items:rows.map(({i}) => i)};
   }
   b.disabled=true;
   const result = await api('/api/checkout',input);
   if (identity !== identityVersion) return;
   if (result.url) location.assign(result.url); else location.hash='order/'+result.order_id;
 }
 if(b.dataset.game){b.disabled=true;await api('/api/game/'+b.dataset.id,{version:Number(b.dataset.version),action:b.dataset.game});await route(false);}
 }catch(err){
   if(identity!==identityVersion)return;
   if(err.code==='PRODUCT_UNAVAILABLE' && location.hash==='#cart') await route(false);
   if(identity!==identityVersion)return;
   const target=document.querySelector('#checkout-error');
   if(err.orderId && target) {
     const link=document.createElement('a');link.href='#order/'+err.orderId;link.textContent='Åpne den ventende ordren';
     target.replaceChildren('Spillet ligger allerede i en ventende ordre. ',link);
     return;
   }
   if(target){target.className='error';target.textContent=err.message;}else toast(err.message);}finally{b.disabled=false;}});
main.addEventListener('change',e=>{const id=e.target.dataset.quantity;if(!id)return;const qty=Number(e.target.value),p=products.find(p=>p.id===id);if(!Number.isInteger(qty)||qty<1||qty>(p.kind==='digital'?1:10)){toast('Velg et gyldig antall.');cartView();return;}cart.find(i=>i.product_id===id).quantity=qty;persist();cartView();});
main.addEventListener('submit',async e=>{if(!['login-form','game-setup'].includes(e.target.id))return;e.preventDefault();const identity=identityVersion,form=e.target,b=form.querySelector('button');b.disabled=true;try{
 if(form.id==='login-form'){const email=form.querySelector('#email').value.trim();if(!email.endsWith('@test.invalid'))throw Error('Bruk bare en syntetisk @test.invalid-adresse i piloten.');const {error}=await auth.auth.signInWithOtp({email,options:{emailRedirectTo:config.shopOrigin+'/'}});if(error)throw Error('Lenken kunne ikke sendes. Vent litt og prøv igjen.');form.querySelector('#login-status').textContent='Lenken er sendt til den lokale testinnboksen. Åpne den for å logge inn.';}
 if(form.id==='game-setup'){const g=await api('/api/game',{entitlement_id:form.dataset.entitlement,players:form.querySelector('#players').value.split('\n').map(v=>v.trim()).filter(Boolean)});location.hash='game/'+g.id;}
 }catch(err){if(identity!==identityVersion)return;const target=form.querySelector('[role="alert"],[role="status"]');target.textContent=err.message;}finally{b.disabled=false;}});
auth.auth.onAuthStateChange((event, nextSession) => {
  const changed = session?.user?.id !== nextSession?.user?.id;
  session = nextSession;
  if (!changed) return;
  identityVersion++;
  renderId++;
  requests.abort();
  requests = new AbortController();
  clearTimeout(poll);
  resumableOrder = null;
  notice.hidden = true;
  notice.textContent = '';
  sessionStorage.removeItem('bli-stogg-checkout-key');
  const page = location.hash.slice(1).split('/')[0];
  if (!main.classList.contains('bs-home')) main.replaceChildren();
  if (['account','order','game','setup','login'].includes(page) || location.hash.includes('access_token=')) {
    main.replaceChildren();
    history.replaceState(null,'',nextSession ? '#account' : '#login');
  }
  // Supabase releases its Auth lock after this synchronous callback.
  setTimeout(() => route(false), 0);
});
document.addEventListener('click',event=>{if(event.target.closest('a[href="#home"]')&&location.hash==='#home'){event.preventDefault();route();}});
// A reload restores the browser's scroll position; a retained #home or section
// hash must not turn that restoration into a new navigation to the anchor.
const restoring=performance.getEntriesByType('navigation')[0]?.type==='reload';
window.addEventListener('hashchange',()=>route());persist(false);await route(Boolean(location.hash)&&!restoring);

}

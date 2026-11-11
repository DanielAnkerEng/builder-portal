// Run against the generated assets, with synthetic identities and in-memory responses only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const origin='https://store.test.invalid';
const productId='00000000-0000-4000-8000-000000000001', missingId='00000000-0000-4000-8000-000000000002';
const product={id:productId,kind:'physical',name:'Testkort',description:'',unit_amount:5000};
const sessionSdk=`
let session={user:{id:'A'},access_token:'A'};
let callback;
export function createClient(){return {auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>callback=fn}}}
window.changeIdentity=(id,event)=>{
  session=id?{user:{id},access_token:id}:null;
  callback(event,session);
};`;
const newContext=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
const page=await newContext.newPage();
page.setDefaultTimeout(7000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let checkout,orderReads=0,hold=false,release,started;
let delayedStarted=new Promise(resolve=>{started=resolve;});
const root=new URL('../../commerce/public/',import.meta.url);
const order=(identity,status='paid')=>({id:productId,status,payment_provider:'stripe_test',request_key:missingId,cart:[{product_id:productId,quantity:1}],
  fulfillment:'not_required',created_at:'2026-11-01',total:5000,active_game_products:[],commerce_order_items:[{name:'Ordre '+identity,kind:'physical',quantity:1,unit_amount:5000}]});
try{
  await newContext.route('**/*',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    assert.equal(url.origin,origin);
    const json=x=>route.fulfill({json:x});
    const identity=route.request().headers().authorization?.slice(7);
    if(path==='/vendor/supabase.js')return route.fulfill({contentType:'text/javascript',body:sessionSdk});
    if(path==='/font.woff2')return route.fulfill({contentType:'font/woff2',body:await readFile(new URL('../../assets/marketing/manrope-latin.woff2',root))});
    if(['/','/app.js','/style.css'].includes(path)){
      const file=path==='/'?'index.html':path.slice(1);
      return route.fulfill({contentType:{'index.html':'text/html','app.js':'text/javascript','style.css':'text/css'}[file],body:await readFile(new URL(file,root))});
    }
    if(path==='/api/config')return json({mode:'test',supabaseUrl:origin,anonKey:'synthetic',shopOrigin:origin});
    if(path==='/api/catalog')return json({products:[product]});
    if(path==='/api/library')return json([{name:'Bibliotek '+identity,id:productId}]);
    if(path==='/api/orders')return json([order(identity)]);
    if(path==='/api/orders/'+productId){
      orderReads++;
      if(hold){
        hold=false;started();await new Promise(resolve=>{release=resolve;});
        return json({...order(identity),commerce_order_items:[{name:'Forsinket ordre A',quantity:1,unit_amount:5000}]});
      }
      return json(order(identity,'pending'));
    }
    if(path==='/api/game/'+productId)return json({id:productId,players:['Spiller'],position:0,total:12,version:1,card:{title:'Privat spillkort '+identity,text:'Eksempel'}});
    if(path==='/api/checkout'){
      checkout=route.request().postDataJSON();
      return route.fulfill({status:409,json:{error:'OPEN_DIGITAL_ORDER',order_id:productId}});
    }
    return route.fulfill({status:404,body:''});
  });
  // A delayed transport can finish even after cancellation. Verify the render guard too.
  await page.addInitScript(({productId,missingId})=>{
    const originalFetch=window.fetch;
    window.fetch=(input,init={})=>originalFetch(input,{...init,signal:undefined});
    localStorage.setItem('bli-stogg-cart',JSON.stringify([{product_id:productId,quantity:2},{product_id:missingId,quantity:1}]));
  },{productId,missingId});
  await page.goto(origin+'/#account');
  await page.getByText('Ordre A',{exact:true}).waitFor();
  const switchNow=(id,event)=>page.evaluate(({id,event})=>{window.changeIdentity(id,event);return document.querySelector('main').textContent;},{id,event});
  assert.match(await switchNow('A','TOKEN_REFRESHED'),/Bibliotek A/);
  assert.equal((await switchNow(null,'SIGNED_OUT')).trim(),'');
  await page.getByLabel('E-post',{exact:true}).waitFor();
  await switchNow('A','SIGNED_IN');await page.getByText('Bibliotek A',{exact:true}).waitFor();
  await page.getByText('Se ordre →',{exact:true}).click();await page.getByText('Oppdater status',{exact:true}).waitFor();
  hold=true;
  await page.getByRole('button',{name:'Oppdater status'}).click();await delayedStarted;
  assert.equal((await switchNow('B','SIGNED_IN')).trim(),'');
  await page.getByText('Ordre B',{exact:true}).waitFor();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/orders/'+productId));
  release();await (await response).finished();await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert.doesNotMatch(await page.locator('main').innerText(),/Forsinket ordre A|Bibliotek A|Det stoppet opp/);
  assert.equal(orderReads,2);
  await page.getByText('Se ordre →',{exact:true}).click();
  await page.locator('#refresh').waitFor();
  const readsBeforeLogout=orderReads;
  assert.equal((await switchNow(null,'SIGNED_OUT')).trim(),'');
  await page.getByLabel('E-post',{exact:true}).waitFor();
  await page.waitForTimeout(6200); // The order poll interval is six seconds.
  assert.equal(orderReads,readsBeforeLogout);
  await switchNow('B','SIGNED_IN');
  await page.getByText('Bibliotek B',{exact:true}).waitFor();
  await page.evaluate(id=>location.hash='game/'+id,productId);await page.getByText('Privat spillkort B',{exact:true}).waitFor();
  assert.equal((await switchNow(null,'SIGNED_OUT')).trim(),'');await page.getByLabel('E-post',{exact:true}).waitFor();
  await switchNow('B','SIGNED_IN');await page.getByText('Bibliotek B',{exact:true}).waitFor();
  await page.locator('#cart-link').click();await page.getByText('Utilgjengelig vare',{exact:true}).waitFor();
  assert.equal(await page.locator('.cart-row').count(),2);assert.equal(await page.locator('#checkout').count(),0);
  await page.getByRole('button',{name:'Fjern utilgjengelig vare'}).click();
  assert.equal(await page.locator('.cart-row').count(),1);assert.match(await page.locator('.panel .price').innerText(),/100/);
  await page.locator('#checkout').click();await page.getByRole('link',{name:'Åpne den ventende ordren'}).click();
  assert.deepEqual(checkout.items,[{product_id:productId,quantity:2}]);
  await page.locator('#resume-checkout').click();
  await page.waitForFunction(()=>!document.querySelector('#resume-checkout')?.disabled);
  assert.equal(checkout.request_key,missingId);assert.deepEqual(checkout.items,[{product_id:productId,quantity:1}]);
  assert.deepEqual(errors,[]);
  console.log('PASS generated storefront: immediate account/order/library/game clearing, same-user refresh, delayed A after B, unavailable line removal/total/payload, overlap link and original checkout retry');
}finally{await browser.close();}

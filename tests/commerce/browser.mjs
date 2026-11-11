// Real Chromium UI, local Supabase Auth/TOTP/Postgres; simulated payment explicitly marked.
import { chromium } from '/Users/danieleng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile,mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { fixtures,client,check,service,totp,config } from './local-support.mjs';
import {createPilot} from '../../commerce/server.mjs';
import {requireSimulation} from '../../commerce/config.mjs';
import { simulatedPayment } from './simulation.mjs';
const evidence=process.env.BLI_STOGG_EVIDENCE_DIR?pathToFileURL(process.env.BLI_STOGG_EVIDENCE_DIR.replace(/\/$/,'')+'/'):new URL('../../../evidence/2026-11-03/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const f=fixtures(),report={browser:'Installed Google Chrome (Playwright)',physicalMobile:false,stripe:'SIMULATED — no Stripe account connected',checks:[],errors:[]};
requireSimulation(config);
assert.equal(config.supabaseUrl,'http://127.0.0.1:57321');
const app=await createPilot(config,{portal:4337,shop:4338});
const browser=await chromium.launch({channel:'chrome',headless:true});
// Keep the reviewed browser origins. Every request goes to the dedicated test
// server, API or inbox, including the second, signed-out context.
async function testContext(options) {
  const ctx=await browser.newContext({...options,serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
    const url=new URL(route.request().url());
    const ports={'4307':'4337','4308':'4338','56321':'57321','56324':'57324','57321':'57321'};
    if(url.hostname!=='127.0.0.1' || !ports[url.port])return route.abort();
    const surface=['4307','4308'].includes(url.port);
    url.port=ports[url.port];
    const headers={...route.request().headers(),host:url.host};
    if(surface && headers.origin) headers.origin=url.origin;
    const response=await route.fetch({url:url.href,headers,maxRedirects:0});
    if(url.pathname==='/api/config' && surface) {
      return route.fulfill({response,json:{...await response.json(),supabaseUrl:'http://127.0.0.1:56321',
        shopOrigin:'http://127.0.0.1:4308',portalOrigin:'http://127.0.0.1:4307'}});
    }
    return route.fulfill({response});
  });
  return ctx;
}
const context=await testContext({viewport:{width:1440,height:900}}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message.replace(/https?:\/\/\S+/g,'[url]')));
function pass(name){report.checks.push({name,result:'PASS'});console.log('PASS '+name);}
async function screenshot(name){await page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:!name.startsWith('wreach-commerce'),animations:'disabled'});}
async function noOverflow(){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
try{
 const person={email:'browser-'+randomUUID()+'@test.invalid',password:'Pilot!'+randomUUID()};f.buyer={...person,id:check(await service.auth.admin.createUser({...person,email_confirm:true})).user.id};
 for(const [width,height] of [[1440,900],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4308/');await page.getByRole('heading',{name:/Dårlige svar.*God stemning/}).waitFor();await noOverflow();await screenshot('home-'+width);pass('Storefront '+width+'px has no horizontal overflow');
 }
 await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 await page.evaluate(()=>document.querySelector('.skip').focus());await page.keyboard.press('Enter');assert.equal(await page.locator('main').evaluate(el=>el===document.activeElement),true);pass('Keyboard skip link reaches main');
 await page.getByRole('link',{name:'Se spillet →',exact:true}).click();await screenshot('product-390');
 await page.getByRole('button',{name:'Legg i handlekurv'}).click();await page.getByRole('link',{name:/Handlekurv/}).click();await page.getByRole('heading',{name:'Handlekurven.'}).waitFor();await noOverflow();await screenshot('cart-390');pass('Product -> cart at mobile width');
 await page.getByRole('link',{name:'Logg inn for å fortsette →'}).click();await page.getByLabel('E-post',{exact:true}).fill(f.buyer.email);await page.getByRole('button',{name:'Send innloggingslenke'}).click();await page.getByText('Lenken er sendt til den lokale testinnboksen.',{exact:false}).waitFor();
 let message;for(let i=0;i<10;i++){const mailbox=await fetch('http://127.0.0.1:57324/api/v1/messages').then(r=>r.json());message=mailbox.messages?.find(m=>m.To?.some(to=>to.Address===f.buyer.email));if(message)break;await new Promise(r=>setTimeout(r,300));}
 assert.ok(message,'Local email delivered');const mail=await fetch('http://127.0.0.1:57324/api/v1/message/'+message.ID).then(r=>r.json());const link=mail.HTML.match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1]?.replaceAll('&amp;','&');assert.ok(link,'Actual Supabase email confirmation link');
 await page.goto(link);await page.waitForURL('http://127.0.0.1:4308/**');await page.waitForFunction(()=>!location.hash.includes('access_token'));await page.goto('http://127.0.0.1:4308/#account');await page.getByRole('heading',{name:'Mine spill.'}).waitFor();
 const token=await page.evaluate(async()=>{const c=JSON.parse(localStorage.getItem('bli-stogg-buyer'));return c.access_token;});assert.ok(token);const buyer=client(token);pass('Real passwordless email login from isolated Mailpit');
 await page.goto('http://127.0.0.1:4308/#cart');await page.getByRole('button',{name:'Gå til Stripe-testbetaling →'}).click();await page.getByText('Stripe-testmiljøet er ikke koblet til ennå. Ingen betaling er startet.',{exact:true}).waitFor();pass('Unconfigured Stripe gives an honest, actionable error');
 const digital=f.products.find(p=>p.kind==='digital'),physical=f.products.find(p=>p.kind==='physical');
 let entitlement=check(await service.from('commerce_entitlements').select('*').eq('buyer_id',f.buyer.id).eq('product_id',digital.id)).at(0);
 if(!entitlement){const o=check(await buyer.rpc('commerce_reserve_order',{p_store:f.store.id,p_key:randomUUID(),p_cart:[{product_id:digital.id,quantity:1},{product_id:physical.id,quantity:1}]}));
  await page.goto('http://127.0.0.1:4308/#order/'+o.id+'?cancelled=1');await page.getByText('Venter på betalingsbekreftelse',{exact:true}).last().waitFor();await screenshot('order-pending-390');
  await page.goto('http://127.0.0.1:4308/');await simulatedPayment(o);pass('Simulated webhook grants access without visiting return page');
 }
 await page.goto('http://127.0.0.1:4308/#account');await page.getByRole('link',{name:'Spill →',exact:true}).click();await page.getByLabel('Ett navn per linje').fill('Alex\nSam\nKim');await page.getByRole('button',{name:'Start spillet →'}).click();await page.getByRole('button',{name:'Neste kort →'}).waitFor();await noOverflow();await screenshot('game-390');const gameUrl=page.url();
 await page.getByRole('button',{name:'Hopp over',exact:true}).click();await page.getByText('Kort 2 av 12',{exact:true}).waitFor();await page.reload();await page.getByText('Kort 2 av 12',{exact:true}).waitFor();pass('Game skip and position persist after reload');
 for(let n=2;n<=12;n++){await page.getByRole('button',{name:'Neste kort →'}).click();if(n<12)await page.getByText(`Kort ${n+1} av 12`,{exact:true}).waitFor();}
 await page.getByRole('heading',{name:'Takk for runden.'}).waitFor();await screenshot('game-complete-390');pass('Entire 12-card game finishes and offers another round');
 const anonymous=await testContext(),anon=await anonymous.newPage();await anon.goto(gameUrl);await anon.getByRole('heading',{name:'Det stoppet opp.'}).waitFor();assert.equal(await anon.getByText('Rask i replikken',{exact:true}).count(),0);await anonymous.close();pass('Anonymous browser cannot fetch protected game');
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4307/login.html');await page.getByLabel('E-post',{exact:true}).fill(f.admin.email);await page.locator('#password').fill(f.admin.password);await page.getByRole('button',{name:'Logg inn',exact:true}).click();await page.locator('#mfaCode').waitFor();await page.locator('#mfaCode').fill(totp(f.admin.totp));await page.getByRole('button',{name:'Bekreft og fortsett'}).click();await page.waitForURL('**/admin.html');
 await page.goto('http://127.0.0.1:4307/admin.html#customers');await page.getByRole('link',{name:/Bli Støgg/}).first().click();await page.getByRole('heading',{name:'Bli Støgg',exact:true}).waitFor();await screenshot('wreach-customer-1440');pass('Real Wreach password + TOTP login and persisted customer discovery');
 await page.getByRole('link',{name:'Butikk og ordre',exact:true}).click();await page.getByRole('heading',{name:'Bli Støgg – lokal pilot',exact:true}).waitFor();
 const description=page.locator(`[data-product="${digital.id}"] textarea`),original=await description.inputValue();await description.fill(original+' Nettlesertest.');await page.locator(`[data-product="${digital.id}"] button`).click();await page.getByText(/Lagret i lokal database/).waitFor();await page.reload();assert.equal(await page.locator(`[data-product="${digital.id}"] textarea`).inputValue(),original+' Nettlesertest.');
 await page.locator(`[data-product="${digital.id}"] textarea`).fill(original);await page.locator(`[data-product="${digital.id}"] button`).click();await page.getByText(/Lagret i lokal database/).waitFor();pass('Product edit saved through Wreach and survives reload');
 await screenshot('wreach-commerce-1440');await page.setViewportSize({width:390,height:844});await noOverflow();await screenshot('wreach-commerce-390');assert.equal(await page.locator('main').count(),1);await page.getByRole('heading',{name:'Testordrer',exact:true}).scrollIntoViewIfNeeded();await page.locator('td[data-label="Betaling"]').filter({hasText:'Simulert hendelse'}).first().waitFor();await page.locator('td').filter({hasText:'Fysisk testordre: ikke sendt'}).first().waitFor();await page.getByText('Aktiv spilltilgang',{exact:false}).first().waitFor();await page.locator('tbody tr').filter({hasText:'Simulert hendelse'}).filter({hasText:'Aktiv spilltilgang'}).filter({hasText:'Fysisk testordre: ikke sendt'}).first().scrollIntoViewIfNeeded();await page.screenshot({path:new URL('wreach-orders-390.png',evidence).pathname,fullPage:false,animations:'disabled'});pass('Admin distinguishes simulated payments, physical delivery and digital access');
 assert.equal(await page.locator('#shop-link').isVisible(),true);
 await page.goto('http://127.0.0.1:4307/commerce-admin.html?website='+f.otherStore.website_id);
 await page.getByRole('heading',{name:f.otherStore.name,exact:true}).waitFor();
 assert.equal(await page.locator('#shop-link').isVisible(),false);
 assert.equal(await page.locator('#shop-link').getAttribute('href'),null);
 pass('Shop shortcut is present for the served store only');
 assert.equal(report.errors.length,0,'No uncaught browser errors');
}finally{await writeFile(new URL('report.json',evidence),JSON.stringify(report,null,2));await browser.close();await app.close();}

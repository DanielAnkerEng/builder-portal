// Opens synthetic local demo sessions without printing passwords or tokens.
import { chromium } from '/Users/danieleng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixtures,client,check,totp } from '../tests/commerce/local-support.mjs';
const f=fixtures(),c=client(),login=check(await c.auth.signInWithPassword({email:f.buyer.email,password:f.buyer.password}));
const browser=await chromium.launch({channel:'chrome',headless:false}),context=await browser.newContext({viewport:null});
const store=await context.newPage();await store.goto('http://127.0.0.1:4308/');
await store.evaluate(session=>localStorage.setItem('bli-stogg-buyer',JSON.stringify(session)),login.session);
await store.goto('http://127.0.0.1:4308/#account');
const admin=await context.newPage();await admin.goto('http://127.0.0.1:4307/login.html');await admin.locator('#email').fill(f.admin.email);await admin.locator('#password').fill(f.admin.password);await admin.getByRole('button',{name:'Logg inn',exact:true}).click();await admin.locator('#mfaCode').waitFor();await admin.locator('#mfaCode').fill(totp(f.admin.totp));await admin.getByRole('button',{name:'Bekreft og fortsett'}).click();await admin.waitForURL('**/admin.html');await admin.goto('http://127.0.0.1:4307/admin.html#customer/'+f.company+'/overview');await store.bringToFront();
console.log('Åpnet to lokale demofaner med syntetiske kontoer. Betalingen i demospillet er simulert. Lukk dette Chrome-vinduet når du er ferdig.');
await new Promise(resolve=>browser.on('disconnected',resolve));

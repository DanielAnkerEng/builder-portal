// Run with the local Playwright installation, never with a hosted endpoint.
// Keep the actual restaurant tab alive across an operator restart of this server.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const workspace = path.resolve(__dirname, '../../../..');
const profile = path.join(workspace, 'privat-moteoppsett');
const evidenceRoot = path.join(workspace, 'evidence');
fs.mkdirSync(evidenceRoot,{recursive:true,mode:0o700});
const evidence = fs.mkdtempSync(path.join(evidenceRoot,'motetest-'));
const read = name => JSON.parse(fs.readFileSync(path.join(profile, name)));
const {portal,restaurant} = read('origins.json');
const {projects,instance} = read('binding.json');

async function verifiedAccount(targets, trustedInstance, readAccount, get = fetch) {
  for (const value of Object.values(targets)) {
    const url = new URL(value);
    assert(url.port && value === 'http://127.0.0.1:' + url.port, 'Forventet eksplisitt loopback-port');
  }
  assert(targets.portal !== targets.restaurant && /^[a-f0-9]{24}$/.test(trustedInstance));
  for (const [kind,origin] of Object.entries(targets)) {
    const response = await get(origin+'/meeting/test-target',{
      redirect:'error',signal:AbortSignal.timeout(3000)
    });
    assert(response.ok);
    assert.deepEqual(await response.json(),{instance:trustedInstance,kind});
  }
  return readAccount();
}
const checks = [];
let stage = 'åpne nettleseren';
function code(account) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits=[...account.seed].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join('');
  const key=Buffer.from(bits.match(/.{8}/g).map(v=>parseInt(v,2)));
  const counter=Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const hash=crypto.createHmac('sha1',key).update(counter).digest();
  return String((hash.readUInt32BE(hash[19]&15)&0x7fffffff)%1000000).padStart(6,'0');
}
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
async function checkTargetGuards() {
  let accountReads=0, requests=0;
  const readDummy=()=>{accountReads++;return {}};
  const example={portal:'http://127.0.0.1:12345',restaurant:'http://127.0.0.1:12346'};
  const id='a'.repeat(24);
  function reply(identity=id, swap=false) {
    return async (address,options)=>{
      requests++;
      assert.equal(options.redirect,'error');
      const portalRequest=new URL(address).origin===example.portal;
      return {ok:true,json:async()=>({instance:identity,kind:portalRequest!==swap?'portal':'restaurant'})};
    };
  }
  for (const field of ['portal','restaurant']) {
    for (const value of ['https://example.invalid','http://localhost:12345','http://127.0.0.1',
                         'http://127.0.0.1:12345/login.html','http://user@127.0.0.1:12345']) {
      await assert.rejects(verifiedAccount({...example,[field]:value},id,readDummy,reply()));
    }
  }
  assert.equal(requests,0);
  await assert.rejects(verifiedAccount(example,id,readDummy,reply('b'.repeat(24))));
  await assert.rejects(verifiedAccount(example,id,readDummy,reply(id,true)));
  assert.equal(accountReads,0);
  await verifiedAccount(example,id,readDummy,reply());
  assert.equal(accountReads,1);
}
async function enter(browser) {
  const account=await verifiedAccount({portal,restaurant},instance,()=>read('account.json'));
  const ctx=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block'});
  await ctx.route('**/*',r=>{
    const url=new URL(r.request().url());
    if(![portal,restaurant].includes(url.origin)) { checks.push('UNEXPECTED_ORIGIN');return r.abort(); }
    return r.continue();
  });
  const page=await ctx.newPage();
  await page.goto(portal+'/login.html');
  assert.equal(page.url(),portal+'/login.html');
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(portal+'/mfa.html');
  await page.locator('#mfaSubmit:enabled').waitFor();
  if(Date.now()%30000>27000)await sleep(3200);
  assert.equal(page.url(),portal+'/mfa.html');
  await page.locator('#mfaCode').fill(code(account));
  await page.locator('#mfaSubmit').click();
  await page.waitForURL(portal+'/builder.html');
  const entry=page.locator('#journeyEntry:visible');
  await entry.waitFor();
  assert.equal(await page.locator('#projectName').inputValue(),'Bord & Jord');
  const identity = await page.evaluate(async id=>{
    const {supabase}=await import('/js/supabase.js');
    const {data:{session}}=await supabase.auth.getSession();
    const level=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const r=await fetch('/api/projects/'+id+'/round',{headers:{Authorization:'Bearer '+session.access_token}});
    return {id:session.user.id, level:level.data.currentLevel,round:r.ok?(await r.json()).runde:null};
  },projects[0]);
  assert(identity.id===account.uid && identity.level==='aal2' && identity.round);
  await entry.click();
  await page.locator('#journeySurface #reset:visible').waitFor();
  return {ctx,page,round:identity.round};
}
async function flow(page,values) {
  await page.waitForFunction(w=>{
    const root=document.querySelector('#journeySurface').shadowRoot;
    return !root.querySelector('main')?.hidden &&
      [...root.querySelectorAll('.flow strong')].map(n=>n.textContent).join()===w;
  },values.join(),{timeout:20000});
}
async function verifyPausedDraft(p) {
  stage='avbrutt tilgang med ulagret Builder-utkast';
  const entry=p.locator('#journeyEntry'), close=p.locator('#journeyReturn');
  const form=p.locator('#f-heroTitle'), notice=p.locator('#journeyAccessNotice');
  const retry=p.locator('#journeyVerifyAccess');
  const mockedSaves=[];
  await p.route('**/functions/v1/save-draft',route=>{
    const body=route.request().postDataJSON();
    mockedSaves.push(body);
    return route.fulfill({json:{ok:true,revision:body.expectedRevision+1}});
  });
  await close.click();await entry.waitFor();
  await p.locator('[data-tab="innhold"]').first().click();
  const edit='Bevart i redigeringen under tilgangskontroll';
  await form.fill(edit);await entry.click();
  const roundRoute='**/api/projects/'+projects[0]+'/round';
  const availableRoute='**/api/projects/'+projects[0]+'/available';
  await p.route(roundRoute,r=>r.fulfill({status:403,json:{}}));
  await notice.waitFor();
  assert.equal(await form.inputValue(),edit);
  assert(await p.locator('#journeyDialog').isHidden());
  await p.route(availableRoute,r=>r.fulfill({status:403,json:{}}));
  await Promise.all([p.waitForResponse(r=>r.url().endsWith('/available')),retry.click()]);
  // The same project under a different principal must not resume the previous draft.
  await p.evaluate(async()=>{
    const {supabase}=await import('/js/supabase.js');
    const original=supabase.auth.getSession.bind(supabase.auth);
    window.restoreMeetingTestSession=()=>{supabase.auth.getSession=original};
    supabase.auth.getSession=async()=>({data:{session:{user:{id:'different-test-user'}}}});
  });
  await p.unroute(availableRoute);
  await retry.click();
  await p.locator('#journeyVerifyAccess:enabled').waitFor();
  await p.locator('#saveBtn').click();
  await sleep(1100);
  assert.equal(mockedSaves.length,0);
  assert(await notice.isVisible());
  assert.equal(await form.inputValue(),edit);
  await p.evaluate(()=>window.restoreMeetingTestSession());
  const saved=p.waitForResponse(r=>r.url().endsWith('/functions/v1/save-draft'));
  await retry.click();await saved;
  assert(await notice.isHidden());
  assert.equal(mockedSaves.length,1);
  assert.equal(mockedSaves[0].websiteId,projects[0]);
  assert(mockedSaves[0].content.pages.some(page=>page.heroTitle===edit));
  checks.push('Simulert 403 og kontobytte bevarte utkastet. Ingen lagringskall før ekte tilgangskontroll for opprinnelig aktør/prosjekt. Ett simulert lagringssvar.');
}
(async()=>{
  await checkTargetGuards();
  if (process.argv.includes('--check-targets')) {
    await verifiedAccount({portal,restaurant},instance,()=>{});
    console.log('PASS: adresser, serverroller og instans kontrollert før privat fil.');
    return;
  }
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {
    stage='første innlogging og prosjekt';
    const first=await enter(browser),p=first.page;
    const root=p.locator('#journeySurface');
    await flow(p,[0,0,0]);
    checks.push('Adresse- og instanskontroller før lesing av innloggingsmateriale');
    checks.push('Samme bundne kunde og prosjekt, AAL2, null ved oppstart');
    stage='SEO og annonse';
    await root.locator('#rerun').click();
    await root.getByText(/Begge sidene lest/).waitFor();
    const [seo]=await Promise.all([first.ctx.waitForEvent('page'),root.getByRole('link',{name:/Åpne etterversjonen/}).click()]);
    await Promise.all([seo.waitForEvent('close'),seo.locator('.demo-toolbar [data-journey-return]').click()]);
    await p.bringToFront();
    await root.locator('[data-value="after-title"]:visible').waitFor();
    checks.push('SEO-retur lukket etterfanen og beholdt Kundereisen');
    await root.locator('[data-step="annonse"]').click();
    const [old]=await Promise.all([first.ctx.waitForEvent('page'),root.locator('#visit[href]').click()]);
    await old.waitForURL(restaurant+'/scene/**/bord-og-jord.html');
    const menu=old.getByRole('link',{name:/Se menyen/});
    await menu.waitFor();
    await old.locator('#meny').scrollIntoViewIfNeeded();
    await p.bringToFront();await flow(p,[1,1,0]);
    await old.bringToFront();await menu.click();
    await p.bringToFront();await flow(p,[1,1,1]);
    await root.locator('#resultat').screenshot({path:path.join(evidence,'fullfort.png')});
    checks.push('SEO leste begge sider; én annonse, åpning og meny; scroll alene 1/1/0');
    const [news]=await Promise.all([first.ctx.waitForEvent('page'),root.locator('[data-source="nyhetsbrev"]').click()]);
    const footer=news.locator('.demo-footer [data-journey-return]');
    await news.getByRole('button',{name:'Dessert',exact:true}).waitFor();
    await Promise.all([news.waitForEvent('close'),footer.click()]);
    await p.bringToFront();await flow(p,[1,1,1]);
    checks.push('Restaurantens rendrerte bunntekst returnerte til samme måling');
    stage='avvent omstart av denne prosessen';
    fs.writeFileSync(path.join(evidence,'klar-for-omstart'),'OK\n');
    console.log('Klar for serveromstart:',evidence);
    for(let n=0;n<360&&!fs.existsSync(path.join(evidence,'server-startet'));n++)await sleep(1000);
    assert(fs.existsSync(path.join(evidence,'server-startet')));
    stage='ny innlogging etter omstart';
    // A different browser context keeps the earlier restaurant tab exactly as opened.
    const next=await enter(browser);
    assert(first.round!==next.round);
    await next.page.locator('#journeySurface [data-step="resultat"]').click();
    await flow(next.page,[0,0,0]);
    checks.push('Ny AAL2-innlogging, samme kunde og prosjekt med annen rundeverdi og 0/0/0');
    stage='ekte klikk i restaurantfanen fra forrige serverprosess';
    await old.bringToFront();
    const [rejected]=await Promise.all([old.waitForResponse(r=>r.url().endsWith('/event')), menu.click()]);
    assert.equal(rejected.status(),409);
    await old.getByText('Denne demorunden er avsluttet.').waitFor();
    await next.page.bringToFront();
    await next.page.waitForResponse(r=>r.url().endsWith('/round') && r.status()===200);
    await flow(next.page,[0,0,0]);
    checks.push('Gammel fane: ekte menyklikk avvist med 409, 0/0/0 etter ny serveravlesning');
    await verifyPausedDraft(next.page);
    assert(!checks.includes('UNEXPECTED_ORIGIN'));
    fs.writeFileSync(path.join(evidence,'resultat.json'),JSON.stringify({browser:browser.version(),checks,externalRequests:0},null,2));
    console.log('PASS møtereise og omstart');
  } finally {await browser.close();}
})().catch(()=>{console.error('Møtetest feilet ved',stage);process.exitCode=1;});

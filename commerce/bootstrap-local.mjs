// Explicit local synthetic fixture setup, following the repository's local Auth fixture pattern.
// Not a production admin backfill. Never imports identities, sessions or customer data.
import { randomUUID } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync,chmodSync } from 'node:fs';
import pg from 'pg';
import { config,service,client,check,totp,privateRoot } from '../tests/commerce/local-support.mjs';
const fixtureFile=new URL('fixtures.json',privateRoot);
if(existsSync(fixtureFile)){console.log('Fixtures already exist; preserved without resetting accounts or TOTP.');process.exit(0);}
const db=new pg.Client({connectionString:config.databaseUrl});await db.connect();
const state={};function save(){writeFileSync(fixtureFile,JSON.stringify(state,null,2),{mode:0o600});chmodSync(fixtureFile,0o600);}
try{
  for(const role of ['admin','buyer','otherBuyer','otherEditor']){
    const email=`${role.toLowerCase()}-${randomUUID().slice(0,8)}@test.invalid`,password='Pilot!a9-'+randomUUID();
    const {user}=check(await service.auth.admin.createUser({email,password,email_confirm:true}));state[role]={id:user.id,email,password};
  }
  await db.query("insert into public.profiles(id,display_name,status) values($1,'Syntetisk Bli Støgg-administrator','active'),($2,'Syntetisk annen kundes redaktør','active')",[state.admin.id,state.otherEditor.id]);
  await db.query("insert into public.platform_admins(user_id,admin_role) values($1,'admin')",[state.admin.id]);
  const c=client();check(await c.auth.signInWithPassword(state.admin));
  const factor=check(await c.auth.mfa.enroll({factorType:'totp',friendlyName:'Bli Stogg isolated pilot'}));state.admin.totp=factor.totp.secret;
  const challenge=check(await c.auth.mfa.challenge({factorId:factor.id}));check(await c.auth.mfa.verify({factorId:factor.id,challengeId:challenge.id,code:totp(state.admin.totp)}));
  for(const [key,name] of [['company','Bli Støgg'],['otherCompany','Isolasjonstest – syntetisk kunde']]){
    const result=check(await c.rpc('security_v2_create_company',{p_idempotency_key:randomUUID(),p_payload:{schemaVersion:1,company:{name},contact:null,services:['website'],internal:{lifecycleStatus:'onboarding',assignments:[]}}}));
    state[key]=result.companyId; if(!state[key])throw Error('COMPANY_CREATION_FAILED');
  }
  const content={businessName:'Bli Støgg',accent:'#f7941d',accent2:'#1f2b4d',bg:'#ffffff',status:'draft',activePageId:'home',pages:[{id:'home',slug:'',name:'Forside',sections:[],offerings:[],gallery:[]}]};
  state.store=check(await c.rpc('commerce_create_store',{p_company:state.company,p_name:'Bli Støgg – lokal pilot',p_slug:'bli-stogg',p_content:content}));
  state.otherStore=check(await c.rpc('commerce_create_store',{p_company:state.otherCompany,p_name:'Isolasjonstest – butikk',p_slug:'isolation-fixture',p_content:{...content,businessName:'Isolasjonstest'}}));
  state.products=[];
  for(const p of [
    {name:'Støgg på skjerm',description:'Midlertidig pilotinnhold. Ett digitalt selskapsspill med 12 kort, spillerliste og én felles skjerm. Spill med poeng eller alkoholfritt. Testpris; endelig innhold og prismodell er ikke bestemt.',kind:'digital',game_key:'bli-stogg-classic',unit_amount:4900,active:true},
    {name:'Støgg på bordet',description:'Fysisk testprodukt for å prøve handlekurv og ordreflyt. Illustrasjonen er en skisse. Innhold, lager, frakt og levering er ikke avklart. Ingen varer sendes i piloten.',kind:'physical',game_key:null,unit_amount:14900,active:true}
  ])state.products.push(check(await c.rpc('commerce_save_product',{p_store:state.store.id,p_product:null,p_revision:null,p_data:p})));
  state.otherProduct=check(await c.rpc('commerce_save_product',{p_store:state.otherStore.id,p_product:null,p_revision:null,p_data:{name:'Syntetisk isolasjonsprodukt',description:'Kun sikkerhetstest',kind:'physical',game_key:null,unit_amount:1000,active:true}}));
  await db.query("insert into public.company_memberships(company_id,user_id,role,status) values($1,$2,'editor','active')",[state.otherCompany,state.otherEditor.id]);
  const editor=client();check(await editor.auth.signInWithPassword(state.otherEditor));const ef=check(await editor.auth.mfa.enroll({factorType:'totp',friendlyName:'Isolated second company'}));state.otherEditor.totp=ef.totp.secret;const ec=check(await editor.auth.mfa.challenge({factorId:ef.id}));check(await editor.auth.mfa.verify({factorId:ef.id,challengeId:ec.id,code:totp(state.otherEditor.totp)}));
  save();console.log(JSON.stringify({company:state.company,website:state.store.website_id,store:state.store.id,products:state.products.map(p=>({id:p.id,kind:p.kind})),syntheticIdentities:4}));
}catch(e){save();throw e;}finally{await db.end();}

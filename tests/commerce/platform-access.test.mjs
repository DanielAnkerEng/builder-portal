// Real policies/RPCs, synthetic rows in ONE transaction, always ROLLBACK.
// No Auth API, passwords, sessions, fixture customers, payments or migrations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';


test('isolated rollback: commerce AAL2, roles, tenant identity, RPC writes and composite FKs',
 {skip:process.env.BLI_STOGG_PLATFORM_DB_TESTS!=='1'},async()=>{
  const {config}=await import('./local-support.mjs');
  const db=new pg.Client({connectionString:config.databaseUrl});await db.connect();
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
  const ids={};for(const key of ['a','b','inactive','owner','companyAdmin','editor','viewer','publisher','other','suspended','inactiveProfile','admin','inactiveAdmin','buyer'])ids[key]=randomUUID();
  const userKeys=Object.keys(ids).filter(k=>!['a','b','inactive'].includes(k));
  const denied=async(sql,args,code)=>{await db.query('savepoint denied');try{await assert.rejects(()=>db.query(sql,args),e=>e.code===code);}finally{await db.query('rollback to savepoint denied');}};
  const claims=async(user,aal='aal2')=>{await db.query('reset role');await q("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:ids[user],aal,role:'authenticated'})]);await db.query('set local role authenticated');};
  await db.query('begin');
  try{
   for(const c of ['a','b','inactive'])await q('insert into public.companies(id,name,is_active) values($1,$2,$3)',[ids[c],'Isolated platform review '+c,c!=='inactive']);
   for(const u of userKeys){
    await q("insert into auth.users(id,email,role,aud,email_confirmed_at) values($1,$2,'authenticated','authenticated',now())",[ids[u],ids[u]+'@test.invalid']);
    await q('insert into public.profiles(id,display_name,status) values($1,$2,$3) on conflict(id) do update set display_name=excluded.display_name,status=excluded.status',[ids[u],'Synthetic '+u,u==='inactiveProfile'?'suspended':'active']);
   }
   for(const [u,role,company,status] of [['owner','owner','a','active'],['companyAdmin','company_admin','a','active'],['editor','editor','a','active'],['viewer','viewer','a','active'],['publisher','publisher','a','active'],['other','editor','b','active'],['suspended','editor','a','suspended'],['inactiveProfile','editor','a','active']])
    await q('insert into public.company_memberships(company_id,user_id,role,status) values($1,$2,$3,$4)',[ids[company],ids[u],role,status]);
   for(const u of ['admin','inactiveAdmin'])await q("insert into public.platform_admins(user_id,admin_role,is_active) values($1,'admin',$2)",[ids[u],u==='admin']);
   const stores={},products={},websites={};
   for(const c of ['a','b','inactive']){
    websites[c]=(await q('insert into public.websites(company_id,name,public_slug,created_by) values($1,$2,$3,$4) returning id',[ids[c],'Synthetic '+c,'qa-'+randomUUID(),ids.admin]))[0].id;
    stores[c]=(await q('insert into public.commerce_stores(company_id,website_id,slug,name) values($1,$2,$3,$4) returning id',[ids[c],websites[c],'qa-'+randomUUID(),'Synthetic '+c]))[0].id;
    products[c]=(await q("insert into public.commerce_products(store_id,company_id,name,description,kind,unit_amount) values($1,$2,'Synthetic product','','physical',100) returning id",[stores[c],ids[c]]))[0].id;
   }
   for(const [u,aal,visible] of [['owner','aal2',['a']],['companyAdmin','aal2',['a']],['editor','aal2',['a']],['other','aal2',['b']],['admin','aal2',['a','b']],['admin','aal1',[]],['owner','aal1',[]],['viewer','aal2',[]],['publisher','aal2',[]],['suspended','aal2',[]],['inactiveProfile','aal2',[]],['inactiveAdmin','aal2',[]],['buyer','aal1',[]]]){
    await claims(u,aal);
    const rows=await q('select id,company_id,website_id from public.commerce_stores where id=any($1::uuid[]) order by id',[Object.values(stores)]);
    assert.deepEqual(rows.map(r=>r.id).sort(),visible.map(c=>stores[c]).sort(),u+'/'+aal);
    for(const r of rows){const c=visible.find(c=>stores[c]===r.id);assert.equal(r.company_id,ids[c]);assert.equal(r.website_id,websites[c]);}
    if(!visible.includes('a'))await denied('select public.commerce_save_product($1,$2,1,$3)',[stores.a,products.a,{}],'42501');
   }
   await claims('editor');
   const data={name:'Saved synthetic product',description:'Only in rollback transaction',kind:'physical',game_key:null,unit_amount:200,active:true};
   const saved=(await q('select * from public.commerce_save_product($1,$2,1,$3)',[stores.a,products.a,data]))[0];assert.equal(saved.name,data.name);assert.equal(saved.company_id,ids.a);
   for (const rev of [null,0,-1,1]) {
     await denied('select public.commerce_save_product($1,$2,$3,$4)',[stores.a,products.a,rev,data],'P0001');
   }
   const retained=(await q('select revision from public.commerce_products where id=$1',[products.a]))[0];
   assert.equal(retained.revision,saved.revision);
   await denied('select public.commerce_save_product($1,$2,1,$3)',[stores.b,products.b,data],'42501');
   await denied('select public.commerce_save_product($1,$2,1,$3)',[stores.a,products.b,data],'P0001');
   await denied('update public.commerce_products set name=$1 where id=$2',['Direct write',products.a],'42501');
   await db.query('reset role');
   const unattached=(await q("insert into public.websites(company_id,name,public_slug,created_by) values($1,'FK isolation',$2,$3) returning id",[ids.a,'qa-'+randomUUID(),ids.admin]))[0].id;
   await denied("insert into public.commerce_stores(company_id,website_id,slug,name) values($1,$2,$3,'Wrong company')",[ids.b,unattached,'qa-'+randomUUID()],'23503');
   await denied("insert into public.commerce_products(store_id,company_id,name,description,kind,unit_amount) values($1,$2,'Wrong company','','physical',100)",[stores.a,ids.b],'23503');
   // An anonymous role cannot use administration even with a forged claims setting.
   await db.query('set local role anon');await denied('select id from public.commerce_stores',[],'42501');
  }finally{await db.query('rollback');
   assert.equal((await q('select count(*)::int as n from auth.users where id=any($1::uuid[])',[userKeys.map(k=>ids[k])]))[0].n,0);
   assert.equal((await q('select count(*)::int as n from public.companies where id=any($1::uuid[])',[[ids.a,ids.b,ids.inactive]]))[0].n,0);
   await db.end();
  }
 });

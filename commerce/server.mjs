import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadConfig,validateConfig,requireSimulation,requireOfflinePayments } from './config.mjs';
import { makeStripe,verifyStripeAccount,checkoutLines,checkoutParams,fulfillStripeEvent,retrieveSession,validateSession } from './stripe.mjs';
import { makeDeck,validatePlayers,gameView,rules } from './game.mjs';
import { localPlatformResponse } from './local-platform.mjs';

const root=resolve(import.meta.dirname,'..'),pub=resolve(import.meta.dirname,'public');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail=(code,status=400)=>Object.assign(Error(code),{status});
function checked(result){if(result.error)throw fail(result.error.message?.match(/^[A-Z_]+$/)?.[0]||'REQUEST_REJECTED',result.error.code==='42501'?403:400);return result.data;}
async function body(req,raw=false){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw fail('REQUEST_TOO_LARGE',413);chunks.push(chunk);}const data=Buffer.concat(chunks);if(raw)return data;try{return JSON.parse(data.toString('utf8'));}catch{throw fail('INVALID_JSON');}}
function exact(v,keys){if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!(k in v)))throw fail('INVALID_REQUEST');}
const mimes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon'};
export async function createPilot(config=loadConfig(),ports={portal:4307,shop:4308},testDependencies={}) {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) requireOfflinePayments(config);
  validateConfig(config);
  if(testDependencies.stripeClient)requireSimulation(config);
  // No injected provider is accepted in Stripe-test mode or a production process.
  const service=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),stripe=testDependencies.stripeClient??makeStripe(config.stripe);
  const paymentProvider=config.stripe.mode==='test'?'stripe_test':'simulation';
  if(stripe)await verifyStripeAccount(stripe,config.stripe);
  const shopOrigin=`http://127.0.0.1:${ports.shop}`,portalOrigin=`http://127.0.0.1:${ports.portal}`;
  async function store(){const s=checked(await service.from('commerce_stores').select('*').eq('slug',config.storeSlug).eq('status','local_preview').single());const c=checked(await service.from('companies').select('is_active').eq('id',s.company_id).single());if(!c.is_active)throw fail('STORE_UNAVAILABLE',404);if(s.payment_mode!==paymentProvider||(paymentProvider==='stripe_test'&&s.stripe_account_id!==config.stripe.accountId))throw fail('PAYMENT_MODE_CONFLICT',503);return s;}
  function servesStore(s) {
    return s.slug === config.storeSlug && s.status === 'local_preview' && s.payment_mode === paymentProvider &&
      (paymentProvider !== 'stripe_test' || s.stripe_account_id === config.stripe.accountId);
  }
  async function ordersWithAccess(orders, shopStore) {
    const digital = orders.filter(o => servesStore(shopStore) && o.status === 'paid' &&
      o.payment_provider === shopStore.payment_mode && o.commerce_order_items.some(i => i.kind === 'digital'));
    const proofs = digital.length ? checked(await service.from('commerce_entitlement_proofs')
      .select('order_id,commerce_entitlements!inner(buyer_id,product_id,active)')
      .in('order_id', digital.map(o => o.id)).eq('provider', shopStore.payment_mode)
      .eq('commerce_entitlements.active', true)) : [];
    return orders.map(order => {
      const items = order.commerce_order_items.filter(i => i.kind === 'digital' && proofs.some(proof =>
        proof.order_id === order.id && proof.commerce_entitlements.buyer_id === order.buyer_id &&
        proof.commerce_entitlements.product_id === i.product_id));
      return {...order, active_game_products: items.map(i => i.name)};
    });
  }
  async function identity(req){const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!token)throw fail('AUTH_REQUIRED',401);
    const {data,error}=await service.auth.getUser(token);if(error||!data.user?.email_confirmed_at||data.user.is_anonymous)throw fail('AUTH_REQUIRED',401);
    return {user:data.user,client:createClient(config.supabaseUrl,config.anonKey,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}})};}
  const buckets=new Map();function limit(key,max=60){const now=Date.now(),b=buckets.get(key);if(!b||b.until<now)buckets.set(key,{n:1,until:now+60000});else if(++b.n>max)throw fail('TRY_LATER',429);if(buckets.size>10000)for(const [k,v] of buckets)if(v.until<now)buckets.delete(k);}
  function handler(surface){const origin=surface==='shop'?shopOrigin:portalOrigin;return async(req,res)=>{
    const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    // Local transport policy only. Production _headers and its HTTPS upgrade remain untouched.
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' http://127.0.0.1:56321; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if(req.headers.host!==new URL(origin).host)throw fail('INVALID_HOST',403);
      const path=new URL(req.url,origin).pathname;
      if(path.startsWith('/api/')){
        if(!['GET','POST'].includes(req.method))throw fail('METHOD_NOT_ALLOWED',405);
        if(req.method==='POST'&&path!=='/api/stripe/webhook'&&req.headers.origin!==origin)throw fail('ORIGIN_REJECTED',403);
        if(path==='/api/config'&&req.method==='GET')return send({supabaseUrl:config.supabaseUrl,anonKey:config.anonKey,mode:config.stripe.mode,portalOrigin,shopOrigin,localPreview:true});
        if(path==='/api/catalog'&&req.method==='GET'){
          const s=await store(),products=checked(await service.from('commerce_products').select('id,name,description,kind,unit_amount,currency,revision').eq('store_id',s.id).eq('active',true).order('kind'));
          return send({store:{name:s.name},products});
        }
        if(path==='/api/stripe/webhook'&&req.method==='POST'&&surface==='shop'){
          if(!stripe)throw fail('STRIPE_NOT_CONFIGURED',503);
          let event;try{event=stripe.webhooks.constructEvent(await body(req,true),req.headers['stripe-signature'],config.stripe.webhookSecret);}catch{throw fail('INVALID_SIGNATURE',400);}
          try{return send(await fulfillStripeEvent({stripe,service,event,provider:paymentProvider,config,storeId:(await store()).id}));}catch{throw fail('WEBHOOK_RETRY_REQUIRED',500);}
        }
        const {user,client}=await identity(req);limit(user.id+':'+surface);
        if(path.startsWith('/api/admin/')){
          if(surface!=='portal')throw fail('NOT_FOUND',404);
          const input=req.method==='POST'?await body(req):null;
          if(path==='/api/admin/store'&&req.method==='GET'){
            const website=new URL(req.url,origin).searchParams.get('website');if(!uuid.test(website||''))throw fail('INVALID_PROJECT');
            const stores=checked(await client.from('commerce_stores').select('*').eq('website_id',website));if(!stores.length)throw fail('FORBIDDEN',403);const s=stores[0];
            const [products,orders]=await Promise.all([client.from('commerce_products').select('*').eq('store_id',s.id).order('kind'),client.from('commerce_orders').select('*,commerce_order_items(*),commerce_payments(*)').eq('store_id',s.id).order('created_at',{ascending:false}).limit(100)]);
            const shopUrl = servesStore(s) ? shopOrigin : null;
            return send({store:s,shopUrl,products:checked(products),
              orders:await ordersWithAccess(checked(orders),s)});
          }
          if(path==='/api/admin/product'&&req.method==='POST'){
            exact(input,['store_id','product_id','revision','data']);
            if (input.product_id !== null && (!Number.isInteger(input.revision) || input.revision < 1))
              throw fail('REVISION_CONFLICT',409);
            return send(checked(await client.rpc('commerce_save_product',{p_store:input.store_id,p_product:input.product_id,p_revision:input.revision,p_data:input.data})));
          }
          throw fail('NOT_FOUND',404);
        }
        if(surface!=='shop')throw fail('NOT_FOUND',404);
        const s=await store();
        if(path==='/api/checkout'&&req.method==='POST'){
          limit(user.id+':checkout',10);
          const input=await body(req);exact(input,['request_key','items']);if(!uuid.test(input.request_key))throw fail('INVALID_REQUEST');
          // The route accepts no company, store, currency or client price.
          if(!stripe)throw fail('STRIPE_NOT_CONFIGURED',503);
          const reserved = await client.rpc('commerce_reserve_checkout',{p_store:s.id,p_key:input.request_key,p_cart:input.items});
          if (reserved.error?.code === 'PGRST202') throw fail('LOCAL_MIGRATION_REQUIRED',503);
          if (reserved.error?.message === 'OPEN_DIGITAL_ORDER' && uuid.test(reserved.error.details))
            return send({error:'OPEN_DIGITAL_ORDER',order_id:reserved.error.details},409);
          const order=checked(reserved);
          if(order.status!=='pending')return send({order_id:order.id});
          const existing=checked(await service.from('commerce_payments').select('session_id,provider').eq('order_id',order.id).maybeSingle());
          if(existing&&existing.provider!==paymentProvider)throw fail('PAYMENT_CONFLICT',409);
          if(!existing&&Date.now()-Date.parse(order.created_at)>23*60*60*1000)throw fail('CHECKOUT_RECONCILIATION_REQUIRED',409);
          const items=checked(await client.from('commerce_order_items').select('*').eq('order_id',order.id));
          let session;
          try {
            const created=existing?{id:existing.session_id}:await stripe.checkout.sessions.create(checkoutParams(order,items,shopOrigin,await checkoutLines(stripe,order,items)),{idempotencyKey:'checkout:'+order.id});
            session=await retrieveSession(stripe,created.id);
          }catch{throw fail('CHECKOUT_UNCONFIRMED',503);}
          validateSession(session,order,items);
          if(existing&&session.status!=='open')return send({order_id:order.id});
          if(session.livemode!==false||!session.id.startsWith('cs_test_')||!session.url?.startsWith('https://checkout.stripe.com/'))throw fail('TEST_MODE_ONLY',503);
          checked(await service.rpc('commerce_bind_payment',{p_order:order.id,p_session:session.id,p_provider:paymentProvider}));
          return send({url:session.url,order_id:order.id});
        }
        if(path==='/api/orders'&&req.method==='GET')return send(checked(await client.from('commerce_orders').select('*,commerce_order_items(*),commerce_payments(*)').eq('buyer_id',user.id).eq('store_id',s.id).order('created_at',{ascending:false}).limit(100)));
        if(path.startsWith('/api/orders/')&&req.method==='GET'){
          const id=path.split('/').at(-1);if(!uuid.test(id))throw fail('NOT_FOUND',404);
          const rows=checked(await client.from('commerce_orders').select('*,commerce_order_items(*),commerce_payments(*)').eq('id',id).eq('buyer_id',user.id).eq('store_id',s.id));if(!rows.length)throw fail('NOT_FOUND',404);return send((await ordersWithAccess(rows,s))[0]);
        }
        if(path==='/api/library'&&req.method==='GET'){
          const entitlements=checked(await service.from('commerce_entitlements').select('id,product_id,commerce_products!inner(name,store_id),commerce_entitlement_proofs!inner(provider)').eq('buyer_id',user.id).eq('active',true).eq('commerce_products.store_id',s.id).eq('commerce_entitlement_proofs.provider',paymentProvider));
          return send(entitlements.map(e=>({id:e.id,product_id:e.product_id,name:e.commerce_products.name})));
        }
        async function entitlement(id){const rows=checked(await service.from('commerce_entitlements').select('id,commerce_products!inner(store_id),commerce_entitlement_proofs!inner(provider)').eq('id',id).eq('buyer_id',user.id).eq('active',true).eq('commerce_products.store_id',s.id).eq('commerce_entitlement_proofs.provider',paymentProvider));if(!rows.length)throw fail('ACCESS_REQUIRED',403);return rows[0];}
        if(path==='/api/game'&&req.method==='POST'){
          const input=await body(req);exact(input,['entitlement_id','players']);if(!uuid.test(input.entitlement_id))throw fail('INVALID_REQUEST');
          await entitlement(input.entitlement_id);let players;try{players=validatePlayers(input.players);}catch(e){throw fail(e.message);}
          const session=checked(await service.from('commerce_game_sessions').insert({entitlement_id:input.entitlement_id,buyer_id:user.id,players,deck:makeDeck(players)}).select().single());return send({...gameView(session),rules});
        }
        if(path.startsWith('/api/game/')){
          const id=path.split('/').at(-1);if(!uuid.test(id))throw fail('NOT_FOUND',404);
          let session=checked(await service.from('commerce_game_sessions').select('*').eq('id',id).eq('buyer_id',user.id).maybeSingle());if(!session)throw fail('NOT_FOUND',404);await entitlement(session.entitlement_id);
          if(req.method==='POST'){
            const input=await body(req);exact(input,['version','action']);if(!Number.isInteger(input.version)||!['next','skip','end'].includes(input.action))throw fail('INVALID_ACTION');
            if(session.version!==input.version)throw fail('ROUND_CHANGED',409);
            const position=input.action==='end'?session.deck.length:Math.min(session.deck.length,session.position+1);
            if(session.position>=session.deck.length)throw fail('ROUND_COMPLETE',409);
            const updated=checked(await service.from('commerce_game_sessions').update({position,version:session.version+1,ended_early:input.action==='end',skipped:session.skipped+(input.action==='skip'?1:0),updated_at:new Date().toISOString()}).eq('id',id).eq('version',input.version).select().maybeSingle());
            if(!updated)throw fail('ROUND_CHANGED',409);session=updated;
          }
          return send({...gameView(session),rules});
        }
        throw fail('NOT_FOUND',404);
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw fail('METHOD_NOT_ALLOWED',405);
      let file;
      if(surface==='shop'){
        const allowed={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/vendor/supabase.js':'vendor/supabase.js'};
        if(path==='/font.woff2')file=resolve(root,'assets/marketing/manrope-latin.woff2');
        else {if(!allowed[path])throw fail('NOT_FOUND',404);file=resolve(pub,allowed[path]);}
      }else if(path==='/commerce-admin.html')file=resolve(pub,'admin.html');
      else if(path==='/commerce-admin.js')file=resolve(pub,'admin.js');
      else if(path==='/commerce-style.css')file=resolve(pub,'style.css');
      else if(path==='/font.woff2')file=resolve(root,'assets/marketing/manrope-latin.woff2');
      else if(path==='/commerce-vendor/supabase.js')file=resolve(pub,'vendor/supabase.js');
      else {
        const publicHtml=['/','/index.html','/login.html','/mfa.html','/admin.html','/builder.html','/security-settings.html','/site.html'];
        if(!publicHtml.includes(path)&&!/^\/(js|css|assets)\/[a-zA-Z0-9_./-]+$/.test(path))throw fail('NOT_FOUND',404);
        file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/')||!mimes[extname(file)])throw fail('NOT_FOUND',404);
      }
      let bytes;try{bytes=await readFile(file);}catch{throw fail('NOT_FOUND',404);}
      if(surface==='portal')bytes=localPlatformResponse(path,bytes);
      res.writeHead(200,{'Content-Type':mimes[extname(file)]});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){const known=error.status||/^[A-Z_]+$/.test(error.message);send({error:known?error.message:'SERVICE_UNAVAILABLE'},error.status||500);}
  };}
  const servers=[];for(const [surface,port] of Object.entries(ports)){const server=http.createServer(handler(surface));await new Promise((ok,bad)=>server.once('error',bad).listen(port,'127.0.0.1',ok));servers.push(server);}
  return {servers,close:()=>Promise.all(servers.map(s=>new Promise(r=>s.close(r))))};
}
if(process.argv[1]===import.meta.filename){
  try{await createPilot();console.log('Wreach pilot: http://127.0.0.1:4307/admin.html | Bli Støgg: http://127.0.0.1:4308/');}
  catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'PILOT_START_FAILED');process.exitCode=1;}
}

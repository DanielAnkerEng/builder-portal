import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { requireSimulation } from './config.mjs';

export const webhookEvents=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'];
export function makeStripe(config) { return config.mode==='test'?new Stripe(config.secretKey,{maxNetworkRetries:2,timeout:15000}):null; }
export async function verifyStripeAccount(stripe,config) {
  const account=await stripe.accounts.retrieve();
  if(account.id!==config.accountId)throw Error('STRIPE_ACCOUNT_MISMATCH');
  const balance=await stripe.balance.retrieve();
  if(balance.livemode!==false)throw Error('TEST_MODE_ONLY');
  return {accountId:account.id,environmentName:config.environmentName};
}
const metadata=order=>({order_id:order.id,company_id:order.company_id,store_id:order.store_id,buyer_id:order.buyer_id});

// Stable product IDs preserve one immutable test product/default price per local snapshot,
// including after a lost response or Stripe's 24-hour idempotency retention window.
export async function checkoutLines(stripe,order,items) {
  const lines=[];
  for(const item of items) {
    const snapshot=createHash('sha256').update(JSON.stringify([order.company_id,order.store_id,item.product_id,item.name,item.kind,item.unit_amount,order.currency])).digest('hex');
    const id='bst_pilot_'+snapshot;
    let product;
    try {product=await stripe.products.retrieve(id,{expand:['default_price']});}
    catch(error) {
      if(error.code!=='resource_missing')throw error;
      try {product=await stripe.products.create({id,name:item.name+' (Bli Støgg testprodukt)',metadata:{pilot:'bli-stogg',product_id:item.product_id,company_id:order.company_id,store_id:order.store_id,snapshot_id:snapshot},default_price_data:{currency:order.currency,unit_amount:item.unit_amount},expand:['default_price']},{idempotencyKey:'product:'+id});}
      catch(createError) {try{product=await stripe.products.retrieve(id,{expand:['default_price']});}catch{throw createError;}}
    }
    const price=product.default_price;
    if(product.id!==id||product.livemode!==false||product.active!==true||product.metadata?.snapshot_id!==snapshot||product.metadata?.product_id!==item.product_id||product.metadata?.company_id!==order.company_id||product.metadata?.store_id!==order.store_id||price?.livemode!==false||price.active!==true||price.type!=='one_time'||price.unit_amount!==item.unit_amount||price.currency!==order.currency||price.product!==id||!price.id?.startsWith('price_'))throw Error('STRIPE_CATALOG_MISMATCH');
    lines.push({quantity:item.quantity,price:price.id});
  }
  return lines;
}
export function checkoutParams(order,items,origin,lines) {
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('INVALID_RETURN_ORIGIN');
  return {mode:'payment',payment_method_types:['card'],client_reference_id:order.id,
    metadata:metadata(order),payment_intent_data:{metadata:metadata(order)},line_items:lines,
    success_url:origin+'/#order/'+order.id,cancel_url:origin+'/#order/'+order.id+'?cancelled=1',
    ...(items.some(i=>i.kind==='physical')?{shipping_address_collection:{allowed_countries:['NO']}}:{})};
}
export function validateSession(session,order,items) {
  if(session.livemode!==false||!session.id?.startsWith('cs_test_')||session.mode!=='payment'||session.client_reference_id!==order.id||
    Object.entries(metadata(order)).some(([key,value])=>session.metadata?.[key]!==value)||
    session.amount_total!==order.total||session.currency!==order.currency||session.line_items?.has_more!==false||session.line_items?.data?.length!==items.length) throw Error('PAYMENT_MISMATCH');
  const actual=session.line_items.data.map(i=>[i.price?.product?.metadata?.product_id,i.quantity,i.price?.unit_amount,i.price?.currency].join(':')).sort();
  const expected=items.map(i=>[i.product_id,i.quantity,i.unit_amount,order.currency].join(':')).sort();
  if(actual.some((v,i)=>v!==expected[i]))throw Error('PAYMENT_MISMATCH');
}
export async function retrieveSession(stripe,id) {
  const session=await stripe.checkout.sessions.retrieve(id,{expand:['payment_intent']});
  // The embedded list may contain only a handful of lines. Local carts allow up to 20.
  const lines=await stripe.checkout.sessions.listLineItems(id,{limit:100,expand:['data.price.product']});
  return {...session,line_items:lines};
}
export function validatePaymentIntent(session,order) {
  const intent=session.payment_intent;
  if(!intent?.id?.startsWith('pi_')||intent.livemode!==false||intent.status!=='succeeded'||intent.amount!==order.total||intent.amount_received!==order.total||intent.currency!==order.currency||Object.entries(metadata(order)).some(([key,value])=>intent.metadata?.[key]!==value))throw Error('PAYMENT_INTENT_MISMATCH');
  return intent.id;
}
export async function fulfillStripeEvent({stripe,service,event,provider='stripe_test',config,storeId}) {
  if(provider==='simulation')requireSimulation(config);
  if(event.livemode!==false)throw Error('LIVE_EVENT_REJECTED');
  if(!webhookEvents.includes(event.type))return {ignored:true};
  if(event.account||!event.id?.startsWith('evt_')||!event.data?.object?.id?.startsWith('cs_test_'))throw Error('EVENT_CONTEXT_MISMATCH');
  const session=await retrieveSession(stripe,event.data.object.id);
  if(session.id!==event.data.object.id)throw Error('SESSION_ID_MISMATCH');
  const {data:order,error}=await service.from('commerce_orders').select('*').eq('id',session.client_reference_id).single();
  if(error||!order)throw Error('ORDER_NOT_FOUND');
  if(order.store_id!==storeId||order.payment_provider!==provider)throw Error('PAYMENT_CONTEXT_MISMATCH');
  const {data:items,error:ie}=await service.from('commerce_order_items').select('*').eq('order_id',order.id);if(ie)throw Error('DATABASE_UNAVAILABLE');
  validateSession(session,order,items);
  const status=session.payment_status==='paid'&&session.status==='complete'?'paid':session.status==='expired'?'expired':event.type==='checkout.session.async_payment_failed'&&session.status==='complete'&&session.payment_status==='unpaid'?'failed':'pending';
  const intent=status==='paid'?validatePaymentIntent(session,order):null;
  const {error:err}=await service.rpc('commerce_record_payment',{p_event:event.id,p_order:order.id,p_session:session.id,p_provider:provider,p_status:status,p_amount:session.amount_total,p_currency:session.currency,p_company:order.company_id,p_buyer:order.buyer_id,p_intent:intent});
  if(err)throw Error('PAYMENT_PERSIST_FAILED');return {received:true};
}

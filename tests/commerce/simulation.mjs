// TEST HARNESS ONLY: no HTTP route exists for creating a simulated payment.
import Stripe from 'stripe';
import { requireSimulation } from '../../commerce/config.mjs';
import { randomUUID } from 'node:crypto';
import { fulfillStripeEvent } from '../../commerce/stripe.mjs';
import { service,check,config } from './local-support.mjs';
export async function simulatedPayment(order,{status='paid',eventId='evt_sim_'+randomUUID(),sessionId='cs_test_sim_'+order.id,eventType='checkout.session.completed'}={}) {
  requireSimulation(config);
  const items=check(await service.from('commerce_order_items').select('*').eq('order_id',order.id));
  const session={id:sessionId,livemode:false,mode:'payment',client_reference_id:order.id,metadata:{order_id:order.id,company_id:order.company_id,store_id:order.store_id,buyer_id:order.buyer_id},amount_total:order.total,currency:order.currency,
    status:status==='expired'?'expired':['paid','failed'].includes(status)?'complete':'open',payment_status:status==='paid'?'paid':'unpaid',line_items:{has_more:false,data:items.map(i=>({quantity:i.quantity,price:{unit_amount:i.unit_amount,currency:order.currency,product:{metadata:{product_id:i.product_id}}}}))}};
  session.payment_intent={id:'pi_sim_'+order.id,livemode:false,status:'succeeded',amount:order.total,amount_received:order.total,currency:order.currency,metadata:session.metadata};
  const event={id:eventId,livemode:false,type:status==='failed'?'checkout.session.async_payment_failed':status==='expired'?'checkout.session.expired':eventType,data:{object:{id:sessionId}}};
  const sdk=new Stripe('sk_test_simulation_not_a_real_key'),secret='whsec_'+randomUUID(),payload=JSON.stringify(event);
  const header=Stripe.webhooks.generateTestHeaderString({payload,secret});
  const verified=sdk.webhooks.constructEvent(payload,header,secret);
  const fakeStripe={checkout:{sessions:{retrieve:async()=>session,listLineItems:async()=>session.line_items}}};
  await fulfillStripeEvent({stripe:fakeStripe,service,event:verified,provider:'simulation',config,storeId:order.store_id});
  return {eventId,session,items};
}

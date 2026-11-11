// Explicit operator command. Reads Stripe account/balance only; creates no Stripe objects.
import {loadConfig} from './config.mjs';
import {makeStripe,verifyStripeAccount} from './stripe.mjs';
import {createClient} from '@supabase/supabase-js';
try {
  if(process.argv.slice(2).some(arg=>arg!=='--activate'))throw Error('INVALID_ARGUMENT');
  const config=loadConfig();
  if(config.stripe.mode!=='test')throw Error('STRIPE_TEST_CONFIG_MISSING');
  const verified=await verifyStripeAccount(makeStripe(config.stripe),config.stripe);
  console.log(JSON.stringify({verifiedTestAccount:verified.accountId,environmentName:verified.environmentName,objectsCreated:0}));
  if(process.argv.includes('--activate')) {
    const service=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:store,error}=await service.from('commerce_stores').select('id').eq('slug',config.storeSlug).eq('status','local_preview').single();
    if(error||!store)throw Error('STORE_NOT_FOUND');
    const result=await service.rpc('commerce_activate_stripe_test',{p_store:store.id,p_account:verified.accountId});
    if(result.error)throw Error('STORE_ACTIVATION_REJECTED');
    console.log('Stripe test activated for the local store. Historical simulation remains labelled and grants no access in this mode. Restart only the pilot server.');
  }
} catch(error) {
  // SDK errors may contain request context: never dump them or the private config.
  console.error(/^[A-Z_]+$/.test(error.message)?error.message:'STRIPE_PREFLIGHT_FAILED');process.exitCode=1;
}

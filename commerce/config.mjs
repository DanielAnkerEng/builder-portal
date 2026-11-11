import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function loadConfig(path=resolve(import.meta.dirname,'../../private/runtime.json')) {
  try {return validateConfig(JSON.parse(readFileSync(path,'utf8')));}
  catch(error) {throw Error(/^[A-Z_]+$/.test(error.message)?error.message:'PRIVATE_CONFIG_INVALID');}
}
export function validateConfig(c) {
  let db;try{db=new URL(c.databaseUrl);}catch{throw Error('ISOLATED_LOCAL_CONFIG_REQUIRED');}
  const pilot = c.supabaseUrl === 'http://127.0.0.1:56321' && db.port === '56322';
  const testStack = process.env.NODE_ENV === 'test' &&
    c.supabaseUrl === 'http://127.0.0.1:57321' && db.port === '57322';
  if(process.env.NODE_ENV==='production'||!(pilot || testStack)||db.hostname!=='127.0.0.1'||db.pathname!=='/postgres'||db.search||!['postgres:','postgresql:'].includes(db.protocol)) throw Error('ISOLATED_LOCAL_CONFIG_REQUIRED');
  if(!['disabled','test'].includes(c.stripe?.mode)) throw Error('TEST_MODE_ONLY');
  if(c.stripe.mode==='test'&&(!/^sk_test_[A-Za-z0-9]+$/.test(c.stripe.secretKey)||!/^whsec_[A-Za-z0-9]+$/.test(c.stripe.webhookSecret)||!/^acct_[A-Za-z0-9]+$/.test(c.stripe.accountId)||!c.stripe.environmentName?.trim())) throw Error('EXPLICIT_STRIPE_TEST_ACCOUNT_REQUIRED');
  return c;
}
export function requireSimulation(config) {
  validateConfig(config);
  if(config.stripe.mode!=='disabled'||process.env.NODE_ENV!=='test') throw Error('SIMULATION_DISABLED');
}

// Test entry points check the mode before constructing any SDK or database client.
export function requireOfflinePayments(config) {
  if (config.stripe?.mode !== 'disabled') throw Error('SIMULATION_DISABLED');
  return config;
}

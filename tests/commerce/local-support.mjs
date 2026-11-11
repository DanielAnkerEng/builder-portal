import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadConfig,requireOfflinePayments } from '../../commerce/config.mjs';
const testRun = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
export const privateRoot = new URL(testRun ? '../../../private/test/' : '../../../private/', import.meta.url);
export const config = requireOfflinePayments(loadConfig(new URL('runtime.json', privateRoot)));
if (testRun && config.supabaseUrl !== 'http://127.0.0.1:57321') throw Error('DEDICATED_TEST_STACK_REQUIRED');
export const service=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
export function client(token){return createClient(config.supabaseUrl,config.anonKey,{global:{headers:token?{Authorization:'Bearer '+token}:{}},auth:{persistSession:false,autoRefreshToken:false}});}
export function check({data,error}){if(error)throw Error(error.code+': '+error.message);return data;}
export function totp(seed){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of seed.replace(/=+$/,''))bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',key).update(counter).digest(),off=hash.at(-1)&15;return String((hash.readUInt32BE(off)&0x7fffffff)%1000000).padStart(6,'0');}
export function fixtures(){return JSON.parse(readFileSync(new URL('fixtures.json',privateRoot),'utf8'));}
export async function signIn(person,aal2=false){const c=client();const login=check(await c.auth.signInWithPassword({email:person.email,password:person.password}));if(!aal2)return {client:c,token:login.session.access_token,user:login.user};
  const factor=check(await c.auth.mfa.listFactors()).totp.find(f=>f.status==='verified');const challenge=check(await c.auth.mfa.challenge({factorId:factor.id}));const v=check(await c.auth.mfa.verify({factorId:factor.id,challengeId:challenge.id,code:totp(person.totp)}));return {client:c,token:v.access_token,user:login.user};}

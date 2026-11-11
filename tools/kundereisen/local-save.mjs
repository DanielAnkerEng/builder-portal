// Local runner for the original save-draft handler. No service credential is supplied.
// Only the pinned browser SDK, GoTrue user verification, profile read and the existing
// security_v2_save_draft RPC under the caller's JWT are available to this transport.
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const [profile,publicRoot,source]=process.argv.slice(2);
const db=JSON.parse(fs.readFileSync(path.join(profile,'binding.json'))).db;
if(!/^wreach-membership-[a-f0-9-]{36}-db$/.test(db))throw Error('Unexpected fixture');
const root=path.join(source,'supabase/functions');
const asModule=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const sdk=pathToFileURL(path.join(publicRoot,'js/vendor/local-supabase-2.112.4.js')).href;
const helper=stripTypeScriptTypes(fs.readFileSync(root+'/_shared/security.ts','utf8')).replace('npm:@supabase/supabase-js@2.112.4',sdk);
const handler=stripTypeScriptTypes(fs.readFileSync(root+'/save-draft/index.ts','utf8')).replace('../_shared/security.ts',asModule(helper));
const base='http://127.0.0.1';
let serve;
globalThis.Deno={serve:fn=>{serve=fn},env:{get:name=>name==='SUPABASE_URL'?base:'local-preview-public'}};
globalThis.fetch=async(resource,options={})=>{
 const req=new Request(resource,options),u=new URL(req.url);
 const dest={'/auth/v1/user':[9999,'/user','GET'],'/rest/v1/profiles':[3000,'/profiles','GET'],'/rest/v1/rpc/security_v2_save_draft':[3000,'/rpc/security_v2_save_draft','POST']}[u.pathname];
 if(!dest||u.origin!==base||req.method!==dest[2]||req.headers.get('authorization')!=='Bearer '+input.bearer)throw Error('Local transport denied');
 const config=[['url',base+':'+dest[0]+dest[1]+u.search],['request',req.method],['header','Authorization: Bearer '+input.bearer],['header','Accept: '+(req.headers.get('accept')||'application/json')],['header','Content-Type: application/json']];
 if(req.method==='POST')config.push(['data-raw',await req.text()]);
 const result=spawnSync('/usr/local/bin/docker',['--host','unix://'+os.homedir()+'/.docker/run/docker.sock','exec','-i',db,'curl','-q','-sS','--globoff','--max-time','8','--config','-','-w','\n%{http_code}'],{input:config.map(([k,v])=>k+' = '+JSON.stringify(v)).join('\n'),encoding:'utf8',timeout:11000,maxBuffer:3e6});
 if(result.status!==0)throw Error('Isolated upstream unavailable');
 const split=result.stdout.lastIndexOf('\n');return new Response(result.stdout.slice(0,split),{status:Number(result.stdout.slice(split+1)),headers:{'Content-Type':'application/json'}});
};
await import(asModule(handler));
const response=await serve(new Request(base+'/functions/v1/save-draft',{method:'POST',headers:{Authorization:'Bearer '+input.bearer,'Content-Type':'application/json'},body:input.body}));
process.stdout.write(JSON.stringify({status:response.status,data:await response.json()}));

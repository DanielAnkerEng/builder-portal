import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {expectedPilotFile} from './pilot-platform-contract.mjs';
import {localPlatformResponse} from '../../commerce/local-platform.mjs';
const root=new URL('../../',import.meta.url),baseline='85cb16a4156744c779b842d2bcbcf433f065a7d9';
const read=p=>readFileSync(new URL(p,root));
const original=p=>execFileSync('git',['show',baseline+':'+p],{cwd:root});

test('shared SDK and local config are original bytes; only pilot response swaps exact import/port',()=>{
  for(const file of ['js/supabase.js','js/supabase.local.js'])assert.deepEqual(read(file),original(file));
  const sdk=localPlatformResponse('/js/supabase.js',read('js/supabase.js')).toString();
  assert.equal(sdk,original('js/supabase.js').toString().replace("'https://esm.sh/@supabase/supabase-js@2'","'/commerce-vendor/supabase.js'"));
  const config=localPlatformResponse('/js/supabase.local.js',read('js/supabase.local.js')).toString();
  assert.equal(config,original('js/supabase.local.js').toString().replace(':54321',':56321'));
  assert.deepEqual(localPlatformResponse('/js/auth.js',read('js/auth.js')),original('js/auth.js'));
  for(const source of ['',sdk,original('js/supabase.js').toString().repeat(2)])assert.throws(()=>localPlatformResponse('/js/supabase.js',Buffer.from(source)),/PILOT_PLATFORM_SOURCE_CHANGED/);
});
test('local response adapter stays behind validated loopback server and portal-only path',()=>{
  const server=read('commerce/server.mjs').toString(),config=read('commerce/config.mjs').toString();
  assert.match(server,/validateConfig\(config\)/);
  assert.match(server,/listen\(port,'127\.0\.0\.1',ok\)/);
  assert.match(server,/req.headers.host!==new URL\(origin\).host/);
  assert.match(server,/if\(surface==='portal'\)bytes=localPlatformResponse\(path,bytes\)/);
  assert.match(config,/process.env.NODE_ENV==='production'/);
  assert.ok(config.includes("c.supabaseUrl === 'http://127.0.0.1:56321' && db.port === '56322'"));
});
test('reviewed contract still rejects other bytes, origin expansion and authorization weakening',()=>{
  const mutations=[
    ['js/admin-dashboard.mjs',s=>s.replace('encodeURIComponent(site.id)','site.company_id')],
    ['js/admin-dashboard.mjs',s=>s.replace("document.location?.origin === 'http://127.0.0.1:4307'",'true')],
    ['supabase/functions/admin-create-company/index.ts',s=>s.replace("=== 'bli-stogg-pilot:56321'","=== 'another-project'")],
    ['supabase/functions/admin-create-company/index.ts',s=>s.replace('platformAdmin: true','platformAdmin: false')],
    ['supabase/config.toml',s=>s.replace('jwt_expiry = 900','jwt_expiry = 3600')],
    ['supabase/config.toml',s=>s.replace('http://127.0.0.1:4308/#account','https://unapproved.invalid/**')],
    ['js/auth.js',s=>s+'\n// unreviewed change\n'],
    ['deploy/cloudflare/_headers',s=>s.replace("frame-ancestors 'none'","frame-ancestors *")],
  ];
  for(const [file,mutate] of mutations){const expected=expectedPilotFile(file,original(file));assert.notDeepEqual(Buffer.from(mutate(expected.toString())),expected,file);}
  assert.throws(()=>expectedPilotFile('js/admin-dashboard.mjs',Buffer.from('unrecognized baseline')),/BASELINE_CONTEXT_CHANGED/);
});
test('pilot redirects are exact loopback URLs and security-sensitive defaults remain baseline bytes',()=>{
  const config=read('supabase/config.toml').toString();
  assert.deepEqual(read('supabase/config.toml'),expectedPilotFile('supabase/config.toml',original('supabase/config.toml')));
  assert.match(config,/project_id = "bli-stogg-pilot"/);
  const urls=JSON.parse(config.match(/^additional_redirect_urls = (.+)$/m)[1]);
  assert.deepEqual(urls,['http://127.0.0.1:4307','http://127.0.0.1:4308/','http://127.0.0.1:4308/#account']);
  for(const u of urls){assert.equal(new URL(u).hostname,'127.0.0.1');assert.ok(!u.includes('*'));}
  assert.deepEqual(read('commerce/local-edge.env').toString().split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')),['WREACH_LOCAL_PILOT=bli-stogg-pilot:56321']);
  assert.equal(JSON.parse(read('package.json')).scripts['start:pilot:edge'],'supabase functions serve --workdir . --env-file commerce/local-edge.env');
  for(const file of ['js/auth.js','js/supabase-environment.mjs','js/supabase-public-config.mjs','supabase/functions/_shared/security.ts','deploy/cloudflare/_headers'])assert.deepEqual(read(file),original(file));
});
test('browser SDK is exactly pinned; production build excludes commerce/config/backend assets',()=>{
  assert.equal(JSON.parse(read('package.json')).dependencies['@supabase/supabase-js'],'2.117.2');
  assert.match(read('pnpm-lock.yaml').toString(),/'@supabase\/supabase-js@2\.117\.2':\n\s+resolution: \{integrity: sha512-/);
  const build=read('scripts/build-production.sh').toString();
  assert.doesNotMatch(build,/commerce\/|commerce-vendor|supabase\/config.toml/);
  // This build script already includes approved homepage/editor work after the
  // visual baseline. Pin its reviewed pilot starting commit, not a moving HEAD.
  assert.deepEqual(read('scripts/build-production.sh'),execFileSync('git',['show','64752e9711f4e7b333e3def518825ece57975cbe:scripts/build-production.sh'],{cwd:root}));
});

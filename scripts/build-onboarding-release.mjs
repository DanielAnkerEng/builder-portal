// Local packaging only. No deployment, credentials, network or Git mutations.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync,chmodSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {resolve,dirname,join,relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {BASELINE,EDGE_CONFIG,ROLLBACK_OVERLAY,RELEASE_MIGRATIONS,productionFiles,readSourceProvenance,verifyOnboardingRelease} from './onboarding-release-integrity.mjs'
if(process.argv.length!==2)throw new Error('No target overrides supported')
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const baseline=BASELINE
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'})
const sourceProvenance=readSourceProvenance(root)
// Rebuild first: an old dist/ can pass an allowlist check but contain stale code.
execFileSync('bash',['scripts/build-production.sh'],{cwd:root,stdio:'pipe'})
const out=mkdtempSync(join(tmpdir(),'wreach-onboarding-release-')),entries=[]
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const secretPattern=new RegExp('sb_'+'secret_'+'[A-Za-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
function put(path,bytes){
  if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..'))throw new Error('Invalid artifact path')
  const text=String(bytes)
  if(secretPattern.test(text))throw new Error('Credential pattern; no values printed')
  mkdirSync(dirname(join(out,path)),{recursive:true});writeFileSync(join(out,path),bytes,{flag:'wx',mode:0o444})
  entries.push({path,sha256:sha(bytes),bytes:Buffer.byteLength(bytes)})
}
const copy=(path,target)=>put(target,readFileSync(join(root,path)))
copy('deploy/supabase/create-customer-maintenance/index.ts','maintenance/supabase/functions/create-customer/index.ts')
copy('deploy/supabase/create-customer-maintenance/config.toml','maintenance/supabase/config.toml')
for(const file of ['create-customer/index.ts','_shared/security.ts','_shared/new-customer.ts'])copy('supabase/functions/'+file,'new-edge/supabase/functions/'+file)
put('new-edge/supabase/config.toml',EDGE_CONFIG)
for(const file of RELEASE_MIGRATIONS)copy('supabase/migrations/'+file,'migrations/'+file)
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])}
for(const file of walk(join(root,'dist')))copy(relative(root,file),'frontend/'+relative(join(root,'dist'),file))
// Reconstruct the approved previous UI from Git, never from a mutable checkout.
const build=git('show',baseline+':scripts/build-production.sh')
const previousFiles=productionFiles(build)
const files=previousFiles.map(file=>file==='_headers'?'deploy/cloudflare/_headers':file)
for(const file of files)put('previous-frontend/'+(file==='deploy/cloudflare/_headers'?'_headers':file),git('show',baseline+':'+file))
// Availability-safe UI rollback: previous admin UI, but keep issued-link landing
// routes and AAL2 onboarding routing. Exact overlay is versioned in the manifest.
const overlays=ROLLBACK_OVERLAY
for(const file of files){const target=file==='deploy/cloudflare/_headers'?'_headers':file;if(!overlays.includes(target))put('rollback-frontend/'+target,git('show',baseline+':'+file))}
for(const file of overlays)copy(file==='_headers'?'deploy/cloudflare/_headers':file,'rollback-frontend/'+file)
for(const entry of entries.filter(e=>e.path.endsWith('.js')||e.path.endsWith('.mjs'))){
  if(!entry.path.startsWith('rollback-frontend/'))continue
  const source=readFileSync(join(out,entry.path),'utf8')
  for(const m of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.\.?\/[^'"]+)['"]/g))readFileSync(resolve(dirname(join(out,entry.path)),m[1]))
}
entries.sort((a,b)=>a.path.localeCompare(b.path))
const digest=sha(JSON.stringify(entries))
assert.deepEqual(readSourceProvenance(root),sourceProvenance,'Source changed during packaging; discard candidate and rebuild')
const manifest={version:'sha256:'+digest,...sourceProvenance,previousFrontendSource:baseline,rollbackOverlay:overlays,
  deployApproved:false,reviewStatus:'LOCAL_REVIEW_ONLY',
  previousFrontendPurpose:'HISTORICAL_REFERENCE_NOT_COMPATIBLE_ROLLBACK',sdkVersion:'2.117.2',files:entries}
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o444})
// Validate the actual output bytes, not merely the packaging source/overlay list.
verifyOnboardingRelease(out,{
  sourceProvenance,
  frontendFiles:productionFiles(readFileSync(join(root,'scripts/build-production.sh'),'utf8')),previousFiles,
  readPrevious:path=>Buffer.from(git('show',baseline+':'+(path==='_headers'?'deploy/cloudflare/_headers':path))),
  readCurrent:path=>readFileSync(join(root,path==='_headers'?'deploy/cloudflare/_headers':path))
})
assert.deepEqual(readSourceProvenance(root),sourceProvenance,'Source changed during validation; candidate must not be used')
// Frozen snapshot; further source changes require a new release directory/hash.
const directories=[out,...walkDirectories(out)]
function walkDirectories(dir){return readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).flatMap(e=>[join(dir,e.name),...walkDirectories(join(dir,e.name))])}
for(const dir of directories.reverse())chmodSync(dir,0o555)
console.log(JSON.stringify({artifact:out,version:manifest.version,files:entries.length,deployApproved:false}))

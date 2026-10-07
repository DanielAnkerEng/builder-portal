// Read-only validation of generated artifacts. No network, Auth or deployment.
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,lstatSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {join,dirname,resolve,relative} from 'node:path'

export const BASELINE='6e0a9aaea3875d6cf3c5d7ddcf238f403e977a39'
export const ROLLBACK_OVERLAY=Object.freeze([
  'onboarding.html','js/onboarding.js','js/customer-onboarding.mjs','js/auth.js',
  'js/post-auth-destination.mjs','js/supabase.js','_headers'
])
const packagedBackend=[
  'maintenance/supabase/functions/create-customer/index.ts','maintenance/supabase/config.toml',
  'new-edge/supabase/functions/create-customer/index.ts','new-edge/supabase/functions/_shared/security.ts',
  'new-edge/supabase/functions/_shared/new-customer.ts','new-edge/supabase/config.toml',
  'migrations/20261006130000_customer_onboarding.sql','migrations/20261006140000_customer_invitation_recovery.sql'
]
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const check=(condition,message)=>{if(!condition)throw new Error(message)}
const secretPattern=new RegExp('sb_'+'secret_'+'[A-Za-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')

export const BACKEND_SOURCES=Object.freeze({
  'maintenance/supabase/functions/create-customer/index.ts':'deploy/supabase/create-customer-maintenance/index.ts',
  'maintenance/supabase/config.toml':'deploy/supabase/create-customer-maintenance/config.toml',
  'new-edge/supabase/functions/create-customer/index.ts':'supabase/functions/create-customer/index.ts',
  'new-edge/supabase/functions/_shared/security.ts':'supabase/functions/_shared/security.ts',
  'new-edge/supabase/functions/_shared/new-customer.ts':'supabase/functions/_shared/new-customer.ts',
  'migrations/20261006130000_customer_onboarding.sql':'supabase/migrations/20261006130000_customer_onboarding.sql',
  'migrations/20261006140000_customer_invitation_recovery.sql':'supabase/migrations/20261006140000_customer_invitation_recovery.sql'
})
export const EDGE_CONFIG='[functions.create-customer]\nenabled = true\nverify_jwt = true\n'

// Inspect only explicit release inputs, including files not yet tracked by Git.
// dist/, unrelated work and private runtime material are not source inputs.
export function releaseSourceFiles(build) {
  return [...new Set([...productionFiles(build).map(p=>p==='_headers'?'deploy/cloudflare/_headers':p),
    ...Object.values(BACKEND_SOURCES),'supabase/config.toml',
    'scripts/build-production.sh','scripts/build-onboarding-release.mjs','scripts/onboarding-release-integrity.mjs',
    'tests/security/static_production_artifact.sh','tests/security/onboarding-release.test.mjs',
    'tests/security/onboarding-bootstrap.test.mjs'])].sort()
}

export function readSourceProvenance(root) {
  const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']})
  const sourceHead=git('rev-parse','HEAD').toString().trim()
  const sourceBranch=git('branch','--show-current').toString().trim()
  check(sourceBranch==='security-auth-upgrade'&&/^[a-f0-9]{40}$/.test(sourceHead),'Unexpected source branch/HEAD')
  // A newer source commit is allowed; the historical UI reference never moves.
  git('merge-base','--is-ancestor',BASELINE,sourceHead)
  const paths=releaseSourceFiles(readFileSync(join(root,'scripts/build-production.sh'),'utf8'))
  let sourceContainsUncommittedChanges=Boolean(git('status','--porcelain=v1','--untracked-files=all','--',...paths).length)
  const sourceFiles=paths.map(path=>{
    check(lstatSync(join(root,path)).isFile(),'Source must be a regular file: '+path)
    const bytes=readFileSync(join(root,path))
    // Compare HEAD directly too: even a new ignored input must count as dirty.
    let committed
    try {committed=git('show',sourceHead+':'+path)} catch {sourceContainsUncommittedChanges=true}
    if(!committed?.equals(bytes))sourceContainsUncommittedChanges=true
    return {path,bytes:bytes.length,sha256:sha(bytes)}
  })
  return {sourceHead,sourceBranch,sourceContainsUncommittedChanges,sourceFiles}
}

export function verifySourceProvenance(manifest,expected) {
  check(manifest.deployApproved===false&&manifest.reviewStatus==='LOCAL_REVIEW_ONLY','Review-only provenance missing')
  check(manifest.previousFrontendSource===BASELINE,'Historical baseline changed')
  check(manifest.sourceBranch==='security-auth-upgrade'&&/^[a-f0-9]{40}$/.test(manifest.sourceHead),'Invalid source identity')
  check(typeof manifest.sourceContainsUncommittedChanges==='boolean','Missing source dirty state')
  check(expected&&Array.isArray(expected.sourceFiles)&&expected.sourceFiles.length>0,'Independent source evidence required')
  for(const field of ['sourceHead','sourceBranch','sourceContainsUncommittedChanges','sourceFiles'])
    assert.deepEqual(manifest[field],expected[field],'Conflicting source provenance: '+field)
}

export function productionFiles(build) {
  const files=['_headers']
  for(const [name,prefix] of [['html_files',''],['css_files','css/'],['js_files','js/']]) {
    const value=build.match(new RegExp(name+'=\\(([\\s\\S]*?)\\)'))?.[1]
    check(value,'Production allowlist unavailable')
    for(const word of value.trim().split(/\s+/)) {
      check(/^[\w.-]+$/.test(word)&&!word.includes('..'),'Invalid production allowlist entry')
      files.push(prefix+word)
    }
  }
  check(new Set(files).size===files.length,'Duplicate production file')
  return files
}

export function verifySdkArtifacts(directory) {
  const snapshots=['frontend','rollback-frontend'].map(scope=>{
    const bytes=readFileSync(join(directory,scope,'js/supabase.js'))
    const imports=[...bytes.toString().matchAll(/from\s+['"](https:\/\/esm\.sh\/@supabase\/supabase-js[^'"]*)['"]/g)]
    check(imports.length===1&&imports[0][1]==='https://esm.sh/@supabase/supabase-js@2.117.2',scope+': tested SDK pin missing')
    return bytes
  })
  check(snapshots[0].equals(snapshots[1]),'Frontend/rollback SDK clients differ')
  return '2.117.2'
}

function walk(directory,prefix='') {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    check(!entry.isSymbolicLink(),'Artifact symlinks are forbidden')
    const path=prefix+entry.name
    if(entry.isDirectory())return walk(join(directory,entry.name),path+'/')
    check(entry.isFile(),'Unexpected artifact file type')
    return [path]
  })
}

export function verifyOnboardingRelease(directory,{frontendFiles,previousFiles,readPrevious,readCurrent,sourceProvenance}) {
  const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8'))
  verifySourceProvenance(manifest,sourceProvenance)
  check(manifest.previousFrontendPurpose==='HISTORICAL_REFERENCE_NOT_COMPATIBLE_ROLLBACK','Historical artifact must not be a rollback target')
  assert.deepEqual(manifest.rollbackOverlay,ROLLBACK_OVERLAY)
  const rollbackFiles=[...new Set([...previousFiles,...ROLLBACK_OVERLAY])]
  const expected=[...packagedBackend,...frontendFiles.map(p=>'frontend/'+p),
    ...previousFiles.map(p=>'previous-frontend/'+p),...rollbackFiles.map(p=>'rollback-frontend/'+p)].sort()
  assert.deepEqual(walk(directory).sort(),[...expected,'manifest.json'].sort(),'Unexpected/missing artifact files')
  check(Array.isArray(manifest.files),'Manifest files missing')
  assert.deepEqual(manifest.files.map(e=>e.path).sort(),expected,'Manifest allowlist mismatch')
  check(manifest.version==='sha256:'+sha(JSON.stringify(manifest.files)),'Manifest content ID mismatch')
  for(const entry of manifest.files) {
    const bytes=readFileSync(join(directory,entry.path))
    check(bytes.length===entry.bytes&&sha(bytes)===entry.sha256,'Artifact byte/hash mismatch: '+entry.path)
    // Only non-secret public anon JWTs may be embedded in browser configuration.
    const text=bytes.toString()
    check(!secretPattern.test(text),'Secret pattern in artifact')
    for(const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      let payload
      try {payload=JSON.parse(Buffer.from(token[1],'base64url').toString())} catch {throw new Error('Unrecognized token-shaped artifact content')}
      check(payload.role==='anon'&&!payload.sub&&!payload.session_id,'Non-public token in artifact')
    }
  }
  for(const [target,source] of Object.entries(BACKEND_SOURCES))
    check(readFileSync(join(directory,target)).equals(readCurrent(source)),'Backend source differs: '+target)
  check(readFileSync(join(directory,'new-edge/supabase/config.toml'),'utf8')===EDGE_CONFIG,'Unexpected generated Edge config')
  check(readCurrent('deploy/supabase/create-customer-maintenance/config.toml').toString()===EDGE_CONFIG,'Unexpected maintenance config')
  const functionConfig=readCurrent('supabase/config.toml').toString().match(/^\[functions\.create-customer\]\s*\n([^[]*)/m)?.[1]
  check(functionConfig&&/^enabled = true$/m.test(functionConfig)&&/^verify_jwt = true$/m.test(functionConfig),'Source Edge JWT config differs')
  for(const [scope,files,expectedBytes] of [
    ['frontend',frontendFiles,readCurrent],['previous-frontend',previousFiles,readPrevious],
    ['rollback-frontend',rollbackFiles,path=>ROLLBACK_OVERLAY.includes(path)?readCurrent(path):readPrevious(path)]
  ]) {
    for(const path of files) {
      check(readFileSync(join(directory,scope,path)).equals(expectedBytes(path)),scope+': source bytes differ: '+path)
      if(!/\.m?js$/.test(path))continue
      const source=readFileSync(join(directory,scope,path),'utf8')
      for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.\.?\/[^'"]+)['"]/g)) {
        const target=relative(join(directory,scope),resolve(dirname(join(directory,scope,path)),match[1]))
        check(files.includes(target),'Missing/out-of-scope relative module: '+path)
      }
    }
  }
  const sdkVersion=verifySdkArtifacts(directory)
  check(manifest.sdkVersion===sdkVersion,'Manifest SDK version differs')
  for(const scope of ['frontend','rollback-frontend']) {
    const headers=readFileSync(join(directory,scope,'_headers'),'utf8')
    for(const page of ['login','mfa','security-settings','admin','builder','onboarding'])for(const suffix of ['','.html']) {
      const route='/'+page+suffix
      const blocks=headers.split(/\n(?=\S)/).filter(block=>block.split('\n')[0]===route)
      check(blocks.length===1&&blocks[0].split('\n').filter(line=>line.trim().startsWith('Cache-Control:')).join('')==='  Cache-Control: no-store, max-age=0','Missing exact no-store policy: '+route)
    }
    check((headers.match(/^  Cache-Control: no-store, max-age=0$/gm)||[]).length===12,'Unexpected no-store count')
  }
  return {files:expected.length,sdkVersion,frontendFiles:frontendFiles.length,previousFiles:previousFiles.length,rollbackFiles:rollbackFiles.length,deployApproved:false}
}

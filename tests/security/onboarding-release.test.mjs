import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,chmodSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {BASELINE,ROLLBACK_OVERLAY,productionFiles,releaseSourceFiles,readSourceProvenance,verifySourceProvenance,verifySdkArtifacts,verifyOnboardingRelease} from '../../scripts/onboarding-release-integrity.mjs'

const repo=resolve(import.meta.dirname,'../..')
const source=readFileSync(join(repo,'js/supabase.js'),'utf8')
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'wreach-release-regression-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  for(const scope of ['frontend','rollback-frontend','previous-frontend']) {
    mkdirSync(join(root,scope,'js'),{recursive:true})
    writeFileSync(join(root,scope,'js/supabase.js'),scope==='previous-frontend'?source.replace('@2.117.2','@2'):source)
  }
  return root
}
test('generated frontend and rollback retain tested SDK while historical reference is untouched',t=>{
  const root=fixture(t)
  assert.equal(verifySdkArtifacts(root),'2.117.2')
  assert.match(readFileSync(join(root,'previous-frontend/js/supabase.js'),'utf8'),/supabase-js@2'/)
  assert.ok(ROLLBACK_OVERLAY.includes('js/supabase.js'))
})
for(const scope of ['frontend','rollback-frontend'])for(const version of ['2','2.117.3','2.117.2?deps=unreviewed']) {
  test('generated '+scope+' rejects missing/tested-version drift: '+version,t=>{
    const root=fixture(t)
    writeFileSync(join(root,scope,'js/supabase.js'),source.replace('@2.117.2','@'+version))
    assert.throws(()=>verifySdkArtifacts(root),/tested SDK pin missing/)
  })
}
test('generated clients must match, not just use the same SDK string',t=>{
  const root=fixture(t)
  writeFileSync(join(root,'rollback-frontend/js/supabase.js'),source+'\n// unexpected change\n')
  assert.throws(()=>verifySdkArtifacts(root),/clients differ/)
})
test('missing generated rollback client fails closed',t=>{
  const root=fixture(t)
  rmSync(join(root,'rollback-frontend/js/supabase.js'))
  assert.throws(()=>verifySdkArtifacts(root))
})
test('packager rebuilds before copying dist and validates output before freezing',()=>{
  const build=readFileSync(join(repo,'scripts/build-onboarding-release.mjs'),'utf8')
  assert.ok(build.indexOf("['scripts/build-production.sh']")<build.indexOf("walk(join(root,'dist'))"))
  assert.ok(build.indexOf('verifyOnboardingRelease(out,')<build.indexOf('chmodSync(dir,0o555)'))
  assert.match(build,/mkdtempSync/)
  assert.match(build,/deployApproved:false,reviewStatus:'LOCAL_REVIEW_ONLY'/)
  assert.match(build,/\.\.\.sourceProvenance/)
  assert.doesNotMatch(build,/sourceContainsUncommittedChanges:true|sourceHead:baseline/)
  assert.equal((build.match(/readSourceProvenance\(root\)/g)||[]).length,3)
})

test('real isolated Git provenance: clean/newer HEAD, dirty/untracked inputs, invalid provenance',async t=>{
  const root=mkdtempSync(join(tmpdir(),'wreach-provenance-git-'))
  t.after(()=>rmSync(root,{recursive:true,force:true}))
  // Read existing historical objects through an alternate. All test Git objects,
  // commits, index and refs are written only inside this disposable repository.
  const objects=execFileSync('git',['rev-parse','--git-path','objects'],{cwd:repo,encoding:'utf8'}).trim()
  const env={...process.env,GIT_ALTERNATE_OBJECT_DIRECTORIES:resolve(repo,objects),
    GIT_AUTHOR_NAME:'Synthetic Fixture',GIT_AUTHOR_EMAIL:'fixture@test.invalid',
    GIT_COMMITTER_NAME:'Synthetic Fixture',GIT_COMMITTER_EMAIL:'fixture@test.invalid'}
  const git=(...args)=>execFileSync('git',args,{cwd:root,env,stdio:['ignore','pipe','pipe'],encoding:'utf8'}).trim()
  git('init','--initial-branch=security-auth-upgrade')
  writeFileSync(join(root,'.git/objects/info/alternates'),resolve(repo,objects)+'\n')
  const build=readFileSync(join(repo,'scripts/build-production.sh'),'utf8')
  const paths=releaseSourceFiles(build)
  for(const path of paths) {
    mkdirSync(join(root,path,'..'),{recursive:true})
    writeFileSync(join(root,path),path==='scripts/build-production.sh'?build:'// synthetic release input\n')
  }
  const snapshot=parent=>{
    git('add','--',...paths)
    const head=git('commit-tree',git('write-tree'),'-p',parent,'-m','Synthetic provenance test only')
    git('update-ref','refs/heads/security-auth-upgrade',head)
    return head
  }
  const head=snapshot(BASELINE)
  const clean=readSourceProvenance(root)
  assert.equal(clean.sourceHead,head);assert.notEqual(head,BASELINE)
  assert.equal(clean.sourceContainsUncommittedChanges,false)
  const manifest=p=>({...p,previousFrontendSource:BASELINE,reviewStatus:'LOCAL_REVIEW_ONLY',deployApproved:false})
  verifySourceProvenance(manifest(clean),clean)
  // Unrelated private/generated paths neither affect provenance nor get read.
  writeFileSync(join(root,'unrelated.synthetic'),'unrelated')
  assert.deepEqual(readSourceProvenance(root),clean)
  writeFileSync(join(root,'js/onboarding.js'),'// changed synthetic input\n')
  const dirty=readSourceProvenance(root)
  assert.equal(dirty.sourceContainsUncommittedChanges,true)
  verifySourceProvenance(manifest(dirty),dirty)
  assert.throws(()=>verifySourceProvenance(manifest(clean),dirty),/Conflicting source/)
  const newer=snapshot(head),newClean=readSourceProvenance(root)
  assert.equal(newClean.sourceHead,newer);assert.notEqual(newer,head)
  assert.equal(newClean.sourceContainsUncommittedChanges,false)
  assert.equal(manifest(newClean).previousFrontendSource,BASELINE)
  verifySourceProvenance(manifest(newClean),newClean)
  git('rm','--cached','--','js/onboarding.js')
  const withoutInput=git('commit-tree',git('write-tree'),'-p',newer,'-m','Synthetic untracked-input test')
  git('update-ref','refs/heads/security-auth-upgrade',withoutInput)
  const untracked=readSourceProvenance(root)
  assert.equal(untracked.sourceContainsUncommittedChanges,true)
  assert.ok(untracked.sourceFiles.some(e=>e.path==='js/onboarding.js'))
  writeFileSync(join(root,'.gitignore'),'js/onboarding.js\n')
  assert.equal(readSourceProvenance(root).sourceContainsUncommittedChanges,true)
  for(const [field,value] of [['sourceHead',BASELINE],['sourceHead','not-a-commit'],['sourceBranch','main'],
    ['sourceContainsUncommittedChanges',false],['sourceContainsUncommittedChanges','true'],['sourceFiles',[]],
    ['previousFrontendSource',newer],['deployApproved',true],['reviewStatus','APPROVED']])
    await t.test('reject contradictory '+field+': '+String(value),()=>assert.throws(()=>verifySourceProvenance({...manifest(untracked),[field]:value},untracked)))
  assert.throws(()=>verifySourceProvenance(manifest(untracked)),/Independent source evidence/)
  git('symbolic-ref','HEAD','refs/heads/main');git('update-ref','HEAD',withoutInput)
  assert.throws(()=>readSourceProvenance(root),/Unexpected source/)
  git('symbolic-ref','HEAD','refs/heads/security-auth-upgrade')
  const unrelated=git('commit-tree',git('write-tree'),'-m','Unrelated synthetic history')
  git('update-ref','HEAD',unrelated)
  assert.throws(()=>readSourceProvenance(root))
})

// Opt-in only reads the named local frozen candidate; never rebuilds/deploys it.
// The packager always runs this same full byte/hash verification before freezing.
test('actual generated release: allowlists, source bytes, SDK, routes, hashes and negative tamper tests',
  {skip:!process.env.WREACH_ONBOARDING_RELEASE_CANDIDATE},async t=>{
    const candidate=process.env.WREACH_ONBOARDING_RELEASE_CANDIDATE
    assert.ok(candidate.startsWith('/'))
    const git=path=>execFileSync('git',['show',BASELINE+':'+path],{cwd:repo})
    const options={
      sourceProvenance:readSourceProvenance(repo),
      frontendFiles:productionFiles(readFileSync(join(repo,'scripts/build-production.sh'),'utf8')),
      previousFiles:productionFiles(git('scripts/build-production.sh').toString()),
      readPrevious:path=>git(path==='_headers'?'deploy/cloudflare/_headers':path),
      readCurrent:path=>readFileSync(join(repo,path==='_headers'?'deploy/cloudflare/_headers':path))
    }
    assert.equal(verifyOnboardingRelease(candidate,options).sdkVersion,'2.117.2')
    for(const [name,mutate] of [
      ['missing SDK overlay',root=>writeFileSync(join(root,'rollback-frontend/js/supabase.js'),source.replace('@2.117.2','@2'))],
      ['tampered historical reference',root=>writeFileSync(join(root,'previous-frontend/js/supabase.js'),source)],
      ['missing landing route',root=>rmSync(join(root,'rollback-frontend/onboarding.html'))],
      ['unexpected preview file',root=>writeFileSync(join(root,'frontend/production-auth-preview.html'),'synthetic')],
      ['deployment approval drift',root=>{const p=join(root,'manifest.json'),m=JSON.parse(readFileSync(p));m.deployApproved=true;writeFileSync(p,JSON.stringify(m))}],
      ['dirty state drift',root=>{const p=join(root,'manifest.json'),m=JSON.parse(readFileSync(p));m.sourceContainsUncommittedChanges=!m.sourceContainsUncommittedChanges;writeFileSync(p,JSON.stringify(m))}],
      ['source HEAD drift',root=>{const p=join(root,'manifest.json'),m=JSON.parse(readFileSync(p));m.sourceHead='a'.repeat(40);writeFileSync(p,JSON.stringify(m))}],
      ['manifest hash drift',root=>{const p=join(root,'manifest.json'),m=JSON.parse(readFileSync(p));m.files[0].sha256='0'.repeat(64);writeFileSync(p,JSON.stringify(m))}]
    ])await t.test(name,()=>{
      const copy=mkdtempSync(join(tmpdir(),'wreach-release-tamper-'))
      // Change only a disposable copy. Previously frozen candidates are read-only.
      function writable(dir){chmodSync(dir,0o700);for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())writable(p);else chmodSync(p,0o600)}}
      try{cpSync(candidate,copy,{recursive:true});writable(copy);mutate(copy);assert.throws(()=>verifyOnboardingRelease(copy,options))}
      finally{writable(copy);rmSync(copy,{recursive:true,force:true})}
    })
  })

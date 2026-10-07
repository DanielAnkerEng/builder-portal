import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

const root = new URL('../../', import.meta.url)
const source = await readFile(new URL('supabase/functions/_shared/security.ts', root), 'utf8')
const transportSource = await readFile(new URL('supabase/functions/_shared/new-customer.ts', root), 'utf8')
const transportUrl = 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(transportSource)).toString('base64')
// Test-only SDK double: no production token, signing key or alternative app auth path.
const token = 'e30.eyJ0ZXN0Ijp0cnVlfQ.signature'
let serial = 0
async function fixture(options = {}) {
  const calls = [], configurations = []
  const userClient = {
    auth: {
      async getUser(jwt) {
        calls.push(['getUser', jwt])
        return { data: { user: options.invalid ? null : { id: 'verified-user' } }, error: options.invalid ? new Error('private auth detail') : null }
      },
      mfa: { async getAuthenticatorAssuranceLevel(jwt) {
        calls.push(['aal', jwt])
        return { data: options.noAssurance ? null : { currentLevel: options.aal ?? 'aal2', nextLevel: 'aal2' }, error: options.aalError ? new Error('private MFA detail') : null }
      } },
    },
    from(table) {
      const filters = []
      return { select(columns) {
        calls.push(['select', table, columns, filters])
        return { eq(key, value) {
          filters.push([key, value])
          return this
        }, async maybeSingle() {
          if (table === 'profiles') return { data: options.missingProfile ? null : { status: options.profile ?? 'active' }, error: options.profileError ? new Error('private profile detail') : null }
          return { data: options.admin === false ? null : { user_id: 'verified-user' }, error: options.adminError ? new Error('private admin detail') : null }
        } }
      } }
    },
  }
  const privileged = { rpc() { throw new Error('Unexpected privileged write') } }
  globalThis.__c0CreateClient = (_url, _key, config) => {
    configurations.push(config)
    return configurations.length === 1 ? userClient : privileged
  }
  globalThis.Deno = { env: { get: name => name === 'SUPABASE_URL' ? 'http://127.0.0.1:54321' : 'test-only-placeholder' } }
  const js = stripTypeScriptTypes(source.replace(/^import .*from 'npm:[^']+'\n/, 'const createClient = globalThis.__c0CreateClient\n'))
  const url = 'data:text/javascript;base64,' + Buffer.from(js + '\n// fixture ' + serial++).toString('base64')
  const helper = await import(url)
  delete globalThis.__c0CreateClient
  return { ...helper, url, calls, configurations, userClient, privileged }
}
const req = value => new Request('http://127.0.0.1/edge-test', { method: 'POST', headers: value === undefined ? {} : { Authorization: value }, body: '{}' })
async function denied(f, request, status, options) {
  await assert.rejects(f.requireAal2(request, options), e => e instanceof Response && e.status === status)
  assert.ok(f.configurations.length < 2, 'No privileged client before authorization completes')
}
for (const [label, header] of [['missing',undefined],['non-Bearer','Basic abc'],['empty','Bearer '],['malformed','Bearer abc'],['extra segments','Bearer a.b.c.d'],['multiple tokens','Bearer a.b.c, Bearer x.y.z']]) {
  test(label + ' authorization denied', async () => { const f = await fixture(); await denied(f,req(header),401); assert.equal(f.calls.length,0) })
}
for (const label of ['invalid','expired']) test(label + ' token rejected by Auth', async () => {
  const f = await fixture({ invalid:true }); await denied(f,req('Bearer '+token),401)
  assert.deepEqual(f.calls,[['getUser',token]])
})
test('AAL1 denied even with nextLevel aal2', async () => {
  const f = await fixture({ aal:'aal1' }); await denied(f,req('Bearer '+token),403)
})
for (const options of [{ noAssurance:true },{ aalError:true }]) test('Assurance failure denied', async () => {
  const f = await fixture(options); await denied(f,req('Bearer '+token),403)
})
for (const options of [{ profile:'suspended' },{ profile:'deactivated' },{ missingProfile:true },{ profileError:true }]) test('Unavailable/inactive profile denied', async () => {
  const f = await fixture(options); await denied(f,req('Bearer '+token),403)
})
for (const label of ['non-admin','inactive admin']) test(label+' denied when platformAdmin requested', async () => {
  const f = await fixture({ admin:false }); await denied(f,req('Bearer '+token),403,{ platformAdmin:true })
  assert.ok(f.calls.some(c=>c[0]==='select'&&c[1]==='platform_admins'&&c[3].some(([k,v])=>k==='is_active'&&v===true)))
})
test('Admin lookup failure denied', async () => {
  const f = await fixture({ adminError:true }); await denied(f,req('Bearer '+token),403,{ platformAdmin:true })
})
test('Active AAL2 admin accepted; verified identity and exact JWT retained', async () => {
  const f = await fixture()
  const ctx = await f.requireAal2(req('bEaReR '+token),{ platformAdmin:true })
  assert.equal(ctx.user.id,'verified-user')
  assert.equal(ctx.userClient,f.userClient)
  assert.equal(ctx.adminClient,f.privileged)
  assert.deepEqual(f.calls.slice(0,2),[['getUser',token],['aal',token]])
  assert.equal(f.configurations[0].global.headers.Authorization,'Bearer '+token)
  assert.deepEqual(f.configurations[0].auth,{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false })
  assert.ok(f.calls.filter(c=>c[0]==='select').every(c=>c[3].some(([k,v])=>['id','user_id'].includes(k)&&v==='verified-user')))
})
test('Normal active AAL2 customer accepted without optional platform-admin requirement', async () => {
  const f = await fixture({ admin:false })
  await f.requireAal2(req('Bearer '+token))
  assert.ok(!f.calls.some(c=>c[1]==='platform_admins'))
})
test('No session synthesis, browser storage, JWT decoding or sensitive logging', () => {
  assert.doesNotMatch(source,/localStorage|sessionStorage|setSession|signIn|atob|decodeJWT|console\./)
  assert.match(source,/getUser\(jwt\)/)
  assert.match(source,/getAuthenticatorAssuranceLevel\(jwt\)/)
  assert.match(source,/supabase-js@2\.112\.4/)
})
// Retired admin-provision-company is covered by no-write tombstone tests.
const consumers = ['save-draft','publish-site','manage-security-keys','critical-company-action','import-legacy-site','create-customer']
for (const name of consumers) {
  test(name+' rejects AAL1 through actual shared helper', async () => {
    const f = await fixture({ aal:'aal1' })
    let handler
    globalThis.Deno.serve = fn => { handler = fn }
    const text = await readFile(new URL('supabase/functions/'+name+'/index.ts',root),'utf8')
    const js = stripTypeScriptTypes(text.replace("'../_shared/security.ts'",JSON.stringify(f.url)).replace("'../_shared/new-customer.ts'",JSON.stringify(transportUrl)))
    await import('data:text/javascript;base64,'+Buffer.from(js+'\n// '+serial++).toString('base64'))
    assert.equal((await handler(req('Bearer '+token))).status,403)
    assert.equal(f.configurations.length,1)
  })
  test(name+' reaches existing input validation with AAL2 without performing writes', async () => {
    const f = await fixture()
    let handler
    globalThis.Deno.serve = fn => { handler = fn }
    const text = await readFile(new URL('supabase/functions/'+name+'/index.ts',root),'utf8')
    const js = stripTypeScriptTypes(text.replace("'../_shared/security.ts'",JSON.stringify(f.url)).replace("'../_shared/new-customer.ts'",JSON.stringify(transportUrl)))
    await import('data:text/javascript;base64,'+Buffer.from(js+'\n// '+serial++).toString('base64'))
    assert.equal((await handler(req('Bearer '+token))).status,400)
    assert.equal(f.configurations.length,2)
  })
}

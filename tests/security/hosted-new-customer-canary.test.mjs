import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createPlan, main, validateLocalContract } from '../../scripts/hosted-new-customer-canary.mjs'

const read = file => readFile(new URL('../../' + file, import.meta.url), 'utf8')
const config = await read('supabase/config.toml')
const source = await read('supabase/functions/admin-create-company/index.ts')
const retired = await read('supabase/functions/admin-provision-company/index.ts')

test('default plan is deterministic, exact fixed target and eight ordered cases', async () => {
  const plan = createPlan()
  assert.equal(plan.target, 'https://oqwpfnmqeriupujpssxz.supabase.co')
  assert.equal(plan.mode, 'PLAN_ONLY'); assert.equal(plan.executionEnabled, false)
  assert.deepEqual(plan.cases.map(c => c.id), ['allowed-preflight','denied-preflight','unsupported-method',
    'missing-jwt','invalid-jwt','authorized-missing-key','retired-invalid-jwt','retired-authorized'])
  assert.equal(await main(), await main())
  assert.ok(plan.cases.every(c => c.body === null && c.idempotencyKey === null && c.inspect.length === 8))
})
test('no overrides, write payloads, credentials, arbitrary targets or CLI execution', async () => {
  for (const options of [{ target: 'http://localhost' }, { body: { company: { name: 'Synthetic' } } },
    { serviceRole: 'synthetic' }, { token: 'synthetic' }, { execute: true }, { rpc: 'anything' }])
    assert.throws(() => createPlan(options), /NO_OVERRIDES/)
  for (const args of [['--execute'], ['--target', 'http://localhost'], ['--body', '{}']])
    await assert.rejects(main(args), /NO_ARGUMENTS/)
})
test('even future opt-in cannot execute; no network, subprocess or credential mechanism', async () => {
  const old = process.env.WREACH_HOSTED_CANARY, fetch = globalThis.fetch
  try {
    process.env.WREACH_HOSTED_CANARY = '1'
    globalThis.fetch = () => { throw new Error('NETWORK_FORBIDDEN') }
    assert.equal(JSON.parse(await main()).executionEnabled, false)
    const script = await read('scripts/hosted-new-customer-canary.mjs')
    assert.doesNotMatch(script, /fetch\s*\(|node:(?:http|https|net|tls|child_process)|process\.env|createClient|service_role/)
    const secretPrefix = new RegExp('sb_' + 'secret_')
    assert.doesNotMatch(script, secretPrefix)
    assert.doesNotMatch(await main(), secretPrefix)
    assert.doesNotMatch(await main(), /Bearer\s|eyJ[A-Za-z0-9_-]+\.|password|cookie/i)
  } finally {
    globalThis.fetch = fetch
    if (old === undefined) delete process.env.WREACH_HOSTED_CANARY
    else process.env.WREACH_HOSTED_CANARY = old
  }
})
test('local contract validation refuses config and pre-RPC drift', () => {
  assert.equal(validateLocalContract(config, source, retired), true)
  assert.throws(() => validateLocalContract(config.replaceAll('verify_jwt = true', 'verify_jwt = false'), source, retired))
  assert.throws(() => validateLocalContract(config, source.replace('!key || !uuid.test(key)', 'false'), retired))
  assert.throws(() => validateLocalContract(config, source, retired.replace('LEGACY_PROVISIONING_RETIRED', 'OTHER')))
})
test('actual handler: authorized missing key stops BEFORE body and RPC', async () => {
  const url = text => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(text)).toString('base64')
  const auth = url('export async function requireAal2(){return {userClient:{rpc(){globalThis.__p3Forbidden++;throw new Error("RPC_FORBIDDEN")}}}}')
  const body = url('export function readPayload(){globalThis.__p3Forbidden++;throw new Error("BODY_FORBIDDEN")} export function validateStructure(){globalThis.__p3Forbidden++;throw new Error("VALIDATION_FORBIDDEN")} export class RequestError extends Error {}')
  let handler
  const old = globalThis.Deno
  try {
    globalThis.__p3Forbidden = 0
    globalThis.Deno = { serve: fn => { handler = fn } }
    await import(url(source.replace("'../_shared/security.ts'", JSON.stringify(auth))
      .replace("'../_shared/new-customer.ts'", JSON.stringify(body))))
    const response = await handler(new Request('http://unit.invalid/', {
      method: 'POST', headers: { origin: 'https://wreach.no' }, body: '',
    }))
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { ok: false, error: { code: 'INVALID_REQUEST' } })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('vary'), 'Origin')
    assert.equal(globalThis.__p3Forbidden, 0)
  } finally { globalThis.Deno = old; delete globalThis.__p3Forbidden }
})

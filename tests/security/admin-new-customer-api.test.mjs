import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNewCustomerApi, resultMatchesAttempt } from '../../js/admin-new-customer-api.mjs'
import * as state from '../../js/admin-new-customer-state.mjs'
const key = '11111111-1111-4111-8111-111111111111'
const companyId = '22222222-2222-4222-8222-222222222222'
const success = { ok: true, status: 'completed', operationId: key, companyId }
const attempt = () => state.prepareSubmission(state.setStep(state.updateCompany(state.createWizardState(), { name: 'Synthetic company' }), 5), () => key).submission
function fixture(response = { data: success, error: null }) {
  const calls = []
  const execute = async (type, ...args) => {
    calls.push({ type, args })
    if (response instanceof Error) throw response
    return typeof response === 'function' ? response() : response
  }
  return { calls, api: createNewCustomerApi({ rpc: (...args) => execute('rpc', ...args), functions: { invoke: (...args) => execute('invoke', ...args) } }) }
}
test('assignees use trusted RPC, normalize only safe fields, preserve text', async () => {
  const { api, calls } = fixture({ data: [{ userId: key, displayName: '<img onerror=bad()>', private: 'DO_NOT_LEAK' }], error: null })
  assert.deepEqual(await api.listAssignees(), { ok: true, assignees: [{ userId: key, displayName: '<img onerror=bad()>' }] })
  assert.deepEqual(calls, [{ type: 'rpc', args: ['security_v2_list_company_assignees'] }])
})
test('empty assignee list is valid', async () => assert.deepEqual(await fixture({ data: [], error: null }).api.listAssignees(), { ok: true, assignees: [] }))
test('malformed assignee data never becomes empty success', async () => {
  for (const data of [null, {}, [{}], [{ userId: 'bad', displayName: 'x' }], [{ userId: key, displayName: null }], [{ userId: key, displayName: 'x' }, { userId: key, displayName: 'y' }]])
    assert.equal((await fixture({ data }).api.listAssignees()).status, 'malformed')
})
test('assignee RPC failures and denial safe', async () => {
  for (const response of [{ error: { message: 'DO_NOT_LEAK' } }, new Error('DO_NOT_LEAK')]) {
    const result = await fixture(response).api.listAssignees()
    assert.equal(result.status, 'request_failed')
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK/)
  }
  assert.equal((await fixture({ data: { error: 'NOT_AUTHORIZED' } }).api.listAssignees()).classification, 'authorization')
})
test('create transports exact frozen D1 snapshot and key, no additional auth or actor fields', async () => {
  const a = attempt(), { api, calls } = fixture()
  const before = JSON.stringify(a)
  const result = await api.createCompany(a)
  assert.deepEqual(calls[0], { type: 'invoke', args: ['admin-create-company', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: a.payload }] })
  assert.equal(calls[0].args[1].body, a.payload)
  assert.equal(JSON.stringify(a), before)
  assert.deepEqual(result, { ...success, attempt: a, idempotencyKey: key })
  assert.equal(calls.length, 1)
})
test('requires frozen submitting attempt before any network call', async () => {
  const { api, calls } = fixture()
  for (const a of [null, { ...attempt() }, Object.freeze({ ...attempt(), status: 'editing' }), Object.freeze({ ...attempt(), payload: {} })])
    await assert.rejects(api.createCompany(a), /INVALID_SUBMISSION_ATTEMPT/)
  assert.equal(calls.length, 0)
})
test('malformed success and invalid IDs are uncertain, never terminal or success', async () => {
  for (const data of [null, {}, { ...success, ok: false }, { ...success, status: 'pending' }, { ...success, companyId: 'bad' }, { ...success, operationId: 'bad' }]) {
    const result = await fixture({ data }).api.createCompany(attempt())
    assert.equal(result.ok, false)
    assert.equal(result.status, 'uncertain')
  }
})
const groups = {
  validation: ['INVALID_REQUEST', 'INVALID_PAYLOAD', 'INVALID_ORGANIZATION_NUMBER', 'INVALID_URL', 'INVALID_EMAIL', 'INVALID_PHONE', 'INVALID_ADDRESS', 'INVALID_CONTACT', 'INVALID_SERVICE', 'DUPLICATE_SERVICE', 'INVALID_LIFECYCLE', 'INVALID_ASSIGNMENT', 'DUPLICATE_ASSIGNMENT', 'INVALID_ASSIGNEE', 'INVALID_IDEMPOTENCY_KEY', 'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'METHOD_NOT_ALLOWED'],
  authentication: ['UNAUTHENTICATED', 'MFA_REQUIRED'], authorization: ['NOT_AUTHORIZED', 'PROFILE_INACTIVE'],
  conflict: ['ORGANIZATION_NUMBER_EXISTS', 'IDEMPOTENCY_CONFLICT'], retry_same_request: ['RETRY_SAME_REQUEST'], internal: ['OPERATION_FAILED'],
}
for (const [classification, codes] of Object.entries(groups)) for (const code of codes) test(`safe server code ${code}`, async () => {
  const result = await fixture({ data: { ok: false, operationId: key, error: { code, message: 'DO_NOT_LEAK' }, debug: 'DO_NOT_LEAK' } }).api.createCompany(attempt())
  assert.equal(result.errorCode, code)
  assert.equal(result.classification, classification)
  assert.equal(result.status, ['IDEMPOTENCY_CONFLICT', 'RETRY_SAME_REQUEST', 'OPERATION_FAILED'].includes(code) ? 'uncertain' : 'failed')
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK/)
})
test('SDK FunctionsHttpError Response context decoded without leaking other data', async () => {
  const context = Response.json({ ok: false, error: { code: 'INVALID_PAYLOAD', message: 'DO_NOT_LEAK' } }, { status: 400 })
  const result = await fixture({ error: { name: 'FunctionsHttpError', message: 'DO_NOT_LEAK', context } }).api.createCompany(attempt())
  assert.equal(result.errorCode, 'INVALID_PAYLOAD')
  assert.equal(context.bodyUsed, false)
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK/)
})
test('unknown HTTP bodies and codes do not leak or confirm failure', async () => {
  for (const context of [new Response('DO_NOT_LEAK', { status: 500 }), Response.json({ ok: false, error: { code: 'DO_NOT_LEAK' } }, { status: 400 })]) {
    const result = await fixture({ error: { name: 'FunctionsHttpError', context } }).api.createCompany(attempt())
    assert.equal(result.status, 'uncertain')
    assert.equal(result.errorCode, 'OPERATION_FAILED')
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK/)
  }
})
test('network/CORS/relay failures uncertain with no retry or key changes', async () => {
  for (const response of [new TypeError('DO_NOT_LEAK CORS failed fetch'), { error: { name: 'FunctionsFetchError', message: 'DO_NOT_LEAK' } }, { error: { name: 'FunctionsRelayError' } }]) {
    const { api, calls } = fixture(response), a = attempt()
    const result = await api.createCompany(a)
    assert.equal(result.status, 'uncertain')
    assert.equal(result.classification, 'uncertain_transport')
    assert.equal(result.idempotencyKey, a.idempotencyKey)
    assert.equal(calls.length, 1)
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK/)
  }
})
test('status completed uses exact existing key and safe projection', async () => {
  const { api, calls } = fixture({ data: { ...success, errorCode: null, private: 'DO_NOT_LEAK' } }), a = attempt()
  const result = await api.getCreationStatus(a)
  assert.deepEqual(result, { ...success, attempt: a, idempotencyKey: key })
  assert.deepEqual(calls, [{ type: 'rpc', args: ['security_v2_get_company_creation_status', { p_idempotency_key: key }] }])
})
test('status persisted package failures normalized', async () => {
  for (const errorCode of ['INVALID_ASSIGNEE', 'ORGANIZATION_NUMBER_EXISTS']) {
    const result = await fixture({ data: { operationId: key, companyId: null, status: 'failed', errorCode } }).api.getCreationStatus(attempt())
    assert.equal(result.status, 'failed')
    assert.equal(result.errorCode, errorCode)
  }
})
test('status NOT_FOUND and pending never trigger create or new key', async () => {
  for (const [data, status] of [[{ error: 'NOT_FOUND' }, 'not_found'], [{ operationId: key, companyId: null, errorCode: null, status: 'pending' }, 'pending']]) {
    const { api, calls } = fixture({ data }), result = await api.getCreationStatus(attempt())
    assert.equal(result.status, status)
    assert.equal(result.idempotencyKey, key)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].type, 'rpc')
  }
})
test('status malformed and unknown terminal errors cannot unlock editing', async () => {
  for (const data of [null, {}, { ...success, errorCode: null, companyId: 'bad' }, { operationId: key, status: 'failed', companyId: null, errorCode: 'DO_NOT_LEAK' }]) {
    const result = await fixture({ data }).api.getCreationStatus(attempt())
    assert.equal(result.status, 'malformed')
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK/)
  }
})
test('status errors are request failures, not creation failures', async () => {
  for (const response of [{ error: { message: 'DO_NOT_LEAK' } }, new Error('DO_NOT_LEAK'), { data: { error: 'NOT_AUTHORIZED' } }])
    assert.equal((await fixture(response).api.getCreationStatus(attempt())).status, 'request_failed')
})
test('late async response is bound to original attempt, not newer attempt with same key', async () => {
  let resolve
  const { api } = fixture(() => new Promise(r => { resolve = r }))
  const old = attempt(), newer = attempt(), pending = api.createCompany(old)
  resolve({ data: success })
  const result = await pending
  assert.equal(resultMatchesAttempt(result, old), true)
  assert.equal(resultMatchesAttempt(result, newer), false)
  assert.equal(resultMatchesAttempt({}, old), false)
})
test('D1 accepts completion and conservative uncertain create result unchanged', async () => {
  let s = state.prepareSubmission(state.setStep(state.updateCompany(state.createWizardState(), { name: 'Synthetic company' }), 5), () => key)
  const result = await fixture(new Error('network')).api.createCompany(s.submission)
  assert.ok(resultMatchesAttempt(result, s.submission))
  s = state.recordOutcome(s, result)
  assert.equal(s.submission.status, 'uncertain')
  s = state.retrySubmission(s)
  s = state.recordOutcome(s, await fixture().api.createCompany(s.submission))
  assert.equal(s.submission.status, 'completed')
})
test('adapter has no direct writes, Auth Admin, storage, credential or UUID-generation path', () => {
  const source = readFileSync(new URL('../../js/admin-new-customer-api.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /createClient|\.from\(|\.auth\.|localStorage|sessionStorage|randomUUID|console\.|innerHTML|\beval\(|sb[_]secret[_]|service_role/)
})

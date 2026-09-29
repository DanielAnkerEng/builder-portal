import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as m from '../../js/admin-new-customer-state.mjs'

const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const fresh = () => m.createWizardState()
const valid = () => m.updateCompany(fresh(), { name: ' Test company ' })
const ready = () => m.setStep(valid(), 5)
const submit = () => m.prepareSubmission(ready(), () => id)
const failed = () => m.recordOutcome(submit(), { status: 'failed', errorCode: 'INVALID_PAYLOAD' })

for (const errorCode of ['UNAUTHENTICATED','MFA_REQUIRED','NOT_AUTHORIZED','PROFILE_INACTIVE','INVALID_PAYLOAD','INVALID_ASSIGNEE','ORGANIZATION_NUMBER_EXISTS','TRANSPORT_ERROR']) {
  test(`unresolved history survives later request ${errorCode}`, () => {
    const original = submit()
    const uncertain = m.recordOutcome(original, { status:'uncertain', errorCode:'TRANSPORT_ERROR' })
    const retry = m.retrySubmission(uncertain)
    assert.equal(retry.submission.unresolved,true)
    const result = m.recordOutcome(retry,{status:errorCode === 'TRANSPORT_ERROR' ? 'uncertain' : 'failed',errorCode})
    assert.equal(result.submission.status,'uncertain')
    assert.equal(result.submission.unresolved,true)
    assert.equal(result.submission.errorCode,errorCode)
    assert.equal(result.submission.payload,original.submission.payload)
    assert.equal(result.submission.idempotencyKey,original.submission.idempotencyKey)
    assert.ok(Object.isFrozen(result.submission.payload.company))
    let generated = 0
    assert.throws(()=>m.prepareSubmission(result,()=>{generated++;return other}))
    assert.equal(generated,0)
    assert.throws(()=>m.resumeEditing(result))
    assert.throws(()=>m.updateCompany(result,{name:'Changed'}))
  })
}
test('trusted completion or persisted failure alone clears unresolved history',()=>{
  const s=m.recordOutcome(submit(),{status:'uncertain',errorCode:'TRANSPORT_ERROR'})
  const done=m.recordOutcome(s,{status:'completed',operationId:id,companyId:other})
  assert.equal(done.submission.unresolved,false)
  for(const errorCode of ['INVALID_ASSIGNEE','ORGANIZATION_NUMBER_EXISTS']) {
    const failed=m.recordOutcome(s,{status:'failed',errorCode,operationId:id})
    assert.equal(failed.submission.unresolved,false)
    assert.equal(failed.submission.status,'failed')
    const edit=m.updateCompany(m.resumeEditing(failed),{name:'Changed'})
    assert.equal(m.prepareSubmission(edit,()=>other).submission.idempotencyKey,other)
  }
  const auth=m.recordOutcome(s,{status:'failed',errorCode:'UNAUTHENTICATED',operationId:id})
  assert.equal(auth.submission.unresolved,true)
})

test('initial state is immutable, pristine and memory-only', () => {
  const s = fresh()
  assert.equal(s.step, 1)
  assert.equal(s.submission.status, 'editing')
  assert.equal(s.submission.payload, null)
  assert.equal(s.submission.idempotencyKey, null)
  assert.deepEqual(m.navigationState(s), { pristine: true, dirty: false, submitting: false, uncertain: false, completed: false, shouldWarnOnLeave: false })
  assert.ok(Object.isFrozen(s.company))
})
test('default lifecycle is onboarding', () => assert.equal(fresh().internal.lifecycleStatus, 'onboarding'))
test('all five steps accepted; invalid steps rejected', () => {
  for (const step of m.STEPS) assert.equal(m.setStep(fresh(), step).step, step)
  for (const step of [0, 6, '1', null]) assert.throws(() => m.setStep(fresh(), step))
})
test('company name required including whitespace', () => {
  assert.equal(m.validateStep(fresh(), 1)[0].field, 'company.name')
  assert.ok(m.validateStep(m.updateCompany(fresh(), { name: '  ' }), 1).length)
})
test('organization UX accepts nine digits and display spaces without checksum duplication', () => {
  for (const organizationNumber of ['123456789', '123 456 789', '123\u00a0456\u202f789', '']) {
    const s = m.updateCompany(valid(), { organizationNumber })
    assert.deepEqual(m.validateStep(s, 1), [])
    assert.equal(m.buildPayload(s).company.organizationNumber, organizationNumber ? '123456789' : null)
  }
  for (const organizationNumber of ['123', '1234567890', '123-456-789', 'abcdefghi'])
    assert.ok(m.validateStep(m.updateCompany(valid(), { organizationNumber }), 1).length)
})
test('optional company fields normalized to null', () => {
  assert.deepEqual(m.buildPayload(valid()).company, { name: 'Test company', organizationNumber: null, externalWebsiteUrl: null, contactEmail: null, contactPhone: null, address: null })
})
test('optional company text preserved and trimmed without second backend validator', () => {
  const s = m.updateCompany(valid(), { address: ' Road 1 ', contactPhone: ' +47 123 ', contactEmail: ' test@example.invalid ', externalWebsiteUrl: ' https://example.invalid ' })
  assert.equal(m.buildPayload(s).company.address, 'Road 1')
  assert.equal(m.buildPayload(s).company.externalWebsiteUrl, 'https://example.invalid')
})
test('empty contact is valid and null', () => {
  assert.deepEqual(m.validateStep(valid(), 2), [])
  assert.equal(m.buildPayload(valid()).contact, null)
})
test('each partial contact field requires name', () => {
  for (const key of ['email', 'phone', 'title']) assert.ok(m.validateStep(m.updateContact(valid(), { [key]: 'value' }), 2).length)
})
test('contact name permits optional remaining fields', () => {
  assert.deepEqual(m.buildPayload(m.updateContact(valid(), { name: ' Person ' })).contact, { name: 'Person', email: null, phone: null, title: null })
})
test('service enums exactly match locked contract', () => {
  assert.deepEqual(m.SERVICES, ['website', 'website_management', 'seo', 'local_seo', 'google_ads', 'meta_ads', 'linkedin_ads', 'tiktok_ads', 'social_media', 'content', 'analytics'])
  assert.deepEqual(m.buildPayload(m.setServices(valid(), [...m.SERVICES].reverse())).services, m.SERVICES)
})
test('zero services valid', () => assert.deepEqual(m.buildPayload(valid()).services, []))
test('unknown and duplicate services fail closed', () => {
  for (const services of [['constructor'], ['__proto__'], ['website', 'website'], null]) assert.throws(() => m.setServices(valid(), services))
  assert.throws(() => m.buildPayload({ ...valid(), services: ['unknown'] }))
})
test('service selection and deselection are immutable', () => {
  const old = valid(), selected = m.setServices(old, ['seo', 'website'])
  assert.deepEqual(old.services, [])
  assert.deepEqual(m.setServices(selected, []).services, [])
})
test('account always relevant; website responsibility absent', () => assert.deepEqual(m.relevantResponsibilities(['website']), ['account']))
test('SEO responsibility conditional', () => {
  for (const service of ['seo', 'local_seo']) assert.deepEqual(m.relevantResponsibilities([service]), ['account', 'seo'])
})
test('marketing responsibility conditional for all four ads services', () => {
  for (const service of ['google_ads', 'meta_ads', 'linkedin_ads', 'tiktok_ads']) assert.deepEqual(m.relevantResponsibilities([service]), ['account', 'marketing'])
})
test('content responsibility conditional', () => {
  for (const service of ['social_media', 'content']) assert.deepEqual(m.relevantResponsibilities([service]), ['account', 'content'])
})
test('stale assignments explicitly cleared after deselection', () => {
  let s = m.setServices(valid(), ['seo'])
  s = m.setAssignment(s, 'seo', id)
  s = m.setAssignment(s, 'account', other)
  s = m.setServices(s, [])
  assert.deepEqual(s.internal.assignments, { account: other })
  assert.deepEqual(m.buildPayload(s).internal.assignments, [{ responsibilityType: 'account', assigneeUserId: other }])
})
test('hidden known assignments excluded even from externally supplied state', () => {
  const s = valid()
  assert.deepEqual(m.buildPayload({ ...s, internal: { ...s.internal, assignments: { seo: id } } }).internal.assignments, [])
})
test('unassigned means no entry', () => {
  const s = m.setAssignment(valid(), 'account', id)
  for (const empty of ['', null]) assert.deepEqual(m.buildPayload(m.setAssignment(s, 'account', empty)).internal.assignments, [])
})
test('lifecycle enum locked', () => {
  assert.deepEqual(m.LIFECYCLES, ['onboarding', 'active', 'paused', 'ended'])
  for (const lifecycle of m.LIFECYCLES) assert.equal(m.setLifecycle(valid(), lifecycle).internal.lifecycleStatus, lifecycle)
  assert.throws(() => m.setLifecycle(valid(), 'unknown'))
})
test('unknown and irrelevant responsibilities rejected', () => {
  for (const responsibility of ['website', '__proto__', 'seo']) assert.throws(() => m.setAssignment(valid(), responsibility, id))
  assert.throws(() => m.setAssignment(valid(), 'account', 'not-an-id'))
})
test('exact Phase C payload shape, no actor/security/Auth/website extras', () => {
  const payload = m.buildPayload({ ...valid(), actorId: id, role: 'owner', website: {}, auth: {}, membership: {}, invitation: {} })
  assert.deepEqual(payload, { schemaVersion: 1, company: { name: 'Test company', organizationNumber: null, externalWebsiteUrl: null, contactEmail: null, contactPhone: null, address: null }, contact: null, services: [], internal: { lifecycleStatus: 'onboarding', assignments: [] } })
  assert.throws(() => m.updateCompany(valid(), { actorId: id }))
  assert.throws(() => m.buildPayload({ ...valid(), company: { ...valid().company, role: 'owner' } }))
})
test('malicious strings remain inert literal data, never rendered or executed', () => {
  const name = '<img src=x onerror=alert(1)>"\n<script>bad()</script>'
  assert.equal(m.buildPayload(m.updateCompany(valid(), { name })).company.name, name)
})
test('unknown/missing state fails validation safely', () => {
  for (const state of [null, {}, { company: null }]) assert.ok(m.validateStep(state, 5).length)
  assert.throws(() => m.buildPayload(null), /INVALID_WIZARD/)
})
test('confirmation and complete validation required before generating key', () => {
  assert.throws(() => m.prepareSubmission(valid()), /CONFIRMATION_REQUIRED/)
  assert.throws(() => m.prepareSubmission(m.setStep(fresh(), 5)), /INVALID_WIZARD/)
})
test('default UUID generator produces canonical lowercase v4', () => {
  assert.match(m.prepareSubmission(ready()).submission.idempotencyKey, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.throws(() => m.prepareSubmission(ready(), () => 'bad'))
})
test('snapshot deeply frozen and unchanged after later edit', () => {
  const s = submit(), snapshot = s.submission.payload
  assert.throws(() => { snapshot.company.name = 'changed' }, TypeError)
  assert.throws(() => { snapshot.services.push('seo') }, TypeError)
  const edited = m.updateCompany(m.resumeEditing(m.recordOutcome(s, { status: 'failed', errorCode: 'INVALID_PAYLOAD' })), { name: 'Other' })
  assert.equal(snapshot.company.name, 'Test company')
  assert.equal(edited.submission.payload, snapshot)
})
test('active submission prevents second preparation and editing', () => {
  assert.throws(() => m.prepareSubmission(submit()), /EDITING_REQUIRED/)
  assert.throws(() => m.updateCompany(submit(), { name: 'Other' }), /EDITING_REQUIRED/)
})
test('uncertain outcomes retain exact snapshot and key; editing forbidden', () => {
  for (const errorCode of ['TRANSPORT_ERROR', 'RETRY_SAME_REQUEST', 'OPERATION_FAILED']) {
    const old = submit(), s = m.recordOutcome(old, { status: 'uncertain', errorCode })
    assert.equal(s.submission.payload, old.submission.payload)
    assert.equal(s.submission.idempotencyKey, id)
    assert.throws(() => m.resumeEditing(s))
    const retry = m.retrySubmission(s)
    assert.equal(retry.submission.payload, old.submission.payload)
    assert.equal(retry.submission.idempotencyKey, id)
  }
})
test('terminal failed attempt permits editing and explicit same request retry', () => {
  assert.equal(m.resumeEditing(failed()).submission.status, 'editing')
  assert.equal(m.retrySubmission(failed()).submission.idempotencyKey, id)
})
test('identical normalized payload after failure reuses snapshot/key without UUID generation', () => {
  const s = m.updateCompany(m.resumeEditing(failed()), { name: 'Test company' })
  const result = m.prepareSubmission(s, () => { throw Error('must not generate') })
  assert.equal(result.submission.idempotencyKey, id)
  assert.equal(result.submission.payload, s.submission.payload)
})
test('changed payload after terminal failure gets new key', () => {
  const s = m.updateCompany(m.resumeEditing(failed()), { name: 'New name' })
  assert.equal(m.prepareSubmission(s, () => other).submission.idempotencyKey, other)
  assert.throws(() => m.prepareSubmission(s, () => id), /IDEMPOTENCY_KEY_REUSE/)
})
test('conflict cannot silently retry or replace key', () => {
  const s = m.recordOutcome(submit(), { status: 'uncertain', errorCode: 'IDEMPOTENCY_CONFLICT' })
  assert.equal(s.submission.idempotencyKey, id)
  assert.throws(() => m.retrySubmission(s), /RECONCILIATION_REQUIRED/)
  assert.throws(() => m.resumeEditing(s))
  assert.throws(() => m.prepareSubmission(s))
})
test('completed stores validated result and prevents another creation', () => {
  const s = m.recordOutcome(submit(), { status: 'completed', operationId: id, companyId: other })
  assert.equal(s.submission.companyId, other)
  assert.equal(s.submission.operationId, id)
  assert.throws(() => m.prepareSubmission(s))
  assert.throws(() => m.retrySubmission(s))
  assert.throws(() => m.resumeEditing(s))
  assert.equal(m.navigationState(s).completed, true)
  assert.equal(m.navigationState(s).shouldWarnOnLeave, false)
})
test('invalid result IDs and unconfirmed terminal outcomes rejected', () => {
  assert.throws(() => m.recordOutcome(submit(), { status: 'completed', operationId: id, companyId: 'bad' }))
  assert.throws(() => m.recordOutcome(submit(), { status: 'completed', operationId: { toString: () => id }, companyId: other }))
  assert.throws(() => m.recordOutcome(submit(), { status: 'failed', errorCode: 'TRANSPORT_ERROR' }))
  assert.throws(() => m.recordOutcome(submit(), { status: 'failed', errorCode: 'IDEMPOTENCY_CONFLICT' }))
  assert.throws(() => m.recordOutcome(fresh(), { status: 'completed', operationId: id, companyId: other }))
})
test('dirty/navigation flags distinguish step-only changes and unresolved attempts', () => {
  assert.equal(m.navigationState(m.setStep(fresh(), 3)).pristine, true)
  assert.equal(m.navigationState(valid()).dirty, true)
  assert.equal(m.navigationState(submit()).submitting, true)
  assert.equal(m.navigationState(submit()).shouldWarnOnLeave, true)
  const s = m.recordOutcome(submit(), { status: 'uncertain', errorCode: 'TRANSPORT_ERROR' })
  assert.equal(m.navigationState(s).uncertain, true)
  assert.equal(m.navigationState(s).shouldWarnOnLeave, true)
})
test('pure module contains no persistence, network, rendering or browser handlers', () => {
  const source = readFileSync(new URL('../../js/admin-new-customer-state.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.|window\.|fetch\s*\(|supabase|innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new Function|console\.|addEventListener/)
})

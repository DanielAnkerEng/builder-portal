import test from 'node:test'
import assert from 'node:assert/strict'
import { MfaController, classifyAssurance, resolveMfaLoginMode } from '../../js/mfa-controller.mjs'

function fakeAuth(options = {}) {
  const calls = []
  const factors = options.factors || { totp: [], phone: [] }
  let factorRead = 0
  return { calls, mfa: {
    listFactors: async () => { calls.push(['listFactors']); if (options.listError) return { error: new Error('private') }; const sequence = options.factorSequence; return { data: sequence ? sequence[Math.min(factorRead++, sequence.length - 1)] : factors, error: null } },
    enroll: async input => { calls.push(['enroll', input]); return options.enrollError ? { error: options.enrollError === true ? new Error('private') : options.enrollError } : { data: { id: 'new-factor', totp: { qr_code: 'data:image/svg+xml,safe', secret: 'SECRET' } }, error: null } },
    challenge: async input => { calls.push(['challenge', input]); return options.challengeError ? { error: new Error('private') } : { data: { id: 'challenge' }, error: null } },
    verify: async input => { calls.push(['verify', input]); return options.verifyError ? { error: new Error('private') } : { error: null } },
    unenroll: async input => { calls.push(['unenroll', input]); return options.unenrollError ? { error: new Error('private') } : { error: null } },
    getAuthenticatorAssuranceLevel: async () => options.aalError ? { error: new Error('private') } : { data: { currentLevel: options.aal || 'aal2', nextLevel: 'aal2' }, error: null }
  }, refreshSession: async () => options.refreshError ? { error: new Error('private') } : { error: null } }
}

test('classifies AAL2 as authenticated', () => assert.equal(classifyAssurance({ currentLevel: 'aal2', nextLevel: 'aal2' }), 'authenticated'))
test('classifies AAL1 with verified factor as challenge', () => assert.equal(classifyAssurance({ currentLevel: 'aal1', nextLevel: 'aal2' }), 'challenge'))
test('classifies user without verified factor as enrollment', () => assert.equal(classifyAssurance({ currentLevel: 'aal1', nextLevel: 'aal1' }), 'enrollment'))
test('verified factor forces challenge even when assurance metadata is stale', () => assert.equal(resolveMfaLoginMode({ currentLevel: 'aal1', nextLevel: 'aal1' }, { verifiedTotp: [{ id: 'v' }] }), 'challenge'))
test('separates verified, unverified and other factors', async () => { const auth = fakeAuth({ factors: { totp: [{ id: 'v', status: 'verified' }, { id: 'u', status: 'unverified' }], phone: [{ id: 'p' }] } }); const c = new MfaController(auth); const f = await c.loadFactors(); assert.deepEqual([f.verifiedTotp.length, f.unverifiedTotp.length, f.other.length], [1, 1, 1]) })
test('handles listFactors error without leaking details', async () => { const c = new MfaController(fakeAuth({ listError: true })); assert.equal(await c.loadFactors(), null); assert.equal(c.state, 'error') })
test('enrollment waits for explicit start and exposes transient data', async () => { const auth = fakeAuth(), c = new MfaController(auth); await c.loadFactors(); assert.equal(auth.calls.some(([name]) => name === 'enroll'), false); const enrollment = await c.startEnrollment(); assert.equal(c.state, 'awaiting_verification'); assert.equal(enrollment.secret, 'SECRET') })
test('parallel enrollment is blocked', async () => { const auth = fakeAuth(), c = new MfaController(auth); await c.loadFactors(); await c.startEnrollment(); await c.startEnrollment(); assert.equal(auth.calls.filter(([name]) => name === 'enroll').length, 1) })
test('existing unverified factor blocks a new enrollment', async () => { const auth = fakeAuth({ factors: { totp: [{ id: 'u', status: 'unverified' }] } }), c = new MfaController(auth); await c.loadFactors(); await c.startEnrollment(); assert.equal(auth.calls.some(([name]) => name === 'enroll'), false) })
test('verified factor blocks enrollment after a fresh factor read', async () => { const auth = fakeAuth({ factors: { totp: [{ id: 'v', status: 'verified' }] } }), c = new MfaController(auth); await c.loadFactors(); const result = await c.startEnrollment(); assert.equal(result.challengeRequired, true); assert.equal(result.challengeFactorId, 'v'); assert.equal(auth.calls.some(([name]) => name === 'enroll'), false) })
test('factor name conflict refreshes factors and recovers to challenge', async () => { const empty = { totp: [], phone: [] }, verified = { totp: [{ id: 'v-after-race', status: 'verified' }], phone: [] }; const auth = fakeAuth({ factorSequence: [empty, empty, verified], enrollError: { code: 'mfa_factor_name_conflict' } }), c = new MfaController(auth); await c.loadFactors(); const result = await c.startEnrollment(); assert.deepEqual(result, { challengeRequired: true, challengeFactorId: 'v-after-race' }); assert.equal(c.state, 'idle') })
test('cancel unenrolls unfinished factor and clears secret', async () => { const auth = fakeAuth(), c = new MfaController(auth); await c.loadFactors(); await c.startEnrollment(); assert.equal(await c.cancel(), true); assert.equal(c.enrollment, null); assert.equal(c.state, 'cancelled') })
test('unenroll error is recoverable and keeps enrollment available', async () => { const c = new MfaController(fakeAuth({ unenrollError: true })); await c.loadFactors(); await c.startEnrollment(); assert.equal(await c.cancel(), null); assert.equal(c.enrollment.secret, 'SECRET') })
test('wrong TOTP remains retryable and is never retained by controller', async () => { const auth = fakeAuth({ verifyError: true }), c = new MfaController(auth); await c.loadFactors(); await c.startEnrollment(); assert.equal(await c.verify('123456'), null); assert.equal(c.enrollment.secret, 'SECRET'); assert.equal(auth.calls.find(([name]) => name === 'verify')[1].code, '123456') })
test('valid TOTP upgrades AAL1 to AAL2 and clears enrollment secret', async () => { const c = new MfaController(fakeAuth()); await c.loadFactors(); await c.startEnrollment(); assert.equal(await c.verify('123456'), true); assert.equal(c.state, 'verified'); assert.equal(c.enrollment, null) })
test('session refresh failure clears enrollment secret', async () => { const c = new MfaController(fakeAuth({ refreshError: true })); await c.loadFactors(); await c.startEnrollment(); assert.equal(await c.verify('123456'), null); assert.equal(c.enrollment, null) })
test('verification fails closed when AAL2 is not achieved', async () => { const c = new MfaController(fakeAuth({ aal: 'aal1' })); await c.loadFactors(); await c.startEnrollment(); assert.equal(await c.verify('123456'), null); assert.equal(c.state, 'error') })
test('six digits are required before challenge', async () => { const auth = fakeAuth(), c = new MfaController(auth); await c.loadFactors(); await c.startEnrollment(); await c.verify('12x'); assert.equal(auth.calls.some(([name]) => name === 'challenge'), false) })

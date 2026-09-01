import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostAuthDestination } from '../../js/post-auth-destination.mjs'

function fakeSupabase({ role = null, roleError = null, session = true, aal = 'aal2' } = {}) {
  const calls = []
  const query = {
    select(value) { calls.push(['select', value]); return this },
    eq(column, value) { calls.push(['eq', column, value]); return this },
    async maybeSingle() { calls.push(['maybeSingle']); return { data: role ? { admin_role: role } : null, error: roleError } }
  }
  return {
    calls,
    auth: {
      getSession: async () => ({ data: { session: session ? { user: { id: 'current-user' } } : null }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal }, error: null }) }
    },
    from(table) { calls.push(['from', table]); return query }
  }
}

test('platform owner routes to admin', async () => assert.equal(await resolvePostAuthDestination(fakeSupabase({ role: 'owner' })), 'admin.html'))
test('platform admin routes to admin', async () => assert.equal(await resolvePostAuthDestination(fakeSupabase({ role: 'admin' })), 'admin.html'))
test('normal member routes to builder', async () => assert.equal(await resolvePostAuthDestination(fakeSupabase()), 'builder.html'))
test('role lookup error fails closed', async () => await assert.rejects(resolvePostAuthDestination(fakeSupabase({ roleError: new Error('private') })), /POST_AUTH_ROLE_LOOKUP_FAILED/))
test('lookup is scoped to the current active user', async () => { const client = fakeSupabase({ role: 'owner' }); await resolvePostAuthDestination(client); assert.deepEqual(client.calls, [['from','platform_admins'],['select','admin_role'],['eq','user_id','current-user'],['eq','is_active',true],['maybeSingle']]) })
test('missing session fails closed before role lookup', async () => { const client = fakeSupabase({ session: false }); await assert.rejects(resolvePostAuthDestination(client), /POST_AUTH_SESSION_REQUIRED/); assert.equal(client.calls.length, 0) })
test('AAL1 fails closed before role lookup', async () => { const client = fakeSupabase({ aal: 'aal1' }); await assert.rejects(resolvePostAuthDestination(client), /POST_AUTH_AAL2_REQUIRED/); assert.equal(client.calls.length, 0) })
test('unexpected platform role fails closed', async () => await assert.rejects(resolvePostAuthDestination(fakeSupabase({ role: 'legacy-admin' })), /POST_AUTH_ROLE_INVALID/))

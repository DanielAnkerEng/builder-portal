import test from 'node:test'
import assert from 'node:assert/strict'
import { WreachAuthStorage, supabaseAuthStorageKey } from '../../js/auth-storage.mjs'

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)) }
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const key = 'sb-127-auth-token'
const create = (persistent = new MemoryStorage(), transient = new MemoryStorage()) => ({ adapter: new WreachAuthStorage({ persistentStorage: persistent, transientStorage: transient, storageKey: key }), persistent, transient })

test('Supabase storage key matches the SDK namespace', () => {
  assert.equal(supabaseAuthStorageKey('http://127.0.0.1:54321'), key)
  assert.equal(supabaseAuthStorageKey('https://project.supabase.co'), 'sb-project-auth-token')
})

test('remember off stores Auth session only in session storage', () => {
  const { adapter, persistent, transient } = create(); adapter.prepareForSignIn(false); adapter.setItem(key, 'session-token')
  assert.equal(transient.getItem(key), 'session-token'); assert.equal(persistent.getItem(key), null)
})

test('remember off loses session after browser restart simulation', () => {
  const persistent = new MemoryStorage(), first = create(persistent).adapter; first.prepareForSignIn(false); first.setItem(key, 'session-token')
  const restarted = create(persistent, new MemoryStorage()).adapter
  assert.equal(restarted.getItem(key), null)
})

test('remember on stores Auth session only in local storage', () => {
  const { adapter, persistent, transient } = create(); adapter.prepareForSignIn(true); adapter.setItem(key, 'persistent-token')
  assert.equal(persistent.getItem(key), 'persistent-token'); assert.equal(transient.getItem(key), null)
})

test('remember on survives browser restart simulation', () => {
  const persistent = new MemoryStorage(), first = create(persistent).adapter; first.prepareForSignIn(true); first.setItem(key, 'persistent-token')
  const restarted = create(persistent, new MemoryStorage()).adapter
  assert.equal(restarted.getItem(key), 'persistent-token')
})

test('switching to non-remember removes stale persistent Auth data', () => {
  const { adapter, persistent } = create(); adapter.prepareForSignIn(true); adapter.setItem(key, 'old'); adapter.prepareForSignIn(false)
  assert.equal(persistent.getItem(key), null); assert.equal(adapter.mode, 'transient')
})

test('switching to remember removes stale transient Auth data', () => {
  const { adapter, transient } = create(); adapter.prepareForSignIn(false); adapter.setItem(key, 'old'); adapter.prepareForSignIn(true)
  assert.equal(transient.getItem(key), null); assert.equal(adapter.mode, 'persistent')
})

test('ambiguous duplicate sessions fail closed by clearing both', () => {
  const persistent = new MemoryStorage({ [key]: 'one' }), transient = new MemoryStorage({ [key]: 'two' }), { adapter } = create(persistent, transient)
  assert.equal(adapter.getItem(key), null); assert.equal(adapter.mode, 'transient')
})

test('logout cleanup removes only the Wreach Auth namespace', () => {
  const persistent = new MemoryStorage({ [key]: 'token', [`${key}-code-verifier`]: 'verifier', other_app: 'keep' })
  const transient = new MemoryStorage({ [key]: 'token-2', other_session: 'keep' }), { adapter } = create(persistent, transient); adapter.clearAuthData()
  assert.equal(persistent.getItem(key), null); assert.equal(persistent.getItem('other_app'), 'keep'); assert.equal(transient.getItem('other_session'), 'keep')
})

test('adapter rejects storage keys outside its Auth namespace', () => {
  const { adapter } = create(); assert.throws(() => adapter.setItem('other-app', 'value'), /Unexpected Auth storage key/)
})

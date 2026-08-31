export class WreachAuthStorage {
  constructor({ persistentStorage, transientStorage, storageKey }) {
    if (!persistentStorage || !transientStorage || !storageKey) throw new Error('Auth storage unavailable')
    this.persistentStorage = persistentStorage
    this.transientStorage = transientStorage
    this.storageKey = storageKey
    this.mode = this.detectMode()
  }

  detectMode() {
    const transient = this.transientStorage.getItem(this.storageKey)
    const persistent = this.persistentStorage.getItem(this.storageKey)
    if (transient !== null && persistent !== null) {
      this.clearAuthData()
      return 'transient'
    }
    return persistent !== null ? 'persistent' : 'transient'
  }

  prepareForSignIn(remember) {
    this.clearAuthData()
    this.mode = remember === true ? 'persistent' : 'transient'
  }

  getItem(key) { this.assertAuthKey(key); return this.activeStorage().getItem(key) }
  setItem(key, value) { this.assertAuthKey(key); this.inactiveStorage().removeItem(key); this.activeStorage().setItem(key, value) }
  removeItem(key) { this.assertAuthKey(key); this.persistentStorage.removeItem(key); this.transientStorage.removeItem(key) }

  clearAuthData() {
    this.clearNamespace(this.persistentStorage)
    this.clearNamespace(this.transientStorage)
  }

  clearNamespace(storage) {
    const keys = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key && this.isAuthKey(key)) keys.push(key)
    }
    keys.forEach(key => storage.removeItem(key))
  }

  isAuthKey(key) { return key === this.storageKey || key.startsWith(`${this.storageKey}-`) }
  assertAuthKey(key) { if (!this.isAuthKey(key)) throw new Error('Unexpected Auth storage key') }
  activeStorage() { return this.mode === 'persistent' ? this.persistentStorage : this.transientStorage }
  inactiveStorage() { return this.mode === 'persistent' ? this.transientStorage : this.persistentStorage }
}

export function supabaseAuthStorageKey(url) {
  const hostname = new URL(url).hostname
  return `sb-${hostname.split('.')[0]}-auth-token`
}

export function createBrowserAuthStorage(browser, url) {
  return new WreachAuthStorage({
    persistentStorage: browser.localStorage,
    transientStorage: browser.sessionStorage,
    storageKey: supabaseAuthStorageKey(url)
  })
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isLocalSupabaseHost } from './supabase-environment.mjs'
import { createBrowserAuthStorage } from './auth-storage.mjs'
import { PRODUCTION_PUBLIC_CONFIG, validateProductionPublicConfig } from './supabase-public-config.mjs'

if (!validateProductionPublicConfig(PRODUCTION_PUBLIC_CONFIG)) throw new Error('Invalid production public configuration')
const local = isLocalSupabaseHost(window.location.hostname)
const config = local ? (await import('./supabase.local.js')).LOCAL_SUPABASE_CONFIG : PRODUCTION_PUBLIC_CONFIG

if (local && new URL(config.url).hostname !== '127.0.0.1') throw new Error('Localhost is restricted to local Supabase')
if (!local && config !== PRODUCTION_PUBLIC_CONFIG) throw new Error('Invalid production Supabase configuration')

export const supabaseEnvironment = local ? 'local' : 'production'
export const authStorage = createBrowserAuthStorage(window, config.url)
export const supabase = createClient(config.url, config.key, {
  auth: {
    storage: authStorage,
    storageKey: authStorage.storageKey,
    persistSession: true,
    autoRefreshToken: true
  }
})

export async function prepareAuthSignIn(remember = false) {
  await supabase.auth.signOut({ scope: 'local' })
  authStorage.prepareForSignIn(remember)
}

export function clearWreachAuthSession() { authStorage.clearAuthData() }

if (local) showLocalEnvironmentBanner()

function showLocalEnvironmentBanner() {
  const show = () => {
    document.documentElement.dataset.supabaseEnvironment = 'local'
    if (document.getElementById('localSupabaseBanner')) return
    const banner = document.createElement('div')
    banner.id = 'localSupabaseBanner'
    banner.className = 'environment-banner environment-banner-local'
    banner.setAttribute('role', 'status')
    banner.textContent = 'LOCAL SUPABASE – kun lokale testdata'
    document.body.prepend(banner)
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true })
}

// Public browser configuration only. Never add service-role, secret, or database keys here.
export const PRODUCTION_PUBLIC_CONFIG = Object.freeze({
  url: 'https://oqwpfnmqeriupujpssxz.supabase.co',
  key: 'sb_publishable_BcJUAYkgF3nHpdbCyHd1eA_pQ3yEA15'
})

export function validateProductionPublicConfig(config) {
  if (!config || typeof config.url !== 'string' || typeof config.key !== 'string') return false
  let url
  try { url = new URL(config.url) } catch { return false }
  if (url.protocol !== 'https:' || url.hostname !== 'oqwpfnmqeriupujpssxz.supabase.co' || url.pathname !== '/') return false
  if (!config.key.startsWith('sb_publishable_')) return false
  const privilegedPrefix = `${['sb', 'secret'].join('_')}_`
  return !config.key.toLowerCase().includes(privilegedPrefix) && !/(service[_-]?role|secret)/i.test(config.key)
}

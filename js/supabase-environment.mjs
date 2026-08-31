const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function isLocalSupabaseHost(hostname) {
  return LOCAL_HOSTS.has(String(hostname).toLowerCase())
}

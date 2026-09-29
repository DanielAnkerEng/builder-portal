// Retired route: no clients, credentials, body reads or external side effects.
// Genuine JWT verification remains the configured gateway's responsibility.
const origins = new Set(['https://wreach.no', 'http://127.0.0.1:4175', 'http://localhost:4175'])
const allowedHeaders = ['authorization', 'apikey', 'content-type', 'x-client-info']
Deno.serve((req: Request): Response => {
  const origin = req.headers.get('origin')
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' })
  if (origin && origins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  }
  const fail = (code: string, status: number) => Response.json({ ok: false, error: { code } }, { status, headers })
  if (origin && !origins.has(origin)) return fail('NOT_AUTHORIZED', 403)
  if (req.method === 'OPTIONS') {
    const requested = req.headers.get('access-control-request-headers')
    if (!origin || req.headers.get('access-control-request-method') !== 'POST' ||
      (requested && requested.split(',').some(h => !allowedHeaders.includes(h.trim().toLowerCase()))))
      return fail('INVALID_REQUEST', 400)
    return new Response(null, { status: 204, headers })
  }
  // Presence check only, not a substitute for verify_jwt=true.
  if (!req.headers.get('authorization')?.startsWith('Bearer ')) return fail('UNAUTHENTICATED', 401)
  return fail('LEGACY_PROVISIONING_RETIRED', 410)
})

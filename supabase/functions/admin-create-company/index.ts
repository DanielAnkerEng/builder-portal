import { requireAal2 } from '../_shared/security.ts'
import { readPayload, RequestError, validateStructure } from '../_shared/new-customer.ts'

// Local origins are the exact existing config.toml Auth development origins.
const origins = new Set(['https://wreach.no', 'http://127.0.0.1:4175', 'http://localhost:4175'])
const allowedHeaders = ['authorization', 'apikey', 'content-type', 'idempotency-key', 'x-client-info']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const validationCodes = new Set(['INVALID_IDEMPOTENCY_KEY', 'INVALID_PAYLOAD', 'INVALID_ORGANIZATION_NUMBER',
  'INVALID_URL', 'INVALID_EMAIL', 'INVALID_PHONE', 'INVALID_ADDRESS', 'INVALID_CONTACT', 'INVALID_SERVICE',
  'DUPLICATE_SERVICE', 'INVALID_LIFECYCLE', 'INVALID_ASSIGNMENT', 'DUPLICATE_ASSIGNMENT', 'INVALID_ASSIGNEE'])

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin')
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' })
  if (origin && origins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  }
  const fail = (code: string, status: number, operationId?: string) => Response.json({ ok: false,
    ...(operationId ? { operationId } : {}), error: { code } }, { status, headers })
  if (!['POST', 'OPTIONS'].includes(req.method)) {
    headers.set('Allow', 'POST, OPTIONS')
    return fail('METHOD_NOT_ALLOWED', 405)
  }
  if (origin !== null && !origins.has(origin)) return fail('NOT_AUTHORIZED', 403)
  if (req.method === 'OPTIONS') {
    const method = req.headers.get('access-control-request-method')
    const requested = req.headers.get('access-control-request-headers')
    if (!origin || method !== 'POST' || (requested && requested.split(',').some(h => !allowedHeaders.includes(h.trim().toLowerCase()))))
      return fail('INVALID_REQUEST', 400)
    return new Response(null, { status: 204, headers })
  }
  let context: Awaited<ReturnType<typeof requireAal2>>
  try { context = await requireAal2(req, { platformAdmin: true }) }
  catch (error) {
    if (error instanceof Response) {
      if (error.status === 401) return fail('UNAUTHENTICATED', 401)
      const reason = await error.text()
      if (error.status === 403) return fail(reason === 'MFA required' ? 'MFA_REQUIRED' : reason === 'Profile unavailable' ? 'PROFILE_INACTIVE' : 'NOT_AUTHORIZED', 403)
    }
    return fail('OPERATION_FAILED', 500)
  }
  try {
    const key = req.headers.get('idempotency-key')
    if (!key || !uuid.test(key)) return fail('INVALID_REQUEST', 400)
    const payload = await readPayload(req)
    validateStructure(payload)
    let result
    try {
      result = await context.userClient.rpc('security_v2_create_company', { p_idempotency_key: key, p_payload: payload })
    } catch {
      // Outcome may have committed before transport failed. Never switch keys.
      return fail('RETRY_SAME_REQUEST', 503)
    }
    if (result.error) {
      // SDK transport failures have status 0. SQL/internal errors are not exposed.
      return result.status === 0 ? fail('RETRY_SAME_REQUEST', 503) : fail('OPERATION_FAILED', 500)
    }
    const data = result.data
    if (!data || typeof data !== 'object') return fail('OPERATION_FAILED', 500)
    if (data.ok === true && data.status === 'completed' && typeof data.operationId === 'string' && uuid.test(data.operationId)
      && typeof data.companyId === 'string' && uuid.test(data.companyId))
      return Response.json({ ok: true, operationId: data.operationId, companyId: data.companyId, status: 'completed' }, { headers })
    if (data.ok !== false) return fail('OPERATION_FAILED', 500)
    const operationId = typeof data.operationId === 'string' && uuid.test(data.operationId) ? data.operationId : undefined
    if (data.error === 'NOT_AUTHORIZED') return fail('NOT_AUTHORIZED', 403, operationId)
    if (['IDEMPOTENCY_CONFLICT', 'ORGANIZATION_NUMBER_EXISTS'].includes(data.error)) return fail(data.error, 409, operationId)
    if (validationCodes.has(data.error)) return fail(data.error, 400, operationId)
    return fail('OPERATION_FAILED', 500)
  } catch (error) {
    return error instanceof RequestError ? fail(error.code, error.status) : fail('INVALID_REQUEST', 400)
  }
})

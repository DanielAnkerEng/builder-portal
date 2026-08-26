import { bodyObject, correlationId, json, requireAal2, text } from '../_shared/security.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const { user, adminClient } = await requireAal2(req)
    const body = await bodyObject(req)
    const action = text(body.action, 32)
    const cid = correlationId(body.correlationId)
    if (action === 'set_personal_key') {
      const { data, error } = await adminClient.rpc('security_v2_set_personal_key', {
        p_actor: user.id, p_new_key: text(body.newKey),
        p_current_key: typeof body.currentKey === 'string' ? body.currentKey : null, p_correlation_id: cid,
      })
      return error ? json({ error: 'KEY_OPERATION_FAILED' }, 500) : json(data, data?.ok ? 200 : 403)
    }
    if (action === 'set_company_key') {
      const { data, error } = await adminClient.rpc('security_v2_set_company_key', {
        p_actor: user.id, p_company: text(body.companyId, 36), p_personal_key: text(body.personalKey),
        p_current_company_key: typeof body.currentCompanyKey === 'string' ? body.currentCompanyKey : null,
        p_new_company_key: text(body.newCompanyKey), p_correlation_id: cid,
      })
      return error ? json({ error: 'KEY_OPERATION_FAILED' }, 500) : json(data, data?.ok ? 200 : 403)
    }
    return json({ error: 'UNSUPPORTED_ACTION' }, 400)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'KEY_OPERATION_FAILED' }, 500)
  }
})


import { bodyObject, correlationId, json, requireAal2, text } from '../_shared/security.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const { user, adminClient } = await requireAal2(req)
    const body = await bodyObject(req)
    if (body.action !== 'change_member_role') return json({ error: 'UNSUPPORTED_ACTION' }, 400)
    const { data, error } = await adminClient.rpc('security_v2_change_member_role', {
      p_actor: user.id, p_company: text(body.companyId, 36), p_target_user: text(body.targetUserId, 36),
      p_new_role: text(body.newRole, 32), p_personal_key: text(body.personalKey), p_company_key: text(body.companyKey),
      p_correlation_id: correlationId(body.correlationId),
    })
    return error ? json({ error: 'CRITICAL_ACTION_FAILED' }, 500) : json(data, data?.ok ? 200 : 403)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'CRITICAL_ACTION_FAILED' }, 500)
  }
})


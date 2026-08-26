import { bodyObject, correlationId, json, requireAal2, text } from '../_shared/security.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const { user, userClient, adminClient } = await requireAal2(req)
    const { data: admin } = await userClient.from('platform_admins').select('user_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!admin) return json({ error: 'NOT_AUTHORIZED' }, 403)
    const body = await bodyObject(req)
    const email = text(body.email).trim().toLowerCase()
    const companyId = text(body.companyId, 36)
    const role = text(body.role ?? 'owner', 32)
    if (!['owner', 'company_admin', 'publisher', 'editor', 'viewer'].includes(role)) return json({ error: 'INVALID_ROLE' }, 400)
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email)
    if (inviteError || !invited.user) return json({ error: 'INVITE_FAILED' }, 400)
    const invitedId = invited.user.id
    const { error: profileError } = await adminClient.from('profiles').upsert({ id: invitedId, email, display_name: text(body.displayName ?? email), status: 'active' })
    const { error: membershipError } = await adminClient.from('company_memberships').insert({ company_id: companyId, user_id: invitedId, role, status: 'invited', invited_by: user.id })
    if (profileError || membershipError) {
      await adminClient.auth.admin.deleteUser(invitedId)
      return json({ error: 'INVITE_ROLLED_BACK' }, 500)
    }
    await adminClient.from('audit_events').insert({ actor_user_id: user.id, company_id: companyId, event_type: 'user.invite', result: 'success',
      target_type: 'user', target_id: invitedId, authorization_requirements: ['aal2', 'platform_admin'],
      request_correlation_id: correlationId(body.correlationId), metadata: { role } })
    return json({ ok: true, userId: invitedId })
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'INVITE_FAILED' }, 500)
  }
})


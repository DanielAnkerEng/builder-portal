import { requireAal2 } from '../_shared/security.ts'
import { readPayload, RequestError } from '../_shared/new-customer.ts'

const origins = new Set(['https://wreach.no', 'http://127.0.0.1:4175', 'http://localhost:4175'])
const allowedHeaders = ['authorization', 'apikey', 'content-type', 'idempotency-key', 'x-client-info']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const safeCodes = new Set(['NOT_AUTHORIZED', 'INVALID_REQUEST', 'INVITATION_CONFLICT', 'INVITATION_UNAVAILABLE',
  'EXISTING_IDENTITY_REQUIRES_REVIEW', 'IDENTITY_REQUIRES_REVIEW', 'DELIVERY_UNCONFIRMED',
  'INVITATION_NOT_FOUND', 'ACTIVE_MEMBERSHIP_EXISTS', 'RESEND_THROTTLED', 'INVITATION_STATE_INCOMPATIBLE', 'IDENTITY_CONFLICT', 'BINDING_MISMATCH'])

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin')
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' })
  if (origin && origins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  }
  const fail = (code: string, status = 400) => Response.json({ ok: false, error: { code } }, { status, headers })
  if (origin && !origins.has(origin)) return fail('NOT_AUTHORIZED', 403)
  if (req.method === 'OPTIONS') {
    const requested = req.headers.get('access-control-request-headers')
    if (!origin || req.headers.get('access-control-request-method') !== 'POST' ||
      (requested && requested.split(',').some(h => !allowedHeaders.includes(h.trim().toLowerCase())))) return fail('INVALID_REQUEST')
    return new Response(null, { status: 204, headers })
  }
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405)
  let context: Awaited<ReturnType<typeof requireAal2>>
  try { context = await requireAal2(req, { platformAdmin: true }) }
  catch (error) { return fail(error instanceof Response && error.status === 401 ? 'UNAUTHENTICATED' : 'NOT_AUTHORIZED', error instanceof Response ? error.status : 500) }
  try {
    const key = req.headers.get('idempotency-key')
    if (!key || !uuid.test(key)) return fail('INVALID_REQUEST')
    const body = await readPayload(req) as Record<string, unknown>
    // Both normal invite and recovery use a server-owned fixed redirect.
    const serverUrl = new URL(Deno.env.get('SUPABASE_URL') ?? '')
    const production = serverUrl.origin === 'https://oqwpfnmqeriupujpssxz.supabase.co'
    const local = serverUrl.protocol === 'http:' && ['127.0.0.1', 'localhost', 'kong', 'supabase_kong_webbyra-demo-github'].includes(serverUrl.hostname)
    if ((!production && !local) || (production && origin && origin !== 'https://wreach.no') || (local && origin === 'https://wreach.no')) return fail('NOT_AUTHORIZED', 403)
    const redirectTo = production ? 'https://wreach.no/onboarding.html' : 'http://127.0.0.1:4175/onboarding.html'
    if (body && ['recover','reconcile'].includes(body.action as string)) {
      if (Object.keys(body).sort().join(',') !== 'action,companyId,invitationId' ||
        typeof body.companyId !== 'string' || !uuid.test(body.companyId) || typeof body.invitationId !== 'string' || !uuid.test(body.invitationId)) return fail('INVALID_REQUEST')
      const plan = await context.userClient.rpc(body.action === 'recover' ? 'security_v2_prepare_invitation_recovery' : 'security_v2_authorize_invitation_reconcile', {
        ...(body.action === 'recover' ? {p_request:key} : {}), p_invitation:body.invitationId, p_company:body.companyId,
      })
      if (plan.error) return fail('INVITATION_UNCONFIRMED',503)
      if (plan.data?.ok !== true) return fail(safeCodes.has(plan.data?.error) ? plan.data.error : 'INVITATION_UNCONFIRMED',plan.data?.error === 'RESEND_THROTTLED' ? 429 : 409)
      if (!uuid.test(plan.data.invitationId)) return fail('INVITATION_UNCONFIRMED',503)
      let delivery = 'reconciled_without_email'
      if (body.action === 'recover') {
        if (!uuid.test(plan.data.attemptId)) return fail('INVITATION_UNCONFIRMED',503)
        const claim = await context.adminClient.rpc('security_v2_claim_invitation_delivery',{p_attempt:plan.data.attemptId})
        if (claim.error) return fail('INVITATION_UNCONFIRMED',503)
        if (claim.data?.ok !== true) return fail(safeCodes.has(claim.data?.error) ? claim.data.error : 'INVITATION_UNCONFIRMED',409)
        delivery = claim.data.delivery ?? 'uncertain'
        if (claim.data.send === true) {
          if (typeof claim.data.email !== 'string' || !['invite','recovery'].includes(claim.data.mode) || !uuid.test(claim.data.originId)) return fail('INVITATION_UNCONFIRMED',503)
          let sent = false
          try {
            const result = claim.data.mode === 'invite'
              ? await context.adminClient.auth.admin.inviteUserByEmail(claim.data.email,{redirectTo,data:{wreach_invitation_id:claim.data.originId}})
              : await context.adminClient.auth.resetPasswordForEmail(claim.data.email,{redirectTo})
            sent = !result.error
          } catch { /* Delivery is uncertain; never retry automatically. */ }
          const receipt = await context.adminClient.rpc('security_v2_finish_invitation_delivery',{p_attempt:plan.data.attemptId,p_sent:sent})
          if (receipt.error || receipt.data?.ok !== true) return fail('INVITATION_UNCONFIRMED',503)
          delivery = sent ? 'sent' : 'uncertain'
        }
      }
      const finalized = await context.adminClient.rpc('security_v2_finalize_customer_invite',{p_invitation:plan.data.invitationId})
      if (finalized.error) return fail('INVITATION_UNCONFIRMED',503)
      if (finalized.data?.ok !== true) return fail(safeCodes.has(finalized.data?.error) ? finalized.data.error : 'INVITATION_UNCONFIRMED',409)
      return Response.json({ok:true,invitationId:plan.data.invitationId,status:finalized.data.status,delivery},{headers})
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'companyId,displayName,email,role' ||
      typeof body.companyId !== 'string' || !uuid.test(body.companyId) ||
      typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
      typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.length > 120 || /[\x00-\x1f\x7f]/.test(body.displayName) ||
      !['viewer', 'editor'].includes(body.role as string)) return fail('INVALID_REQUEST')
    const prepared = await context.userClient.rpc('security_v2_prepare_customer_invite', {
      p_request_id: key, p_company: body.companyId, p_email: body.email.trim().toLowerCase(), p_display_name: body.displayName.trim(), p_role: body.role,
    })
    if (prepared.error) return fail('INVITATION_UNCONFIRMED', 503)
    const plan = prepared.data
    if (plan?.ok !== true) return fail(safeCodes.has(plan?.error) ? plan.error : 'INVITATION_UNCONFIRMED', 409)
    if (typeof plan.invitationId !== 'string' || !uuid.test(plan.invitationId)) return fail('INVITATION_UNCONFIRMED', 503)
    if (plan.send === true) {
      // At most one email attempt per reservation. Timeout is not a resend cue.
      // Never delete an Auth user or overwrite an existing profile on failure.
      const invited = await context.adminClient.auth.admin.inviteUserByEmail(body.email.trim().toLowerCase(), {
        redirectTo, data: { wreach_invitation_id: plan.invitationId },
      })
      if (invited.error) return fail('DELIVERY_UNCONFIRMED', 503)
    }
    // Reconcile earlier Auth success followed by DB/response failure.
    // SQL finds only the new identity bound to this reservation.
    const finalized = await context.adminClient.rpc('security_v2_finalize_customer_invite', { p_invitation: plan.invitationId })
    if (finalized.error) return fail('INVITATION_UNCONFIRMED', 503)
    if (finalized.data?.ok !== true) return fail(safeCodes.has(finalized.data?.error) ? finalized.data.error : 'INVITATION_UNCONFIRMED', 409)
    if (!['invited', 'accepted'].includes(finalized.data.status)) return fail('INVITATION_UNCONFIRMED', 503)
    return Response.json({ ok: true, invitationId: plan.invitationId, status: finalized.data.status }, { headers })
  } catch (error) {
    return error instanceof RequestError ? fail(error.code, error.status) : fail('INVITATION_UNCONFIRMED', 503)
  }
})

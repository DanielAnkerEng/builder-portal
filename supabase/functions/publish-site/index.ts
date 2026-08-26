import { bodyObject, correlationId, json, requireAal2, text } from '../_shared/security.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const { user, adminClient } = await requireAal2(req)
    const body = await bodyObject(req)
    const expectedRevision = Number(body.expectedRevision)
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) return json({ error: 'INVALID_REVISION' }, 400)
    const { data, error } = await adminClient.rpc('security_v2_publish_site', {
      p_actor: user.id, p_website_id: text(body.websiteId, 36), p_expected_revision: expectedRevision,
      p_personal_key: text(body.personalKey), p_correlation_id: correlationId(body.correlationId),
    })
    if (error) return json({ error: 'PUBLISH_FAILED' }, 500)
    return json(data, data?.ok ? 200 : data?.error === 'STALE_REVISION' ? 409 : 403)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'PUBLISH_FAILED' }, 500)
  }
})


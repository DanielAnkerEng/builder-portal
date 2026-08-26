import { bodyObject, correlationId, json, requireAal2, text } from '../_shared/security.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const { userClient } = await requireAal2(req)
    const body = await bodyObject(req)
    const websiteId = text(body.websiteId, 36)
    const expectedRevision = Number(body.expectedRevision)
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: 'INVALID_REVISION' }, 400)
    if (!body.content || typeof body.content !== 'object' || Array.isArray(body.content)) return json({ error: 'INVALID_CONTENT' }, 400)
    if (new TextEncoder().encode(JSON.stringify(body.content)).length > 1_048_576) return json({ error: 'CONTENT_TOO_LARGE' }, 413)
    const { data, error } = await userClient.rpc('security_v2_save_draft', {
      p_website_id: websiteId, p_content: body.content, p_expected_revision: expectedRevision,
      p_correlation_id: correlationId(body.correlationId),
    }).single()
    if (error) return json({ error: error.message.includes('STALE_REVISION') ? 'STALE_REVISION' : 'SAVE_FAILED' }, error.message.includes('STALE_REVISION') ? 409 : 403)
    return json({ ok: true, ...data })
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'SAVE_FAILED' }, 500)
  }
})


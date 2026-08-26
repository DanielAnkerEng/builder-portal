import { bodyObject, correlationId, json, requireAal2, text } from '../_shared/security.ts'

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const { user, userClient, adminClient } = await requireAal2(req)
    const { data: admin } = await userClient.from('platform_admins').select('user_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
    if (!admin) return json({ error: 'NOT_AUTHORIZED' }, 403)
    const b = await bodyObject(req), action = text(b.action, 32), cid = correlationId(b.correlationId)
    if (action === 'stage') {
      const { data, error } = await adminClient.rpc('security_v2_stage_legacy_import', {
        p_actor: user.id, p_fingerprint: text(b.fingerprint, 64), p_account_id: text(b.accountId, 120),
        p_project_name: text(b.projectName, 160), p_email: typeof b.email === 'string' ? b.email : '',
        p_legacy_company: typeof b.legacyCompanyId === 'string' && b.legacyCompanyId ? b.legacyCompanyId : null,
        p_content: b.content, p_metadata: { exportedAt: b.exportedAt, source: 'legacy-browser-export-v1' }, p_correlation: cid,
      })
      return error ? json({ error: 'IMPORT_STAGE_FAILED' }, 400) : json(data, data?.ok ? 200 : 409)
    }
    if (action === 'confirm_mapping') {
      const { data, error } = await adminClient.rpc('security_v2_confirm_legacy_mapping', {
        p_actor: user.id, p_import: text(b.importId, 36), p_company: text(b.companyId, 36),
        p_site_name: text(b.siteName, 160), p_public_slug: text(b.publicSlug, 80),
        p_confirmed: b.mappingConfirmed === true, p_correlation: cid,
      })
      return error ? json({ error: 'IMPORT_MAPPING_FAILED' }, 400) : json(data, data?.ok ? 200 : 409)
    }
    return json({ error: 'UNSUPPORTED_ACTION' }, 400)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'IMPORT_FAILED' }, 500)
  }
})

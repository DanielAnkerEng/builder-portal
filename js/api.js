import { supabase } from './supabase.js'
const cid = () => crypto.randomUUID()
export async function loadWebsiteDraft(websiteId) {
  const { data: website, error: websiteError } = await supabase.from('websites').select('id,company_id,name,public_slug,domain,status,current_publication_id').eq('id', websiteId).single(); if (websiteError) throw websiteError
  const { data: draft, error: draftError } = await supabase.from('website_drafts').select('content,revision,updated_at').eq('website_id', websiteId).maybeSingle(); if (draftError) throw draftError
  return { website, draft: draft ?? { content: null, revision: 0, updated_at: null } }
}
export async function saveDraft(websiteId, content, expectedRevision) {
  const { data, error } = await supabase.functions.invoke('save-draft', { body: { websiteId, content, expectedRevision, correlationId: cid() } })
  if (error || !data?.ok) throw Object.assign(new Error(data?.error || 'SAVE_FAILED'), { code: data?.error }); return data
}
export async function publishSite(websiteId, expectedRevision, personalKey) {
  const { data, error } = await supabase.functions.invoke('publish-site', { body: { websiteId, expectedRevision, personalKey, correlationId: cid() } })
  if (error || !data?.ok) throw Object.assign(new Error(data?.error || 'PUBLISH_FAILED'), { code: data?.error }); return data
}
export async function setPersonalKey(newKey, currentKey = null) {
  const { data, error } = await supabase.functions.invoke('manage-security-keys', { body: { action: 'set_personal_key', newKey, currentKey, correlationId: cid() } })
  if (error || !data?.ok) throw new Error(data?.error || 'KEY_OPERATION_FAILED'); return data
}


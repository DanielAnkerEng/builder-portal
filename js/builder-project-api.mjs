import { supabase } from './supabase.js'

export async function renameWebsite(websiteId, value) {
  const name=String(value).trim()
  if(!name||name.length>160||/[\u0000-\u001f\u007f]/.test(name)) throw Error('INVALID_NAME')
  // JWT-bearing client; server derives actor and permissions. No direct table write.
  const {data,error}=await supabase.rpc('security_v2_rename_website',{
    p_website_id:websiteId,p_name:name,p_correlation_id:crypto.randomUUID(),
  }).single()
  if(error||!data?.name)throw Error('RENAME_FAILED')
  return data
}

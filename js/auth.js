import { clearWreachAuthSession, supabase } from './supabase.js'
export async function requireAal2({ platformAdmin = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession(); if (!session) return redirect('login.html')
  const { data: assurance, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if (error || assurance.currentLevel !== 'aal2') return redirect('mfa.html')
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,display_name,username,status').eq('id', session.user.id).single()
  if (profileError || profile?.status !== 'active') throw new Error('Profile unavailable')
  const { data: admin } = await supabase.from('platform_admins').select('admin_role').eq('user_id', session.user.id).eq('is_active', true).maybeSingle()
  if (platformAdmin && !admin) return redirect('builder.html')
  const { data: memberships = [] } = await supabase.from('company_memberships').select('company_id,role,status').eq('user_id', session.user.id).eq('status', 'active')
  return { session, user: session.user, profile, admin, memberships, isPlatformAdmin: Boolean(admin) }
}
export async function signOut() { try { await supabase.auth.signOut() } finally { clearWreachAuthSession(); location.replace('login.html') } }
function redirect(url) { location.replace(url); return new Promise(() => {}) }

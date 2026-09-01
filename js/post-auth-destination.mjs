export async function resolvePostAuthDestination(supabase) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const session = sessionData?.session
  if (sessionError || !session?.user?.id) throw new Error('POST_AUTH_SESSION_REQUIRED')

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assuranceError || assurance?.currentLevel !== 'aal2') throw new Error('POST_AUTH_AAL2_REQUIRED')

  const { data: platformAdmin, error: roleError } = await supabase
    .from('platform_admins')
    .select('admin_role')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (roleError) throw new Error('POST_AUTH_ROLE_LOOKUP_FAILED')
  if (!platformAdmin) return 'builder.html'
  if (platformAdmin.admin_role === 'owner' || platformAdmin.admin_role === 'admin') return 'admin.html'
  throw new Error('POST_AUTH_ROLE_INVALID')
}

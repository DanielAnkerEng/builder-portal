const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function getOnboardingStatus(client) {
  const { data, error } = await client.rpc('security_v2_customer_onboarding_status')
  if (error || data?.ok !== true || !['none', 'invited', 'accepted'].includes(data.status)) throw new Error('INVITATION_UNAVAILABLE')
  if (data.status !== 'none' && (!uuid.test(data.invitationId) || !['viewer', 'editor'].includes(data.role) || typeof data.passwordRequired !== 'boolean')) throw new Error('INVITATION_UNAVAILABLE')
  return data
}

export async function readOnboardingState(client) {
  const { data: identity, error } = await client.auth.getUser()
  if (error || !identity?.user) throw new Error('LOGIN_REQUIRED')
  const status = await getOnboardingStatus(client)
  if (status.status === 'none') throw new Error('INVITATION_UNAVAILABLE')
  const { data: assurance, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalError) throw new Error('ASSURANCE_UNAVAILABLE')
  return { ...status, stage: status.passwordRequired ? 'password' : assurance?.currentLevel !== 'aal2' ? 'mfa' : status.status === 'accepted' ? 'active' : 'ready' }
}

export async function establishPassword(client, password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || password !== confirmation) throw new Error('PASSWORD_INVALID')
  const state = await readOnboardingState(client)
  if (state.status !== 'invited') throw new Error('INVITATION_UNAVAILABLE')
  const { data: identity, error: identityError } = await client.auth.getUser()
  if (identityError || !identity?.user?.email) throw new Error('LOGIN_REQUIRED')
  const { error } = await client.auth.updateUser({ password })
  if (error) throw new Error('PASSWORD_REJECTED')
  // Auth signs the password AMR; an invite/recovery session alone is not proof.
  const signedIn = await client.auth.signInWithPassword({ email: identity.user.email, password })
  if (signedIn.error || signedIn.data?.user?.id !== identity.user.id) throw new Error('PASSWORD_LOGIN_REQUIRED')
  return readOnboardingState(client)
}

export async function acceptInvitation(client) {
  const state = await readOnboardingState(client)
  if (!['ready', 'active'].includes(state.stage)) throw new Error('AAL2_AND_PASSWORD_REQUIRED')
  const { data, error } = await client.rpc('security_v2_accept_customer_invitation', { p_invitation: state.invitationId })
  if (error || data?.ok !== true || data.status !== 'active' || !uuid.test(data.companyId)) throw new Error('ACTIVATION_UNCONFIRMED')
  return { companyId: data.companyId, destination: 'builder.html' }
}

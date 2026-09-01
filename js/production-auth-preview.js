import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MfaController, classifyAssurance, resolveMfaLoginMode } from './mfa-controller.mjs'
import { productionAuthPreviewAllowed, refreshPreviewFactorStatus } from './production-auth-preview-gate.mjs'
import { PRODUCTION_PUBLIC_CONFIG, validateProductionPublicConfig } from './supabase-public-config.mjs'

if (!productionAuthPreviewAllowed(window.location)) stopPreview('Preview-lenken er ugyldig. Bruk den eksakte, dokumenterte lokale URL-en.')
if (!validateProductionPublicConfig(PRODUCTION_PUBLIC_CONFIG)) stopPreview('Offentlig produksjonskonfigurasjon mangler eller er ugyldig.')

const volatileStorage = createMemoryStorage()
const client = createClient(PRODUCTION_PUBLIC_CONFIG.url, PRODUCTION_PUBLIC_CONFIG.key, {
  auth: { storage: volatileStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
})
const auth = client.auth
const controller = new MfaController(auth, renderMfa)
const el = {
  login: byId('previewLoginForm'), email: byId('previewEmail'), password: byId('previewPassword'),
  authPanel: byId('previewAuthPanel'), mfaPanel: byId('previewMfaPanel'), status: byId('previewStatus'),
  factors: byId('previewFactors'), start: byId('previewMfaStart'), enrollment: byId('previewEnrollment'),
  qr: byId('previewQr'), secret: byId('previewSecret'), verifyForm: byId('previewVerifyForm'),
  code: byId('previewCode'), verify: byId('previewVerify'), cancel: byId('previewCancel'),
  logout: byId('previewLogout'), error: byId('previewError')
}
let mode = 'enrollment', challengeFactorId = null

el.login.addEventListener('submit', signIn)
el.start.addEventListener('click', async () => {
  const result = await controller.startEnrollment()
  if (result?.challengeRequired) enterChallenge(result.challengeFactorId)
})
el.verifyForm.addEventListener('submit', async event => {
  event.preventDefault()
  const ok = await controller.verify(el.code.value, mode === 'challenge' ? challengeFactorId : undefined)
  el.code.value = ''
  if (ok) await finishVerifiedUi()
})
el.cancel.addEventListener('click', async () => {
  const unverifiedId = controller.enrollment?.factorId || controller.factors.unverifiedTotp[0]?.id
  if (await controller.cancel(unverifiedId)) await initializeMfa()
})
el.logout.addEventListener('click', logout)
window.addEventListener('pagehide', clearSensitiveUi)

async function signIn(event) {
  event.preventDefault(); clearError(); setBusy(true)
  const email = el.email.value.trim(), password = el.password.value
  const { error } = await auth.signInWithPassword({ email, password })
  el.password.value = ''; setBusy(false)
  if (error) return showError('Innlogging mislyktes. Kontroller e-post og passord.')
  el.authPanel.hidden = true; el.mfaPanel.hidden = false
  await initializeMfa()
}

async function initializeMfa() {
  clearSensitiveUi(); clearError()
  const { data: { session }, error: sessionError } = await auth.getSession()
  if (sessionError || !session) return logoutWithError('Ingen gyldig Auth-session ble funnet.')
  const { data: assurance, error: assuranceError } = await auth.mfa.getAuthenticatorAssuranceLevel()
  if (assuranceError) return showError('Sikkerhetsnivået kunne ikke kontrolleres.')
  const factors = await controller.loadFactors()
  if (!factors) return
  mode = resolveMfaLoginMode(assurance, factors)
  if (classifyAssurance(assurance) === 'authenticated') return showVerified()
  if (mode === 'challenge') enterChallenge(factors.verifiedTotp[0]?.id)
  renderMfa(controller.snapshot())
}

function renderMfa(snapshot) {
  const verified = snapshot.factors.verifiedTotp, unverified = snapshot.factors.unverifiedTotp
  const busy = ['starting', 'verifying', 'cancelling'].includes(snapshot.state)
  if (verified.length && !snapshot.enrollment) enterChallenge(snapshot.challengeFactorId || challengeFactorId || verified[0].id)
  el.factors.textContent = `${verified.length} verifisert TOTP-faktor, ${unverified.length} uverifisert.`
  el.status.textContent = mode === 'challenge' ? 'Bekreft eksisterende faktor.' : 'Aktiver TOTP kun ved eksplisitt valg.'
  el.start.hidden = verified.length > 0 || unverified.length > 0 || Boolean(snapshot.enrollment)
  el.start.disabled = busy
  el.cancel.hidden = verified.length > 0 || (!unverified.length && !snapshot.enrollment)
  el.cancel.disabled = busy
  el.enrollment.hidden = !snapshot.enrollment
  el.verifyForm.hidden = mode !== 'challenge' && !snapshot.enrollment
  el.verify.disabled = busy
  if (snapshot.enrollment) { el.qr.src = snapshot.enrollment.qrCode; el.secret.textContent = snapshot.enrollment.secret }
  if (snapshot.state === 'error') showError(snapshot.message)
}

function enterChallenge(factorId) { mode = 'challenge'; challengeFactorId = factorId || null }
async function finishVerifiedUi() {
  const factors = await refreshPreviewFactorStatus(controller)
  showVerified()
  if (!factors) el.factors.textContent = 'AAL2 er bekreftet, men faktorstatusen kunne ikke oppdateres.'
}
function showVerified() { clearSensitiveUi(); mode = 'authenticated'; el.status.textContent = 'AAL2 bekreftet. Auth/MFA-testen er fullført.'; el.start.hidden = true; el.cancel.hidden = true; el.verifyForm.hidden = true }
async function logout() { clearSensitiveUi(); try { await auth.signOut({ scope: 'local' }) } finally { volatileStorage.clear(); el.mfaPanel.hidden = true; el.authPanel.hidden = false; el.email.value = ''; el.password.value = ''; mode = 'enrollment'; challengeFactorId = null } }
async function logoutWithError(message) { await logout(); showError(message) }
function clearSensitiveUi() { controller.clearSecrets(); el.qr.removeAttribute('src'); el.secret.textContent = ''; el.code.value = '' }
function setBusy(busy) { [...el.login.elements].forEach(control => { control.disabled = busy }) }
function showError(message) { el.error.textContent = message; el.error.classList.add('show') }
function clearError() { el.error.textContent = ''; el.error.classList.remove('show') }
function byId(id) { return document.getElementById(id) }
function createMemoryStorage() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() } }
function stopPreview(message) { document.body.replaceChildren(); const notice = document.createElement('p'); notice.className = 'auth-error show'; notice.setAttribute('role', 'alert'); notice.textContent = message; document.body.append(notice); throw new Error('Production Auth preview stopped') }

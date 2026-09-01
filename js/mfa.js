import { supabase } from './supabase.js'
import { MfaController, classifyAssurance, resolveMfaLoginMode } from './mfa-controller.mjs'
import { signOut } from './auth.js'
import { resolvePostAuthDestination } from './post-auth-destination.mjs'

const el = { title: byId('mfaTitle'), help: byId('mfaHelp'), status: byId('mfaStatus'), enrollment: byId('enrollment'), qr: byId('mfaQr'), secret: byId('mfaSecret'), form: byId('mfaForm'), code: byId('mfaCode'), error: byId('mfaError'), start: byId('mfaStart'), cancel: byId('mfaCancel'), submit: byId('mfaSubmit') }
let mode = 'enrollment', challengeFactorId = null
const controller = new MfaController(supabase.auth, render)
const { data: { session }, error: sessionError } = await supabase.auth.getSession()
if (sessionError || !session) location.replace('login.html'); else await initialize()

async function initialize() {
  const { data: assurance, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return showError('Sikkerhetsnivået kunne ikke kontrolleres.')
  mode = classifyAssurance(assurance); if (mode === 'authenticated') return routeAfterAal2()
  const factors = await controller.loadFactors(); if (!factors) return
  mode = resolveMfaLoginMode(assurance, factors)
  if (mode === 'challenge') { challengeFactorId = factors.verifiedTotp[0]?.id || null; if (!challengeFactorId) return showError('En verifisert autentiseringsfaktor ble ikke funnet.') }
  render(controller.snapshot())
}

el.start.addEventListener('click', async () => { const result = await controller.startEnrollment(); if (result?.challengeRequired) { mode = 'challenge'; challengeFactorId = result.challengeFactorId; render(controller.snapshot()) } })
el.cancel.addEventListener('click', async () => { const id = controller.enrollment?.factorId || controller.factors.unverifiedTotp[0]?.id; if (await controller.cancel(id)) await controller.loadFactors() })
el.form.addEventListener('submit', async event => { event.preventDefault(); const ok = await controller.verify(el.code.value, mode === 'challenge' ? challengeFactorId : undefined); el.code.value = ''; if (ok) await routeAfterAal2() })
byId('mfaLogout').addEventListener('click', async () => { clearSensitiveUi(); await signOut() })
window.addEventListener('pagehide', clearSensitiveUi)

function render(snapshot) {
  clearError(); const busy = ['starting', 'verifying', 'cancelling'].includes(snapshot.state), verified = snapshot.factors.verifiedTotp, unverified = snapshot.factors.unverifiedTotp.length
  if (verified.length && !snapshot.enrollment) { mode = 'challenge'; challengeFactorId = snapshot.challengeFactorId || challengeFactorId || verified[0].id }
  const challenge = mode === 'challenge' && verified.length > 0
  el.title.textContent = challenge ? 'Bekreft tofaktor' : 'Aktiver tofaktor'
  el.help.textContent = challenge ? 'Skriv inn koden fra autentiseringsappen.' : 'Registrering starter først når du velger Aktiver 2FA.'
  el.status.textContent = verified.length ? `${verified.length} verifisert TOTP-faktor` : unverified ? 'En uferdig TOTP-registrering må fjernes før du kan starte på nytt.' : 'Ingen verifisert TOTP-faktor.'
  el.start.hidden = verified.length > 0 || Boolean(unverified) || Boolean(snapshot.enrollment); el.cancel.hidden = challenge || (!unverified && !snapshot.enrollment); el.form.hidden = !challenge && !snapshot.enrollment; el.enrollment.hidden = !snapshot.enrollment
  el.start.disabled = busy; el.cancel.disabled = busy; el.submit.disabled = busy
  if (snapshot.enrollment) { el.qr.src = snapshot.enrollment.qrCode; el.secret.textContent = snapshot.enrollment.secret }
  if (snapshot.state === 'error') showError(snapshot.message)
}
function clearSensitiveUi() { controller.clearSecrets(); el.qr.removeAttribute('src'); el.secret.textContent = ''; el.code.value = '' }
async function routeAfterAal2() { try { location.replace(await resolvePostAuthDestination(supabase)) } catch { showError('Tilgangen kunne ikke kontrolleres. Logg ut og prøv igjen.') } }
function showError(message) { el.error.textContent = message; el.error.classList.add('show') }
function clearError() { el.error.textContent = ''; el.error.classList.remove('show') }
function byId(id) { return document.getElementById(id) }

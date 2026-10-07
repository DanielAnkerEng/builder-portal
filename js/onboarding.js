import { readOnboardingState, establishPassword, acceptInvitation } from './customer-onboarding.mjs'

// The existing SDK alone consumes the invitation/recovery session. Never copy,
// decode, log or persist link tokens. Let the SDK finish normal callback handling
// before cleanup; failed imports/initialization must also remove URL remnants.
const linkError = new URLSearchParams(location.hash.slice(1)).has('error') || new URLSearchParams(location.search).has('error')
let supabase, signOut
let initializationFailed = false
try {
  ;({ supabase } = await import('./supabase.js'))
  initializationFailed = Boolean((await supabase.auth.getSession()).error)
  ;({ signOut } = await import('./auth.js'))
}
catch { initializationFailed = true }
finally { history.replaceState(null, '', location.pathname) }
const byId = id => document.getElementById(id)
const form = byId('onboardingPasswordForm'), password = byId('onboardingPassword'), confirmation = byId('onboardingConfirmation')
const status = byId('onboardingStatus'), error = byId('onboardingError'), mfa = byId('onboardingMfa'), accept = byId('onboardingAccept'), workspace = byId('onboardingWorkspace')
let busy = false
const clearPassword = () => { password.value = ''; confirmation.value = '' }
const hideActions = () => { form.hidden = true; mfa.hidden = true; accept.hidden = true; workspace.hidden = true }
function showError(code) {
  const messages = { LOGIN_REQUIRED: 'Åpne den gyldige invitasjonslenken, eller logg inn på nytt.',
    PASSWORD_INVALID: 'Passordene må være like og inneholde 12–128 tegn.', PASSWORD_REJECTED: 'Passordet kunne ikke lagres. Kontroller kravene og prøv igjen.',
    PASSWORD_LOGIN_REQUIRED: 'Passordinnlogging kunne ikke bekreftes. Bruk Logg inn med passordet du nettopp valgte, og fullfør 2FA.',
    INITIALIZATION_FAILED: 'Innloggingstjenesten kunne ikke lastes eller bekreftes. Last siden på nytt. Åpne eventuelt invitasjonslenken på nytt, eller logg inn med ditt etablerte passord. Ingen tilgang er aktivert.',
    ACTIVATION_UNCONFIRMED: 'Aktiveringen kunne ikke bekreftes. Kontroller status på nytt; det opprettes ikke et nytt medlemskap.' }
  error.textContent = messages[code] || 'Invitasjonen er ikke tilgjengelig. Den kan være utløpt, tilbakekalt eller tilhøre en annen bruker. Kontakt Wreach.'
  error.classList.add('show')
}
async function refresh() {
  hideActions(); error.textContent = ''; error.classList.remove('show')
  const state = await readOnboardingState(supabase)
  status.textContent = { password: 'Trinn 1: Velg ditt personlige passord.', mfa: 'Trinn 2: Bekreft obligatorisk tofaktor.', ready: 'Trinn 3: Tofaktor er bekreftet. Aktiver din inviterte tilgang.', active: 'Kundetilgangen er aktivert.' }[state.stage]
  form.hidden = state.stage !== 'password'; mfa.hidden = state.stage !== 'mfa'; accept.hidden = state.stage !== 'ready'; workspace.hidden = state.stage !== 'active'
}
async function run(action) {
  if (busy) return
  if (initializationFailed || linkError) { hideActions(); showError(initializationFailed ? 'INITIALIZATION_FAILED' : 'INVITATION_UNAVAILABLE'); return }
  busy = true; document.querySelectorAll('button').forEach(button => { button.disabled = true })
  try { await action() } catch (cause) { showError(cause?.message) }
  finally { busy = false; document.querySelectorAll('button').forEach(button => { button.disabled = false }) }
}
form.addEventListener('submit', event => { event.preventDefault(); void run(async () => {
  try { await establishPassword(supabase, password.value, confirmation.value) } finally { clearPassword() }
  await refresh()
}) })
accept.addEventListener('click', () => void run(async () => { await acceptInvitation(supabase); await refresh() }))
byId('onboardingRefresh').addEventListener('click', () => void run(refresh))
byId('onboardingLogout').addEventListener('click', () => {
  clearPassword()
  if (signOut) void signOut()
  else location.replace('login.html')
})
window.addEventListener('pagehide', clearPassword)
if (linkError || initializationFailed) {
  hideActions(); status.textContent = 'Invitasjonslenken kunne ikke bekreftes.'
  showError(initializationFailed ? 'INITIALIZATION_FAILED' : 'INVITATION_UNAVAILABLE')
  byId('onboardingRefresh').disabled = true
  if (!signOut) byId('onboardingLogout').textContent = 'Tilbake til innlogging'
}
else await run(refresh)

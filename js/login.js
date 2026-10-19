import { prepareAuthSignIn, supabase } from './supabase.js'
import { classifyAssurance } from './mfa-controller.mjs'
import { resolvePostAuthDestination } from './post-auth-destination.mjs'
const form=document.getElementById('loginForm'), errorEl=document.getElementById('authError')
const forgotLink = document.getElementById('forgotLink')
const submitButton = form.querySelector('button[type="submit"]')
let busy = false

form.addEventListener('submit', async event => {
  event.preventDefault()
  if (busy) return
  clearFeedback()
  setBusy(true, 'Logger inn …')
  let navigating = false
  try {
    const email = document.getElementById('email').value.trim(), password = document.getElementById('password').value, remember = document.getElementById('remember').checked
    try { await prepareAuthSignIn(remember) }
    catch { return show('Sikker lagring kunne ikke klargjøres. Prøv igjen.') }
    let result
    try { result = await supabase.auth.signInWithPassword({email, password}) }
    catch { return show('Innloggingen kunne ikke fullføres. Kontroller forbindelsen og prøv igjen.') }
    if (!result || result.error) return show('Feil e-post eller passord.')
    let assuranceResult
    try { assuranceResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel() }
    catch { return show('Sikkerhetsnivået kunne ikke kontrolleres. Prøv igjen.') }
    if (!assuranceResult || assuranceResult.error) return show('Sikkerhetsnivået kunne ikke kontrolleres. Prøv igjen.')
    if (classifyAssurance(assuranceResult.data) !== 'authenticated') {
      location.replace('mfa.html')
      navigating = true
      return
    }
    try {
      location.replace(await resolvePostAuthDestination(supabase))
      navigating = true
    } catch { return show('Tilgangen kunne ikke kontrolleres. Logg ut og prøv igjen.') }
  } finally {
    if (!navigating) setBusy(false)
  }
})

forgotLink.addEventListener('click', async event => {
  event.preventDefault()
  if (busy) return
  clearFeedback()
  const emailInput = document.getElementById('email'), email = emailInput.value.trim()
  if (!email) return show('Skriv inn e-postadressen først.')
  if (!emailInput.checkValidity()) return show('Skriv inn en gyldig e-postadresse.')
  setBusy(true, 'Behandler forespørselen …')
  try {
    const result = await supabase.auth.resetPasswordForEmail(email)
    if (!result || result.error) return show('Forespørselen kunne ikke behandles. Prøv igjen senere.')
    show('Forespørselen er behandlet. Hvis kontoen finnes, får du en e-post med videre instruksjoner.', false)
  } catch {
    show('Forespørselen kunne ikke behandles. Prøv igjen senere.')
  } finally {
    setBusy(false)
  }
})

function setBusy(value, message) {
  busy = value
  submitButton.disabled = value
  form.setAttribute('aria-busy', String(value))
  if (value) {
    forgotLink.setAttribute('aria-disabled', 'true')
    show(message, false)
    errorEl.classList.remove('is-success')
  } else forgotLink.removeAttribute('aria-disabled')
}
function clearFeedback() {
  errorEl.textContent = ''
  errorEl.classList.remove('show', 'is-success')
  errorEl.setAttribute('role', 'status')
  errorEl.setAttribute('aria-live', 'polite')
}
function show(message, error = true) {
  errorEl.setAttribute('role', error ? 'alert' : 'status')
  errorEl.setAttribute('aria-live', error ? 'assertive' : 'polite')
  errorEl.classList.toggle('is-success', !error)
  errorEl.classList.add('show')
  errorEl.textContent = message
}

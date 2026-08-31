import { requireAal2 } from './auth.js'
import { setPersonalKey } from './api.js'
import { supabase } from './supabase.js'
import { MfaController } from './mfa-controller.mjs'

await requireAal2()
const keyForm = byId('keyForm'), keyError = byId('keyError')
const mfa = { status: byId('settingsMfaStatus'), list: byId('settingsFactorList'), start: byId('settingsMfaStart'), enrollment: byId('settingsEnrollment'), qr: byId('settingsMfaQr'), secret: byId('settingsMfaSecret'), form: byId('settingsMfaForm'), code: byId('settingsMfaCode'), verify: byId('settingsMfaVerify'), cancel: byId('settingsMfaCancel'), error: byId('settingsMfaError') }
const controller = new MfaController(supabase.auth, renderMfa)
await controller.loadFactors()

keyForm.addEventListener('submit', async event => { event.preventDefault(); const next = byId('newKey').value; if (next !== byId('confirmKey').value) return showKey('Nøklene er ikke like.'); try { await setPersonalKey(next, byId('currentKey').value || null); keyForm.reset(); showKey('Sikkerhetsnøkkelen er lagret.', false) } catch { showKey('Nøkkelen kunne ikke lagres. Kontroller nåværende nøkkel.') } })
mfa.start.addEventListener('click', () => controller.startEnrollment())
mfa.cancel.addEventListener('click', async () => { const id = controller.enrollment?.factorId || controller.factors.unverifiedTotp[0]?.id; if (await controller.cancel(id)) await controller.loadFactors() })
mfa.form.addEventListener('submit', async event => { event.preventDefault(); const ok = await controller.verify(mfa.code.value); mfa.code.value = ''; if (ok) await controller.loadFactors() })
window.addEventListener('pagehide', clearSensitiveUi)

function renderMfa(snapshot) {
  clearMfaError(); mfa.list.replaceChildren(); const busy = ['starting', 'verifying', 'cancelling'].includes(snapshot.state), verified = snapshot.factors.verifiedTotp, unverified = snapshot.factors.unverifiedTotp
  mfa.status.textContent = verified.length ? `2FA er aktiv. ${verified.length} verifisert TOTP-faktor.` : '2FA er ikke aktivert.'
  verified.forEach((factor, index) => addFactorRow(`TOTP-faktor ${index + 1} – verifisert`, factor.id, verified.length > 1))
  unverified.forEach((factor, index) => addFactorRow(`TOTP-faktor ${index + 1} – uverifisert`, factor.id, true))
  snapshot.factors.other.forEach(() => addFactorRow('Annen MFA-faktor', null, false))
  mfa.start.hidden = Boolean(verified.length) || Boolean(unverified.length) || Boolean(snapshot.enrollment); mfa.start.disabled = busy
  mfa.cancel.hidden = !unverified.length && !snapshot.enrollment; mfa.cancel.disabled = busy
  mfa.enrollment.hidden = !snapshot.enrollment; mfa.verify.disabled = busy
  if (snapshot.enrollment) { mfa.qr.src = snapshot.enrollment.qrCode; mfa.secret.textContent = snapshot.enrollment.secret }
  if (snapshot.state === 'error') showMfaError(snapshot.message)
}

function addFactorRow(label, factorId, removable) {
  const row = document.createElement('div'), text = document.createElement('span'); row.className = 'factor-row'; text.textContent = label; row.append(text)
  if (removable && factorId) { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-ghost'; button.textContent = 'Fjern'; button.addEventListener('click', async () => { if (await controller.cancel(factorId)) await controller.loadFactors() }); row.append(button) }
  mfa.list.append(row)
}
function clearSensitiveUi() { controller.clearSecrets(); mfa.qr.removeAttribute('src'); mfa.secret.textContent = ''; mfa.code.value = '' }
function showKey(message, error = true) { keyError.textContent = message; keyError.classList.toggle('show', error) }
function showMfaError(message) { mfa.error.textContent = message; mfa.error.classList.add('show') }
function clearMfaError() { mfa.error.textContent = ''; mfa.error.classList.remove('show') }
function byId(id) { return document.getElementById(id) }

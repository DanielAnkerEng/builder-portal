const STATES = new Set(['idle', 'starting', 'awaiting_verification', 'verifying', 'verified', 'cancelling', 'cancelled', 'error'])

export class MfaController {
  constructor(auth, onChange = () => {}) { this.auth = auth; this.onChange = onChange; this.state = 'idle'; this.factors = { verifiedTotp: [], unverifiedTotp: [], other: [] }; this.enrollment = null }
  snapshot(extra = {}) { return { state: this.state, factors: this.factors, enrollment: this.enrollment, ...extra } }
  transition(state, extra = {}) { if (!STATES.has(state)) throw new Error('Invalid MFA state'); this.state = state; this.onChange(this.snapshot(extra)) }
  async loadFactors() {
    const { data, error } = await this.auth.mfa.listFactors()
    if (error) return this.fail('Kunne ikke hente tofaktorstatus.')
    const totp = Array.isArray(data?.totp) ? data.totp : [], phone = Array.isArray(data?.phone) ? data.phone : []
    this.factors = { verifiedTotp: totp.filter(f => f.status === 'verified'), unverifiedTotp: totp.filter(f => f.status !== 'verified'), other: phone }
    this.transition('idle'); return this.factors
  }
  async startEnrollment() {
    if (['starting', 'verifying', 'cancelling'].includes(this.state)) return
    if (this.enrollment) return this.fail('En registrering pågår allerede.', true)
    const currentFactors = await this.loadFactors()
    if (!currentFactors) return null
    if (currentFactors.verifiedTotp.length) return this.requireChallenge(currentFactors.verifiedTotp[0].id)
    if (currentFactors.unverifiedTotp.length) return this.fail('Fullfør eller fjern den uferdige faktoren først.', true)
    this.transition('starting')
    const { data, error } = await this.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Wreach authenticator' })
    if (isFactorNameConflict(error)) {
      const refreshedFactors = await this.loadFactors()
      if (refreshedFactors?.verifiedTotp.length) return this.requireChallenge(refreshedFactors.verifiedTotp[0].id)
    }
    if (error || !data?.id || !data?.totp?.qr_code || !data?.totp?.secret) return this.fail('Kunne ikke starte tofaktorregistrering.')
    this.enrollment = { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
    this.transition('awaiting_verification'); return this.enrollment
  }
  async verify(code, factorId = this.enrollment?.factorId) {
    if (this.state === 'verifying') return
    if (!factorId || !/^\d{6}$/.test(code)) return this.fail('Skriv inn en gyldig sekssifret kode.', true)
    this.transition('verifying')
    const { data: challenge, error: challengeError } = await this.auth.mfa.challenge({ factorId })
    if (challengeError || !challenge?.id) return this.fail('Verifiseringen kunne ikke startes. Prøv igjen.', true)
    const { error: verifyError } = await this.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
    if (verifyError) return this.fail('Koden er ugyldig eller utløpt. Prøv en ny kode.', true)
    const { error: refreshError } = await this.auth.refreshSession()
    if (refreshError) return this.fail('Sesjonen kunne ikke oppdateres. Logg inn på nytt.')
    const { data: assurance, error: assuranceError } = await this.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError || assurance?.currentLevel !== 'aal2') return this.fail('Tofaktor ble bekreftet, men sikkerhetsnivået ble ikke oppgradert. Logg inn på nytt.')
    this.clearSecrets(); this.transition('verified'); return true
  }
  async cancel(factorId = this.enrollment?.factorId) {
    if (this.state === 'cancelling') return
    if (!factorId) return this.fail('Ingen uferdig faktor å fjerne.', true)
    this.transition('cancelling')
    const { error } = await this.auth.mfa.unenroll({ factorId })
    if (error) return this.fail('Den uferdige faktoren kunne ikke fjernes.', true)
    this.clearSecrets(); this.factors.unverifiedTotp = this.factors.unverifiedTotp.filter(f => f.id !== factorId); this.transition('cancelled'); return true
  }
  clearSecrets() { if (this.enrollment) { this.enrollment.qrCode = ''; this.enrollment.secret = '' } this.enrollment = null }
  requireChallenge(factorId) { this.clearSecrets(); this.transition('idle', { challengeRequired: true, challengeFactorId: factorId }); return { challengeRequired: true, challengeFactorId: factorId } }
  fail(message, recoverable = false) { if (!recoverable) this.clearSecrets(); this.transition('error', { message, recoverable }); return null }
}

export function classifyAssurance(assurance) {
  if (assurance?.currentLevel === 'aal2') return 'authenticated'
  if (assurance?.currentLevel === 'aal1' && assurance?.nextLevel === 'aal2') return 'challenge'
  return 'enrollment'
}

export function resolveMfaLoginMode(assurance, factors) {
  if (assurance?.currentLevel === 'aal2') return 'authenticated'
  if (factors?.verifiedTotp?.length) return 'challenge'
  return classifyAssurance(assurance)
}

function isFactorNameConflict(error) {
  return error?.code === 'mfa_factor_name_conflict' || error?.error_code === 'mfa_factor_name_conflict'
}

import { adminElement } from './admin-shell.mjs'

export function createCustomerInviteApi(client, randomId = () => crypto.randomUUID()) {
  let attempt = null
  const recoveries = new Map()
  return {
    async list(companyId) {
      const {data,error} = await client.rpc('security_v2_list_customer_invitations',{p_company:companyId})
      if (error || data?.ok !== true || !Array.isArray(data.invitations) || data.invitations.some(i =>
        !/^[0-9a-f-]{36}$/.test(i.invitationId) || typeof i.email !== 'string' || typeof i.displayName !== 'string' ||
        !['viewer','editor'].includes(i.role) || !['reserved','invited','accepted','revoked','expired'].includes(i.status) ||
        typeof i.delivery !== 'string' || typeof i.recoverable !== 'boolean')) throw new Error('INVITATION_UNCONFIRMED')
      return data.invitations
    },
    async recover(companyId, invitationId, action = 'recover') {
      if (!['recover','reconcile'].includes(action)) throw new Error('INVALID_REQUEST')
      const identity = [companyId,invitationId,action].join(':')
      if (!recoveries.has(identity)) recoveries.set(identity,randomId())
      const {data,error} = await client.functions.invoke('create-customer',{
        method:'POST',headers:{'Idempotency-Key':recoveries.get(identity)},body:{companyId,invitationId,action},
      })
      if (error || data?.ok !== true) {
        let code = data?.error?.code
        try { if (error?.context) code = (await error.context.clone().json())?.error?.code } catch { /* Safe fallback only. */ }
        const safe = ['RESEND_THROTTLED','ACTIVE_MEMBERSHIP_EXISTS','INVITATION_STATE_INCOMPATIBLE','IDENTITY_CONFLICT','BINDING_MISMATCH','INVITATION_NOT_FOUND']
        throw new Error(safe.includes(code) ? code : 'INVITATION_UNCONFIRMED')
      }
      if (!/^[0-9a-f-]{36}$/.test(data.invitationId) || !['invited','accepted'].includes(data.status) ||
        !['sent','dispatching','uncertain','reconciled_without_email'].includes(data.delivery)) throw new Error('INVITATION_UNCONFIRMED')
      return {invitationId:data.invitationId,status:data.status,delivery:data.delivery}
    },
    async invite(input) {
      if (!attempt) attempt = Object.freeze({ key: randomId(), body: Object.freeze({ ...input }) })
      if (JSON.stringify(input) !== JSON.stringify(attempt.body)) throw new Error('KEEP_ORIGINAL_INVITATION')
      const { data, error } = await client.functions.invoke('create-customer', {
        method: 'POST', headers: { 'Idempotency-Key': attempt.key }, body: attempt.body,
      })
      if (error || data?.ok !== true || !['invited', 'accepted'].includes(data.status) ||
        typeof data.invitationId !== 'string' || !/^[0-9a-f-]{36}$/.test(data.invitationId)) throw new Error('INVITATION_UNCONFIRMED')
      return { invitationId: data.invitationId, status: data.status }
    },
    async revoke(invitationId) {
      const { data, error } = await client.rpc('security_v2_revoke_customer_invitation', { p_invitation: invitationId })
      if (error || data?.ok !== true || data.status !== 'revoked') throw new Error('REVOCATION_UNCONFIRMED')
    },
  }
}

export function mountCustomerInvite({ document, companyId, createApi }) {
  const el = (tag, css, text) => adminElement(document, tag, css, text)
  const section = el('section', 'dashboard-section'), form = el('form', 'auth-form')
  section.append(el('h3', '', 'Inviter portalbruker'), el('p', '', 'Kun nye kontoer. Editor kan lese og lagre utkast, men ikke publisere eller administrere tilganger. Invitasjonen aktiverer ikke medlemskapet.'))
  const email = el('input'), name = el('input'), role = el('select')
  email.type = 'email'; email.required = true; email.maxLength = 254; email.autocomplete = 'off'
  name.required = true; name.maxLength = 120; name.autocomplete = 'off'
  role.required = true
  for (const [value, label] of [['', 'Velg rolle eksplisitt'], ['editor', 'Editor – anbefalt pilotrolle'], ['viewer', 'Viewer – kun lesing']]) {
    const option = el('option', '', label); option.value = value; role.append(option)
  }
  for (const [title, input] of [['Kundens e-post', email], ['Visningsnavn', name], ['Tilgangsrolle', role]]) {
    const label = el('label', 'field'); label.append(el('span', '', title), input); form.append(label)
  }
  const submit = el('button', 'btn btn-primary', 'Send invitasjon'), revoke = el('button', 'btn btn-outline', 'Tilbakekall uakseptert invitasjon'), result = el('p')
  submit.type = 'submit'; revoke.type = 'button'; revoke.hidden = true; result.setAttribute('role', 'status')
  form.append(submit); section.append(form, result, revoke)
  const api = createApi(); let busy = false, frozen = null, invitationId = null
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || invitationId) return
    if (!frozen) {
      if (!['editor', 'viewer'].includes(role.value) || !email.value.trim() || !name.value.trim()) return
      frozen = Object.freeze({ companyId, email: email.value.trim().toLowerCase(), displayName: name.value.trim(), role: role.value })
      email.disabled = true; name.disabled = true; role.disabled = true
    }
    busy = true; submit.disabled = true
    try {
      const response = await api.invite(frozen); invitationId = response.invitationId
      result.textContent = response.status === 'accepted' ? 'Invitasjonen er allerede akseptert.' : 'Invitasjonen er registrert. Kunden må bekrefte e-post, passord og 2FA før tilgang aktiveres.'
      revoke.hidden = response.status !== 'invited'
    } catch {
      result.textContent = 'Invitasjonen kunne ikke bekreftes. Avstem samme forsøk uten ny e-post, eller hent invitasjonsstatus nedenfor før en eksplisitt recovery.'
      submit.textContent = 'Avstem samme invitasjon'; submit.disabled = false
    } finally { busy = false }
  })
  revoke.addEventListener('click', async () => {
    if (busy || !invitationId) return
    busy = true; revoke.disabled = true
    try { await api.revoke(invitationId); result.textContent = 'Den uaksepterte invitasjonen er tilbakekalt.'; revoke.hidden = true }
    catch { result.textContent = 'Tilbakekalling kunne ikke bekreftes. Ingen konto slettes.' }
    finally { busy = false; revoke.disabled = false }
  })
  const load = el('button','btn btn-outline','Vis invitasjoner / oppdater status'), history = el('div')
  load.type = 'button'; section.append(load,history)
  const recoveryErrors = {
    RESEND_THROTTLED:'Vent minst 60 sekunder. Maksimalt tre recovery-forsøk per time.',
    ACTIVE_MEMBERSHIP_EXISTS:'Tilgangen er allerede aktiv. Recovery kan ikke endre medlemskapet.',
    IDENTITY_CONFLICT:'Identiteten samsvarer ikke. Ingen e-post eller tilgang sendes videre.',
    BINDING_MISMATCH:'Bruker, selskap eller rolle samsvarer ikke. Handlingen er avvist.',
    INVITATION_STATE_INCOMPATIBLE:'Invitasjonen har en nyere eller inkompatibel tilstand. Hent status på nytt.',
  }
  async function refreshHistory() {
    const rows = await api.list(companyId)
    history.replaceChildren()
    if (!rows.length) { history.append(el('p','','Ingen invitasjoner registrert.')); return }
    for (const row of rows) {
      const item = el('section','dashboard-section')
      item.append(el('h4','',row.displayName),el('p','',row.email+' · '+row.role+' · '+row.status),
        el('p','','Utsendelse: '+row.delivery+'. Tidligere generasjoner: '+String(row.historicalCount ?? 0)+'. Registrert utsendelse er ikke bevis på mottatt e-post.'))
      if (row.recoverable) {
        for (const [action,label] of [['reconcile','Avstem uten ny e-post'],['recover',row.status==='revoked' ? 'Inviter på nytt med samme rolle' : 'Send ny tilgangslenke (samme rolle)'],['revoke','Tilbakekall invitasjon']]) {
          const button = el('button','btn btn-outline',label); button.type='button'; item.append(button)
          button.addEventListener('click',async()=>{
            if (busy) return
            busy=true; button.disabled=true; load.disabled=true
            try {
              if(action==='revoke') { await api.revoke(row.invitationId); result.textContent='Invitasjonen er tilbakekalt.' }
              else {
                const response=await api.recover(companyId,row.invitationId,action)
                result.textContent=response.delivery==='sent' ? 'Ny tilgangslenke er sendt til Auth for levering. Ingen tilgang er aktivert.' :
                  'Bindingen er avstemt. Ingen automatisk ny e-post. Kontroller utsendelsesstatus; kunden må fortsatt fullføre passord og 2FA.'
              }
              await refreshHistory()
            } catch(cause) { result.textContent=recoveryErrors[cause?.message] || 'Handlingen kunne ikke bekreftes. Hent status og avstem før et nytt utsendelsesforsøk.' }
            finally { busy=false; button.disabled=false; load.disabled=false }
          })
        }
      }
      history.append(item)
    }
  }
  load.addEventListener('click',async()=>{
    if(busy)return
    busy=true; load.disabled=true
    try {await refreshHistory()} catch {result.textContent='Kunne ikke hente invitasjonsstatus.'}
    finally {busy=false; load.disabled=false}
  })
  return section
}

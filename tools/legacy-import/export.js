const report = document.getElementById('report')
document.getElementById('export').addEventListener('click', async () => {
  let accounts
  try { accounts = JSON.parse(localStorage.getItem('sn_accounts') || '[]') } catch { report.textContent = 'Ugyldig sn_accounts. Originaldata er ikke endret.'; return }
  const sites = []
  for (const account of accounts) {
    if (!account?.id || account.role === 'admin') continue
    const storageKey = `sn_builder_state__${account.id}`
    const raw = localStorage.getItem(storageKey)
    if (!raw) { sites.push({ accountId: account.id, projectName: account.projectName || '', status: 'missing_state', storageKey }); continue }
    let content
    try { content = JSON.parse(raw) } catch { sites.push({ accountId: account.id, projectName: account.projectName || '', status: 'invalid_json', storageKey }); continue }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    const fingerprint = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')
    sites.push({ accountId: String(account.id), projectName: String(account.projectName || ''), email: String(account.email || ''),
      legacyCompanyId: /^[0-9a-f-]{36}$/i.test(account.companyId || '') ? account.companyId : null,
      storageKey, fingerprint, content, status: 'needs_mapping' })
  }
  const manifest = { format: 'wreach-legacy-export-v1', exportedAt: new Date().toISOString(), sites }
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `wreach-legacy-export-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href)
  report.textContent = sites.map(s => `${s.accountId}: ${s.projectName || '(uten navn)'} — ${s.status}`).join('\n') || 'Ingen lokale kundesider funnet.'
})

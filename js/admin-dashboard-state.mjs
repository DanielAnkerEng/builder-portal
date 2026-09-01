const COUNT_IDS = ['statTotal', 'statLive', 'statDraft']

export function renderAdminDashboardState(document, state, websites = []) {
  const counts = COUNT_IDS.map(id => document.getElementById(id))
  const status = document.getElementById('adminOverviewStatus')
  if (counts.some(element => !element) || !status) throw new Error('ADMIN_DASHBOARD_UI_UNAVAILABLE')

  if (state === 'loading') {
    for (const element of counts) element.textContent = 'Laster …'
    status.textContent = 'Laster kontooversikt …'
    status.dataset.state = 'loading'
    status.setAttribute('role', 'status')
    status.hidden = false
    return
  }

  if (state === 'error') {
    for (const element of counts) element.textContent = '—'
    status.textContent = 'Kunne ikke hente kontooversikten'
    status.dataset.state = 'error'
    status.setAttribute('role', 'alert')
    status.hidden = false
    return
  }

  if (state !== 'success' || !Array.isArray(websites)) throw new Error('ADMIN_DASHBOARD_STATE_INVALID')
  counts[0].textContent = String(websites.length)
  counts[1].textContent = String(websites.filter(website => website.current_publication_id).length)
  counts[2].textContent = String(websites.filter(website => !website.current_publication_id).length)
  status.textContent = ''
  status.dataset.state = 'success'
  status.setAttribute('role', 'status')
  status.hidden = true
}

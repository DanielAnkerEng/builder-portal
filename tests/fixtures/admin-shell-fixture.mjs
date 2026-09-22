// Presentation fixture only: does not import an Auth client or any data APIs.
import { mountAdminShell, createAdminState } from '../../js/admin-shell.mjs'
import { renderAdminDashboardState } from '../../js/admin-dashboard-state.mjs'
const shell = mountAdminShell({ document, window, host: document.getElementById('fixtureShell'), content: document.getElementById('fixtureContent'), profile: { display_name: 'DEMO DATA · Lokal test' }, platformRole: '' })
shell.logout.disabled = true
shell.logout.textContent = 'Ingen session i testen'
renderAdminDashboardState(document, 'loading')
document.getElementById('fixtureGrid').append(createAdminState(document, {title:'Ingen testprosjekter',description:'Dette er en isolert visning av app-skallet. Ingen produksjonsdata brukes.'}))

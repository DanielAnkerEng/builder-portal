// Isolated visual fixture. Never imports authentication, API clients or real data.
import { mountAdminShell } from '../../js/admin-shell.mjs'
import { mountDashboard } from '../../js/admin-dashboard.mjs'
const shell = mountAdminShell({document,window,host:document.getElementById('fixtureShell'),content:document.getElementById('fixtureContent'),profile:{display_name:'DEMO DATA · Lokal test'},platformRole:''})
shell.logout.disabled = true
shell.logout.textContent = 'Ingen session i testen'
const dashboard = mountDashboard({document,host:document.getElementById('fixtureDashboard')})
const rows = [
  {id:'demo-draft',name:'DEMO DATA · Privat prosjekt',companies:{name:'Fiktiv eksempelbedrift'},current_publication_id:null,public_slug:'demo-draft'},
  {id:'demo-published',name:'DEMO DATA · Publisert eksempel',companies:{name:'Fiktiv eksempelbedrift'},current_publication_id:'demo-publication',public_slug:'demo-published'},
  {id:'demo-text',name:'<img src=x onerror=alert(1)>',companies:{name:'DEMO DATA · <script>test</script>'},current_publication_id:null},
]
const select = document.getElementById('fixtureState')
function render() { dashboard.update(select.value === 'empty' ? 'real' : select.value, select.value === 'demo' ? rows : []) }
select.addEventListener('change',render)
// Keep demo actions inside this presentation fixture; inspect hrefs without visiting real app routes.
document.getElementById('fixtureDashboard').addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault()})
render()

// Isolated presentation data, not an authentication bypass or a production data source.
import { mountAdminShell } from '../../js/admin-shell.mjs'
import { mountCustomers } from '../../js/admin-customers.mjs'
import { aggregateCustomers } from '../../js/admin-customers-data.mjs'
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333'
const companies=[{id:a,name:'DEMO DATA · Alfa eksempelbedrift med et svært langt selskapsnavn'},{id:b,name:'DEMO DATA · Åsen uten nettsider'},{id:c,name:'DEMO DATA · <img src=x onerror=alert(1)>'}]
const websites=[{id:'demo-one',company_id:a,name:'DEMO DATA · Hovedside',current_publication_id:'demo-publication',public_slug:'demo-one'},{id:'demo-two',company_id:a,name:'DEMO DATA · Upublisert prosjekt',current_publication_id:null},{id:'demo-three',company_id:c,name:'<script>test</script>',current_publication_id:null},{id:'demo-orphan',name:'DEMO DATA · Uten selskap'}]
const customers=mountCustomers({document,load:async()=>aggregateCustomers(companies,websites)})
const shell=mountAdminShell({document,window,host:document.getElementById('fixtureShell'),content:document.getElementById('fixtureContent'),profile:{display_name:'DEMO DATA'},platformRole:'',modules:new Map([['customers',customers]])})
shell.logout.disabled=true;shell.logout.textContent='Ingen session i testen'
document.querySelector('.admin-page-header').append(document.querySelector('.customers-fixture-banner'))
customers.element.addEventListener('click',event=>{const a=event.target.closest('a');if(a&&!a.getAttribute('href').startsWith('#'))event.preventDefault()})

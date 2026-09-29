// Isolated DOM fixture. No Auth client, credentials or real writes.
import { mountAdminShell } from '../../js/admin-shell.mjs'
import { mountCustomers } from '../../js/admin-customers.mjs'
const id = '11111111-1111-4111-8111-111111111111'
let created = false
const api = {
  listAssignees: async () => ({ok:true,assignees:[{userId:id,displayName:'DEMO DATA — ansvarlig'}]}),
  createCompany: async attempt => { created=true;return {attempt,idempotencyKey:attempt.idempotencyKey,status:'completed',companyId:id,operationId:id} },
}
const customers=mountCustomers({document,window,newCustomerApi:api,load:async()=>({customers:created?[{id,name:'DEMO DATA — eksempelbedrift',websites:[],published:0}]:[],orphans:[]})})
const shell=mountAdminShell({document,window,host:document.getElementById('fixtureShell'),content:document.getElementById('fixtureContent'),profile:{display_name:'DEMO DATA'},platformRole:'',modules:new Map([['customers',customers]])})
shell.logout.disabled=true
const banner=document.createElement('p');banner.textContent='DEMO DATA — isolert UI-test uten Auth, database eller ekte opprettelse.';document.querySelector('.admin-page-header').append(banner)

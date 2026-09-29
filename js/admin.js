import { supabase } from './supabase.js'
import { requireAal2, signOut } from './auth.js'
import { mountDashboard, loadDashboardWebsites } from './admin-dashboard.mjs'
import { mountAdminShell } from './admin-shell.mjs'
import { mountCustomers } from './admin-customers.mjs'
import { readCustomers } from './admin-customers-data.mjs'
import { createNewCustomerApi } from './admin-new-customer-api.mjs'
const ctx=await requireAal2({platformAdmin:true});
const customers = mountCustomers({ document, window, load: () => readCustomers(supabase), newCustomerApi: createNewCustomerApi(supabase) })
const shell = mountAdminShell({ document, window, host: document.getElementById('adminShell'), content: document.getElementById('adminLegacyContent'), profile: ctx.profile, platformRole: ctx.admin.admin_role, modules: new Map([['customers', customers]]) })
shell.logout.addEventListener('click',signOut)
const dashboard = mountDashboard({ document, host: document.getElementById('adminDashboard') })
await loadDashboardWebsites(dashboard, () => supabase.from('websites').select('id,name,public_slug,status,current_publication_id,companies(name)'))

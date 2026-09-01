import test from 'node:test'
import assert from 'node:assert/strict'
import { renderAdminDashboardState } from '../../js/admin-dashboard-state.mjs'

function fakeDocument() {
  const elements = Object.fromEntries(['statTotal', 'statLive', 'statDraft', 'adminOverviewStatus'].map(id => [id, {
    textContent: '', hidden: false, dataset: {}, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value }
  }]))
  return { elements, getElementById: id => elements[id] || null }
}

test('loading state is neutral and visible', () => { const doc=fakeDocument();renderAdminDashboardState(doc,'loading');assert.deepEqual(['statTotal','statLive','statDraft'].map(id=>doc.elements[id].textContent),['Laster …','Laster …','Laster …']);assert.equal(doc.elements.adminOverviewStatus.textContent,'Laster kontooversikt …');assert.equal(doc.elements.adminOverviewStatus.hidden,false) })
test('successful empty result renders legitimate zero counts', () => { const doc=fakeDocument();renderAdminDashboardState(doc,'success',[]);assert.deepEqual(['statTotal','statLive','statDraft'].map(id=>doc.elements[id].textContent),['0','0','0']);assert.equal(doc.elements.adminOverviewStatus.hidden,true) })
test('successful populated result renders correct counts', () => { const doc=fakeDocument();renderAdminDashboardState(doc,'success',[{current_publication_id:'publication-1'},{current_publication_id:null},{current_publication_id:null}]);assert.deepEqual(['statTotal','statLive','statDraft'].map(id=>doc.elements[id].textContent),['3','1','2']) })
test('query failure renders a safe visible error instead of zeroes', () => { const doc=fakeDocument();renderAdminDashboardState(doc,'error');assert.deepEqual(['statTotal','statLive','statDraft'].map(id=>doc.elements[id].textContent),['—','—','—']);assert.equal(doc.elements.adminOverviewStatus.textContent,'Kunne ikke hente kontooversikten');assert.equal(doc.elements.adminOverviewStatus.attributes.role,'alert');assert.equal(doc.elements.adminOverviewStatus.hidden,false) })

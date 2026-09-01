import test from 'node:test'
import assert from 'node:assert/strict'
import { productionAuthPreviewAllowed, PRODUCTION_AUTH_PREVIEW_URL, refreshPreviewFactorStatus } from '../../js/production-auth-preview-gate.mjs'
import { PRODUCTION_PUBLIC_CONFIG, validateProductionPublicConfig } from '../../js/supabase-public-config.mjs'

const allowed = `http://127.0.0.1:4175${PRODUCTION_AUTH_PREVIEW_URL}`

test('preview requires the exact explicit local URL gate', () => assert.equal(productionAuthPreviewAllowed({ href: allowed }), true))
test('ordinary localhost traffic cannot activate preview', () => assert.equal(productionAuthPreviewAllowed({ href: 'http://127.0.0.1:4175/login.html' }), false))
test('query gate without confirmation hash is rejected', () => assert.equal(productionAuthPreviewAllowed({ href: 'http://127.0.0.1:4175/production-auth-preview.html?mode=production-auth-preview' }), false))
test('additional query parameters are rejected', () => assert.equal(productionAuthPreviewAllowed({ href: 'http://127.0.0.1:4175/production-auth-preview.html?mode=production-auth-preview&extra=true#confirm-real-production-users' }), false))
test('remote origin cannot activate local preview', () => assert.equal(productionAuthPreviewAllowed({ href: 'https://wreach.no/production-auth-preview.html?mode=production-auth-preview#confirm-real-production-users' }), false))
test('production browser config is public and valid', () => assert.equal(validateProductionPublicConfig(PRODUCTION_PUBLIC_CONFIG), true))
test('service-role and secret keys are rejected', () => {
  assert.equal(validateProductionPublicConfig({ url: PRODUCTION_PUBLIC_CONFIG.url, key: 'service_role' }), false)
  assert.equal(validateProductionPublicConfig({ url: PRODUCTION_PUBLIC_CONFIG.url, key: `${['sb', 'secret'].join('_')}_private` }), false)
})
test('successful verification refreshes factor status through listFactors', async () => {
  let reads = 0
  const expected = { verifiedTotp: [{ id: 'verified' }], unverifiedTotp: [], other: [] }
  const result = await refreshPreviewFactorStatus({ loadFactors: async () => { reads += 1; return expected } })
  assert.equal(reads, 1)
  assert.equal(result, expected)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isLocalSupabaseHost } from '../../js/supabase-environment.mjs'

test('localhost uses local Supabase', () => assert.equal(isLocalSupabaseHost('localhost'), true))
test('IPv4 loopback uses local Supabase', () => assert.equal(isLocalSupabaseHost('127.0.0.1'), true))
test('IPv6 loopback uses local Supabase', () => assert.equal(isLocalSupabaseHost('[::1]'), true))
test('lookalike hostname cannot select local mode', () => assert.equal(isLocalSupabaseHost('localhost.example.com'), false))
test('production hostname cannot select local mode', () => assert.equal(isLocalSupabaseHost('wreach.no'), false))

test('shared browser client pins the tested SDK version across Auth redirects', () => {
  const source = readFileSync(new URL('../../js/supabase.js', import.meta.url), 'utf8')
  const imports = [...source.matchAll(/from\s+['"](https:\/\/esm\.sh\/@supabase\/supabase-js[^'"]*)['"]/g)]
  assert.equal(imports.length, 1)
  assert.equal(imports[0][1], 'https://esm.sh/@supabase/supabase-js@2.117.2')
  assert.doesNotMatch(source, /https:\/\/esm\.sh\/@supabase\/supabase-js@(?:2|latest)['"]|[?&](?:target|deps)=/)
})

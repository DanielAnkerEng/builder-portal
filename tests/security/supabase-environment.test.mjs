import test from 'node:test'
import assert from 'node:assert/strict'
import { isLocalSupabaseHost } from '../../js/supabase-environment.mjs'

test('localhost uses local Supabase', () => assert.equal(isLocalSupabaseHost('localhost'), true))
test('IPv4 loopback uses local Supabase', () => assert.equal(isLocalSupabaseHost('127.0.0.1'), true))
test('IPv6 loopback uses local Supabase', () => assert.equal(isLocalSupabaseHost('[::1]'), true))
test('lookalike hostname cannot select local mode', () => assert.equal(isLocalSupabaseHost('localhost.example.com'), false))
test('production hostname cannot select local mode', () => assert.equal(isLocalSupabaseHost('wreach.no'), false))

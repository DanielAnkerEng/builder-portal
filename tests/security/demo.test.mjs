import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMOS, resolveDemo } from '../../js/demo-data.mjs'
import { readFileSync } from 'node:fs'

for (const key of ['restaurant', 'frisor', 'handverker', 'bilverksted', 'eiendom', 'konsulent']) {
  test(`demo key ${key}`, () => {
    assert.equal(resolveDemo(key), DEMOS[key])
    assert.equal(resolveDemo(key).services.length, 3)
  })
}
for (const key of ['constructor', '__proto__', 'toString', 'does-not-exist', '', null]) {
  test(`invalid demo key ${String(key)} falls back`, () => {
    assert.equal(resolveDemo(key), DEMOS.restaurant)
  })
}
test('demo stays static and uses safe rendering', () => {
  const source = readFileSync(new URL('../../js/demo.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|localStorage|sessionStorage|supabase|\bfetch\s*\(/)
  assert.match(source, /resolveDemo\(params.get\('site'\)\)/)
  const html = readFileSync(new URL('../../demo.html', import.meta.url), 'utf8')
  assert.match(html, /noindex,nofollow/)
  assert.match(html, /Fiktiv virksomhet/)
})
test('marketing does not claim contact submission or invented results', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const script = readFileSync(new URL('../../js/script.js', import.meta.url), 'utf8')
  assert.match(html, /Kontaktskjema kommer snart/)
  assert.doesNotMatch(html, /<form|testimonial|data-count|Leverte nettsider/)
  assert.doesNotMatch(script, /Takk! Vi tar kontakt|contactForm/)
})

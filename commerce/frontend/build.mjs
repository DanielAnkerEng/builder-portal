import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {landingMarkup} from './landing.mjs';
const base=new URL('.',import.meta.url),publicDir=new URL('../public/',base);
await build({entryPoints:[fileURLToPath(new URL('shop.mjs',base))],outfile:fileURLToPath(new URL('app.js',publicDir)),bundle:true,format:'esm',target:'es2022',external:['/vendor/supabase.js'],legalComments:'none'});
const css=await readFile(new URL('store-base.css',base),'utf8')+'\n'+await readFile(new URL('landing.css',base),'utf8');
await writeFile(new URL('style.css',publicDir),css);
await writeFile(new URL('index.html',publicDir),`<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:,"><title>Bli Støgg – spill for gjengen</title><meta name="description" content="Én skjerm. Hele gjengen. Prøv tre kort fra Bli Støggs demospill. Lokal pilot med eksempelprodukter."><link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/style.css"><script type="module" src="/app.js"></script></head><body class="shop-page">
<a class="skip" href="#main">Hopp til innhold</a><header class="masthead"><a class="wordmark" href="#home">Bli Støgg.<span>Lokal pilot</span></a><nav aria-label="Hovedmeny"><a href="#products">Spillene</a><a href="#account">Mine spill</a><a href="#cart" id="cart-link">Handlekurv (0)</a></nav></header>
<main id="main" class="bs-home" tabindex="-1">${landingMarkup()}<noscript><p class="bs-section">Demoens kortknapper og butikken trenger JavaScript. Du kan lese eksempeloppgaven og om de to spillformatene ovenfor.</p></noscript></main><div id="notice" class="notice" role="status" aria-live="polite" hidden></div>
<footer><a class="footer-name" href="#home">Bli Støgg.</a><p>En skjerm. Hele gjengen. Alltid lov å stå over.</p><p>Dette er en privat, lokal testbutikk for voksne. Eksempelprodukter og testpriser. Selgerinformasjon, vilkår, kundestøtte og levering må avklares før lansering.</p><a href="#account">Finn tilbake til spillene dine →</a></footer></body></html>`);
console.log('Built Bli Støgg frontend: app.js, style.css, index.html');

# Bli Støgg / Wreach – lokal pilot

Lokal kjøps- og spillflyt i en isolert checkout av `DanielAnkerEng/builder-portal`, basert på `64752e9711f4e7b333e3def518825ece57975cbe`, branch `codex/bli-stogg-commerce-pilot`. Ingen commit, staging, push, PR eller publisering.

Egen pilotbranch ble opprettet 3. november uten endringer i de 239 registrerte kildefilene. Betalingsgjennomgangen og nye bevis ligger i `evidence/2026-11-03/payment-review/`. Ingen reset av eksisterende pilotdata i denne gjennomgangen.

Se **STRIPE_TEST_SETUP.md** for én samlet tilkoblingsveiledning og konfigurasjonsmal. Stripe er fremdeles frakoblet.

## Bruk piloten

- Butikk: <http://127.0.0.1:4308/>
- Wreach: <http://127.0.0.1:4307/admin.html#customers>
- Lokal testinnboks: <http://127.0.0.1:56324/>
- Adressen til den syntetiske demokjøperen ligger i feltet `buyer.email` i pilotens private `fixtures.json`. Velg **Mine spill**, send innloggingslenke, åpne lenken i testinnboksen. Denne kontoen har en **simulert** ordre og spilltilgang fra nettlesertesten. Ingen betaling er gjennomført hos Stripe.
- For demonstrasjon uten manuell håndtering av testadministratorens passord/TOTP: kjør `node commerce/open-demo.mjs` fra source med prosjektets Node-runtime. Dette åpner et eget Chrome-vindu med syntetisk kjøper og en faktisk passord-/TOTP-innlogget Wreach-administrator. Det omgår ikke serverautorisasjon. Lukk vinduet når du er ferdig.

Arbeidsrot: `/Users/danieleng/Documents/Codex/bli-stogg/`. Kode i `source/`, bevis i `evidence/2026-11-03/`, prosjektverktøy i `tools/`, privat konfigurasjon i `private/`. Private filer ligger utenfor Git og serverte mapper, med filmodus 0600 og mappe 0700. Ikke kopier innholdet til chat, logger eller dokumentasjon.

## Hva er implementert?

- Bli Støgg er en faktisk `companies`-rad, opprettet gjennom eksisterende bruker-JWT-avgrenset `security_v2_create_company`. Samme støttede operasjon er testet gjennom `admin-create-company` Edge.
- En ny avgrenset `commerce_create_store` oppretter `websites`, et gyldig privat `website_drafts`-dokument og en butikk med FK til samme `company_id`. Kundeopprettelsen alene lager ingen nettsted eller medlemskap.
- Wreach-kundeoversikten finner kunden og prosjektet. **Butikk og ordre** åpner kundens vedvarende produkter og ordre. Endring krever AAL2, aktiv profil, aktivt selskap og plattformadmin eller tillatt selskapsrolle. Revisjonskontroll hindrer tapte produktendringer.
- Ett digitalt spill og ett fysisk testprodukt; priser 49 og 149 NOK er midlertidige testpriser. Produkt og pris lagres i katalogen, ordrelinjer har uforanderlige kjøpsøyeblikksbilder. Beløp regnes i heltallsøre.
- Butikkjøpere bruker Supabase Auth-lenker. Ingen egen passordhåndtering i butikkflyten. Ingen profil, company_membership eller administratorrettighet opprettes ved kjøp. Butikk og portal har separate nettleserorigins og Auth-lagringsnøkler.
- Serveren bestemmer butikk/company og validerer produkt, mengde, valuta og pris. Ordretransaksjonen er idempotent og låser samtidige forsøk fra samme kjøper. Bruker-JWT/RLS beskytter ordrelesing; betalingsfunksjonene er bare tilgjengelige for serverrollen.
- Stripe Checkout-kode er implementert for engangskjøp i uttrykkelig testmodus. Live-nøkler og andre Supabase-adresser avvises ved oppstart. Eksakt Stripe-konto verifiseres før bruk. Eksisterende Checkout-session gjenbrukes; gamle uavklarte opprettelser krever avstemming i stedet for et nytt forsøk etter idempotensvinduet.
- Ny additiv migrasjon `20261103150000_commerce_payment_boundary.sql` bevarer gamle ordre/rettigheter, legger til modusgrenser, separate betalingsbevis og lagret PaymentIntent. Ingen historiske simulerte ordre blir ommerket til Stripe.
- Webhook verifiserer **rå Buffer-bytes** med Stripe SDK, henter session og ordrelinjer fra Stripe, kontrollerer testmodus, faktisk status, beløp, valuta, ordre, company, kjøper og produkter. Transaksjonen lagrer betaling/hendelse/rettighet samlet. Gjentatte hendelser dupliserer ikke tilgang, og en sen feil overskriver ikke betalt. Retursiden gir aldri tilgang.
- Spillinnhold ligger bare på serveren. Oppstart, kortlesing og fremdrift krever kjøperens aktive rettighet. 2–12 spillere, 12 kort, regler, neste, hopp over, tidlig avslutning, ny runde og reload. Versjonskontroll hindrer dobbelt fremrykk. Innholdet kan spilles med poeng eller alkoholfritt.

## Oppstart og avgrensning

Node som er brukt: `/Users/danieleng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

1. Start Docker Desktop hvis nødvendig. Ingen oppdatering/installasjon trengs.
2. Kjør `pnpm start:pilot` eller den lokale snarveien `../tools/start-pilot.sh` fra `source/`. Skriptet starter bare Supabase-prosjektet `bli-stogg-pilot`, og deretter portal/butikk på loopback. Det nullstiller ingen database og avslutter ingen andre servere.
Ved første oppstart setter `commerce/local-docker.mjs` eksplisitt `HostIp=127.0.0.1` før Docker oppretter containerne. `python3 commerce/local-stack.py verify` leser faktiske bindinger for API, PostgreSQL og testinnboks. For en eksisterende wildcard-binding kjører operatøren `python3 commerce/local-stack.py rebind` én gang. Dette gjenbruker databasevolumet og kopierer den installerte database- og gatewaykonfigurasjonen direkte mellom lokale containere. Mailpit bruker midlertidig meldingslagring.

3. Kjør `../tools/start-edge.sh` separat for Wreachs lokale Edge-funksjoner. Uten denne prosessen virker butikkflyten, men eksisterende Wreach Edge-handlinger er utilgjengelige.

Edge-oppstarten sender nå eksplisitt `--env-file commerce/local-edge.env`. Filen inneholder bare den offentlige pilotmarkøren `WREACH_LOCAL_PILOT=bli-stogg-pilot:56321`, ingen hemmeligheter. Samme kommando finnes som `start:pilot:edge` i package.json og bruker eksisterende Supabase CLI. Ikke bruk `--no-verify-jwt`. CORS-origin 4307 krever både denne markøren og CLI-ens interne `SUPABASE_URL=http://kong:8000`; uten markøren er tillegget avslått. Hosted Supabase får ikke tillegget selv om markøren settes.

Supabase API 56321, database 56322, lokal e-post 56324, shadow 56320, reserverte øvrige porter 56323/56327/56329, Edge-inspektør 5683. Wreach på 4203, 4205, 4206 og den eksisterende Supabase-stakken på 543xx er ikke konfigurert eller nullstilt av dette arbeidet. Docker Desktop startet sine eksisterende containere etter deres egen restart-policy; ingen av disse ble målrettet av pilotkommandoer.

Ny installasjon trenger prosjektlokal `pnpm install`, `node commerce/build.mjs`, den separate lokale Supabase-konfigurasjonen og privat `runtime.json`. Installerte SDK-er er låst i `pnpm-lock.yaml`. Bundlet Supabase-frontend bygges lokalt; frontend laster ingen SDK fra CDN. `bootstrap-local.mjs` skal bare brukes mot et tomt, uttrykkelig isolert pilotmiljø. Det lager syntetiske Auth-identiteter gjennom Auth Admin API og følger repositoryets lokale fixture-mønster for en ny testadministrator. Det er ikke produksjonsbackfill og bruker ikke produksjonsbruker-ID-er.

Den lokale SDK-en er `@supabase/supabase-js@2.117.2`. Bygget avviser feil versjon/eksterne modulimporter og skriver kilde-/bundlemetadata i den ignorerte vendor-mappen. Wreachs delte `js/supabase.js` og `js/supabase.local.js` har igjen sitt opprinnelige innhold. Bare den validerte lokale portalserverens svar erstatter CDN-importen med `/commerce-vendor/supabase.js` og standard lokal API-port med 56321. Produksjonsbygget får dermed opprinnelig SDK-import og lokal standardport. Butikklenken vises bare på `http://127.0.0.1:4307`; den gir ikke rettigheter.

## Stripe er ikke tilkoblet

Brukeren bekreftet 3. november 2026 at eget Stripe-testmiljø ennå ikke finnes. `stripe.mode` er derfor `disabled`. Checkout gir en forståelig feil uten betaling. Ingen Stripe API-forespørsel, virkelig Stripe-testordre, testkortbetaling, webhook-videresending eller offentlig tunnel er gjennomført.

Når et eget Bli Støgg-testmiljø er identifisert, konfigurer privat `runtime.json` lokalt med `stripe.mode = test`, eksplisitt konto-ID, testhemmelighet og riktig webhook-signaturhemmelighet. Ikke legg hemmeligheter i chat eller frontend. Koden aksepterer bare `sk_test_` og `whsec_`, og kontrollerer konto-ID samt testmodus mot Stripe. Miljønavn må også fylles ut. Se `STRIPE_TEST_SETUP.md` og `stripe-preflight.mjs`; kontokontroll skjer før Stripe-objekter kan opprettes.

Stripe CLI er ikke installert/aktivert av dette arbeidet. Avklar eget testmiljø og CLI-tilkobling før eventuell `stripe listen --forward-to http://127.0.0.1:4308/api/stripe/webhook` med hendelsene `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Lokal videresending bruker en utgående Stripe-tilkobling og åpner ingen offentlig tunnel. CLI-hemmeligheten må samsvare med listeneren, ikke en annen Dashboard-webhook. Ikke bruk Wreachs eksisterende betalingsoppsett.

Kjør deretter ekte testkjøp, avvist testkort, avbrudd, forsinkelse, replay og kjøp uten retur. Nåværende simulerte resultater er ikke en erstatning for denne gaten.

## Tester

Den skrivende commerce-suiten bruker Supabase-prosjektet `bli-stogg-review-test` med API på 57321, PostgreSQL på 57322 og innboks på 57324. Angi installert Node, Supabase CLI og Docker på PATH. Opprett eller oppdater testmiljøet fra `source/`:

```sh
python3 tests/commerce/prepare-isolated.py
supabase functions serve --network-id "$(docker inspect --format '{{.HostConfig.NetworkMode}}' supabase_db_bli-stogg-review-test)" --workdir ../private/test/stack --env-file commerce/local-edge.env
```

La Edge kjøre mens testene utføres i en annen terminal. Fixture-kontoer, passord og runtime for denne stakken ligger i `../private/test/`. Testhjelperne krever eksplisitt frakoblet betaling før de oppretter klienter. Den egne nettleserkontrollen bruker den installerte Chrome-nettleseren og prosjektets eksisterende Playwright-runtime. Sett `PLAYWRIGHT_MODULE` til den installerte modulens `index.mjs` når den ligger utenfor prosjektets Node-moduler.

```sh
NODE_ENV=test BLI_STOGG_PLATFORM_DB_TESTS=1 node --test --test-concurrency=1 tests/commerce/*.test.mjs
NODE_ENV=test BLI_STOGG_EVIDENCE_DIR="../evidence/test-browser" node tests/commerce/browser.mjs
node tests/commerce/buyer-state.browser.mjs
WREACH_LOCAL_AUTH_TESTS=0 WREACH_LOCAL_DIRECT_EDGE_TESTS=0 node --test tests/security/*.test.mjs
```

De tre separate HTTP-grensetestene leser den kjørende piloten på 4307/4308 og forventer frakoblet betalingsmodus. Kjør dem med `BLI_STOGG_PLATFORM_HTTP_TESTS=1 node --test tests/commerce/platform-http.test.mjs`.

Den additive migrasjonen `20261111120000_commerce_reservations_and_revisions.sql` er nødvendig for Checkout. Serveren krever dens reservasjons-RPC. Ulike kurver med samme digitale produkt får en konflikt med lenke til kjøperens ventende ordre. Ordrehistorikk beholder sin opprinnelige betalingsleverandør. Gjeldende spilltilgang bygger på aktiv rettighet og betalingsbevis for butikkens betalingsmiljø.

Bevis: `commerce-tests.tap`, `edge-test.log`, `wreach-regression.log`, `edge-regression.log`, `browser/report.json` og PNG-er i `/Users/danieleng/Documents/Codex/bli-stogg/evidence/2026-11-03/`. Nettlesertestene bruker installert Chrome, 1440/768/390 CSS-piksler og tastatur. Dette er **ikke** fysisk mobil eller faktisk Safari.

## Viktige produksjonsgrenser

- Serveren er uttrykkelig en lokal preview. Den publiserer ikke Wreach-utkast, setter ingen aktiv publikasjon og fjerner ingen personlig/selskapsnøkkel-gate. Produktredigering endrer lokal pilotkatalog. Produksjon trenger en eksplisitt katalog-/publiseringskontrakt og sikker utrulling.
- Lokal Supabase/Kong sender standard `Access-Control-Allow-Origin: *` selv når Edge-handleren setter eksakt origin. Faktisk avvisning av ikke tillatt origin og JWT/AAL2 er testet. Dette er ikke attestasjon av en streng gateway-CORS-policy; produksjon må kontrollere den separat. Portalens/butikkens egne API-er bruker eksakt origin og ingen wildcard-CORS.
- Lokal HTTP har egen CSP uten HTTPS-oppgradering fordi denne serveren ikke tilbyr TLS. Produksjonsfilen `_headers` og Wreach-forsiden er uendret. Ingen sertifikattillit er endret. Dette beviser ikke Safari/produksjon.
- Ordreoversikten er begrenset til de siste 100 radene; ikke en ferdig ordre-/logistikkplattform. Fraktadresse samles inn av Checkout for fysisk produkt når Stripe kobles til, men en full varig leveringsadresse-/fraktarbeidsflyt er ikke implementert. Ingen utsending finnes.
- Refusjonshåndtering og hvordan refusjon tilbakekaller rettigheter må besluttes og implementeres før salg. Ingen automatisk tilgangsendring ved refusjon er gjort i piloten.
- Testinnhold, priser og illustrasjoner er foreløpige. Ingen lager-, leverings- eller kundereferanser er oppfunnet.

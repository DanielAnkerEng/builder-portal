# Overlevering: Wreach-avhengigheter

## Kildegrunnlag

Isolert full Git-klone av `DanielAnkerEng/builder-portal`, commit `64752e9711f4e7b333e3def518825ece57975cbe`, opprinnelig branch `codex/wreach-home-integration-20261103`, nå egen lokal branch `codex/bli-stogg-commerce-pilot`. README er historisk statisk demo og beskriver ikke dagens Auth-modell. `Wreach-dokumentasjon` sin gjeldende status/siste logg er datert 2. november og predaterer kildecommit fra 3. november. Koden er derfor kontrollert direkte. Ingen upublisert onboarding-/hardening-pakke er innført.

## Eksisterende funksjoner som brukes

- `companies`, `profiles`, `platform_admins`, `company_memberships`, `websites`, `website_drafts`, `audit_events` og eksisterende RLS.
- `security_v2_create_company` og Edge `admin-create-company`: AAL2, aktiv profil og aktiv platform-admin, atomisk/idempotent kundepakke. Ingen automatisk Auth, membership eller website.
- Wreach Auth/TOTP og kundeliste, nettsideoversikt og Builder-lenker. `requireAal2`, medlemskontroll, private utkast og eksisterende publiserings-/nøkkelregler beholdes.

## Gjenbrukbare plattformendringer – må reviewes separat

1. `supabase/migrations/20261103120000_commerce_pilot.sql`: butikk FK til Wreach-company/website; produktkatalog, ordrelinjesnapshots, betalinger, hendelsesjournal, rettigheter og spilløkter. RLS og avgrensede RPC-er. Store-/produktoperasjoner auditeres. Samme ordre låses ved samtidige betalingshendelser.
2. `commerce/server.mjs`, `config.mjs`, `stripe.mjs`: lokal adapter for Supabase-identitet, katalog, Checkout og webhook. En produksjonsadapter må beholde autorisasjon og idempotens, og fjerne den lokale preview-avgrensningen gjennom egen vurdert implementasjon.
3. `js/admin-dashboard.mjs`: prosjektbundet **Butikk og ordre**-lenke, aktivert bare på origin `http://127.0.0.1:4307`. `commerce/public/admin.*`: produktredigering og ordreoversikt med serverkontrollert company-tilgang. Lenke alene gir ingen tilgang. Plattformkonseptet kan gjenbrukes senere, men er ikke aktivert på Wreach-produksjon.
4. `commerce/local-platform.mjs` tilpasser kun de lokale portalresponsene for `js/supabase.js` og `js/supabase.local.js`: lokalt bygget SDK 2.117.2 og API-port 56321. De delte kildefilene er byteidentiske med Wreach-grunnlaget og beholder produksjonsimporten/standard lokal port i produksjonsartefaktet. `supabase/config.toml` er den eksplisitte lokale pilotprofilen; den inngår ikke i det statiske produksjonsbygget.
5. `supabase/functions/admin-create-company/index.ts`: origin `http://127.0.0.1:4307` krever både lokal Kong-adresse og markøren fra `commerce/local-edge.env`. Hosted/default-miljøet beholder nøyaktig tidligere origin-sett. Eksisterende AAL2-, profil-, plattformadmin- og RPC-kontroller er uendret.
6. Prosjektlokale avhengigheter/låsfil, `commerce/build.mjs`, nye tester i `tests/commerce/`, justert eksisterende test av prosjektlenker.

## Avgrenset plattformreview 3. november

Bevaringstestens opprinnelige commit er beholdt. `tests/security/pilot-platform-contract.mjs` beskriver bare de eksakte tilleggene i admin-lenken, lokal config og CORS-miljøvakten. Hele de øvrige filbytene sammenlignes fortsatt, også resten av de tilpassede filene. Dette er ingen fil-allowlist. SDK-filene er igjen helt uendrede. Semantiske tester dekker URL-koding per nettsted, fravær av lenken i produksjon, eksakte loopback-redirects, avslått CORS-tillegg i hosted/manglende/feil miljø og samme AAL2-/rollegater.

`tests/commerce/platform-access.test.mjs` tester faktiske eksisterende RLS/RPC/FK-regler med bare syntetiske rader og alltid ROLLBACK. `platform-http.test.mjs` tester den kjørende lokale adapteren og avvisning av anonym/forfalsket identitet og feil origin. Ingen produksjons-, Auth-, MFA-, RLS- eller sikkerhetsheader-regel er endret av denne gjennomgangen. Kjøper-/betalingsplattformen har fortsatt egne produksjonsavklaringer nedenfor.

## Betalingsreview 3. november – tillegg til overleveringen

- `20261103150000_commerce_payment_boundary.sql` er en additiv oppgraderingsmigrasjon. Eksisterende tabeller/unikhetskrav beholdes; ingen database reset eller ommerking av historiske betalingsleverandører.
- Butikk og ordre får eksplisitt betalingsmiljø. `commerce_entitlement_proofs` knytter én eksisterende rettighetsidentitet til separate bevis fra simulering og Stripe. Det opprinnelige `order_id` beholdes. Serveren kontrollerer riktig bevis ved både bibliotek og hvert spillkall.
- `commerce_record_payment` lagrer PaymentIntent, betalingshendelse, ordrestatus og tilgang i samme transaksjon. Den eldre interne `commerce_apply_payment` kan ikke lenger kalles av service_role direkte. Klienter har ingen skrive- eller lesetilgang til betalingsbevisene; autorisasjon utføres på serveren.
- `commerce_activate_stripe_test` er service-only og låser konto-ID; preflight verifiserer konto/testmodus før operasjonen. Ingen offentlig aktiverings- eller simuleringsrute. Aktivering er ikke utført.
- Checkout henter full ordrelinjeliste, kontrollerer riktig butikk/PaymentIntent og gjenbruker stabile testprodukter og priser. Uavklarte svar bevarer ventende ordre med samme idempotensnøkkel.
- Konfigurasjon avviser fjern database, produksjonsprosess, live-nøkler og feil konto. Testhjelpere avvises i Stripe-modus. Avhengigheter/låsfil er ikke oppgradert i denne gjennomgangen.
- Modusskiftet og Stripe-bevis testes kun som SQL-kontrakt i en transaksjon som rulles tilbake. Ingen slik simulert `stripe_test`-ordre er lagret som faktisk Stripe-kjøp. Faktisk Stripe-test gjenstår.

Dette er en avgrenset plattformoverlevering. Ingen av endringene er overført til Wreachs andre arbeidskopier. Refusjon, varig leveringsadresse og fraktflyt er fortsatt uimplementert.

## Bli Støgg-spesifikt

- `commerce/game.mjs`: 12 midlertidige norske selskapskort og regler; ikke tilgjengelig som statisk fil.
- `commerce/public/index.html`, `app.js`, `style.css`: butikk, illustrerte testprodukter, kjøperbibliotek og spillopplevelse.
- `commerce/bootstrap-local.mjs`: eksplisitte syntetiske fixtures og de to midlertidige testproduktene; ikke en hosted onboarding-løsning.
- Det eneste tillatte digitale `game_key` i denne avgrensede migrasjonen er `bli-stogg-classic`. Det må trekkes ut til en vurdert produkt-/spillregistrering dersom flere kunder skal bruke funksjonen. Ingen generell spillbygger er laget.

## Før plattformoverføring eller produksjon

- Review migrasjonen og ACL-er separat. Ingen SQL/SDK/serverfiler er overført til andre arbeidskopier.
- Avklar drift av serveradapter, hemmeligheter, produksjonsauth for kjøpere, webhooklevering, observasjon, backup og gjenoppretting.
- Wreach-utkast er ikke publikasjoner. Definer aktiv katalog/publiseringsversjon med nødvendige sikkerhetsnøkler før offentlig butikkaktivering.
- Lag fysisk leveringsarbeidsflyt og beslutt refusjon → rettighet. Pris-/abonnementsmodell og juridisk selger er ikke vedtatt.
- Senere SEO kobles til nettsted/katalog, kampanjeutkast til company/produkter, analyse til bekreftede betalingshendelser/ordre. Ingen slike moduler eller tredjepartssporing er bygd.

Ingen staging, commit, push, merge, PR, hosted migrasjoner, produksjonsdata, DNS-endringer, globale installasjoner eller publisering.

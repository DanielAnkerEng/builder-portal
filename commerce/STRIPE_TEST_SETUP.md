# Koble til Bli Støggs eget Stripe-testmiljø

Status 3. november 2026: kode og lokalt webhook-endepunkt er klargjort. Privat konfigurasjon står i `disabled`; konto, testnøkkel og webhook-hemmelighet mangler. Stripe CLI finnes ikke på PATH. Ingen faktisk Stripe-testbetaling er utført, og ingen avhengigheter er oppgradert.

## Det du må opprette eller koble til

1. Opprett et eget **Bli Støgg-sandbox/testmiljø** i Stripe. Noter miljønavn og konto-ID `acct_…`. Kontroller navnet i Dashboard. Ikke bruk Wreachs konto eller live-modus.
2. Fyll bare `stripe`-blokken i `/Users/danieleng/Documents/Codex/bli-stogg/private/runtime.json`. Malen er `commerce/stripe-config.example.json`; den inneholder ingen nøkler. Behold Supabase-konfigurasjonen. Feltene er `mode`, `environmentName`, `accountId`, `secretKey` og `webhookSecret`. Hold `mode: "disabled"` til alt er klart. Hemmelighetene skal være `sk_test_…` og `whsec_…`, kun lokalt i denne private filen (0600 i mappe 0700), aldri i chat, Git, skjermbilder, shellhistorikk eller logger. Ingen publiserbar nøkkel trengs for denne serveropprettede Checkout-flyten.
3. Avklar **installasjon og aktivering av Stripe CLI** før vi gjør det. Foreslått oppsett er en egen Bli Støgg-tilkobling som mottar bare fire hendelsestyper og videresender til `http://127.0.0.1:4308/api/stripe/webhook`. Det bruker en utgående forbindelse til Stripe, ingen offentlig tunnel. Listenerens signeringshemmelighet skal lagres i `webhookSecret`; en annen Dashboard-webhook-hemmelighet virker ikke. CLI-utdata som inneholder hemmeligheten må ikke logges eller deles.

Etter denne avklaringen er den avgrensede listener-kommandoen:

```sh
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://127.0.0.1:4308/api/stripe/webhook
```

Kommandoen er **ikke kjørt**. Den må bruke den avklarte, separate Bli Støgg-testkontoen. Ingen `--live`, ingen brede kontohendelser, ingen Connect-videresending. Siste bekreftede SDK er Stripe 20.4.1 med API-versjon `2026-02-25.clover`; ingen oppgradering er nødvendig for første tilkobling. Hendelsens session hentes på nytt med SDK-en, så webhook-payloadens API-versjon brukes ikke som betalingsbevis.

## Kontroller konto før aktivering

Når alle feltene finnes, sett `mode` til `test` lokalt. Fra `source/`, med prosjektets Node-runtime på PATH:

```sh
node commerce/stripe-preflight.mjs
```

Dette leser konto og saldoens `livemode`, sammenligner konto-ID og krever testmodus. Ingen produkt, pris, kunde, Checkout eller betaling opprettes. Feil gir en kort feilkode, uten SDK-respons eller hemmeligheter. Miljønavnet er brukerens dokumenterte identifikasjon; konto-ID og faktisk testmodus verifiseres mot Stripe.

Når kontoen er riktig og lokal videresending er avklart:

```sh
node commerce/stripe-preflight.mjs --activate
```

Dette gjentar kontrollen og låser bare den lokale Bli Støgg-butikken til konto-ID og `stripe_test`. Det kan ikke bytte til en annen Stripe-konto. Start deretter bare pilotserveren på 4307/4308 på nytt. Aktiveringskommandoen er **ikke kjørt**. Endring tilbake til simuleringsmodus er ikke eksponert som en operatørkommando eller HTTP-rute.

Gamle demobetalinger og ordre forblir `simulation`. De blir synlige i historikken, men kan ikke gi spilltilgang i Stripe-modus. En ny faktisk Stripe-testbetaling får et eget betalingsbevis uten å omskrive den opprinnelige demorettigheten. Testhjelpere og injisert Stripe-SDK avvises i Stripe-modus; SQL-kontrollen sperrer også simuleringsbetalinger når butikkens modus er endret.

## Første faktiske betalingskontroll

Bruk syntetiske kjøpere og Checkout. Engangskjøp er kun et teknisk testvalg. Eksisterende 49/149 NOK er midlertidige testpriser, ingen kommersiell prisbeslutning. Produkter/priser blir først opprettet ved Checkout etter kontokontrollen. Stabile produkt-ID-er og standardpriser gjenbrukes for samme uforanderlige lokale produkt-/prissnapshot, også etter et tapt svar.

| Scenario | Utførelse og databasebevis |
| --- | --- |
| Vellykket | Stripes testkort `4242 4242 4242 4242`, fremtidig dato, valgfri CVC. Kontroller `paid`, `stripe_test`, `cs_test_…`, `pi_…` og kjøperens betalingsbevis/rettighet. |
| Avvist | Stripes testkort `4000 0000 0000 0002`. Ingen betalt ordre eller ny tilgang. Kortavvisning kan la Checkout være åpen og ordren ventende for nytt forsøk. |
| Avbrutt | Bruk tilbake/avbryt. Returparameteren endrer ikke betalingsstatus. Ubetalt session kan gjenbrukes eller senere utløpe. |
| Uten retur | Fullfør betaling og lukk Checkout før retur. Signert Stripe-hendelse skal alene gi tilgang. |
| Gjentatt hendelse | Lever samme reelle Stripe-hendelse på nytt via det avklarte verktøyet. Samme hendelses-ID og én rettighet skal beholdes. Ikke bruk lokalt generert signatur som bevis på Stripe-levering. |
| Reload / ny innlogging | Logg ut og inn med samme syntetiske kjøper. Bibliotek og ordre finnes igjen. |
| Annen kjøper | Ordrelesing og spilltilgang avvises for en annen syntetisk identitet. |
| Fysisk produkt | Betalt fysisk testordre uten spillrettighet. Ingen utsending eller påstand om leveringsklart produkt. |

Første oppsett bruker bare kort. Forsinkede betalingsmetoder er ikke aktivert; feil rekkefølge og forsinkelse er foreløpig lokale simulerte tester. Registrer reelle Stripe-hendelses-ID-er, sessions og betalingsreferanser separat fra simulering. Ikke lagre kortdata, nøkler eller personlige kundeopplysninger som testbevis.

Varig leveringsadresse og fraktarbeidsflyt mangler fortsatt. Før produksjonsforberedelse må den faktiske Stripe-testmatrisen bestå. Deretter gjenstår blant annet refusjon → tilgang, endelig prismodell, juridisk selger, publisering/drift, vilkår, fysisk logistikk og backup.

## Offisielt grunnlag

- [Stripe testmiljøer og dokumenterte testkort](https://docs.stripe.com/testing).
- [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment): verifiser betaling og håndter hendelser uavhengig av retur.
- [Webhook-signatur og rå forespørselsinnhold](https://docs.stripe.com/webhooks).
- [Avgrenset lokal CLI-listener](https://docs.stripe.com/cli/listen).
- [Full liste over Checkout-ordrelinjer](https://docs.stripe.com/api/checkout/sessions/line_items).
- [Stabil produkt-ID og standardpris](https://docs.stripe.com/api/products/create).
- [Idempotens og oppbevaringsvindu](https://docs.stripe.com/api/idempotent_requests).

Kildene ble lest 3. november 2026. De dokumenterer kontraktene; de er ikke bevis for at en Stripe-tilkobling er gjennomført.

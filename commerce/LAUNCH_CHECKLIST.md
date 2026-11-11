# Før ekte salg

Først: opprett og identifiser et eget Bli Støgg Stripe-testmiljø, koble det til sikkert lokalt, og gjennomfør den fulle testmatrisen med faktisk Checkout og signerte hendelser fra Stripe. Ingen virkelig Stripe-test er utført i denne leveransen.

- Godkjenn endelig spillinnhold, produktutforming og priser. Bytt ut merkede pilottekster og illustrasjoner.
- Bestem engangskjøp eller abonnement. Engangskjøp i koden er bare første tekniske testvalg.
- Avklar juridisk selger, riktig Stripe-konto, kontoaktivering og hvem som har betalings-/refusjonsansvar.
- Velg domene og produksjonsmiljø. Tilpass lokal serveradapter, produksjonsauth, katalogpublisering og hemmelighetshåndtering gjennom egen sikkerhetsreview. Ingen DNS/endringer eller publisering nå.
- Utarbeid kjøpsvilkår, personvern, kontakt/kundestøtte og refusjonsrutine. Juridiske krav må vurderes for den faktiske selgeren og produktene; ingen juridisk beslutning er tatt her.
- Bestem hvordan hel/delvis refusjon, reklamasjon eller tilbakeføring påvirker digital tilgang; implementer og test livssyklusen.
- Avklar fysisk lager, fraktpriser, leveringsområder og leveringstid. Implementer varig leveringsadresse, oppfølging og fraktstatus. Ingen logistikk- eller kommersielle løfter i piloten.
- Avklar backup/restore, hendelsesavstemming, feillogging uten persondata/hemmeligheter, varsling, rategrenser, e-postlevering og produksjonskontroll.
- Test faktisk Stripe-Checkout, nettlesere inkludert Safari, fysisk mobil og tilgjengelighet før lansering. Lokal Chromium-kontroll og emulerte bredder er ikke fysisk mobiltest.

SEO, kampanjeutkast, analyse, flerbrukerrom og generell spillbygger er senere arbeid. De skal ikke forsinke den første avgrensede Stripe-testreisen.

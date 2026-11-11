---
name: "Bli Støgg – fra skjerm til kortstokk"
description: "Den implementerte visuelle identiteten for Bli Støggs butikkfrontend."
colors:
  red: "#f13b32"
  card-red: "#a92825"
  card-edge: "#9d211d"
  scene: "#11100f"
  surface: "#211b1b"
  warm-white: "#f6f0e6"
  muted: "#c9bcb7"
  secondary: "#3a2b29"
  field: "#171313"
  field-border: "#8e7772"
  demo-secondary: "#b12a25"
  demo-field: "#801e1b"
  demo-text: "#fff6ed"
  error: "#4f1e1b"
  error-text: "#fff1ea"
  invalid: "#ffd1b7"
  footer: "#0a0909"
typography:
  display:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(64px, 6.9vw, 104px)"
    fontWeight: 800
    lineHeight: 1.01
    letterSpacing: "-0.055em"
  display-tablet:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "58px"
    fontWeight: 800
    lineHeight: 1.01
    letterSpacing: "-0.055em"
  display-mobile:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(40px, 10.6vw, 64px)"
    fontWeight: 800
    lineHeight: 1.01
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "clamp(40px, 4.25vw, 64px)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.055em"
  title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.055em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-mobile:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  lead:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "normal"
    letterSpacing: "normal"
  button:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: "normal"
    letterSpacing: "normal"
  button-mobile:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: "normal"
    letterSpacing: "normal"
  navigation:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "normal"
    letterSpacing: "normal"
  demo-title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "42px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.055em"
  demo-title-mobile:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "31px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.055em"
  demo-body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  demo-body-mobile:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  scene-card-title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "31px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.055em"
  scene-card-body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  square: "0px"
  card: "12px"
  demo-card: "16px"
  phone-screen: "32px"
  phone-shell: "44px"
spacing:
  section-desktop: "100px 4.5vw"
  section-mobile: "64px 20px"
  section-small: "54px 18px"
  columns-desktop: "10vw"
  columns-tablet: "5vw"
  actions: "12px"
  actions-mobile: "10px"
  panel: "32px"
  panel-mobile: "22px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.scene}"
    typography: "{typography.button}"
    rounded: "{rounded.square}"
    padding: "15px 23px"
  button-inverse:
    backgroundColor: "{colors.scene}"
    textColor: "{colors.warm-white}"
    typography: "{typography.button}"
    rounded: "{rounded.square}"
    padding: "15px 23px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.warm-white}"
    typography: "{typography.button}"
    rounded: "{rounded.square}"
    padding: "15px 23px"
  button-demo-secondary:
    backgroundColor: "{colors.demo-secondary}"
    textColor: "{colors.demo-text}"
    typography: "{typography.button}"
    rounded: "{rounded.square}"
    padding: "15px 23px"
  field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.square}"
    padding: "13px"
  demo-names:
    backgroundColor: "{colors.demo-field}"
    textColor: "{colors.demo-text}"
    rounded: "{rounded.square}"
    padding: "17px 20px"
  navigation:
    backgroundColor: "{colors.scene}"
    textColor: "{colors.warm-white}"
    typography: "{typography.navigation}"
  demo-card:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.scene}"
    rounded: "{rounded.demo-card}"
    padding: "36px"
  scene-card:
    backgroundColor: "{colors.red}"
    textColor: "{colors.scene}"
    rounded: "{rounded.card}"
    padding: "19px"
    height: "310px"
    width: "220px"
  faq:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.square}"
    padding: "0 24px"
---

# Design System: Bli Støgg

## Overview

**Creative North Star: "Fra skjerm til kortstokk"**

Bli Støgg bruker tung plakatskrift, tydelige røde felt og varm hvit på kullsvart. Uttrykket er sosialt, frekt og lekent; lesbarhet og den felles spilloppgaven bærer opplevelsen. Kort og mobil er bygget i kode, uten produktfotografier.

Denne dokumentasjonen gjelder bare butikkfrontenden under `commerce/frontend` og stilene avgrenset av `.shop-page`. Den beskriver den ferdige koden, ikke Wreach-portalen eller admin. Brukerens rødt/svart-retning og forbindelsen mellom én skjerm og fysiske kort er beholdt. Taste-retningen «Loud and flat», seed 1464425984, informerte plakatskriften og fargeflatene; foreslått kystfoto, portrettseksjon og global fargebevegelse ble ikke tatt i bruk.

**Key Characteristics:**
- Tung lokal Manrope og kompakte overskrifter.
- Kullsvart scene, merkerøde flater og varme hvite lesekort.
- Rette kontroller; avrunding og strukturell dybde på kort og mobil.
- Scrollstyrt forvandling på forsiden, direkte handlinger i demo og butikk.

Kildegrunnlaget er `landing.css`, `store-base.css`, `landing.mjs` og `shop.mjs`. Frontmatter beskriver kildens faktiske verdier; komponentnavnene er dokumentasjonsroller, ikke nye CSS-variabler. De scoped CSS-verdiene har forrang over de arvede Wreach-fargene i `:root`. Sidecarens genererte tonalramper er kun fargeforhåndsvisninger, ikke en ny fargeskala i produktet.

## Colors

Én tydelig rød aksent møter kullsvart og varm hvit. Mørkere rødfarger skiller kortbakside, kortkant og kontroller på røde felt.

### Primary

- **Merkerød** (`red`): hovedhandlinger, sentrale kortbak­sider og de store demo-, om- og avslutningsflatene.
- **Dyp kortrød** (`card-red`): de to ytterste scenekortene og illustrasjonen av det fysiske konseptet.
- **Rød kortkant** (`card-edge`): hard materialkant i produktillustrasjonene.
- **Mørk demorød** (`demo-secondary`, `demo-field`): sekundær demohandling, navneinnstillinger og det enda mørkere navnefeltet.

### Neutral

- **Kullsvart** (`scene`): bakgrunn for scenen og mørk tekst på røde eller lyse flater; også knapper i røde seksjoner.
- **Varm hvit** (`warm-white`): hovedtekst på mørkt, forsiden av oppgavekort og toast. Varme lyse toner i demo- og feiltilstander har egne roller (`demo-text`, `error-text`).
- **Mørk overflate** (`surface`): produktseksjon, FAQ, paneler og telefonskjerm. Footeren har et eget, mørkere felt (`footer`).
- **Dempet tekst** (`muted`): forklaringer, konseptmerking og støttetekst på mørk bakgrunn.
- **Sekundær flate og felt** (`secondary`, `field`, `field-border`): eksisterende butikkhandlinger, status og skjemafelt.
- **Feil og ugyldig input** (`error`, `error-text`, `invalid`): feilpanel og synlig feltmarkering. Feil forklares også i tekst.

## Typography

**Display Font / Body Font:** lokal variabel Manrope, med Arial og sans-serif som fallback. Fontfilen støtter vekt 200–800; den ferdige butikkfrontenden bruker hovedsakelig 400, 600 og 800. Ingen separat mono- eller dekorfont er introdusert.

Plakatpreget kommer fra den tunge vekten, tett sperring og stram linjehøyde. Brødtekst og labels bruker den samme familien med roligere vekt. Størrelsene er tilpasset komponentene; de følger ikke én matematisk skala.

### Hierarchy

| Rolle | Implementert bruk |
| --- | --- |
| `display` | Åpningsoverskrift på desktop. `display-tablet` gjelder åpningen ved 700–1050 px; `display-mobile` gjelder under 700 px. |
| `headline` | Seksjonsoverskrifter. Mobilens standard er 40 px; «Samle gjengen» og «Slipp deg løs» bruker 36 px ved høyst 360 px. |
| `title` | Stegoverskrifter; mobil bruker 28 px. Produkttitler bruker 40 px desktop og 32 px ved mindre bredder. |
| `body`, `body-mobile` | Løpende tekst. Globalt maksimum er 65ch; spillregler og produkttekst har kortere lokale mål. |
| `lead` | Åpningstekst på desktop. Mobil bruker 16 px / 1.45, og 15 px ved høyst 360 px. |
| `label`, `navigation`, `button` | Kompakte støttefunksjoner og tydelige handlinger. Mobilnav er 13 px; ordmerkets «Lokal pilot» er 12 px ved alle bredder. |
| `demo-title`, `demo-body` | Det interaktive demokortets tittel og oppgave. Ved 700–1050 px er de 36/20 px; under 700 px brukes `demo-title-mobile` og `demo-body-mobile`. |
| `scene-card-title`, `scene-card-body` | Tekst i det faste 220 × 310 px scenekortet før scenens geometriske skalering. Første oppgavelinje er 16 px / 800. |

Lesefasens overskrift er 42 px på desktop, 34 px på mobil og 30 px ved høyst 360 px. Demoens seksjonsoverskrift er `clamp(40px, 4.8vw, 70px)` på desktop og 34 px på mobil. Den store uttalelsen i om-seksjonen bruker 36/30/24 px på desktop/nettbrett/mobil. Slike lokale roller skal ikke forveksles med den generelle overskriftsskalaen.

## Layout

Forsiden går kant til kant. Den vanlige butikkflyten har et innholdstak på 1440 px. Horisontalrammen er 4.5vw på desktop, 20 px på mobil og 18 px for de smaleste seksjonene ved høyst 360 px. Standardseksjoner bruker de dokumenterte `section-*`-avstandene; demoen har mindre toppavstand på mobil for å få oppgaven og handlingene raskt fram.

Desktop bruker to spalter til demo, spilleregler, om og FAQ, med 10vw mellomrom. Mellom 700 og 1050 px blir mellomrommet 5vw. Under 700 px blir disse til én spalte. Demoens mobilrekkefølge er tittel → introduksjon → spillkort og handlinger → navneinnstillinger → støttetekst. Kortet kan bli høyere når innhold krever det.

Den faste mastheaden er 88 px høy på desktop og 86 px på mobil. Mobilnav viser Mine spill og Handlekurv; den ekstra produktlenken skjules. Navlenker har minst 44 px høyde. Butikkens arvede delte skjema-/kjøpsoppsett skifter til én kolonne ved 800 px, med ytterligere komprimering ved 540 px. Dette er eksisterende butikkoppsett, ikke nye forsidebruddpunkter.

Forsidens scene har en høyde på 520svh på desktop og 480svh under 700 px. Den synlige scenen er 100svh med sticky-posisjon når bevegelse er aktiv. Under 620 px viewporthøyde, ved redusert bevegelse eller uten JavaScript ligger budskapet i vanlige statiske paneler uten sticky sekvens. Den korte statiske scenen bruker minst 650 px høyde, eller 720 px når den også er mobilbred.

## Elevation & Depth

Vanlige seksjoner og kontroller bygger hierarki med rene fargeflater. Kort og mobil får strukturell dybde: synlige kanter, perspektiv og enkelte skygger gjør forvandlingen fra skjerm til stokk forståelig. Dette er materialbeskrivelse på disse illustrasjonene, ikke en generell skygge på alle paneler.

### Shadow Vocabulary

- **Scenekort:** `0 2px 0 #5b1b18, 0 12px 24px #0004`.
- **Mobilskall:** `8px 8px 0 #241d1b, 10px 10px 0 #67534c, 22px 30px 35px #0006`.
- **Telefonskjerm:** `0 0 0 2px #080707`.
- **Digital produktillustrasjon:** `4px 5px 0 #9d211d`.
- **Fysisk produktillustrasjon:** `3px 4px 0 #f6f0e6, 6px 7px 0 #9d211d, 9px 10px 0 #f6f0e6, 12px 13px 0 #9d211d`.

## Shapes

Knapper, felter, seksjonsflater og FAQ er rette. Scenekort og produktkort har den mindre kortradien; det store interaktive demokortet har den mykere demokortradien. Mobilskallet og telefonskjermen har egne større radier. Radiene ligger i frontmatter og er funksjonelle former, ikke én universell avrunding.

Scenekortet har to sider, skjult bakside og en 3D-vending. Den innledende klippflaten følger telefonskjermen og åpnes kontinuerlig mens kortene løftes ut. Ingen raster- eller bildeskift er nødvendig for å lage objektkontinuiteten.

## Components

### Buttons

Tydelige rektangler med tung tekst. Primærknappen er rød på mørk bakgrunn; i røde seksjoner er knappen kullsvart. Butikkens sekundærknapp bruker den mørke sekundærflaten, mens «Hopp over» i demoen bruker demorød. Teksthandlingen i butikkflyten er transparent og understreket.

Standardknapper har minst 56 px høyde og frontmatterens desktop-padding. Mobil bruker minst 54 px, 15 px skrift og 14 × 20 px padding. Demoens mobilhandlinger har 14 px skrift og 14 × 16 px padding; ved høyst 360 px er den horisontale paddingen 12 px.

Pekerhover på fin peker løfter knappen 2 px, og press skalerer til .98. Transform/opacity bruker 160 ms og `cubic-bezier(.23,1,.32,1)`. Fokus med tastatur gir ingen transform eller overgang. Fokusrammen er 3 px med 5 px avstand, varm hvit på mørke flater og kullsvart i demo/avslutning. Deaktiverte knapper har .5 opacity. Redusert bevegelse fjerner overganger og animasjoner.

### Fields

Butikkfelt er mørke med en tydelig kant, rett form, minst 48 px høyde og 13 px padding. Navnefeltet i demoen ligger i en innebygd details-kontroll: mørkere rødt felt, lys tekst, 18 px skrift, minst 122 px høyde og maksimalt 230 px. Det kan justeres vertikalt. `aria-invalid` gir en 2 px lys varm feilmarkering sammen med konkret feilmelding.

### Navigation and disclosures

Ordmerket er ren tekst i Manrope 800, 30 px på desktop, 25 px på mobil og 23 px ved høyst 360 px. Selve ordmerkelenken har minst 48 px høyde. Navigasjon bruker understrekning på hover og synlig tastaturfokus.

FAQ og navneinnstillinger bruker native `details`/`summary`. Plussmerket roterer 45 grader når innholdet åpnes, uten egen tidslinje. FAQ-sammendrag har minst 76 px høyde; navneinnstillingene har minst 60 px. Panelene bruker sine lokale flater og inneholder vanlig lesbar tekst.

### Interactive demo card

Et varmt hvitt lesekort på rødt felt, uten dekorativ inngangsanimasjon. Desktop har minst 460 px høyde og 36 px padding; nettbrett har 27 px padding. Mobil har minst 340 px og 26 px padding; ved høyst 360 px er dette 330 px og 22 px. Oppgaveteksten har maksimum 28ch. Det er samme kortflate mens tekst, teller og knappestatus endres direkte.

Tre offentlige eksempler kan prøves uten innlogging. «Neste kort», «Hopp over» og «Spill igjen» oppdaterer demoen umiddelbart. Navneinnstillingene er sekundære og lukket i utgangspunktet. Oppgaven annonseres med `aria-live="polite"`; navnefeil og ferdigmelding har egne statusfelt. Ingen navn lagres utenfor fanens minne.

### Signature: one phone, the same five cards

**Kontrakt for denne forsiden:** De samme fem DOM-kortene finnes fra første til siste scrollstadium. Én mobil forbinder den digitale spillformen med en fysisk konseptstokk. Kortene løftes ut, fordeles, vender det sentrale kortet, blir liggende lesbart og samles igjen. Ingen duplisert skjerm eller kryssfading mellom bilder. Dette er forsidens fastsatte komposisjon, ikke en regel for alle framtidige flater.

| Scrollandel | Faktisk sekvens |
| --- | --- |
| 0–12 % | Mobil med klippede kort, overskrift, beskrivelse og demo-CTA. Åpningskopien begynner å tones bort ved 7 %. |
| 12–38 % | Samme kort løftes ut. Klippflaten åpnes mellom 12 og 34 %. Sidekortene har opptil 2.4 prosentpoeng faseforskyvning. Åpningskopien er borte ved 18 %. |
| 38–52 % | Midtkortet vender 180 grader. Kortene går fra vifte til leseplassering mellom 40 og 52 %. |
| 52–75 % | Stabil kortgeometri og lang lesefase. Lesekopi tones inn mellom 27 og 38 %, og begynner å tones ut ved 73 %. |
| 75–94 % | De samme kortene samles til fysisk stokk. Midtkortet vender tilbake mellom 75 og 89 %. |
| 94–100 % | Stokken holdes. Avslutningskopi er synlig fra 91 %, med tydelig merking som fysisk produktkonsept. |

Scrollposisjon er tid. Posisjoner interpoleres direkte, uten smooth-scroll-bibliotek, etterslep eller automatisk avspilling. Mobilen beveger seg mellom 14 og 80 %; opacity går fra 1 til .2 mellom 24 og 66 %. Hele sekvensen kan reverseres ved å scrolle tilbake.

Geometri måles ved oppstart, endret størrelse og ferdig lastet font, ikke per kort per scroll. Scrolloppdateringer går via én planlagt animation frame, med transform, opacity og avgrenset clip-path. Egen mobilgeometri bevarer lesekort og handlinger. Skjult scenekopi er inert og fjernet fra tilgjengelighetstreet; fokus flyttes til den faste snarveien hvis et fokusert element blir skjult. Illustrasjonen er dekorativ for hjelpemidler, med oppgaven tilgjengelig i lesekopien.

### Product illustrations and page continuation

Produktillustrasjonene bruker kort bygget i CSS, med materialkanter for fysisk variant og eksplisitt konseptmerking. Pekerhover endrer rotasjonen med 180 ms og samme easing som knapper. Den kjøpte spillflaten har ingen kortinngangsanimasjon.

Etter hovedsekvensen følger demospill, tre spillesteg, digitale/fysiske eksempelprodukter, en kort om-seksjon, FAQ og ny demo-CTA. De videre seksjonene bruker typografi og fargeflater uten en ny stor bevegelsessekvens. Eksisterende katalog, testpriser og kjøpsflyt beholdes; produktutforming og fysisk levering presenteres ikke som ferdige tilbud.

## Do's and Don'ts

Disse punktene bevarer den brukerfastsatte identiteten og den eksisterende forsidekontrakten innenfor denne frontenden.

### Do:

- **Do** bruk den fastsatte svarte, røde og varmhvite identiteten i butikkfrontenden.
- **Do** behold én mobil og de samme fem DOM-kortene gjennom hele forsidens sekvens, også ved reversert scroll.
- **Do** behold lesepausen og den komplette statiske fortellingen ved redusert bevegelse, kort viewport eller uten JavaScript.
- **Do** hold oppgaver, knapper, fokusmarkering og merking av fysisk produktkonsept lesbare i den aktuelle komposisjonen.
- **Do** bruk de egne mobilverdiene; demokort, tekst og navneinnstillinger har en annen plassering og tetthet enn på desktop.

### Don't:

- **Don't** erstatt den fastsatte forsidens forvandling med dupliserte mobiler, bildeskift eller kryssfading mellom kortkopier.
- **Don't** legg automatisk avspilling, smooth-scroll-etterslep eller en skjult tidslinje til forsidens scrollsekvens.
- **Don't** behandle fysisk produktutforming, testpriser eller pilotinnhold som et ferdig salgstilbud.
- **Don't** før disse scoped butikkvalgene inn som nye globale designregler for Wreach.

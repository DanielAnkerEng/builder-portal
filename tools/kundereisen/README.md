# Kundereisen før kundemøtet

Åpne Terminal i Wreach-kildemappen og kjør

```sh
python3 -B tools/kundereisen/start.py
```

La Terminal stå åpen og bruk portaladressen som skrives ut. Åpne også det private innloggingsarket i nettleseren før du deler skjerm. Logg inn og fullfør tofaktor. Builder åpner Bord & Jord. Velg **Kundereisen**. En kjørende instans kan slås opp med samme kommando uten å miste runden. Bruk **Start ny demorunde** i Kundereisen hvis en tidligere runde fremdeles har tellinger.

For å stoppe bare denne portalen, trykk Ctrl+C i terminalen som *startet* den. Neste start gir en ny, tom runde. Start velger ledige porter på 127.0.0.1, og forsøker å gjenbruke de forrige adressene. Bruk alltid adressen fra siste start. Etter omstart bruker du en ny privat nettleserøkt eller logger inn på nytt. Adgangene fra den forrige prosessen utløper.

## Forutsetninger og private filer

Den godkjente syntetiske kundeidentiteten, TOTP-faktoren og prosjektet må finnes i den isolerte, lokale Docker-instansen. Start kontrollerer containernes ID, eiermerking, nettverksisolasjon og helse, samt prosjekt-ID, bruker-ID, aktiv profil, editortilknytning og verifisert TOTP i en lesetransaksjon. Det trengs Python 3, Docker Desktop, Node (PATH eller Codex sin lokale Node), bash, patch og ripgrep. Ingen nedlasting inngår.

Oppsettet på denne maskinen er allerede gjort. Ved første binding i en ny arbeidsmappe utenfor et Git-repo, plasser selve Wreach-kilden i en undermappe. Fra kilden kan du knytte den til den eksisterende kontrollerte lokale fixturen slik:

```sh
python3 -B tools/kundereisen/configure.py "/sti/til/den/gjennomgåtte/lokale/prosjektreisen"
```

Den private profilen ligger i `../privat-moteoppsett/` ved siden av kildemappen. Hele profilen er operatørmateriale. Hold den utenfor versjonskontroll, webrot, logger og skjermdeling. `account.json` inneholder den ene syntetiske kundens private innlogging. `binding.json` knytter demoen til den isolerte instansen og de stabile prosjekt-ID-ene. Filene eies av operatøren. Profilen bruker 0700, innloggingsarket 0600. Start regenererer `Innlogging.html` fra den private kontofilen. Den gamle midlertidige HTML-filen og den opprinnelige referansemappen trengs ikke ved vanlig start.

Mangler også kontofilen, gjenopprett den fra en privat kopi av samme møteprofil. Alternativt kjør engangsbindingen på nytt dersom den opprinnelige private fixturinformasjonen fortsatt finnes. Hvis både kilden og den private kopien er borte, stopp og avklar kontogjenoppretting med operatøren. Startkommandoen kan ikke gjenskape et tapt passord eller en tapt TOTP-faktor. Ingen kontoer opprettes eller nullstilles av disse kommandoene.

Den eksisterende databasens data ligger i **tmpfs**. La Docker og databasecontaineren kjøre mellom møtene. Stopp av databasen eller omstart av Macen kan føre til at testdataene forsvinner. Den private profilen alene er ingen databasebackup. Ved manglende eller feil database stanser kommandoen. Opplegget er prøvd ved omstart av demoserveren.

## Kildegrense for review

Hele forslaget ligger under `tools/kundereisen/`. Det ordinære bygget bruker sin opprinnelige eksplisitte filliste. Produksjonskilden er 64752e9711f4e7b333e3def518825ece57975cbe.

* **Builder og kundereisen:** Builder-delene av `builder-local.patch` viser den konkrete inngangen og pausen av ventende autolagring. Under `frontend/` ligger sidene, stilene og skjermlogikken for SEO, annonse, restaurant og måling. Det nye prosjektet bestemmes fra Wreachs autoriserte Builder-last. Ingen test-ID eller lokal port ligger i disse komponentene.
* **Serverkrav:** En tilgjengelighets-, lese-, nullstillings- og oppstartsoperasjon for prosjektet og en begrenset hendelsesoperasjon for restaurantfanen. `server.py` oppfyller dette i møteoppsettet med GoTrue, AAL2, aktiv session/profil og RLS under kundens identitet. Den fører rundene i minnet per prosjekt. En eventuell produktintegrasjon trenger en egen støttet tjeneste for dette. Docker-transporten og innloggingsarket er lokale verktøy.
* **SDK og miljø:** SDK-hunken i patchen bytter kun importen i det genererte møtebygget. `frontend/js/supabase.local.js` peker dette bygget på sin egen loopback-adresse. Offlinesiden bruker den gjennomgåtte 2.112.4-bundlen fra privat cache med fast SHA-256. Ordinært bygg bruker original `js/supabase.js`, `js/supabase.local.js`, `js/supabase-public-config.mjs` og `deploy/cloudflare/_headers`. Det omfatter ingen lokal SDK-bundle.
* **Test:** `tests/restart.cjs` bruker lokal Playwright og ekte lokal Auth. Den startes fra arbeidsområdet med en tom runde, en aktiv demoserver og Playwright tilgjengelig via Node. For å holde samme restaurantfane gjennom omstart skriver den en klar-markør i sin unike evidensmappe. Start kun demoserveren på nytt, bekreft adressene og opprett `server-startet` i den mappen for å fortsette testen.

Kandidat for lokalt kode-review er bare kildefilene under `tools/kundereisen/`. Hold generert dist, privat profil, bevis, SDK-cache og tidligere demoer utenfor.

Testen kontrollerer begge loopback-adressene og sammenligner serverrolle og instans-ID med den private bindingen før hver innlogging. Flagg `--check-targets` kjører adressekontrollene uten innlogging. Evidensmappen opprettes ved behov. Etter tilgangstap i Kundereisen ligger åpne Builder-endringer i fanen. Velg **Kontroller prosjekttilgang** med den opprinnelige kontoen for å gjenoppta lagring.

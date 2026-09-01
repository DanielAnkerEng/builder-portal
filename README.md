# Wreach – webbyrå-demo

En statisk demonstrasjon av et webbyrå med kundeportal, administratoroversikt, nettsidebygger og separate eksempelnettsider.

## Funksjoner

- Forside for Wreach
- Administratoroversikt med flere testkunder
- Kundeinnlogging og separate prosjekter
- Redigering av tekst, farger, tilbud, bilder og seksjoner
- Lokal lagring i nettleseren med `localStorage`
- Fullskjermsvisning av hver kundes nettside
- Responsiv visning for datamaskin og mobil

## Kjør lokalt

Prosjektet trenger ingen bygging eller installasjon. Start en enkel lokal server i prosjektmappen:

```bash
python3 -m http.server 4173
```

Åpne deretter [http://localhost:4173](http://localhost:4173).

Du kan også publisere mappen direkte med GitHub Pages.

## Testkontoer

| Konto | Brukernavn | Passord |
|---|---|---|
| Administrator | `admin` | `123` |
| Fjord Eiendom | `fjord` | `fjord123` |
| Nordlys Hårstudio | `salong` | `salong123` |
| Trygg Rørservice | `ror` | `ror123` |
| Klar Regnskap | `tall` | `tall123` |
| Fjordgrill | `smak` | `smak123` |

## Viktig om demoen

Dette er en frontend-demo. Kontoer, passord og endringer lagres kun lokalt i brukerens nettleser. Den har ingen database eller sikker serverinnlogging og må ikke brukes som et ekte produksjonssystem uten en backend.

## Publisering på GitHub Pages

1. Opprett et tomt repository på GitHub.
2. Koble denne lokale mappen til repositoryet og push `main`.
3. Gå til **Settings → Pages** på GitHub.
4. Velg **Deploy from a branch**, `main` og mappen `/ (root)`.

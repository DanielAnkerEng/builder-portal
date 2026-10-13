// One source of truth for the exhibition and all six fictional demo sites.
export const DEMOS = Object.freeze({
  restaurant: {
    key: 'restaurant', theme: 'restaurant', label: 'Restaurant', name: 'Bord & Jord',
    kicker: 'Kjøkkenet følger sesongen.', title: 'Bli sittende litt til.',
    intro: 'En liten nabolagsrestaurant med plass til lange samtaler og råvarer i sesong.',
    cta: 'Se menyen', target: 'meny', hero: 'restaurant-room', heroAlt: 'Varmt lys over et dekket restaurantbord – illustrasjonsfoto',
    side: 'restaurant-food', sideAlt: 'Sesongrett på en håndlaget tallerken – illustrasjonsfoto',
    nav: [['Meny', 'meny'], ['Om stedet', 'stedet'], ['Et bord til deg', 'besok']],
    services: [['Smått først', 'Noe å dele mens samtalen kommer i gang.'], ['Fra kjøkkenet', 'Sesongens smaker på en tallerken.'], ['En søt avslutning', 'Bli sittende litt til.']],
    menu: {
      Middag: [['Ovnsbakt torsk', 'Erter, brunet smør og sprø potet'], ['Grillet blomkål', 'Hvit bønnekrem, urter og ristede frø'], ['Langtidsbakt okse', 'Rotgrønnsaker og en fyldig sjy']],
      Smått: [['Surdeigsbrød', 'Pisket smør og flaksalt'], ['Beter fra ovnen', 'Geitost, valnøtter og sitron'], ['Sprø poteter', 'Urtemajones og gressløk']],
      Dessert: [['Eple & vanilje', 'Lune epler, sprø havre og vaniljekrem'], ['Mørk sjokolade', 'Bær og en liten klype havsalt']],
    },
  },
  frisor: {
    key: 'frisor', theme: 'salon', label: 'Frisør', name: 'FORM studio',
    kicker: 'Hår er personlig.', title: 'Din form. Ditt uttrykk.',
    intro: 'Et rolig rom for nye ideer. Vi finner et uttrykk som passer håret ditt, hverdagen din og deg.',
    cta: 'Finn din behandling', target: 'behandlinger', hero: 'salon-hair', heroAlt: 'Hår i bevegelse og mykt motlys – redaksjonelt illustrasjonsfoto, ikke en kunde',
    side: 'salon-room', sideAlt: 'Lys frisørsalong med buede speil – illustrasjonsfoto',
    nav: [['Behandlinger', 'behandlinger'], ['Inspirasjon', 'galleri'], ['Studioet', 'studio']],
    services: [['Klipp & form', 'Fra en liten justering til en ny fasong. En konsultasjon er starten på en klipp tilpasset deg.'], ['Farge & spill', 'Myke overganger, lysere partier eller en tydelig forandring. Vi snakker om vedlikehold før vi begynner.'], ['Pleie & styling', 'Gi håret litt ekstra oppmerksomhet. Behandling og styling tilpasses hårets utgangspunkt.']],
  },
  handverker: {
    key: 'handverker', theme: 'trade', label: 'Håndverker', name: 'FJELL & FORM',
    kicker: 'Materialer. Mennesker. Håndverk.', title: 'Rom som varer.',
    intro: 'Oppussing, tilbygg og innredning. Vi gjør store planer til oversiktlige prosjekter, ett steg av gangen.',
    cta: 'Utforsk prosjekter', target: 'prosjekter', hero: 'trade-bath', heroAlt: 'Moderne baderom med badekar – illustrasjonsfoto, ikke et levert prosjekt',
    side: 'trade-detail', sideAlt: 'Detaljer i et oppusset baderom – illustrasjonsfoto',
    nav: [['Tjenester', 'tjenester'], ['Prosjekter', 'prosjekter'], ['Slik jobber vi', 'prosess']],
    services: [['Oppussing', 'Helhetlig fornyelse av rom, med materialvalg og fremdrift avklart før oppstart.'], ['Tilbygg', 'Mer plass, med en plan som tar hensyn til både huset og hverdagen rundt.'], ['Innredning', 'Detaljene som får rommet til å fungere. Fra oppbevaring til den siste listen.']],
  },
  bilverksted: {
    key: 'bilverksted', theme: 'auto', label: 'Bilverksted', name: 'DREI / verksted',
    kicker: 'Service / vedlikehold / feilsøking', title: 'Neste kilometer starter her.',
    intro: 'Forstå hva bilen trenger. Få en oversiktlig plan for service, vedlikehold og veien videre.',
    cta: 'Hva trenger bilen?', target: 'service', hero: 'auto-workshop', heroAlt: 'Mekaniker ved en bilmotor – illustrasjonsfoto, ikke verkstedets ansatte',
    side: 'auto-detail', sideAlt: 'Arbeid på bil i et verksted – illustrasjonsfoto',
    nav: [['Tjenester', 'service'], ['Slik foregår det', 'prosess'], ['Vanlige spørsmål', 'sporsmal']],
    services: [['Service', 'Planlagt vedlikehold med utgangspunkt i bilens behov. Arbeid og omfang avklares før bilen settes inn.'], ['Feilsøking', 'En ulyd eller et varsel? Vi starter med å finne årsaken og forklarer hva som bør gjøres videre.'], ['Hjul & dekk', 'Dekkskift og vurdering av slitasje. Vi hjelper deg å forstå hva som er klart for neste sesong.']],
  },
  eiendom: {
    key: 'eiendom', theme: 'estate', label: 'Eiendom', name: 'ROM eiendom',
    kicker: 'Et nytt sted å høre til.', title: 'Plass til neste kapittel.',
    intro: 'Lys, linjer og rom for hverdagen. Finn et sted du kan se deg selv.',
    cta: 'Utforsk boligene', target: 'boliger', hero: 'estate-house', heroAlt: 'Moderne hus med store vinduer – illustrasjonsfoto, ikke en bolig til salgs',
    side: 'estate-cabin', sideAlt: 'Trehytte i skog – illustrasjonsfoto, ikke en bolig til salgs',
    nav: [['Boliger', 'boliger'], ['Å selge', 'selge'], ['Vår tilnærming', 'tilnaerming']],
    services: [['Bli kjent', 'Vi starter med boligen og det som gjør den spesiell.'], ['Lag en plan', 'Presentasjon, fremdrift og forventninger avklares sammen.'], ['Neste kapittel', 'En ryddig prosess fra første samtale til overlevering.']],
    properties: [
      {name: 'Lysningen', type: 'Enebolig', image: 'estate-house', facts: '4 rom · 146 m²', description: 'Åpne oppholdsrom vendt mot hagen. Store vindusflater slipper lyset langt inn, mens overdekkede uteplasser gir skygge på varme dager.', rooms:'4', area:'146 m²', features:['Åpent kjøkken og stue med utgang til terrasse', 'Tre soverom samlet i en roligere del av huset', 'Overdekket uteplass og skjermet hage'], materials:'Lyse pussflater, store glassfelt og varme innslag av tre.', surroundings:'Et tenkt boligmiljø med grønne uteområder. Ingen faktisk adresse eller beliggenhet er tilknyttet.'},
      {name: 'Skogro', type: 'Hytte', image: 'estate-cabin', facts: '3 rom · 74 m²', description: 'Et lite tilfluktssted mellom trærne. Oppholdsrommet samler utsikten, mens en enkel materialpalett gir naturen hovedrollen.', rooms:'3', area:'74 m²', features:['Sammenhengende oppholdsrom mot skogen', 'To soverom og en kompakt entré', 'Terrasse i nivå med terrenget'], materials:'Mørk trekledning og naturlige overflater med synlig struktur.', surroundings:'Et illustrert skogsmiljø, uten faktisk tomt, adresse eller salgsobjekt.'},
    ],
  },
  konsulent: {
    key: 'konsulent', theme: 'consulting', label: 'Konsulent & regnskap', name: 'RETNING',
    kicker: 'Oversikt før neste beslutning.', title: 'Mindre usikkerhet. Mer retning.',
    intro: 'Regnskap og rådgivning forklart med vanlige ord. Et tydelig grunnlag for valgene som ligger foran deg.',
    cta: 'Finn ditt startpunkt', target: 'tjenester', hero: null, heroAlt: '',
    side: null, sideAlt: '',
    nav: [['Tjenester', 'tjenester'], ['Samarbeid', 'samarbeid'], ['Spørsmål', 'sporsmal']],
    services: [['Regnskap', 'En ryddig oversikt over tallene. Oppgaver, ansvar og leveranse må avklares ut fra virksomhetens behov.'], ['Økonomisk oversikt', 'Sett tallene i sammenheng. Budsjett og enkle oversikter kan gi et bedre utgangspunkt for planlegging.'], ['Rådgivning', 'En samtalepartner når noe skal endres. Vi begynner med situasjonen din, ikke med en standardløsning.']],
  },
});

export function resolveDemo(key) {
  return typeof key === 'string' && Object.hasOwn(DEMOS, key) ? DEMOS[key] : DEMOS.restaurant;
}

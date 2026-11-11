// Pilot content. Kept on the server; never bundled or served as a static asset.
export const rules='Én felles skjerm. Ta tur etter tur. Bruk poeng, vann eller valgfri alkoholfri drikke. Alle kan hoppe over uten begrunnelse. Ingen oppgave krever alkohol eller fysisk kontakt. Spill til kortene er brukt opp.';
const cards=[
  ['Rask i replikken','{player}: Nevn tre ting som alltid forsvinner på en fest. De andre teller rolig til ti. Klarte du det? Ta ett poeng.'],
  ['Hvem i rommet?','Hvem ville laget den rareste spillelisten? Alle peker samtidig. Den som får flest stemmer, velger neste låt. Uavgjort? Velg sammen.'],
  ['Historien går','{player} starter en historie med tre ord. Gå en runde; hver person legger til tre nye ord. Avslutt så dramatisk dere kan.'],
  ['Uten å si ordet','{player}: Beskriv en pizza uten å si pizza, ost eller mat. Gruppen får tre gjetninger. Ett poeng til den som gjetter riktig.'],
  ['Liten avstemning','Er frokost til middag genialt eller kaos? Velg side og gi hver side ett argument. Ingen riktig fasit.'],
  ['Minnekjede','{player}: Si «Jeg pakker med meg …» og legg til en ting. Hver neste person gjentar listen og legger til én ting. Stopp etter én runde.'],
  ['Dårlig reklame','{player}: Hold en ti sekunders salgstale for en helt vanlig sokk. Gruppen finner på slagordet sammen.'],
  ['Fellesnevner','Finn noe alle i gruppen liker. Dere har fem forslag. Det kan ikke være søvn, mat eller helg. Ett felles poeng hvis dere blir enige.'],
  ['To valg','{player}: Vil du alltid komme ti minutter tidlig eller alltid ha feil sko? Velg og forklar. Personen til venstre må forsvare det andre valget.'],
  ['Lydsporet','{player}: Nynn en melodi uten ord. Gruppen får tre gjetninger. Har du ikke lyst? Hopp over eller si tittelen baklengs.'],
  ['Den lille finalen','Alle gir personen til venstre et vennlig, helt oppdiktet superheltnavn. {player} begynner.'],
  ['Skål for gjengen','Velg kveldens morsomste øyeblikk. Skål med det dere har i glasset, eller gi hverandre en applaus. Takk for runden!']
];
export function makeDeck(players) { return cards.map(([title,text],i)=>({title,text:text.replaceAll('{player}',players[i%players.length])})); }
export function validatePlayers(value) {
  if(!Array.isArray(value)||value.length<2||value.length>12||value.some(v=>typeof v!=='string'||!v.trim()||v.trim().length>30||/[\x00-\x1f<>]/.test(v))) throw Error('INVALID_PLAYERS');
  const players=value.map(v=>v.trim());if(new Set(players.map(v=>v.toLowerCase())).size!==players.length)throw Error('DUPLICATE_PLAYERS');return players;
}
export function gameView(s) { return {id:s.id,players:s.players,position:s.position,total:s.deck.length,version:s.version,skipped:s.skipped,endedEarly:s.ended_early,complete:s.position>=s.deck.length,card:s.deck[s.position]??null}; }

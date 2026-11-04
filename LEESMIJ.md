# EU-monitor

Een eigen werkinstrument voor EU-journalistiek: nieuws, agenda, dossiers, stemmingen en
europarlementariërs. **Alleen feiten met een bron**: de site rangschikt niet en geeft geen
oordeel. Volgorde en selectie kies je zelf met filters en sortering.

Online: https://gargamel1437.github.io/eu-monitor/

## Hoe het werkt

1. GitHub draait `europa.py` drie keer per dag (07:15, 12:15 en 18:15 Nederlandse tijd,
   ook in de zomertijd). Zie `.github/workflows/europa.yml`.
2. `europa.py` haalt de gegevens op en bouwt de site in de map `site/`:
   - `site/index.html`: de pagina zelf, met het nieuws erin;
   - `site/data/*.json`: dossiers, stemmingen, agenda, debatten en mensen. Die laadt de
     pagina pas als je het tabblad opent (sneller op de iPhone).
3. Opgehaalde gegevens worden bewaard in `data/`, zodat niet alles elke keer opnieuw hoeft.
   Lukt het ophalen een keer niet, dan toont de site de laatste versie, met een gele melding.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `europa.py` | bouwt de site; voegt de gegevens samen |
| `eu_nieuws.py` | nieuws uit RSS (media en officiële EU-communicatie apart) |
| `dossiers.py` | alle procedures: lijst uit de open data van het Parlement, details uit OEIL |
| `stemmingen.py` | hoofdstemmingen van de laatste twee zittingen (HowTheyVote.eu) |
| `parlement.py` | agenda (komende 4 weken) en debatten (laatste drie zittingen) |
| `raad.py` | vergaderingen van de Raad en EU-toppen, van de site van het EU-voorzitterschap |
| `commissie.py` | planning van de Commissie (per kwartaal), van Geef uw mening |
| `bestuur.py` | het College van commissarissen en de woordvoerders (commission.europa.eu); de Nederlandse bewindspersonen, hun gebruikelijke raadsformatie en de woordvoerders per ministerie (rijksoverheid.nl) |
| `contacten.py` | contactgegevens van europarlementariërs (open data van het Parlement), bewaard in `data/contacten.json` |
| `bronnen.py` | gedeelde hulpjes: ophalen, bewaren, fractienamen |
| `wetgeving.json` | eigen samenvattingen bij enkele dossiers, met bron |
| `onderdelen/sjabloon.html` | de opbouw van de pagina |
| `onderdelen/stijl.css` | het uiterlijk (Liquid Glass, gemaakt voor de iPhone) |
| `onderdelen/js/*.js` | de scripts per onderdeel; worden samengevoegd tot één script |
| `onderdelen/begrippen.json` | uitleg bij begrippen (lang drukken of muis even stil houden) |
| `onderdelen/bronnen.html` | de pagina "Bronnen en beperkingen" |
| `web/` | iconen (licht en donker), manifest, robots.txt en `sw.js` (werkt ook zonder internet) |

## Indeling

Vijf tabbladen onderin: **Agenda** · **Pers** · **Zoek** (in het midden) · **Dossiers** (met
Stemmingen als tweede deel) · **Personen**. Het tandwiel rechtsboven opent Instellingen, met
daarin ook Bronnen en beperkingen. Licht of donker volgt de instelling van je iPhone of computer.

- **Kleuren per instelling** zijn overal hetzelfde: Parlement blauw, Raad paars, Europese Raad
  marineblauw, Commissie goud, internationaal grijs (CSS-klassen `k-ep`, `k-raad`, `k-top`,
  `k-com`, `k-int`). Ook persberichten van Commissie en Raad hebben die kleur.
- **Details openen als wolkje** (`panelen.js`): het groeit open vanuit het item. Lang indrukken
  geeft eerst een voorvertoning. Terug of naar rechts vegen gaat één stap terug (persoon >
  stemming > dossier); naar beneden vegen, het kruisje of ernaast tikken sluit het.
- **Zoeken en filteren in één veld** (`filters.js`): typ en kies een filter, dan wordt het een
  token. Typ "wie", "wat", "waar" (of een andere soort) voor alle keuzes. Houd een label in de
  lijst vast voor "Alleen dit tonen" of "Verbergen". Na elke wijziging kun je het ongedaan
  maken. Sorteren (alleen bij Dossiers, Stemmingen en Debatten) met de glazen knop.
- **Agenda**: één tijdlijn. Knijp met twee vingers (of − + op de computer) voor Ruim, Compact of
  Overzicht (per week één kaart). De datumstrook loopt mee. Meerdaagse items staan elke dag als
  gewone kaart, met "2/4". Tik op een item: een wolkje met Zet in agenda en Meer info
  (programma met tijden, livestream, locatie, dossiers). Filter "Raad" kiest een specifieke
  raad (bijvoorbeeld Ecofin-Raad). Bovenaan zacht: de planning van de Commissie en de eerdere
  debatten.
- **Pers**: hetzelfde nieuwsfeit van meerdere media is één verhaal (`samenvoegen()` in
  `eu_nieuws.py`); tik erop en kies welke bron je opent.
- **Zoek**: zoeken in alles, met recente zoekopdrachten in het veld (wissen vraagt eerst om
  bevestiging), en widgets zoals op de iPhone: Agenda (met vandaag), Pers, Dossiers, Stemmen,
  en naar keuze Persberichten en Personen. Houd een widget vast (of tik op Wijzig) om te slepen,
  weg te halen (−), de maat te kiezen (klein, middel, groot) of er een toe te voegen (+).
- **Personen**: europarlementariërs met contact en activiteit; typ "wie" voor de Commissie
  (met woordvoerders), ministers (met persvoorlichting) of persdiensten.
- **App-icoon**: "eu" in wit, op marineblauw (`onderdelen/icoon-licht.html`) of op het grijs van
  de donkere modus van iOS (`onderdelen/icoon-donker.html`). iOS kiest bij "Zet op beginscherm"
  het icoon dat past bij de modus van dat moment, en wisselt daarna niet meer mee.
- **Meldingen** klik je weg met het kruisje. **Als web-app** maakt de site geen eigen stappen
  in de geschiedenis.

## Vaste balk bovenaan

De meeschuivende balk met zoekbalk en tabwissel (`.plakblok`) steekt op elke pagina aan beide kanten even ver buiten de kaarten uit: `--plak-uit` (10px) bovenin `stijl.css`. De kaarten staan daarom `--pagina-rand` (10 + 8 = 18px) van de schermrand, zodat er naast de balk 8px lucht blijft. Pas alleen die variabelen aan, nooit per pagina.

De titelbalk daarboven (`.topbalk`) is alleen helemaal bovenaan vol wit (donkere modus: zwart, via `--balk-rgb`) en loopt in één lange, zachte overgang naar helemaal doorzichtig onderaan. Kleur en vervaging zitten op `.topbalk::before`, zodat de kleine titel zelf scherp blijft terwijl hij al op een vrij doorzichtig stuk staat. De balk verschijnt en verdwijnt rustig (0,55 s).

## Tekstmaten

Alle tekst gebruikt één reeks maten (CSS-variabelen bovenin `stijl.css`):

| Variabele | Maat | Waarvoor |
|---|---|---|
| `--t-titel` | 34 | grote paginatitel |
| `--t-kop` | 22 | sectiekoppen |
| `--t-kop2` | 20 | koppen in een wolkje, kleinere koppen |
| `--t-kaart` | 17 | titel van een kaart, kleine titel bovenin |
| `--t-tekst` | 16 | gewone tekst, zoekveld |
| `--t-sub` | 15 | lijstregels, knoppen, schakelaars, ondertitels |
| `--t-meta` | 13 | meta onder een kaart, uitleg, datum en bron |
| `--t-label` | 12 | labels (Parlement, Raad …), kleine tellers |
| `--t-mini` | 11 | dagletters in de datumstrook, piepkleine koppen |

## Iets aanpassen

- **Nieuw EU-voorzitterschap** (elk halfjaar, 1 januari en 1 juli): controleer in `raad.py` of de
  site van het nieuwe voorzitterschap in `VOORZITTERSCHAPPEN` staat en klopt.

- **Eigen samenvatting bij een dossier**: voeg in `wetgeving.json` een blok toe met
  `procedure` (bijv. `2026/0336(COD)`), `titel`, en eventueel `probleem`, `verandert` en `links`.
  Zet er alleen feiten in die in de bron staan.
- **Uitleg bij een begrip**: pas `onderdelen/begrippen.json` aan.
- **Zelf bouwen op de Mac**: `python3 europa.py` (met `EU_ALLEEN_CACHE=1` ervoor gaat het snel,
  zonder de dossiers opnieuw op te halen). Bekijk het resultaat via een kleine webserver:
  `cd site && python3 -m http.server`, en open dan http://localhost:8000.
- **Online zetten**: wijzigingen committen en pushen naar `main`; GitHub bouwt de site dan opnieuw.

## Persmomenten en persvoorlichters

- **Persmomenten in de agenda** komen uit de persberichten van de Commissie en de Raad (afgelopen 5 dagen): een bericht waarvan de kop een persconferentie, persverklaring of persbriefing noemt. Het staat op de dag dat de bron het publiceerde; het tijdstip geeft de bron niet. Een persbericht van dezelfde dag hoort erbij als ze een eigennaam delen die geen persoon is (zoals Frontex) of minstens twee kenmerkende woorden in de kop. Bij twijfel geen koppeling. Aangekondigde persconferenties (de planning van Europe by Satellite) zitten er niet in: die staat alleen in een app die automatisch ophalen niet ondersteunt.
- **Persvoorlichters** onder Personen > Persdiensten komen van de perspagina van de Vertegenwoordiging van de Commissie in Nederland (`bestuur.persdiensten()`). De perspagina's van het Parlement en de Raad weigeren automatisch ophalen (HTTP 403); daar staat alleen de link naar de dienst.

## Lijsten, pop-ups en scrollen

- Lange lijsten (Pers, Procedures, Stemmingen, Personen) laden er `LAAD_STAP` (20) tegelijk, met overal hetzelfde ronde plusje onderaan. De agenda is één doorlopende lijst.
- Alle details openen als hele pagina van onderen (`openPaneel(..., { vol: true })`); alleen het kleine wolkje bij een agenda-item blijft een wolkje.
- Zolang een paneel open is, ligt de pagina erachter vast via `html.geen-scroll` (niet op `body`: dan schieten de vaste balken los). Op de iPhone houdt een touchmove-wachter scrollen buiten het paneel tegen, en na sluiten wordt de scrollpositie zo nodig teruggezet.

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
| `web/` | icoon, manifest, robots.txt en `sw.js` (werkt ook zonder internet) |

## Indeling

Vijf tabbladen onderin: **Agenda** · **Nieuws** · **Overzicht** (in het midden, met zoeken) ·
**Dossiers** · **Stemmen** (stemmingen en europarlementariërs). De bronnen staan onder de
tandwiel rechtsboven (Instellingen > Over). Licht of donker volgt de instelling van je iPhone of computer.

- **Filters**: overal hetzelfde. Naast elk zoekveld een knop Filters met een teller. Per filter
  een rij; tik erop en vink één of meer dingen aan. Boven de lijst staat een regel met wat er aan
  staat (met Wis). Keuzes worden bewaard. De code staat in `onderdelen/js/filters.js`.
- **Agenda**: Week · Maand · Jaar (of knijpen met twee vingers). Week is een lijst met Deze week,
  Volgende week en Later; Maand is een kalender met puntjes per instelling; Jaar toont twaalf
  maanden. Filters: Wat (stemmingen en besluiten, debatten, ministersoverleg, toppen,
  persmomenten, wetgevingsstappen), Wie (Parlement, Raad, Europese Raad, Commissie,
  internationaal), Periode (komend of afgelopen debatten) en Ook tonen. De categorieën zet
  `europa.py` op elk item (`categorieen()`). Tik op een item voor het programma met tijden, de
  locatie, de livestream en **＋ Agenda** (zitting, dag of dagdeel). De planning van de Commissie
  per kwartaal staat in een inklapbaar blok onderaan.
- **Nieuws**: hetzelfde nieuws van meerdere media wordt één bericht met "Ook bij: …" (alleen als
  de koppen in dezelfde taal duidelijk overeenkomen, binnen 24 uur; zie `samenvoegen()` in
  `eu_nieuws.py`).
- **Overzicht**: "Wijzig" linksboven. Rood min = weghalen, groen plus = toevoegen, ≡ = slepen.
  Tik op een blok voor het aantal regels en een filter. Recente zoekopdrachten verschijnen in het
  zoekveld (veeg naar links of Wis, met bevestiging).
- **Instellingen** (tandwiel): eerst de categorieën (Algemeen, Nieuws, Agenda, Overzicht, Mijn
  notities, Over), dan een niveau dieper. Terug of terugvegen gaat één niveau terug.
- **Mensen**: in de filters kies je Wie (europarlementariërs, Commissie, Raad en ministers,
  persdiensten). Bij een europarlementariër staan contact en activiteit (totaal en nu actief,
  met een groen lampje voor wat nog loopt). Een link in een detail (bijvoorbeeld naar een
  stemming) opent een scherm dieper; Terug brengt je terug.
- **Vegen**: in Nieuws (Media | Persberichten) en Stemmen (Stemmingen | Mensen) veeg je naar
  links of rechts. De schakelaar blijft op zijn plek; het andere deel begint bovenaan.
- **Meldingen** (zoals "bron niet bereikbaar") klik je weg met het kruisje.
- **Als web-app** (op het beginscherm) maakt de site geen eigen stappen in de geschiedenis.
  Zo kan alleen het eigen terugvegen van een paneel bewegen, en schuift de pagina erachter niet mee.
- **Zoeken** vergeeft tikfouten, accenten en hoofdletters, en kent afkortingen en
  Nederlands/Engels (AI = KI, EC = Commissie, Oekraïne = Ukraine). Treffers zonder tikfout
  staan eerst; bij bijna-treffers staat er "Bedoel je …?" (in de taal van wat je typte). De lijst
  met synoniemen staat in `onderdelen/js/basis.js` (`SYNONIEMEN`).
- **Stemmingen** tonen in welke vergadering ze waren, met links naar agenda, notulen en de
  hoofdelijke stemmingen.
- **App-icoon**: de bron is `onderdelen/icoon-donker.html`. Na een nieuw icoon moet je de
  web-app op je beginscherm verwijderen en opnieuw toevoegen; iOS bewaart het oude.

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

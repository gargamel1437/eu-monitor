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
| `bronnen.py` | gedeelde hulpjes: ophalen, bewaren, fractienamen |
| `wetgeving.json` | eigen samenvattingen bij enkele dossiers, met bron |
| `onderdelen/sjabloon.html` | de opbouw van de pagina |
| `onderdelen/stijl.css` | het uiterlijk (Liquid Glass, gemaakt voor de iPhone) |
| `onderdelen/js/*.js` | de scripts per onderdeel; worden samengevoegd tot één script |
| `onderdelen/begrippen.json` | uitleg bij begrippen (lang drukken of muis even stil houden) |
| `onderdelen/bronnen.html` | de pagina "Bronnen en beperkingen" |
| `web/` | icoon, manifest en robots.txt |

## Indeling

Vijf tabbladen onderin: **Agenda** · **Nieuws** · **Overzicht** (in het midden, met zoeken) ·
**Dossiers** · **Stemmen** (stemmingen en europarlementariërs). De bronnen staan onder de
i-knop rechtsboven. Licht of donker volgt de instelling van je iPhone of computer.

- **Vegen**: in een tab met een schakelaar (Nieuws: Media | Uit Brussel zelf; Agenda; Stemmen)
  veeg je naar links of rechts naar het volgende deel. Elk deel onthoudt waar je was.
- **Zoeken** vergeeft tikfouten, accenten en hoofdletters, en kent afkortingen en
  Nederlands/Engels (AI = KI, EC = Commissie, Oekraïne = Ukraine). Treffers zonder tikfout
  staan eerst; bij bijna-treffers staat er "Bedoel je …?". De lijst met synoniemen staat in
  `onderdelen/js/basis.js` (`SYNONIEMEN`).
- **Agenda** is ingedeeld in kalenderweken (deze week, volgende week, later). Bij de plenaire
  vergaderingen staan de exacte tijden per dagdeel (debatten en stemmingen), uit de open data
  van het Parlement. De Raad en EU-toppen hebben alleen een datum: het voorzitterschap
  publiceert geen tijden. Dossiers die OEIL in een zitting verwacht, staan bij die zitting.
  **＋ Agenda** opent een `.ics`-bestand (`site/ics/`), ook in de web-app op de iPhone.
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

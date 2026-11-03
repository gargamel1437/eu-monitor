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
| `bronnen.py` | gedeelde hulpjes: ophalen, bewaren, fractienamen |
| `wetgeving.json` | eigen samenvattingen bij enkele dossiers, met bron |
| `onderdelen/sjabloon.html` | de opbouw van de pagina |
| `onderdelen/stijl.css` | het uiterlijk (Liquid Glass, gemaakt voor de iPhone) |
| `onderdelen/js/*.js` | de scripts per onderdeel; worden samengevoegd tot één script |
| `onderdelen/begrippen.json` | uitleg bij begrippen (lang drukken of muis even stil houden) |
| `onderdelen/bronnen.html` | de pagina "Bronnen en beperkingen" |
| `web/` | icoon, manifest en robots.txt |

## Iets aanpassen

- **Eigen samenvatting bij een dossier**: voeg in `wetgeving.json` een blok toe met
  `procedure` (bijv. `2026/0336(COD)`), `titel`, en eventueel `probleem`, `verandert` en `links`.
  Zet er alleen feiten in die in de bron staan.
- **Uitleg bij een begrip**: pas `onderdelen/begrippen.json` aan.
- **Zelf bouwen op de Mac**: `python3 europa.py` (met `EU_ALLEEN_CACHE=1` ervoor gaat het snel,
  zonder de dossiers opnieuw op te halen). Bekijk het resultaat via een kleine webserver:
  `cd site && python3 -m http.server`, en open dan http://localhost:8000.
- **Online zetten**: wijzigingen committen en pushen naar `main`; GitHub bouwt de site dan opnieuw.

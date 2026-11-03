#!/usr/bin/env python3
"""EU-nieuws: haalt Europees nieuws op uit RSS-feeds (gratis, zonder AI)
en geeft elk bericht een beleidsterrein. Wordt gebruikt door europa.py."""

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

DAGEN_TERUG = 5  # EU-nieuws gaat trager dan gewoon nieuws
ATOM = "{http://www.w3.org/2005/Atom}"

# naam: (feed-url, taal, alleen_eu_nieuws_houden)
BRONNEN = {
    "Europese Commissie": [("https://ec.europa.eu/commission/presscorner/api/rss?language=nl", "nl", False)],
    "Raad van de EU": [("https://www.consilium.europa.eu/nl/rss/pressreleases.ashx", "nl", False)],
    "NOS": [("https://feeds.nos.nl/nosnieuwspolitiek", "nl", True),
            ("https://feeds.nos.nl/nosnieuwsbuitenland", "nl", True)],
    "Politico Europe": [("https://www.politico.eu/feed/", "en", False)],
    "Euractiv": [("https://www.euractiv.com/feed/", "en", False)],
}

# Officiële communicatie van de EU zelf (persberichten) houden we apart van journalistiek nieuws.
OFFICIEEL = {"Europese Commissie", "Raad van de EU"}

# Berichten van NOS houden we alleen als ze over de EU gaan.
EU_WOORDEN = re.compile(
    r"\bEU\b|\bEU-|Europese (Unie|Commissie|Raad|Parlement|ministers|leiders)|Europees Parlement|"
    r"\bBrussel\b|europarlement|eurocommissaris|Von der Leyen|Kallas|Metsola|EU-lidstaten|eurozone",
    re.I)

OVERSLAAN = re.compile(r"weekly schedule|dagelijks nieuws|daily news|partner content|promoted content|\bsponsored\b", re.I)
# Politico Europe heeft ook Brits, Duits en Frans binnenlands nieuws en advertenties: die laten we weg.
OVERSLAAN_LINK = re.compile(r"/sponsored-content/|berlin-playbook|paris-playbook|london-playbook|politics-at-sam-and-anne")
OVERSLAAN_CATEGORIE = re.compile(r"^(British politics|Der Podcast|Actualité|Paris Influence|Berlin Bulletin)$")

TERREINEN = [
    ("Klimaat & energie", r"klimaat|climate|energie|energy|\bets\b|emissie|emission|methaan|methane|co2|"
                          r"green deal|duurzam|hitte|heatwave|droogte|drought|overstroming|flood"),
    ("Migratie", r"migra|asiel|asylum|frontex|grenzen|grensbewaking|border|terugkeer|vluchteling|refugee"),
    ("Digitaal & AI", r"digita|\bai\b|artificial intelligence|kunstmatige intelligentie|\bdsa\b|\bdma\b|"
                      r"big tech|cyber|online platform|\bchips?\b|\bdata\b"),
    ("Landbouw & voedsel", r"landbouw|agricult|farm|boeren|visserij|fisher|voedsel|food|mercosur"),
    ("Defensie & veiligheid", r"defensie|defen[cs]e|militair|military|navo|nato|wapen|weapon|munitie|ammunition|"
                              r"vredesfaciliteit|peace facility|paraatheid|preparedness"),
    ("Oekraïne & Rusland", r"oekra|ukrain|rusland|russia|kremlin|poetin|putin|kyiv|kiev"),
    ("Handel", r"handel|trade|tarie[fv]|tariff|douane|customs|\bexport|\bimport|vrijhandel|summit with|canada|china"),
    ("Economie & begroting", r"begroting|budget|econom|inflatie|inflation|\becb\b|belasting|\btax|meerjarig|mff|"
                             r"concurrentie|competitive|industr|aanbested|procurement|banken|banking"),
    ("Rechtsstaat & democratie", r"rechtsstaat|rule of law|democrat|democrati|journalist|persvrijheid|media freedom|"
                                 r"corrupt|hof van justitie|court of justice|verkiezing|election|grondrecht|fundamental rights"),
    ("Uitbreiding", r"uitbreiding|enlargement|toetreding|accession|kandidaat-lid|westelijke balkan|western balkans|"
                    r"moldavi|moldova|georgia|georgië|albani|\bservi[eë]|serbia|montenegro|noord-macedoni|north macedonia"),
]
TERREINEN = [(naam, re.compile(patroon, re.I)) for naam, patroon in TERREINEN]

COMMISSIE_SOORT = [  # eerste woorden van de beschrijving in de Commissie-feed
    ("Persbericht", r"Persbericht|Press release"),
    ("Vragen & antwoorden", r"Vragen en antwoorden|Questions and answers"),
    ("Toespraak", r"Speech|Toespraak"),
    ("Verklaring", r"Statement|Verklaring|Gezamenlijke persmededeling|Joint"),
    ("Factsheet", r"Factsheet"),
    ("Nieuws", r"News|Nieuws"),
]

MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
           "augustus", "september", "oktober", "november", "december"]
DAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"]


from bronnen import ophalen


def schoon(tekst):
    tekst = re.sub(r"<[^>]+>", " ", tekst or "")
    return re.sub(r"\s+", " ", html.unescape(tekst)).strip()


def kort(tekst, max_tekens=230):
    if len(tekst) <= max_tekens:
        return tekst
    knip = tekst[:max_tekens].rsplit(" ", 1)[0]
    return knip.rstrip(",.;:") + "…"


def datum_van(item):
    for veld in ("pubDate", ATOM + "updated"):
        waarde = item.findtext(veld)
        if not waarde:
            continue
        try:
            return parsedate_to_datetime(waarde)
        except Exception:
            pass
        try:
            return datetime.fromisoformat(waarde.replace("Z", "+00:00"))
        except Exception:
            pass
    return None


def commissie_soort(beschrijving):
    """'European Commission Speech Brussels, 03 Nov 2026 Tekst…' -> ('Toespraak', 'Tekst…')"""
    rest = re.sub(r"^European Commission\s*", "", beschrijving)
    soort = None
    for naam, patroon in COMMISSIE_SOORT:
        if re.match(patroon, rest, re.I):
            soort = naam
            break
    rest = re.sub(r"^.*?\b\d{1,2} \w{3} \d{4}\s*", "", rest, count=1)  # plaats + datum weghalen
    rest = rest.replace("“Check against delivery”", "").strip()
    return soort, rest


def terreinen_van(tekst, categorieen=""):
    """Eerst op kop en tekst; alleen als dat niets oplevert kijken we naar de categorieën van de feed."""
    for bron in (tekst, categorieen):
        gevonden = [naam for naam, patroon in TERREINEN if patroon.search(bron)]
        if gevonden:
            return gevonden[:2]
    return ["Overig"]


def berichten():
    grens = datetime.now(timezone.utc) - timedelta(days=DAGEN_TERUG)
    gezien, lijst, fouten = set(), [], []
    for bron, feeds in BRONNEN.items():
        for url, taal, alleen_eu in feeds:
            try:
                root = ET.fromstring(ophalen(url))
            except Exception as e:
                fouten.append(f"{bron}: {e}")
                continue
            for item in root.iter("item"):
                link = (item.findtext("link") or "").strip()
                titel = schoon(item.findtext("title"))
                if not link or link in gezien or not titel or OVERSLAAN.search(titel) or OVERSLAAN_LINK.search(link):
                    continue
                categorie_lijst = [c.text or "" for c in item.findall("category")]
                if any(OVERSLAAN_CATEGORIE.match(c) for c in categorie_lijst):
                    continue
                datum = datum_van(item)
                if datum is None or datum < grens:
                    continue
                tekst = schoon(item.findtext("description"))
                if OVERSLAAN.search(tekst[:200]):
                    continue
                soort = None
                if bron == "Europese Commissie":
                    soort, tekst = commissie_soort(tekst)
                if alleen_eu and not EU_WOORDEN.search(titel + " " + tekst):
                    continue
                voorstel = bool(re.search(r"\b(propos|voorstel|stelt voor|presenteert|presents)", titel, re.I)) \
                    and bron in ("Europese Commissie",)
                gezien.add(link)
                lijst.append({
                    "bron": bron, "taal": taal, "titel": titel, "tekst": kort(tekst), "link": link,
                    "datum": datum.astimezone(), "soort": soort, "voorstel": voorstel,
                    "kanaal": "officieel" if bron in OFFICIEEL else "media",
                    "terreinen": terreinen_van(f"{titel} {tekst}", " ".join(categorie_lijst)),
                })
    lijst.sort(key=lambda b: b["datum"], reverse=True)
    return lijst, fouten


# ---------- HTML ----------

def e(t):
    return html.escape(t, quote=True)


def dagkop(d, nu):
    if d.date() == nu.date():
        return "Vandaag"
    if d.date() == (nu - timedelta(days=1)).date():
        return "Gisteren"
    return f"{DAGEN[d.weekday()].capitalize()} {d.day} {MAANDEN[d.month - 1]}"


def bericht_html(b):
    labels = "".join(f'<span class="label">{e(t)}</span>' for t in b["terreinen"])
    extra = ""
    if b["voorstel"]:
        extra += '<span class="label voorstel">Voorstel</span>'
    if b["soort"]:
        extra += f'<span class="label soort">{e(b["soort"])}</span>'
    if b.get("kanaal") == "officieel":
        extra = '<span class="label officieel">Officieel</span>' + extra
    if b["taal"] == "en":
        extra += '<span class="label taal" title="Engelstalige bron">EN</span>'
    terreinen = "|".join(b["terreinen"])
    return (
        f'<li class="bericht {e(b.get("kanaal", "media"))}" data-bron="{e(b["bron"])}" data-terrein="{e(terreinen)}">'
        f'<a href="{e(b["link"])}" target="_blank" rel="noopener">'
        f'<div class="meta"><span class="bron">{e(b["bron"])}</span>'
        f'<span class="tijd">{b["datum"]:%H:%M}</span></div>'
        f'<h3>{e(b["titel"])}</h3>'
        + (f'<p>{e(b["tekst"])}</p>' if b["tekst"] else "")
        + f'<div class="labels">{extra}{labels}</div></a></li>'
    )


def nieuws_html(lijst):
    if not lijst:
        return '<p class="leeg">Geen berichten gevonden. Probeer het later opnieuw.</p>'
    nu = datetime.now().astimezone()
    delen, huidige = [], None
    for b in lijst:
        kop = dagkop(b["datum"], nu)
        if kop != huidige:
            if huidige is not None:
                delen.append("</ul>")
            delen.append(f'<h2 class="dag">{kop}</h2><ul class="berichten">')
            huidige = kop
        delen.append(bericht_html(b))
    delen.append("</ul>")
    return "\n".join(delen)


def knoppen_html(lijst, sleutel, alle_waarden):
    telling = {}
    for b in lijst:
        for w in (b[sleutel] if isinstance(b[sleutel], list) else [b[sleutel]]):
            telling[w] = telling.get(w, 0) + 1
    knoppen = ['<button class="chip actief" data-waarde="">Alles</button>']
    for w in alle_waarden:
        if telling.get(w):
            knoppen.append(f'<button class="chip" data-waarde="{e(w)}">{e(w)} <small>{telling[w]}</small></button>')
    return "".join(knoppen)

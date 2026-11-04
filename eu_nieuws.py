#!/usr/bin/env python3
"""EU-nieuws: haalt Europees nieuws op uit RSS-feeds (gratis, zonder AI)
en geeft elk bericht een beleidsterrein. Wordt gebruikt door europa.py."""

import html
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from bronnen import DAGEN, MAANDEN, ophalen

DAGEN_TERUG = 5  # EU-nieuws gaat trager dan gewoon nieuws
ATOM = "{http://www.w3.org/2005/Atom}"

# naam: (feed-url, taal, alleen_eu_nieuws_houden)
# Alleen bronnen met een werkende, openbare RSS-feed (getest op 3 november 2026). Niet gelukt:
# Reuters en AP (geen openbare feed meer), FD (geen feed), The Brussels Times en Agence Europe
# (feed is kapotte XML). Algemene feeds filteren we op EU-nieuws.
BRONNEN = {
    "Europese Commissie": [("https://ec.europa.eu/commission/presscorner/api/rss?language=nl", "nl", False)],
    "Raad van de EU": [("https://www.consilium.europa.eu/nl/rss/pressreleases.ashx", "nl", False)],
    "NOS": [("https://feeds.nos.nl/nosnieuwspolitiek", "nl", True),
            ("https://feeds.nos.nl/nosnieuwsbuitenland", "nl", True)],
    "NRC": [("https://www.nrc.nl/rss/", "nl", True)],
    "de Volkskrant": [("https://www.volkskrant.nl/buitenland/rss.xml", "nl", True),
                      ("https://www.volkskrant.nl/voorpagina/rss.xml", "nl", True)],
    "Trouw": [("https://www.trouw.nl/buitenland/rss.xml", "nl", True)],
    "Politico Europe": [("https://www.politico.eu/feed/", "en", False)],
    "Euractiv": [("https://www.euractiv.com/feed/", "en", False)],
    "EUobserver": [("https://euobserver.com/rss", "en", False)],
    "The Guardian": [("https://www.theguardian.com/world/eu/rss", "en", False)],
    "Financial Times": [("https://www.ft.com/europe?format=rss", "en", True)],
    "BBC News": [("https://feeds.bbci.co.uk/news/world/europe/rss.xml", "en", True)],
    "Deutsche Welle": [("https://rss.dw.com/xml/rss-en-eu", "en", False)],
    "Le Monde": [("https://www.lemonde.fr/en/europe/rss_full.xml", "en", True)],
    "Euronews": [("https://www.euronews.com/rss?format=mrss&level=program&name=europe-news", "en", True)],
}

# Officiële communicatie van de EU zelf (persberichten) houden we apart van journalistiek nieuws.
OFFICIEEL = {"Europese Commissie", "Raad van de EU"}
# Bronnen waarvan (een deel van) de artikelen achter een betaalmuur staat.
BETAALMUUR = {"NRC", "de Volkskrant", "Trouw", "Financial Times"}

# Algemene feeds houden we alleen als het bericht over de EU gaat (Nederlands en Engels).
EU_WOORDEN = re.compile(
    r"\bEU\b|\bEU-|\bEU's\b|Europese (Unie|Commissie|Raad|Parlement|ministers|leiders)|Europees Parlement|"
    r"European (Union|Commission|Parliament|Council)|\bBrussel\b|\bBrussels\b|europarlement|eurocommissaris|\bMEPs?\b|"
    r"Von der Leyen|Kallas|Metsola|EU-lidstaten|member states|eurozone|\bECB\b|Strasbourg|Straatsburg",
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


# Nummer van een bericht van de Commissie (zoals ip_26_2244), om het aan een dossier te koppelen.
def persnummer(link):
    m = re.search(r"/presscorner/detail/\w+/([a-z]+_\d+_\d+)", link or "", re.I)
    return m.group(1).lower() if m else None


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
    return samenvoegen(lijst), fouten


STOP = {"with", "from", "that", "this", "what", "will", "have", "after", "over", "into", "about", "their", "they",
        "voor", "met", "van", "naar", "over", "door", "deze", "niet", "zijn", "wordt", "worden", "nieuwe", "eerste",
        "says", "said", "could", "would", "should", "amid", "against", "tegen", "onder", "meer", "news"}


GENERIEK = {"europe", "european", "europese", "europees", "europa", "brussels", "brussel", "commission", "commissie",
            "union", "unie", "parliament", "parlement", "council", "raad", "minister", "ministers", "government",
            "regering", "leaders", "leiders", "year", "week", "plan", "plans", "deal", "states", "lidstaten", "member",
            "countries", "landen", "president", "chief", "first", "last", "nieuwe", "more", "than", "news", "today",
            "vandaag", "while", "after", "before", "where", "which", "there", "their", "these", "those", "been", "being",
            "foreign", "policy", "warns", "warn", "chief", "says", "said", "likely", "could", "would", "zegt", "waarschuwt"}


def kopwoorden(titel):
    return {w for w in re.findall(r"[a-zà-ÿ0-9]{4,}", titel.lower()) if w not in STOP and w not in GENERIEK}


def namen(tekst):
    """Eigennamen (met hoofdletter, niet aan het begin van de zin): die zijn hetzelfde in elke taal."""
    uit = set()
    for zin in re.split(r"[.:;!?\n]", tekst):
        woorden = re.findall(r"[A-Za-zÀ-ÿ'’\-]+", zin)
        for w in woorden[1:]:
            if w[:1].isupper() and len(w) >= 4 and w.lower() not in GENERIEK and w.lower() not in STOP and not w.isupper():
                uit.add(w.lower().strip("'’"))
    return uit


def samenvoegen(lijst):
    """Hetzelfde nieuwsfeit van meerdere media wordt één verhaal met alle bronnen erbij; je kiest
    zelf welke je opent. Twee berichten horen bij elkaar (binnen 36 uur, verschillende bron) als:
    - hun koppen minstens 3 kenmerkende woorden delen, en dat de helft van de kortste kop is; of
    - kop en eerste regels samen minstens 4 kenmerkende woorden delen, waarvan minstens één
      eigennaam (zo werken ook een Nederlandse en een Engelse kop over hetzelfde); of
    - ze minstens 2 eigennamen en 3 kenmerkende woorden delen.
    Algemene woorden (EU, Commissie, Brussel…) tellen niet mee. Persberichten voegen we niet samen."""
    media = [b for b in lijst if b["kanaal"] == "media"]
    info = {}
    for b in media:
        kop = kopwoorden(b["titel"])
        alles = kop | kopwoorden(b["tekst"][:180])
        info[id(b)] = (kop, alles, namen(b["titel"] + ". " + b["tekst"][:180]))
    def lijkt(a, b):
        if a["bron"] == b["bron"] or abs((a["datum"] - b["datum"]).total_seconds()) > 36 * 3600:
            return False
        ka, aa, na = info[id(a)]
        kb, ab, nb = info[id(b)]
        kop, alle, nm = len(ka & kb), len(aa & ab), len(na & nb)
        return (kop >= 3 and kop >= 0.5 * min(len(ka), len(kb))) or (alle >= 4 and nm >= 1 and alle >= 0.3 * min(len(aa), len(ab))) or (nm >= 2 and alle >= 3)

    # een bericht hoort bij een verhaal als het op minstens de helft van de berichten daarin lijkt
    # (zo groeit een verhaal niet via één toevallige overeenkomst door naar een ander onderwerp)
    verhalen = []
    for b in media:
        beste, score = None, 0
        for v in verhalen:
            n = sum(1 for x in v if lijkt(b, x))
            if n and n * 2 >= len(v) and n > score:
                beste, score = v, n
        if beste is not None:
            beste.append(b)
        else:
            verhalen.append([b])
    groep_van = {}
    for n, v in enumerate(verhalen):
        for b in v:
            groep_van[id(b)] = n

    def wortel(x):
        return groep_van[x]
    groepen = {n: v for n, v in enumerate(verhalen)}
    uit = []
    gehad = set()
    for b in lijst:
        b["ook"] = []
        if b["kanaal"] != "media":
            uit.append(b)
            continue
        g = groepen[wortel(id(b))]
        if wortel(id(b)) in gehad:
            continue
        gehad.add(wortel(id(b)))
        # één bericht per bron; het nieuwste bericht is de kop van het verhaal
        per_bron = {}
        for x in g:
            per_bron.setdefault(x["bron"], x)
        rest = [x for x in per_bron.values() if x is not b]
        b["ook"] = [{"bron": x["bron"], "link": x["link"], "titel": x["titel"], "taal": x["taal"],
                     "tijd": x["datum"].strftime("%H:%M"), "dag": x["datum"].date().isoformat()} for x in rest]
        for x in rest:
            b["terreinen"] = list(dict.fromkeys(b["terreinen"] + x["terreinen"]))[:2]
        uit.append(b)
    return uit


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
    if b["bron"] in BETAALMUUR:
        extra += '<span class="label taal" title="Mogelijk achter een betaalmuur">Betaalmuur</span>'
    terreinen = "|".join(b["terreinen"])
    kanaal = b.get("kanaal", "media")
    # de instelling achter een persbericht, voor dezelfde kleur als in de agenda
    instelling = {"Europese Commissie": "com", "Raad van de EU": "raad"}.get(b["bron"], "")
    bronnen = [b["bron"]] + [o["bron"] for o in b.get("ook", [])]
    kop = (f'<li class="bericht {e(kanaal)}{" verhaal" if b.get("ook") else ""}{" k-" + instelling if instelling else ""}" data-bron="{e(b["bron"])}"'
           f' data-bronnen="{e("|".join(bronnen))}" data-taal="{e(b["taal"])}" data-terrein="{e(terreinen)}"'
           f' data-tijd="{b["datum"].day} {MAANDEN[b["datum"].month - 1][:3]} {b["datum"]:%H:%M}"')
    inhoud = (f'<h3>{e(b["titel"])}</h3>' + (f'<p>{e(b["tekst"])}</p>' if b["tekst"] else "")
              + f'<div class="labels">{extra}{labels}</div>')
    deel = (f'<button class="deel-mini" aria-label="Delen" data-deel="{e(json.dumps({"t": b["titel"], "u": b["link"]}, ensure_ascii=False))}">'
            '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M6 11H5v9.5h14V11h-1"/></svg></button>')
    # hoort het bij een persmoment in de agenda: een knopje erheen
    if b.get("agenda"):
        deel = (f'<a class="agenda-mini" href="#agenda?item={e(b["agenda"])}" aria-label="In de agenda">'
                '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></a>') + deel
    if not b.get("ook"):
        return (kop + (' data-agenda="1"' if b.get("agenda") else "") + '>' + f'<a href="{e(b["link"])}" target="_blank" rel="noopener">'
                f'<div class="meta"><span class="bron">{e(b["bron"])}</span><span class="tijd">{b["datum"]:%H:%M}</span></div>'
                + inhoud + "</a>" + deel + "</li>")
    # meerdere bronnen over hetzelfde nieuws: één verhaal, tik = kies welke bron je opent
    alle = [{"bron": b["bron"], "titel": b["titel"], "link": b["link"], "taal": b["taal"], "tijd": b["datum"].strftime("%H:%M"),
             "dag": b["datum"].date().isoformat()}] + b["ook"]
    return (kop + f' data-verhaal="{e(json.dumps(alle, ensure_ascii=False))}">'
            f'<div class="verhaal-kaart" role="button" tabindex="0">'
            f'<div class="meta"><span class="bron">{len(alle)} bronnen</span><span class="tijd">{b["datum"]:%H:%M}</span></div>'
            + inhoud
            + '<div class="bronrij">' + "".join(f'<span>{e(x["bron"])}</span>' for x in alle) + "</div></div>" + deel + "</li>")


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

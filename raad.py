#!/usr/bin/env python3
"""Raad: vergaderingen van de Raad van de EU, de Eurogroep en EU-toppen (Europese Raad,
informele bijeenkomsten van regeringsleiders, internationale toppen).

Bron: de officiële agenda van het EU-voorzitterschap (een site van de Raad zelf). De gewone
site van de Raad (consilium.europa.eu) laat geen scripts toe; de site van het voorzitterschap
wel, en die toont dezelfde formele vergaderingen. Het voorzitterschap wisselt elk halfjaar:
voeg dan de nieuwe site toe aan VOORZITTERSCHAPPEN. Wordt gebruikt door europa.py."""

import html
import re
from datetime import date
from urllib.parse import urlencode

from bronnen import ophalen

# (eerste dag, site): het voorzitterschap dat op die dag begint
VOORZITTERSCHAPPEN = [
    ("2026-07-01", "https://irish-presidency.consilium.europa.eu"),
    ("2027-01-01", "https://lithuanian-presidency.consilium.europa.eu"),
    ("2027-07-01", "https://greek-presidency.consilium.europa.eu"),
]

# soort op de site -> (soort in onze agenda, volgorde)
SOORTEN = {
    "European Council": "EU-top",
    "Summit": "EU-top",
    "Council of the EU": "Raad",
    "Eurogroup": "Raad",
    "Informal ministerial meeting": "Raad (informeel)",
}

RAADSNAMEN = [
    ("General Affairs Council", "Raad Algemene Zaken"),
    ("Foreign Affairs Council", "Raad Buitenlandse Zaken"),
    ("Economic and Financial Affairs Council", "Ecofin-Raad"),
    ("Justice and Home Affairs Council", "Raad Justitie en Binnenlandse Zaken"),
    ("Employment, Social Policy, Health and Consumer Affairs Council", "Raad Werkgelegenheid, Sociaal Beleid, Volksgezondheid en Consumentenzaken"),
    ("Competitiveness Council", "Raad Concurrentievermogen"),
    ("Transport, Telecommunications and Energy Council", "Raad Vervoer, Telecommunicatie en Energie"),
    ("Agriculture and Fisheries Council", "Raad Landbouw en Visserij"),
    ("Environment Council", "Raad Milieu"),
    ("Education, Youth, Culture and Sport Council", "Raad Onderwijs, Jeugd, Cultuur en Sport"),
    ("Eurogroup", "Eurogroep"),
    ("European Council", "Europese Raad"),
    ("Informal meeting of EU Heads of State or Government", "Informele bijeenkomst van de EU-regeringsleiders"),
    ("Meeting of the European Political Community (EPC)", "Europese Politieke Gemeenschap (EPC)"),
]
ONDERDELEN = {
    "Defence": "defensie", "Development": "ontwikkeling", "Trade": "handel", "Budget": "begroting",
    "Cohesion": "cohesie", "Transport": "vervoer", "Telecommunications": "telecommunicatie", "Energy": "energie",
    "Health": "volksgezondheid", "Employment and social policy": "werkgelegenheid en sociaal beleid",
    "Internal market and industry": "interne markt en industrie", "Research and space": "onderzoek en ruimtevaart",
    "Education and Youth": "onderwijs en jeugd", "Culture and Sport": "cultuur en sport",
}
PLAATSEN = {"Brussels": "Brussel", "Luxembourg": "Luxemburg", "Video conference": "videoconferentie"}
MAANDEN_EN = ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"]


def nederlands(titel):
    """'Foreign Affairs Council (Defence)' -> 'Raad Buitenlandse Zaken (defensie)'; onbekend blijft Engels."""
    m = re.match(r"^(.*?)\s*(?:\(([^)]*)\))?\s*$", titel)
    kern, deel = m.group(1).strip(), m.group(2)
    for en, nl in RAADSNAMEN:
        if kern == en or titel.strip() == en:
            if titel.strip() == en:
                return nl
            return nl + (f" ({ONDERDELEN.get(deel, deel)})" if deel else "")
    return titel.strip()


def schoon(t):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t or ""))).strip()


def jaar_bij(dag, maand, vandaag):
    """De site toont '9 November' zonder jaar: kies het jaar dat het dichtst bij vandaag ligt."""
    kandidaten = [date(vandaag.year + d, maand, dag) for d in (-1, 0, 1)]
    return min(kandidaten, key=lambda x: abs((x - vandaag).days))


def soort_ids(site):
    """De filtercodes per soort staan in het formulier op de pagina zelf."""
    t = ophalen(site + "/en/events/").decode("utf-8", "replace")
    ids = {}
    for m in re.finditer(r'name="Types" value="([^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*?<label[^>]*>\s*([^<]+?)\s*<', t):
        ids[m.group(2).strip()] = m.group(1)
    return ids


def lees_pagina(t, site, vandaag):
    uit, huidig = [], None
    blok = t[t.find("Number of events"):]
    for m in re.finditer(r'events-group__date[^>]*>\s*<span[^>]*>\s*(\d{1,2}) ([A-Z][a-z]+)\s*</span>|<h3 class="event__title[^"]*">(.*?)</h3>(.*?)</article>', blok, re.S):
        if m.group(1):
            if m.group(2) in MAANDEN_EN:
                huidig = jaar_bij(int(m.group(1)), MAANDEN_EN.index(m.group(2)) + 1, vandaag)
            continue
        if not huidig:
            continue
        a = re.search(r'href="([^"]+)"[^>]*>(.*?)</a>', m.group(3), re.S)
        if not a:
            continue
        plaats = re.search(r'event__location.*?<span>(.*?)</span>', m.group(4), re.S)
        link = a.group(1) if a.group(1).startswith("http") else site + a.group(1)
        uit.append({"datum": huidig.isoformat(), "titel_en": schoon(a.group(2)), "plaats": schoon(plaats.group(1)) if plaats else "", "url": link})
    return uit


def vergaderingen(vandaag=None):
    vandaag = vandaag or date.today()
    nu = vandaag.isoformat()
    sites = [s for i, (begin, s) in enumerate(VOORZITTERSCHAPPEN)
             if begin <= nu < (VOORZITTERSCHAPPEN[i + 1][0] if i + 1 < len(VOORZITTERSCHAPPEN) else "9999")]
    # binnen 6 weken van een wissel ook het volgende voorzitterschap (lukt dat niet, dan geen probleem)
    volgende = [s for begin, s in VOORZITTERSCHAPPEN if nu < begin and (date.fromisoformat(begin) - vandaag).days <= 42]
    if not sites:
        raise RuntimeError("geen voorzitterschap bekend voor vandaag: vul VOORZITTERSCHAPPEN in raad.py aan")
    uit, gezien = [], set()
    for site in sites + volgende:
        try:
            ids = soort_ids(site)
        except Exception:
            if site in volgende:
                continue
            raise
        for naam, soort in SOORTEN.items():
            if naam not in ids:
                continue
            for pagina in range(1, 6):
                url = site + "/en/events/?" + urlencode({"Types": ids[naam], "page": pagina})
                t = ophalen(url).decode("utf-8", "replace")
                items = lees_pagina(t, site, vandaag)
                nieuw = [i for i in items if (i["datum"], i["titel_en"]) not in gezien]
                for i in nieuw:
                    gezien.add((i["datum"], i["titel_en"]))
                    titel = nederlands(i["titel_en"])
                    if soort == "Raad (informeel)":
                        titel = "Informele ministersbijeenkomst: " + re.sub(r"^Informal (meeting|videoconference) of (the )?", "", titel)
                    uit.append({"datum": i["datum"], "soort": soort.replace(" (informeel)", ""), "titel": titel,
                                "titel_en": i["titel_en"], "plaats": PLAATSEN.get(i["plaats"], i["plaats"]), "url": i["url"],
                                "informeel": soort == "Raad (informeel)"})
                if not nieuw or 'page=' + str(pagina + 1) not in t:
                    break
    uit.sort(key=lambda i: (i["titel"], i["datum"]))
    # meerdaagse vergaderingen (zelfde naam op opeenvolgende dagen) worden één item met een einddatum
    samen = []
    for i in uit:
        v = samen[-1] if samen else None
        if v and v["titel"] == i["titel"] and (date.fromisoformat(i["datum"]) - date.fromisoformat(v.get("eind", v["datum"]))).days == 1:
            v["eind"] = i["datum"]
        else:
            samen.append(i)
    uit = sorted(samen, key=lambda i: (i["datum"], i["titel"]))
    if not uit:
        raise RuntimeError("geen vergaderingen gevonden op de site van het voorzitterschap")
    return uit


if __name__ == "__main__":
    for v in vergaderingen():
        print(v["datum"], v.get("eind", ""), v["soort"], "|", v["titel"], "|", v["plaats"])

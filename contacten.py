#!/usr/bin/env python3
"""Contactgegevens van europarlementariërs: e-mail, telefoon en kantoor in Brussel en Straatsburg,
website en sociale media, zoals het Parlement ze publiceert (open data, data.europarl.europa.eu).

Contactgegevens veranderen zelden. Ze worden bewaard in data/contacten.json; elke keer bouwen
haalt de ontbrekende op en ververst de oudste (hoogstens VERVERS per keer).
Wordt gebruikt door europa.py."""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from bronnen import CACHE, ophalen_json

EP = "https://data.europarl.europa.eu/api/v2"
FMT = "format=application%2Fld%2Bjson"
BESTAND = CACHE / "contacten.json"
VERVERS = 120
GEBOUW = {"LOW": "Straatsburg", "ASP": "Brussel", "SDM": "Straatsburg", "WIC": "Straatsburg"}
SOCIAAL = {"TWT": "X", "FBW": "Facebook", "IST": "Instagram", "LNK": "LinkedIn", "YTB": "YouTube",
           "TKT": "TikTok", "BSK": "Bluesky", "MST": "Mastodon", "THR": "Threads"}


def een(mep_id):
    x = ophalen_json(f"{EP}/meps/{mep_id}?{FMT}", 30)["data"][0]
    tel = []
    for m in x.get("hasMembership", []):
        for c in m.get("contactPoint", []) or []:
            nummer = ((c.get("hasTelephone") or {}).get("hasValue") or "").replace("tel:", "")
            plaats = GEBOUW.get((c.get("hasSite") or "").rsplit("/", 1)[-1], "")
            if nummer and not any(t["nummer"] == nummer for t in tel):
                tel.append({"plaats": plaats, "nummer": nummer, "kantoor": c.get("officeAddress", "")})
    sociaal = []
    for acc in x.get("account", []) or []:
        soort = (acc.get("dcterms_type") or "").rsplit("/", 1)[-1]
        if acc.get("id", "").startswith("http"):
            sociaal.append({"naam": SOCIAAL.get(soort, "Account"), "url": acc["id"]})
    web = x.get("homepage") or ""
    return {"mail": (x.get("hasEmail") or "").replace("mailto:", ""), "tel": tel,
            "web": web if isinstance(web, str) else (web[0] if web else ""), "sociaal": sociaal,
            "opgehaald": date.today().isoformat()}


def bijwerken(ids):
    """Geeft {id: contact} voor alle ids; haalt ontbrekende en de oudste opnieuw op."""
    try:
        bewaard = json.loads(BESTAND.read_text(encoding="utf-8"))
    except Exception:
        bewaard = {}
    ids = [str(i) for i in ids]
    if os.environ.get("EU_ALLEEN_CACHE"):   # snelle nieuwsronde: niets ophalen
        return {i: bewaard[i] for i in ids if i in bewaard}
    nodig = [i for i in ids if i not in bewaard]
    nodig += sorted((i for i in ids if i in bewaard), key=lambda i: bewaard[i].get("opgehaald", ""))[:max(0, VERVERS - len(nodig))]

    def veilig(i):
        try:
            return i, een(i)
        except Exception:
            return i, None
    with ThreadPoolExecutor(8) as pool:
        for i, c in pool.map(veilig, nodig):
            if c:
                bewaard[i] = c
    CACHE.mkdir(exist_ok=True)
    BESTAND.write_text(json.dumps(bewaard, ensure_ascii=False), encoding="utf-8")
    return {i: bewaard[i] for i in ids if i in bewaard}


if __name__ == "__main__":
    print(json.dumps(een("256810"), ensure_ascii=False, indent=1))

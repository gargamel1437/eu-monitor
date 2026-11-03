#!/usr/bin/env python3
"""Commissie: de planning van de Europese Commissie. Welke voorstellen, mededelingen en
aanbevelingen de Commissie zelf zegt te willen aannemen, en in welk kwartaal.

Bron: 'Geef uw mening' (Have Your Say), het officiële portaal waarop de Commissie elk gepland
initiatief aankondigt met het kwartaal waarin ze het wil aannemen. Alleen initiatieven die nog
niet zijn aangenomen. Wordt gebruikt door europa.py; de details worden bewaard in data/commissie/,
zodat niet elke keer alles opnieuw hoeft."""

import json
import re
import html
from datetime import date

from bronnen import CACHE, ophalen_json

API = "https://ec.europa.eu/info/law/better-regulation/brpapi"
PAGINA = "https://ec.europa.eu/info/law/better-regulation/have-your-say/initiatives/{}_nl"
MAP_C = CACHE / "commissie"
VERS_DAGEN = 3            # details van een initiatief na zoveel dagen opnieuw ophalen
MAX_DETAILS = 120         # zoveel details per keer ophalen; de rest volgt bij de volgende runs

# soort handeling -> Nederlandse naam. Alleen de soorten die de Commissie zelf aanneemt als
# beleid of wetsvoorstel; uitvoerings- en gedelegeerde handelingen laten we weg (dat zijn er honderden).
SOORTEN = {
    "PROP_REG": "Voorstel voor een verordening",
    "PROP_DIR": "Voorstel voor een richtlijn",
    "PROP_DEC": "Voorstel voor een besluit",
    "PROP_RECO": "Voorstel voor een aanbeveling van de Raad",
    "COMMUNIC": "Mededeling",
    "JOINT_COMMUNIC": "Gezamenlijke mededeling",
}
NOG_NIET_AANGENOMEN = {"INIT_PLANNED", "PLANNING_WORKFLOW", "OPC_LAUNCHED", "CFE_WORKFLOW", "ISC_WORKFLOW"}


def kwartaal_van(d):
    return (d.year, (d.month - 1) // 3 + 1)


def kwartalen_rond(vandaag):
    """Het vorige, het huidige en de twee volgende kwartalen."""
    j, k = kwartaal_van(vandaag)
    uit = []
    for stap in range(-1, 3):
        n = j * 4 + (k - 1) + stap
        uit.append((n // 4, n % 4 + 1))
    return uit


def lijst_initiatieven():
    """Alle geplande initiatieven van de soorten hierboven die nog niet zijn aangenomen."""
    uit = {}
    for soort in SOORTEN:
        for pagina in range(0, 15):
            d = ophalen_json(f"{API}/searchInitiatives?size=100&page={pagina}&language=EN&foreseenActType={soort}")
            p = d["initiativeResultDtoPage"]
            for x in p["content"]:
                st = (x.get("currentStatuses") or [{}])[0].get("frontEndStage")
                if st in NOG_NIET_AANGENOMEN:
                    uit[int(x["id"])] = soort
            if p.get("last", True):
                break
    return uit


def details(iid, vandaag):
    MAP_C.mkdir(parents=True, exist_ok=True)
    pad = MAP_C / f"{iid}.json"
    if pad.exists():
        oud = json.loads(pad.read_text(encoding="utf-8"))
        if (vandaag - date.fromisoformat(oud["opgehaald"])).days < VERS_DAGEN:
            return oud, False
    else:
        oud = None
    d = ophalen_json(f"{API}/groupInitiatives/{iid}")
    nl = {t["field"]: t["value"] for t in d.get("initiativeTranslations", []) if t.get("language") == "NL"}
    gepland = ""
    for pub in d.get("publications", []):
        if pub.get("stage") == "ADOPTION_WORKFLOW" and pub.get("plannedPeriod"):
            gepland = pub["plannedPeriod"]  # bijv. 'Q-2026-4'
    reactie = ""
    for pub in d.get("publications", []):
        if pub.get("receivingFeedbackStatus") == "OPEN" and pub.get("endDate"):
            reactie = pub["endDate"][:10].replace("/", "-")
    samenvatting = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", nl.get("SUMMARY") or d.get("dossierSummary") or ""))).strip()
    item = {"id": iid, "titel": nl.get("SHORT_TITLE") or d.get("shortTitle", ""), "titel_en": d.get("shortTitle", ""),
            "soort": d.get("foreseenActType", ""), "gepland": gepland, "dg": d.get("dg", ""),
            "onderwerpen": [t.get("label", "") for t in d.get("topics", [])], "reactie_tot": reactie,
            "samenvatting": samenvatting[:600], "opgehaald": vandaag.isoformat()}
    pad.write_text(json.dumps(item, ensure_ascii=False), encoding="utf-8")
    return item, True


def planning(vandaag=None):
    vandaag = vandaag or date.today()
    ids = lijst_initiatieven()
    if not ids:
        raise RuntimeError("geen initiatieven gevonden bij Geef uw mening")
    # eerst de initiatieven die we nog niet kennen, dan de oudste
    def leeftijd(iid):
        pad = MAP_C / f"{iid}.json"
        return "" if not pad.exists() else json.loads(pad.read_text(encoding="utf-8")).get("opgehaald", "")
    opgehaald, items = 0, []
    for iid in sorted(ids, key=leeftijd):
        pad = MAP_C / f"{iid}.json"
        if opgehaald >= MAX_DETAILS and pad.exists():
            items.append(json.loads(pad.read_text(encoding="utf-8")))
            continue
        if opgehaald >= MAX_DETAILS:
            continue
        try:
            item, nieuw = details(iid, vandaag)
        except Exception:
            if pad.exists():
                items.append(json.loads(pad.read_text(encoding="utf-8")))
            continue
        opgehaald += nieuw
        items.append(item)
    venster = {f"Q-{j}-{k}" for j, k in kwartalen_rond(vandaag)}
    uit = []
    for x in items:
        if x["gepland"] not in venster:
            continue
        j, k = int(x["gepland"].split("-")[1]), int(x["gepland"].split("-")[2])
        uit.append({**x, "soort_naam": SOORTEN.get(x["soort"], x["soort"]), "jaar": j, "kwartaal": k,
                    "url": PAGINA.format(x["id"]), "achter": (j, k) < kwartaal_van(vandaag)})
    uit.sort(key=lambda x: (x["jaar"], x["kwartaal"], x["soort_naam"], x["titel"]))
    return {"items": uit, "bekend": len(ids), "huidig": "Q-%d-%d" % kwartaal_van(vandaag)}


if __name__ == "__main__":
    p = planning()
    print(p["bekend"], "initiatieven nog niet aangenomen;", len(p["items"]), "gepland rond nu")
    for x in p["items"][:40]:
        print(x["gepland"], "|", x["soort_naam"], "|", x["titel"][:80], "|", x["dg"])

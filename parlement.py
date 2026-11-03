"""Europees Parlement: agenda (komende weken) en debatten (laatste zittingen, met sprekers).

Bron: de open data van het Europees Parlement, https://data.europarl.europa.eu
Afgelopen vergaderdagen veranderen niet meer en worden bewaard in data/debatten/."""

import json
import re
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

from bronnen import CACHE, VOLGORDE_FRACTIES, ophalen_json

EP = "https://data.europarl.europa.eu/api/v2"
FMT = "format=application%2Fld%2Bjson"
PLAATSEN = {"FRA_SXB": "Straatsburg", "BEL_BRU": "Brussel"}

PROCEDUREEL = re.compile(
    r"hervatting|redevoeringen van één minuut|opening van de|sluiting van de|notulen|agenda van de volgende|"
    r"samenstelling|stemverklaring|mededeling van de voorzitter|regeling van de werkzaamheden|ondertekening|"
    r"verificatie van geloofsbrieven|onderbreking|rectificatie|ingekomen stukken|kennisgeving|"
    r"teksten waarover het debat is gesloten|^stemmingen$|stemmingen \(|vragenuur$|urgentverklaring", re.I)


def schoon_label(label):
    label = re.sub(r"^\d+(\.\d+)*\.\s*", "", label or "")
    label = re.sub(r"\s*\((debat|stemming)\)\s*$", "", label)
    return re.sub(r"\s*\*+I*\s*", " ", label).strip()


# ---------- vergaderdagen ----------

def vergaderdagen():
    """Met een bewaarde kopie: de vergaderkalender verandert zelden en de API is soms traag."""
    pad = CACHE / "vergaderdagen.json"
    try:
        dagen = _vergaderdagen()
        pad.parent.mkdir(exist_ok=True)
        pad.write_text(json.dumps(dagen), encoding="utf-8")
        return dagen
    except Exception:
        if pad.exists():
            return json.loads(pad.read_text(encoding="utf-8"))
        raise


def _vergaderdagen():
    vandaag = date.today()
    jaren = {vandaag.year, (vandaag + timedelta(days=45)).year, (vandaag - timedelta(days=45)).year}
    dagen = []
    for jaar in sorted(jaren):
        for m in ophalen_json(f"{EP}/meetings?year={jaar}&{FMT}&limit=300", 120)["data"]:
            plaats = (m.get("hasLocality") or "").rsplit("/", 1)[-1]
            dagen.append({"id": m["activity_id"], "datum": m["activity_date"],
                          "plaats": PLAATSEN.get(plaats, plaats or "?")})
    return sorted(dagen, key=lambda d: d["datum"])


def sessies(dagen):
    """Groepeert losse vergaderdagen tot zittingen (dagen die vlak na elkaar liggen)."""
    groepen = []
    for d in dagen:
        dt = date.fromisoformat(d["datum"])
        if groepen and (dt - date.fromisoformat(groepen[-1][-1]["datum"])).days <= 3:
            groepen[-1].append(d)
        else:
            groepen.append([d])
    return groepen


# ---------- agenda (komende zitting) ----------

def tijdstip(waarde, kies):
    """De API geeft een tijd soms als lijst (bijvoorbeeld twee eindtijden): neem de vroegste of laatste."""
    if isinstance(waarde, list):
        waarde = kies([w for w in waarde if isinstance(w, str)], default="")
    return waarde if isinstance(waarde, str) else ""


def agenda_dag(dag):
    """Eén vergaderdag: de debatten, en het programma per dagdeel met begin- en eindtijd
    (Brusselse tijd, zoals het Parlement ze publiceert). Zonder tijden in de bron: geen tijden."""
    data = ophalen_json(f"{EP}/meetings/{dag['id']}/foreseen-activities?{FMT}&limit=500", 60).get("data", [])
    per_id = {x.get("id"): x for x in data}

    def tekst(x):
        label = (x.get("activity_label") or {})
        return label.get("nl") or label.get("en") or ""

    debatten, stemmen, blokken, begin, eind = [], [], [], [], []
    for x in data:
        soort = x.get("had_activity_type", "")
        if soort.endswith("PLENARY_DEBATE") and not PROCEDUREEL.search(tekst(x)):
            debatten.append(schoon_label(tekst(x)))
        elif soort.endswith("MEETING_PART"):
            van, tot = tijdstip(x.get("activity_start_date"), min), tijdstip(x.get("activity_end_date"), max)
            stemming = "VOTE" in ((x.get("activity_label") or {}).get("en") or tekst(x)).upper()
            if van:
                begin.append(van)
                if stemming:
                    stemmen.append(van[11:16])
            if tot:
                eind.append(tot)
            punten = []
            for c in x.get("consists_of", []):
                y = per_id.get(c)
                t = schoon_label(tekst(y)) if y else ""
                if t and not PROCEDUREEL.search(t):
                    punten.append(t)
            if van:
                blokken.append({"begin": van[11:16], "eind": tot[11:16] if tot else "",
                                "soort": "Stemmingen" if stemming else "Debatten", "punten": list(dict.fromkeys(punten))})
    blokken.sort(key=lambda b: b["begin"])
    return {**dag, "debatten": list(dict.fromkeys(debatten)), "stemmingen": sorted(set(stemmen)),
            "blokken": blokken, "begin": min(begin) if begin else "", "eind": max(eind) if eind else "",
            "agenda_url": f"https://www.europarl.europa.eu/doceo/document/OJQ-10-{dag['datum']}_NL.html"}


# ---------- debatten (afgelopen zitting) ----------

def debatten_dag(dag):
    """Inhoudelijke debatten van één vergaderdag, met de ID's van de sprekers."""
    acts = ophalen_json(f"{EP}/meetings/{dag['id']}/activities?{FMT}&limit=500", 60).get("data", [])
    try:
        toespraken = ophalen_json(f"{EP}/speeches?{FMT}&sitting-date={dag['datum']}&limit=2000", 60).get("data", [])
    except Exception:
        toespraken = None  # sprekers zijn mooi, maar niet noodzakelijk
    sprekers = defaultdict(list)
    for t in toespraken or []:
        if not (t.get("had_activity_type") or "").endswith("PLENARY_DEBATE_SPEECH"):
            continue
        personen = (t.get("had_participation") or {}).get("had_participant_person") or []
        for debat_id in t.get("inverse_consists_of") or []:
            sprekers[debat_id] += [p.rsplit("/", 1)[-1] for p in personen]
    samen = {}
    for x in sorted(acts, key=lambda a: int((re.search(r"ITM-(\d+)$", a["activity_id"]) or [0, 0])[1])):
        if not (x.get("had_activity_type") or "").endswith("PLENARY_DEBATE"):
            continue
        label = x.get("activity_label") or {}
        tekst = label.get("nl") or label.get("en") or ""
        if PROCEDUREEL.search(tekst):
            continue
        nummer = int((re.search(r"ITM-(\d+)$", x["activity_id"]) or [0, 0])[1])
        # "… (voortzetting van het debat)" hoort bij hetzelfde debat
        titel = re.sub(r"\s*\(voortzetting van het debat\)", "", schoon_label(tekst))
        ids = list(dict.fromkeys(sprekers.get(x["id"], [])))
        if titel in samen:
            samen[titel]["sprekers"] = list(dict.fromkeys(samen[titel]["sprekers"] + ids))
            continue
        samen[titel] = {
            "nummer": nummer, "titel": titel, "datum": dag["datum"], "plaats": dag["plaats"], "sprekers": ids,
            "verslag": f"https://www.europarl.europa.eu/doceo/document/CRE-10-{dag['datum']}-ITM-{nummer:03d}_NL.html",
            "sprekers_bekend": toespraken is not None,
        }
    return list(samen.values())


# ---------- alles samen ----------

def debatten_dag_cache(dag, leden):
    """Afgelopen dagen veranderen niet meer: bewaar ze. Sprekers-ID's houden we apart, zodat
    fracties en namen bij elke run met de nieuwste ledenlijst worden ingevuld."""
    pad = CACHE / "debatten" / f"{dag['datum']}.json"
    if pad.exists():
        ruw = json.loads(pad.read_text(encoding="utf-8"))
    else:
        ruw = debatten_dag(dag)
        if all(x["sprekers_bekend"] for x in ruw) and dag["datum"] < date.today().isoformat():
            pad.parent.mkdir(parents=True, exist_ok=True)
            pad.write_text(json.dumps(ruw, ensure_ascii=False), encoding="utf-8")
    uit = []
    for x in ruw:
        fr = Counter()
        nl, overig = [], 0
        for pid in x.get("sprekers", []):
            lid = leden.get(pid)
            if not lid:
                overig += 1
                continue
            fr[lid["fractie"]] += 1
            if lid["land"] == "NL":
                nl.append({"id": pid, "naam": lid["naam"], "partij": lid["partij"]})
        uit.append({**x, "fracties": [[f, fr[f]] for f in VOLGORDE_FRACTIES if fr.get(f)],
                    "nederlanders": nl, "overige_sprekers": overig})
    return uit


def alles(leden, zittingen_terug=3, dagen_vooruit=28):
    vandaag = date.today()
    dagen = vergaderdagen()
    groepen = sessies(dagen)
    vorige = [g for g in groepen if g[-1]["datum"] < vandaag.isoformat()][-zittingen_terug:]
    grens = (vandaag + timedelta(days=dagen_vooruit)).isoformat()
    komend = [d for d in dagen if vandaag.isoformat() <= d["datum"] <= grens]
    with ThreadPoolExecutor(2) as pool:
        debat_dagen = list(pool.map(lambda d: debatten_dag_cache(d, leden), [d for g in vorige for d in g]))
        agenda = list(pool.map(agenda_dag, komend))
    later = [d for d in dagen if d["datum"] > grens][:4]
    return {
        "opgehaald": datetime.now().isoformat(timespec="minutes"),
        "zittingen": [{"begin": g[0]["datum"], "eind": g[-1]["datum"], "plaats": g[0]["plaats"]} for g in vorige],
        "debatten": [d for dag in debat_dagen for d in dag],
        "agenda": agenda,
        "later": later,
    }

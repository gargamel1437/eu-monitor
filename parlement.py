"""Europees Parlement: agenda, debatten (met sprekers per fractie) en stemmingen.

Bronnen (gratis, openbaar):
- Open data van het Europees Parlement: https://data.europarl.europa.eu
- HowTheyVote.eu: hoe elke europarlementariër stemde."""

import json
import re
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

from bronnen import CACHE, ophalen_json

EP = "https://data.europarl.europa.eu/api/v2"
FMT = "format=application%2Fld%2Bjson"
HTV = "https://howtheyvote.eu/api"

PLAATSEN = {"FRA_SXB": "Straatsburg", "BEL_BRU": "Brussel"}
FRACTIES = {"EPP": "EVP", "SD": "S&D", "PFE": "PfE", "ECR": "ECR", "RENEW": "Renew",
            "GREEN_EFA": "Groenen", "GUE_NGL": "Links", "ESN": "ESN", "NI": "Niet-ingeschreven"}
VOLGORDE_FRACTIES = ["EVP", "S&D", "PfE", "ECR", "Renew", "Groenen", "Links", "ESN", "Niet-ingeschreven"]

PROCEDUREEL = re.compile(
    r"hervatting|redevoeringen van één minuut|opening van de|sluiting van de|notulen|agenda van de volgende|"
    r"samenstelling|stemverklaring|mededeling van de voorzitter|regeling van de werkzaamheden|ondertekening|"
    r"verificatie van geloofsbrieven|onderbreking|rectificatie|ingekomen stukken|kennisgeving|"
    r"teksten waarover het debat is gesloten|^stemmingen$|stemmingen \(|vragenuur$", re.I)


def schoon_label(label):
    label = re.sub(r"^\d+(\.\d+)*\.\s*", "", label or "")
    label = re.sub(r"\s*\((debat|stemming)\)\s*$", "", label)
    return re.sub(r"\s*\*+I*\s*", " ", label).strip()


def naam_mooi(voornaam, achternaam):
    achter = " ".join(w.capitalize() if not w.isupper() or len(w) > 1 else w for w in achternaam.lower().split())
    achter = re.sub(r"\b(Van|De|Der|Den|Het|Ten|Ter|In 'T)\b", lambda m: m.group(1).lower(), achter)
    return f"{voornaam} {achter}".strip()


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

def agenda_dag(dag):
    data = ophalen_json(f"{EP}/meetings/{dag['id']}/foreseen-activities?{FMT}&limit=500", 60).get("data", [])
    debatten, stemmen = [], []
    for x in data:
        label = (x.get("activity_label") or {})
        tekst = label.get("nl") or label.get("en") or ""
        soort = x.get("had_activity_type", "")
        if soort.endswith("PLENARY_DEBATE") and not PROCEDUREEL.search(tekst):
            debatten.append(schoon_label(tekst))
        elif soort.endswith("MEETING_PART") and "VOTE" in tekst.upper():
            tijd = (x.get("activity_start_date") or "")[11:16]
            if tijd:
                stemmen.append(tijd)
    return {**dag, "debatten": list(dict.fromkeys(debatten)), "stemmingen": sorted(set(stemmen)),
            "agenda_url": f"https://www.europarl.europa.eu/doceo/document/OJQ-10-{dag['datum']}_NL.html"}


# ---------- debatten (afgelopen zitting) ----------

def debatten_dag(dag, leden):
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
            for p in personen:
                sprekers[debat_id].append(p.rsplit("/", 1)[-1])
    uit = []
    for x in acts:
        if not (x.get("had_activity_type") or "").endswith("PLENARY_DEBATE"):
            continue
        label = (x.get("activity_label") or {})
        tekst = label.get("nl") or label.get("en") or ""
        if PROCEDUREEL.search(tekst):
            continue
        nr = re.search(r"ITM-(\d+)$", x["activity_id"])
        nummer = int(nr.group(1)) if nr else 0
        ids = list(dict.fromkeys(sprekers.get(x["id"], [])))
        fracties = Counter()
        nederlanders = []
        overig = 0
        for p in ids:
            lid = leden.get(p)
            if not lid:
                overig += 1
                continue
            fracties[lid["fractie"]] += 1
            if lid["land"] == "NL":
                nederlanders.append(f"{lid['naam']} ({lid['partij']})")
        uit.append({
            "sprekers": ids,
            "nummer": nummer, "titel": schoon_label(tekst), "datum": dag["datum"], "plaats": dag["plaats"],
            "verslag": f"https://www.europarl.europa.eu/doceo/document/CRE-10-{dag['datum']}-ITM-{nummer:03d}_NL.html",
            "fracties": [[f, fracties[f]] for f in VOLGORDE_FRACTIES if fracties.get(f)],
            "nederlanders": nederlanders, "overige_sprekers": overig,
            "sprekers_bekend": toespraken is not None,
        })
    uit.sort(key=lambda d: d["nummer"])
    # "… (voortzetting van het debat)" hoort bij hetzelfde debat: samenvoegen.
    samen = {}
    for d in uit:
        sleutel = re.sub(r"\s*\(voortzetting van het debat\)", "", d["titel"])
        if sleutel in samen:
            oud = samen[sleutel]
            telling = Counter(dict(oud["fracties"])) + Counter(dict(d["fracties"]))
            oud["fracties"] = [[f, telling[f]] for f in VOLGORDE_FRACTIES if telling.get(f)]
            oud["nederlanders"] = list(dict.fromkeys(oud["nederlanders"] + d["nederlanders"]))
            oud["overige_sprekers"] += d["overige_sprekers"]
            oud["sprekers"] = list(dict.fromkeys(oud["sprekers"] + d["sprekers"]))
        else:
            d["titel"] = sleutel
            samen[sleutel] = d
    return list(samen.values())


# ---------- alles samen ----------

def debatten_dag_cache(dag, leden):
    """Afgelopen dagen veranderen niet meer: bewaar ze. Sprekers-ID's houden we apart, zodat
    fracties en namen bij elke run met de nieuwste ledenlijst worden ingevuld."""
    pad = CACHE / "debatten" / f"{dag['datum']}.json"
    if pad.exists():
        ruw = json.loads(pad.read_text(encoding="utf-8"))
    else:
        ruw = debatten_dag(dag, {})
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

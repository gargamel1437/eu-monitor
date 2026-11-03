"""Stemmingen in het Europees Parlement via HowTheyVote.eu (gratis, openbaar).

Alle hoofdstemmingen van de laatste twee zittingen. Stemmingen veranderen niet meer,
dus elke stemming wordt één keer opgehaald en bewaard in data/stemmen/."""

import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import dossiers
from bronnen import CACHE, FRACTIES, naam_mooi, ophalen_json

HTV = "https://howtheyvote.eu/api"
MAP = CACHE / "stemmen"
PARTIJ_NAMEN = {"Independent": "Onafhankelijk"}


def meerderheid(telling):
    gestemd = {k: v for k, v in telling.items() if k != "DID_NOT_VOTE" and v}
    return max(gestemd, key=gestemd.get) if gestemd else None


def zittingen(aantal=2):
    data = ophalen_json(f"{HTV}/sessions?page_size=200")["results"]
    vandaag = date.today().isoformat()
    voorbij = [s for s in data if s["end_date"] < vandaag]
    return sorted(voorbij, key=lambda s: s["start_date"])[-aantal:]


def detail(stem_id):
    pad = MAP / f"{stem_id}.json"
    if pad.exists():
        return json.loads(pad.read_text(encoding="utf-8"))
    d = ophalen_json(f"{HTV}/votes/{stem_id}", 60)
    leden, nl = {}, []
    per_partij = {}
    for mv in d.get("member_votes", []):
        m = mv["member"]
        fractie = FRACTIES.get((m.get("group") or {}).get("code"), (m.get("group") or {}).get("short_label", "?"))
        land = (m.get("country") or {}).get("iso_alpha_2", "")
        partij = (m.get("national_party") or {}).get("short_label") or "?"
        partij = PARTIJ_NAMEN.get(partij, partij)
        leden[str(m["id"])] = {"naam": naam_mooi(m["first_name"], m["last_name"]), "fractie": fractie,
                               "land": land, "partij": partij}
        if land == "NL":
            nl.append({"id": str(m["id"]), "naam": leden[str(m["id"])]["naam"], "partij": partij,
                       "fractie": fractie, "positie": mv["position"]})
            per_partij.setdefault(partij, Counter())[mv["position"]] += 1
    per_fractie = {}
    for g in (d.get("stats") or {}).get("by_group", []):
        per_fractie[FRACTIES.get(g["group"]["code"], g["group"].get("short_label"))] = g["stats"]
    fractie_meerderheid = {f: meerderheid(st) for f, st in per_fractie.items()}
    partij_meerderheid = {p: meerderheid(c) for p, c in per_partij.items()}
    partij_fractie = {}
    for x in nl:
        partij_fractie.setdefault(x["partij"], Counter())[x["fractie"]] += 1
    afwijkers = []
    for p, pm in partij_meerderheid.items():
        fr = partij_fractie[p].most_common(1)[0][0]
        if pm and fractie_meerderheid.get(fr) and pm != fractie_meerderheid[fr]:
            afwijkers.append({"partij": p, "fractie": fr, "partij_stem": pm, "fractie_stem": fractie_meerderheid[fr]})
    for x in nl:
        pm = partij_meerderheid.get(x["partij"])
        fm = fractie_meerderheid.get(x["fractie"])
        x["anders_dan_partij"] = bool(pm and x["positie"] not in ("DID_NOT_VOTE", pm))
        x["anders_dan_fractie"] = bool(fm and x["positie"] not in ("DID_NOT_VOTE", fm))
    proc = d.get("procedure") or {}
    totaal = (d.get("stats") or {}).get("total", {})
    verwant = [{"id": r["id"], "wat": r.get("description") or "", "onderwerp": r.get("amendment_subject") or "",
                "nummer": r.get("amendment_number") or "", "uitslag": r.get("result")}
               for r in (d.get("related") or []) if not r.get("is_main")]
    uit = {
        "id": d["id"], "moment": d["timestamp"], "titel": d.get("display_title") or "",
        "beschrijving": d.get("description") or "", "uitslag": d.get("result"),
        "meerderheid": d.get("majority_type"), "totaal": totaal, "per_fractie": per_fractie,
        "nl_partijen": {p: dict(c) for p, c in per_partij.items()}, "nl_leden": nl,
        "nl_verdeeld": len({v for v in partij_meerderheid.values() if v}) > 1,
        "afwijkers": afwijkers,
        "procedure": proc.get("reference"), "procedure_titel": (proc.get("title") or "").replace("\n", " "),
        "terreinen": dossiers.terreinen([(s.get("code", ""), s.get("label", "")) for s in d.get("oeil_subjects") or []]),
        "commissies": [c.get("code") for c in d.get("responsible_committees") or []],
        "verwant": verwant, "url": f"https://howtheyvote.eu/votes/{d['id']}",
        "document": (d.get("document") or {}).get("url"), "referentie": d.get("reference"),
        "leden": leden,
    }
    MAP.mkdir(parents=True, exist_ok=True)
    pad.write_text(json.dumps(uit, ensure_ascii=False), encoding="utf-8")
    return uit


def alles(aantal_zittingen=2):
    zit = zittingen(aantal_zittingen)
    if not zit:
        return {"zittingen": [], "stemmen": [], "leden": {}}
    begin = zit[0]["start_date"]
    ids, pagina = [], 1
    while True:
        r = ophalen_json(f"{HTV}/votes?page_size=100&page={pagina}", 60)
        klaar = False
        for v in r["results"]:
            if v["timestamp"][:10] < begin:
                klaar = True
                break
            if v.get("is_main"):
                ids.append(v["id"])
        if klaar or not r.get("has_next") or pagina > 10:
            break
        pagina += 1
    with ThreadPoolExecutor(4) as pool:
        stemmen = list(pool.map(detail, ids))
    leden = {}
    for s in sorted(stemmen, key=lambda s: s["moment"]):
        leden.update(s.pop("leden", {}))
    for s in stemmen:
        s.pop("leden", None)
    stemmen.sort(key=lambda s: s["moment"], reverse=True)
    return {"zittingen": [{"begin": z["start_date"], "eind": z["end_date"]} for z in zit],
            "stemmen": stemmen, "leden": leden}

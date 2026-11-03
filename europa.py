#!/usr/bin/env python3
"""EU-monitor: bouwt de website in de map site/.

Uitgangspunt: alleen feiten met een bron. De site rangschikt niet en geeft geen oordeel;
volgorde en selectie kies je zelf met filters en sortering.

Wat er gebeurt:
1. Gegevens ophalen (elk onderdeel heeft zijn eigen bestand):
   eu_nieuws.py (nieuws), stemmingen.py (HowTheyVote.eu), parlement.py (agenda en debatten),
   dossiers.py (alle procedures, via de open data van het Parlement en OEIL),
   raad.py (vergaderingen van de Raad en EU-toppen, via het EU-voorzitterschap) en
   commissie.py (de planning van de Commissie, via Geef uw mening).
2. Gegevens samenvoegen tot kleine JSON-bestanden in site/data/, die de pagina per tabblad
   pas inlaadt als je dat tabblad opent (sneller op de iPhone).
3. De pagina zelf maken uit onderdelen/: sjabloon.html, stijl.css en de scripts in onderdelen/js/.

Gratis, zonder AI. Staat volledig los van ~/nieuws. Zie LEESMIJ.md."""

import html
import hashlib
import json
import os
import re
import shutil
from collections import Counter
from datetime import date, datetime, timedelta, timezone

import commissie
import dossiers
import eu_nieuws
import parlement
import raad
import stemmingen
from bronnen import DAGEN, MAANDEN, MAP, met_cache

ONDERDELEN = MAP / "onderdelen"
SITE = MAP / "site"
AFGEROND_TONEN_DAGEN = 183          # afgeronde dossiers van het afgelopen halfjaar tonen
UPDATE_TIJDEN = ["07:15", "12:15", "18:15"]   # Nederlandse tijd, zie .github/workflows/europa.yml
JS_VOLGORDE = ["basis", "panelen", "nieuws", "dossiers", "stemmingen", "mensen", "agenda", "overzicht", "start"]
FRACTIE_BEGRIP = {"EVP": "EVP", "S&D": "S&D", "PfE": "PfE", "ECR": "ECR", "Renew Europe": "Renew",
                  "Groenen/EVA": "Groenen", "Links": "Links", "ESN": "ESN", "Niet-ingeschreven": "Niet-ingeschreven"}


def e(t):
    return html.escape(str(t if t is not None else ""), quote=True)


def js(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def moment(m):
    return m.replace("T", " ")[:16] if m else ""


# ---------- gegevens ophalen ----------

def dossiers_ophalen(eigen_refs):
    """Werkt de dossiers bij. Is de bron niet bereikbaar, dan de bewaarde versie."""
    snel = bool(os.environ.get("EU_ALLEEN_CACHE"))
    try:
        if snel:
            raise RuntimeError("alleen bewaarde gegevens gebruikt")
        lijst, _, fouten, rest = dossiers.bijwerken(extra=eigen_refs)
        fout = f"{len(fouten)} dossiers konden niet worden opgehaald" if fouten else None
        if rest:
            fout = (fout + "; " if fout else "") + f"{rest} dossiers nog niet opgehaald (volgt bij de volgende runs)"
        return lijst, fout, False
    except Exception as ex:
        lijst = []
        for pad in sorted(dossiers.MAP_DOSSIERS.glob("*.json")):
            try:
                d = json.loads(pad.read_text(encoding="utf-8"))
            except Exception:
                continue
            if not d.get("onbekend"):
                lijst.append(d)
        return lijst, None if snel else f"bron niet bereikbaar ({ex}); bewaarde versie gebruikt", not snel


# ---------- gegevens samenvoegen voor de pagina ----------

def stem_kort(s):
    return {"id": s["id"], "moment": s["moment"], "titel": s["titel"], "uitslag": s["uitslag"],
            "totaal": s["totaal"], "nl_partijen": s["nl_partijen"]}


def pagina_dossiers(alle, eigen, stemmen):
    grens = (date.today() - timedelta(days=AFGEROND_TONEN_DAGEN)).isoformat()
    per_ref = {}
    for s in stemmen:
        if s.get("procedure"):
            per_ref.setdefault(s["procedure"], []).append(stem_kort(s))
    uit = []
    for d in alle:
        if d.get("afgerond") and d.get("laatst", "") < grens and d["ref"] not in eigen:
            continue
        d = {k: v for k, v in d.items() if k not in ("status_en", "oeil_wijziging")}
        d["soort_naam"] = dossiers.SOORTEN.get(d["soort"], d["soort"])
        d["commissaris"] = dossiers.mooie_naam(d.get("commissaris"))
        d["stemmen"] = per_ref.get(d["ref"], [])
        if d["ref"] in eigen:
            d["eigen"] = {k: v for k, v in eigen[d["ref"]].items() if k != "procedure"}
        uit.append(d)
    uit.sort(key=lambda d: d.get("laatst", ""), reverse=True)
    return uit


def dossiers_kort(lijst):
    """Klein overzicht voor het tabblad Overzicht (laatste stappen en zoeken)."""
    uit = []
    for d in lijst:
        g = (d.get("gebeurtenissen") or [{}])[-1]
        uit.append({"ref": d["ref"], "titel": (d.get("eigen") or {}).get("titel") or d["titel"], "status": d["status"],
                    "laatst": d.get("laatst", ""), "stap": g.get("wat", ""), "afgerond": d.get("afgerond", False),
                    "zoek": " ".join(r["naam"] for c in d.get("commissies", []) for r in c.get("rapporteurs", []))})
    return uit


def ics_maken(titel, datum, begin="", eind="", eind_datum="", uitleg="", url=""):
    """Schrijft een agenda-afspraak naar site/ics/<code>.ics en geeft het pad terug.
    Een gewone link naar zo'n bestand opent op de iPhone meteen 'Zet in agenda', ook in de web-app.
    Met tijden (uit de bron) een afspraak met begin en eind, anders een hele dag."""
    code = hashlib.sha1(f"{titel}|{datum}|{begin}".encode()).hexdigest()[:12]

    def v(t):
        return str(t).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

    def utc(t):
        return datetime.fromisoformat(t).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    if begin:
        tot = eind or (datetime.fromisoformat(begin) + timedelta(hours=1)).isoformat()
        tijd = ["DTSTART:" + utc(begin), "DTEND:" + utc(tot)]
    else:
        einde = date.fromisoformat(eind_datum or datum) + timedelta(days=1)
        tijd = ["DTSTART;VALUE=DATE:" + datum.replace("-", ""), "DTEND;VALUE=DATE:" + einde.strftime("%Y%m%d")]
    regels = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EU-monitor//NL", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
              f"UID:{code}@eu-monitor", "DTSTAMP:" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"), *tijd,
              "SUMMARY:" + v(titel), "DESCRIPTION:" + v((uitleg + "\n" if uitleg else "") + (url or ""))]
    if url:
        regels.append("URL:" + url)
    regels += ["END:VEVENT", "END:VCALENDAR"]

    def vouw(r):   # regels van hoogstens 75 tekens, zoals de standaard vraagt
        stukken = [r[:73]] + [" " + r[i:i + 72] for i in range(73, len(r), 72)]
        return "\r\n".join(stukken)
    (SITE / "ics").mkdir(exist_ok=True)
    (SITE / "ics" / f"{code}.ics").write_text("\r\n".join(vouw(r) for r in regels) + "\r\n", encoding="utf-8")
    return f"ics/{code}.ics"


def agenda_items(p, lijst, vergaderingen):
    """Komende 4 weken: plenaire vergaderingen, vergaderingen van de Raad, EU-toppen en geplande
    dossierstappen uit OEIL. Een dossier dat volgens OEIL in een Raadsvergadering wordt besproken,
    komt bij die vergadering te staan (en niet nog eens apart); een dossier dat OEIL in een
    plenaire zitting verwacht, staat bij die zitting. Elk item krijgt een .ics-bestand."""
    nu = date.today().isoformat()
    grens = (date.today() + timedelta(days=28)).isoformat()
    uit = []
    plenair = []
    for dag in p.get("agenda", []):
        blokken = dag.get("blokken", [])
        item = {"datum": dag["datum"], "soort": "Plenaire vergadering", "titel": f"Plenaire vergadering in {dag['plaats']}",
                "punten": dag["debatten"], "blokken": blokken, "begin": dag.get("begin", ""), "eind": dag.get("eind", ""),
                "extra": ("Stemmingen om " + ", ".join(dag["stemmingen"])) if dag["stemmingen"] and not blokken else "",
                "url": dag["agenda_url"]}
        uit.append(item)
        plenair.append(item)
    raad_items = []
    for v in vergaderingen:
        eind = v.get("eind", v["datum"])
        if eind < nu or v["datum"] > grens:
            continue
        item = {"datum": max(v["datum"], nu) if eind >= nu > v["datum"] else v["datum"], "soort": v["soort"], "titel": v["titel"],
                "punten": [], "extra": " · ".join(x for x in [v.get("plaats", ""), ("tot en met " + datum_nl(eind)) if v.get("eind") else "",
                                                              "informeel, er worden geen besluiten genomen" if v.get("informeel") else ""] if x),
                "url": v["url"], "en": v.get("titel_en", ""), "eind_datum": v.get("eind", "")}
        uit.append(item)
        if v["soort"] == "Raad":
            raad_items.append(item)

    def zitting_bij(datum):
        """De plenaire vergaderdag waar een verwachte behandeling bij hoort: dezelfde dag, of anders
        de eerste dag van de zitting die rond die datum valt (OEIL noemt vaak de maandag)."""
        d = date.fromisoformat(datum)
        kandidaten = [i for i in plenair if -1 <= (date.fromisoformat(i["datum"]) - d).days <= 4]
        return next((i for i in kandidaten if i["datum"] == datum), kandidaten[0] if kandidaten else None)

    for d in lijst:
        titel = (d.get("eigen") or {}).get("titel") or d["titel"]
        for v in d.get("vooruit", []):
            if nu <= v["datum"] <= grens:
                zitting = zitting_bij(v["datum"]) if v["wat"] == "Verwachte plenaire behandeling" else None
                if zitting is not None:
                    if d["ref"] not in {x["ref"] for x in zitting.setdefault("dossiers", [])}:
                        zitting["dossiers"].append({"ref": d["ref"], "titel": titel})
                    continue
                soort = "Parlementscommissie" if "commissie" in v["wat"].lower() else "Dossierstap"
                uit.append({"datum": v["datum"], "soort": soort, "titel": f"{v['wat']}: {titel}", "ref": d["ref"], "url": d["url"]})
        for r in d.get("raad", []):
            if nu <= r["datum"] <= grens:
                sleutel = re.sub(r"\s*\(.*$|\s+ECOFIN$", "", r["configuratie"]).split(",")[0].strip().lower()
                bij = [i for i in raad_items if i["datum"] == r["datum"] and sleutel and i["en"].lower().startswith(sleutel)]
                if bij:
                    bij[0]["punten"].append(f"{titel} ({d['ref']})")
                else:
                    uit.append({"datum": r["datum"], "soort": "Raad", "titel": f"Raad ({r['configuratie']}): {titel}", "ref": d["ref"], "url": d["url"]})
    for i in uit:
        i.pop("en", None)
        i.setdefault("dossiers", [])
        i["dossiers"].sort(key=lambda x: x["titel"])
        uitleg = "\n".join(i.get("punten", []) + [x["titel"] + " (" + x["ref"] + ")" for x in i["dossiers"]])
        i["ics"] = ics_maken(i["titel"], i["datum"], i.get("begin", ""), i.get("eind", ""), i.pop("eind_datum", ""), uitleg, i.get("url", ""))
        for k in ("dossiers", "blokken", "begin", "eind"):
            if not i.get(k):
                i.pop(k, None)
    volgorde = {"EU-top": 0, "Plenaire vergadering": 1, "Raad": 2, "Parlementscommissie": 3, "Dossierstap": 4}
    uit.sort(key=lambda i: (i["datum"], volgorde[i["soort"]], i.get("begin", ""), i["titel"]))
    toppen = [{"datum": v["datum"], "eind": v.get("eind", ""), "titel": v["titel"], "plaats": v.get("plaats", ""), "url": v["url"]}
              for v in vergaderingen if v["soort"] == "EU-top" and v["datum"] > grens]
    return {"items": uit, "later": p.get("later", [])[:1], "toppen_later": toppen[:2]}


def dossier_ics(lijst):
    """Een .ics-bestand bij elke geplande stap van een dossier (knop ＋ Agenda in het dossier)."""
    nu = date.today().isoformat()
    for d in lijst:
        titel = (d.get("eigen") or {}).get("titel") or d["titel"]
        for v in d.get("vooruit", []):
            if v["datum"] >= nu:
                v["ics"] = ics_maken(f"{v['wat']}: {titel}", v["datum"], uitleg=d["ref"], url=d.get("url", ""))


def datum_nl(s):
    d = date.fromisoformat(s)
    return f"{DAGEN[d.weekday()]} {d.day} {MAANDEN[d.month - 1]}"


def mensen(leden, lijst, debatten, stemmen, posities):
    """Alle europarlementariërs: rollen in dossiers, debatten en hoe ze stemden.
    Stemgedrag kort per persoon: één letter per stemming in de volgorde van 'stemvolgorde'
    (v voor, t tegen, o onthouden, g niet gestemd, - nog geen lid), plus de nummers van de
    stemmingen waarin iemand anders stemde dan zijn nationale partij (ap) of fractie (af)."""
    m = {pid: {"id": pid, "naam": l["naam"], "partij": l["partij"], "fractie": l["fractie"], "land": l["land"],
               "rap": [], "schaduw": [], "debatten": []} for pid, l in leden.items()}

    def persoon(p):
        if p["id"] not in m:
            m[p["id"]] = {"id": p["id"], "naam": p["naam"], "partij": "", "land": "",
                          "fractie": dossiers.FRACTIE_OEIL.get(p["fractie"], p["fractie"]),
                          "rap": [], "schaduw": [], "debatten": []}
        return m[p["id"]]

    # Rollen als [procedurenummer, parlementscommissie, afgerond]; de titel staat in dossiers-kort.json.
    for d in lijst:
        for c in d.get("commissies", []):
            for r in c.get("rapporteurs", []):
                persoon(r)["rap"].append([d["ref"], c["code"], int(d.get("afgerond", False))])
        for r in d.get("schaduw", []):
            persoon(r)["schaduw"].append([d["ref"], r.get("commissie", ""), int(d.get("afgerond", False))])
    for i, x in enumerate(debatten):
        for pid in x.get("sprekers", []):
            if pid in m:
                m[pid]["debatten"].append(i)
    volgorde = [s["id"] for s in stemmen]
    for p in m.values():
        p["st"], p["ap"], p["af"] = "", [], []
    for n, s in enumerate(stemmen):
        pos = posities.get(str(s["id"])) or posities.get(s["id"]) or {}
        # meerderheid per fractie (uit de cijfers van HowTheyVote) en per nationale partij
        fm = {f: stemmingen.meerderheid(c) for f, c in (s.get("per_fractie") or {}).items()}
        per_partij = {}
        for pid, x in pos.items():
            l = leden.get(pid)
            if l and x != "g":
                per_partij.setdefault((l["land"], l["partij"]), Counter())[x] += 1
        pm = {k: c.most_common(1)[0][0] for k, c in per_partij.items() if c}
        kort_naar = {"FOR": "v", "AGAINST": "t", "ABSTENTION": "o"}
        for pid, p in m.items():
            x = pos.get(pid)
            p["st"] += x or "-"
            if not x or x == "g" or pid not in leden:
                continue
            l = leden[pid]
            if l["partij"] not in ("?", "Onafhankelijk") and pm.get((l["land"], l["partij"])) not in (None, x):
                p["ap"].append(n)
            if kort_naar.get(fm.get(l["fractie"])) not in (None, x):
                p["af"].append(n)
    for p in m.values():
        if set(p["st"]) <= {"-"}:
            p["st"] = ""
    return {"stemvolgorde": volgorde, "mensen": list(m.values())}


def begrippen(leden):
    """Uitleg bij begrippen; bij fracties vullen we de Nederlandse partijen automatisch in uit de ledenlijst."""
    lijst = json.loads((ONDERDELEN / "begrippen.json").read_text(encoding="utf-8"))
    per = {}
    for l in leden.values():
        if l.get("land") == "NL":
            per.setdefault(l["fractie"], Counter())[l["partij"]] += 1
    for b in lijst:
        f = FRACTIE_BEGRIP.get(b["term"])
        if not f or not leden:
            continue
        tekst = re.sub(r"\s*(Nederlandse (partij(en)?|leden nu):.*|Er zitten (nu )?geen Nederlandse (partijen|leden) in\.)$", "", b["uitleg"]).strip()
        p = per.get(f)
        b["uitleg"] = tekst + (" Nederlandse leden nu: " + ", ".join(f"{k} ({v})" for k, v in sorted(p.items())) + "."
                               if p else " Er zitten nu geen Nederlandse leden in.")
    return lijst


# ---------- pagina ----------

# ---------- persberichten koppelen aan dossiers ----------

STOPWOORDEN = set("""about above after again against among amending regulation directive decision council european
union parliament commission member states state proposal framework their there these those which would should
under other between within through towards common rules measures certain union's amendment amendments
following regarding concerning provisions establishing period programme""".split())
PROC = re.compile(r"\b(\d{4})/(\d{4})\((COD|CNS|APP|NLE|INI|RSP|BUD|DEC|INL|ACI|AVC|DCE|IMM|REG|RPS|SYN|COS)\)")
COM = re.compile(r"COM\s*\(\s*(\d{4})\s*\)\s*(\d{1,4})")


def woorden(tekst):
    return {w for w in re.findall(r"[a-z]{5,}", (tekst or "").lower()) if w not in STOPWOORDEN}


def pers_koppelen(lijst, officieel):
    """Zet bij elk dossier de officiële berichten die erover gaan, met hoe de koppeling gemaakt is:
    - 'procedurenummer': het nummer (bijv. 2026/0336(COD)) staat in het bericht;
    - 'COM-document': het nummer van het Commissievoorstel (bijv. COM(2026) 730) staat in het bericht;
    - 'eigen bron': het bericht staat als bron in wetgeving.json;
    - 'trefwoorden': kop en begin van het bericht delen minstens 3 kenmerkende woorden met de
      dossiertitel, en dat is minstens de helft van de kenmerkende woorden in die titel."""
    com_index, ref_index = {}, {d["ref"]: d for d in lijst}
    for d in lijst:
        for doc in d.get("documenten", []):
            m = re.match(r"COM\((\d{4})\)0*(\d+)", doc.get("ref", ""))
            if m:
                com_index[(m.group(1), m.group(2))] = d
    titelwoorden = [(d, woorden(d["titel"])) for d in lijst if not d.get("afgerond")]
    titelwoorden = [(d, w) for d, w in titelwoorden if len(w) >= 3]
    aantal = 0
    for b in officieel:
        tekst = f"{b['titel']} {b['tekst']}"
        n = eu_nieuws.persnummer(b["link"])
        gevonden = {}
        for m in PROC.finditer(tekst):
            d = ref_index.get(m.group(0))
            if d:
                gevonden[d["ref"]] = "procedurenummer"
        for m in COM.finditer(tekst):
            d = com_index.get((m.group(1), m.group(2).lstrip("0")))
            if d:
                gevonden.setdefault(d["ref"], "COM-document")
        for d in lijst:
            for _, url in (d.get("eigen") or {}).get("links", []):
                if n and eu_nieuws.persnummer(url) == n:
                    gevonden.setdefault(d["ref"], "eigen bron")
        bw = woorden(tekst)
        if bw:
            for d, w in titelwoorden:
                gedeeld = w & bw
                if len(gedeeld) >= 3 and len(gedeeld) * 2 >= len(w):
                    gevonden.setdefault(d["ref"], "trefwoorden")
        for ref, hoe in gevonden.items():
            ref_index[ref].setdefault("pers", []).append(
                {"titel": b["titel"], "link": b["link"], "bron": b["bron"], "soort": b.get("soort") or "",
                 "datum": b["datum"].date().isoformat(), "hoe": hoe})
            aantal += 1
    return aantal


def script():
    delen = [(ONDERDELEN / "js" / f"{n}.js").read_text(encoding="utf-8") for n in JS_VOLGORDE]
    return "(function () {\n\"use strict\";\n" + "\n".join(delen) + "\n})();\n"


def schrijf_json(naam, obj):
    (SITE / "data" / f"{naam}.json").write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    nu = datetime.now().astimezone()
    meta = {"bijgewerkt": nu.strftime("%Y-%m-%d %H:%M"), "updates": UPDATE_TIJDEN}
    meldingen = []

    nieuws, nieuws_fouten = eu_nieuws.berichten()
    media = [b for b in nieuws if b["kanaal"] == "media"]
    officieel = [b for b in nieuws if b["kanaal"] == "officieel"]
    if nieuws_fouten:
        meldingen.append("Niet alle nieuwsbronnen werkten: " + "; ".join(nieuws_fouten))

    st, st_fout, st_oud = met_cache("stemmingen", stemmingen.alles)
    st = st or {"zittingen": [], "stemmen": [], "leden": {}}
    meta["stemmen"] = {"moment": moment(st_oud) if st_fout else meta["bijgewerkt"], "oud": bool(st_fout)}
    if st_fout:
        meldingen.append("Stemmingen: ophalen lukte nu niet." + (f" Je ziet de versie van {moment(st_oud)}." if st_oud else ""))

    p, p_fout, p_oud = met_cache("parlement", lambda: parlement.alles(st["leden"]))
    p = p or {"debatten": [], "agenda": [], "zittingen": [], "later": []}
    meta["parlement"] = {"moment": moment(p_oud) if p_fout else meta["bijgewerkt"], "oud": bool(p_fout)}
    if p_fout:
        meldingen.append("Agenda en debatten: ophalen lukte nu niet." + (f" Je ziet de versie van {moment(p_oud)}." if p_oud else ""))

    vg, vg_fout, vg_oud = met_cache("raad", raad.vergaderingen)
    meta["raad"] = {"moment": moment(vg_oud) if vg_fout else meta["bijgewerkt"], "oud": bool(vg_fout)}
    if vg_fout:
        meldingen.append("Raad en EU-toppen: ophalen lukte nu niet." + (f" Je ziet de versie van {moment(vg_oud)}." if vg_oud else ""))

    cp, cp_fout, cp_oud = met_cache("commissie", commissie.planning)
    meta["commissie"] = {"moment": moment(cp_oud) if cp_fout else meta["bijgewerkt"], "oud": bool(cp_fout)}
    if cp_fout:
        meldingen.append("Planning van de Commissie: ophalen lukte nu niet." + (f" Je ziet de versie van {moment(cp_oud)}." if cp_oud else ""))

    eigen = {w["procedure"]: w for w in json.loads((MAP / "wetgeving.json").read_text(encoding="utf-8"))}
    alle, d_fout, d_oud = dossiers_ophalen(list(eigen))
    meta["dossiers"] = {"moment": meta["bijgewerkt"], "oud": d_oud}
    if d_fout:
        meldingen.append("Dossiers: " + d_fout + ".")

    lijst = pagina_dossiers(alle, eigen, st["stemmen"])
    gekoppeld = pers_koppelen(lijst, officieel)
    in_dossiers = {d["ref"] for d in lijst}
    for s in st["stemmen"]:
        s["in_dossiers"] = s.get("procedure") in in_dossiers

    # ---- schrijven ----
    if SITE.exists():
        shutil.rmtree(SITE)
    (SITE / "data").mkdir(parents=True)
    for f in (MAP / "web").iterdir():
        shutil.copy(f, SITE / f.name)
    dossier_ics(lijst)
    schrijf_json("dossiers", lijst)
    schrijf_json("dossiers-kort", dossiers_kort(lijst))
    schrijf_json("stemmen", {"zittingen": st["zittingen"], "stemmen": st["stemmen"]})
    schrijf_json("agenda", agenda_items(p, lijst, vg or []))
    schrijf_json("commissie", cp or {"items": [], "bekend": 0, "huidig": ""})
    schrijf_json("debatten", {"zittingen": p.get("zittingen", []),
                              "debatten": [{k: v for k, v in x.items() if k != "sprekers"} for x in p.get("debatten", [])]})
    schrijf_json("mensen", mensen(st["leden"], lijst, p.get("debatten", []), st["stemmen"], st.get("posities", {})))

    terrein_namen = [n for n, _ in eu_nieuws.TERREINEN] + ["Overig"]
    vervang = {
        "{{STIJL}}": (ONDERDELEN / "stijl.css").read_text(encoding="utf-8"),
        "{{MELDINGEN}}": "".join(f'<div class="melding">{e(m)}</div>' for m in meldingen),
        "{{BIJGEWERKT}}": f"{DAGEN[nu.weekday()]} {nu.day} {MAANDEN[nu.month - 1]}, {nu:%H:%M}",
        "{{NIEUWS_MEDIA}}": eu_nieuws.nieuws_html(media),
        "{{NIEUWS_OFFICIEEL}}": eu_nieuws.nieuws_html(officieel),
        "{{TERREIN_KNOPPEN}}": eu_nieuws.knoppen_html(nieuws, "terreinen", terrein_namen),
        "{{BRON_KNOPPEN_MEDIA}}": eu_nieuws.knoppen_html(media, "bron", [b for b in eu_nieuws.BRONNEN if b not in eu_nieuws.OFFICIEEL]),
        "{{BRON_KNOPPEN_OFFICIEEL}}": eu_nieuws.knoppen_html(officieel, "bron", [b for b in eu_nieuws.BRONNEN if b in eu_nieuws.OFFICIEEL]),
        "{{AANTAL}}": str(len(nieuws)),
        "{{AANTAL_MEDIA}}": str(len(media)),
        "{{AANTAL_OFFICIEEL}}": str(len(officieel)),
        "{{BRONNEN}}": (ONDERDELEN / "bronnen.html").read_text(encoding="utf-8"),
        "{{BEGRIPPEN}}": js(begrippen(st["leden"])),
        "{{DATA_META}}": js(meta),
        "{{APP}}": script(),
    }
    pagina = (ONDERDELEN / "sjabloon.html").read_text(encoding="utf-8")
    for sleutel, waarde in vervang.items():
        pagina = pagina.replace(sleutel, waarde)
    (SITE / "index.html").write_text(pagina, encoding="utf-8")

    grootte = sum(f.stat().st_size for f in SITE.rglob("*") if f.is_file()) // 1024
    print(f"{nu:%Y-%m-%d %H:%M} — {len(nieuws)} berichten, {len(lijst)} dossiers ({len(alle)} bekend), "
          f"{len(st['stemmen'])} stemmingen, {len(p.get('debatten', []))} debatten, {gekoppeld} persberichten aan dossiers gekoppeld; pagina "
          f"{(SITE / 'index.html').stat().st_size // 1024} kB, alles samen {grootte} kB"
          + (f" | {' | '.join(meldingen)}" if meldingen else ""))


if __name__ == "__main__":
    main()

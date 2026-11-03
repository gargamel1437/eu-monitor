#!/usr/bin/env python3
"""EU-monitor: bouwt de website in de map site/.

Uitgangspunt: alleen feiten met een bron. De site rangschikt niet en geeft geen oordeel;
volgorde en selectie kies je zelf met filters en sortering.

Wat er gebeurt:
1. Gegevens ophalen (elk onderdeel heeft zijn eigen bestand):
   eu_nieuws.py (nieuws), stemmingen.py (HowTheyVote.eu), parlement.py (agenda en debatten),
   dossiers.py (alle procedures, via de open data van het Parlement en OEIL).
2. Gegevens samenvoegen tot kleine JSON-bestanden in site/data/, die de pagina per tabblad
   pas inlaadt als je dat tabblad opent (sneller op de iPhone).
3. De pagina zelf maken uit onderdelen/: sjabloon.html, stijl.css en de scripts in onderdelen/js/.

Gratis, zonder AI. Staat volledig los van ~/nieuws. Zie LEESMIJ.md."""

import html
import json
import os
import re
import shutil
from collections import Counter
from datetime import date, datetime, timedelta

import dossiers
import eu_nieuws
import parlement
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
    """Klein overzicht voor het tabblad Overzicht (volglijst, gewijzigd sinds vorig bezoek, zoeken)."""
    uit = []
    for d in lijst:
        g = (d.get("gebeurtenissen") or [{}])[-1]
        uit.append({"ref": d["ref"], "titel": (d.get("eigen") or {}).get("titel") or d["titel"], "status": d["status"],
                    "laatst": d.get("laatst", ""), "stap": g.get("wat", ""), "afgerond": d.get("afgerond", False),
                    "zoek": " ".join(r["naam"] for c in d.get("commissies", []) for r in c.get("rapporteurs", []))})
    return uit


def agenda_items(p, lijst):
    """Komende 4 weken: plenaire vergaderingen plus geplande dossierstappen uit OEIL."""
    nu = date.today().isoformat()
    grens = (date.today() + timedelta(days=28)).isoformat()
    uit = []
    for dag in p.get("agenda", []):
        uit.append({"datum": dag["datum"], "soort": "Plenaire vergadering", "titel": f"Plenaire vergadering in {dag['plaats']}",
                    "punten": dag["debatten"], "extra": ("Stemmingen om " + ", ".join(dag["stemmingen"])) if dag["stemmingen"] else "",
                    "url": dag["agenda_url"]})
    for d in lijst:
        titel = (d.get("eigen") or {}).get("titel") or d["titel"]
        for v in d.get("vooruit", []):
            if nu <= v["datum"] <= grens:
                soort = "Parlementscommissie" if "commissie" in v["wat"].lower() else "Dossierstap"
                uit.append({"datum": v["datum"], "soort": soort, "titel": f"{v['wat']}: {titel}", "ref": d["ref"], "url": d["url"]})
        for r in d.get("raad", []):
            if nu <= r["datum"] <= grens:
                uit.append({"datum": r["datum"], "soort": "Raad", "titel": f"Raad ({r['configuratie']}): {titel}", "ref": d["ref"], "url": d["url"]})
    volgorde = {"Plenaire vergadering": 0, "Raad": 1, "Parlementscommissie": 2, "Dossierstap": 3}
    uit.sort(key=lambda i: (i["datum"], volgorde[i["soort"]], i["titel"]))
    return {"items": uit, "later": p.get("later", [])[:1]}


def mensen(leden, lijst, debatten, stemmen):
    """Per europarlementariër: rollen in dossiers, debatten en (voor Nederlanders) stemgedrag."""
    m = {pid: {"id": pid, "naam": l["naam"], "partij": l["partij"], "fractie": l["fractie"], "land": l["land"],
               "rap": [], "schaduw": [], "debatten": [], "stemmen": []} for pid, l in leden.items()}

    def persoon(p):
        if p["id"] not in m:
            m[p["id"]] = {"id": p["id"], "naam": p["naam"], "partij": "", "land": "",
                          "fractie": dossiers.FRACTIE_OEIL.get(p["fractie"], p["fractie"]),
                          "rap": [], "schaduw": [], "debatten": [], "stemmen": []}
        return m[p["id"]]

    # Rollen als [procedurenummer, parlementscommissie, afgerond]; de titel staat in dossiers-kort.json.
    for d in lijst:
        for c in d.get("commissies", []):
            for r in c.get("rapporteurs", []):
                persoon(r)["rap"].append([d["ref"], c["code"], int(d.get("afgerond", False))])
        for r in d.get("schaduw", []):
            persoon(r)["schaduw"].append([d["ref"], r.get("commissie", ""), int(d.get("afgerond", False))])
    # Debatten en stemmingen als verwijzing (nummer in debatten.json, id in stemmen.json): dat houdt het bestand klein.
    for i, x in enumerate(debatten):
        for pid in x.get("sprekers", []):
            if pid in m:
                m[pid]["debatten"].append(i)
    for s in stemmen:
        for l in s.get("nl_leden", []):
            if l["id"] in m:
                m[l["id"]]["stemmen"].append([s["id"], l["positie"], int(l["anders_dan_partij"]), int(l["anders_dan_fractie"])])
    # Niet-Nederlanders zonder rol of debat laten we weg: dat scheelt veel en ze hebben hier geen gegevens.
    return [p for p in m.values() if p["land"] == "NL" or p["rap"] or p["schaduw"] or p["debatten"]]


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

def nieuws_blokken(media, officieel):
    def regel(b):
        return (f'<li><a href="{e(b["link"])}" target="_blank" rel="noopener"><div class="regel">{e(b["titel"])}</div>'
                f'<div class="meta2"><span>{e(b["bron"])}</span>' + (f'<span>{e(b["soort"])}</span>' if b.get("soort") else "")
                + f'<span>{b["datum"]:%d-%m %H:%M}</span>'
                + ('<span class="label voorstel">Voorstel</span>' if b["voorstel"] else "")
                + ('<span class="label taal">EN</span>' if b["taal"] == "en" else "") + "</div></a></li>")
    uit = []
    if media:
        uit.append('<div class="kop-met-link"><h2>Nieuws uit de media</h2><a href="#nieuws">Alles</a></div>'
                   f'<div class="kaart"><ul class="lijst">{"".join(regel(b) for b in media[:5])}</ul></div>')
    if officieel:
        uit.append('<div class="kop-met-link"><h2>Uit Brussel zelf</h2><a href="#nieuws">Alles</a></div>'
                   '<p class="intro"><span class="label officieel">Officieel</span> Persberichten van de Commissie en de Raad.</p>'
                   f'<div class="kaart"><ul class="lijst officieel">{"".join(regel(b) for b in officieel[:4])}</ul></div>')
    return "\n".join(uit)


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

    eigen = {w["procedure"]: w for w in json.loads((MAP / "wetgeving.json").read_text(encoding="utf-8"))}
    alle, d_fout, d_oud = dossiers_ophalen(list(eigen))
    meta["dossiers"] = {"moment": meta["bijgewerkt"], "oud": d_oud}
    if d_fout:
        meldingen.append("Dossiers: " + d_fout + ".")

    lijst = pagina_dossiers(alle, eigen, st["stemmen"])
    in_dossiers = {d["ref"] for d in lijst}
    for s in st["stemmen"]:
        s["in_dossiers"] = s.get("procedure") in in_dossiers

    # ---- schrijven ----
    if SITE.exists():
        shutil.rmtree(SITE)
    (SITE / "data").mkdir(parents=True)
    for f in (MAP / "web").iterdir():
        shutil.copy(f, SITE / f.name)
    schrijf_json("dossiers", lijst)
    schrijf_json("dossiers-kort", dossiers_kort(lijst))
    schrijf_json("stemmen", {"zittingen": st["zittingen"], "stemmen": st["stemmen"]})
    schrijf_json("agenda", agenda_items(p, lijst))
    schrijf_json("debatten", {"zittingen": p.get("zittingen", []),
                              "debatten": [{k: v for k, v in x.items() if k != "sprekers"} for x in p.get("debatten", [])]})
    schrijf_json("mensen", mensen(st["leden"], lijst, p.get("debatten", []), st["stemmen"]))

    terrein_namen = [n for n, _ in eu_nieuws.TERREINEN] + ["Overig"]
    vervang = {
        "{{STIJL}}": (ONDERDELEN / "stijl.css").read_text(encoding="utf-8"),
        "{{MELDINGEN}}": "".join(f'<div class="melding">{e(m)}</div>' for m in meldingen),
        "{{BIJGEWERKT}}": f"{DAGEN[nu.weekday()]} {nu.day} {MAANDEN[nu.month - 1]}, {nu:%H:%M}",
        "{{OV_NIEUWS}}": nieuws_blokken(media, officieel),
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
          f"{len(st['stemmen'])} stemmingen, {len(p.get('debatten', []))} debatten; pagina "
          f"{(SITE / 'index.html').stat().st_size // 1024} kB, alles samen {grootte} kB"
          + (f" | {' | '.join(meldingen)}" if meldingen else ""))


if __name__ == "__main__":
    main()

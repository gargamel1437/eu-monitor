#!/usr/bin/env python3
"""EU-monitor: bouwt index.html, een werkinstrument voor EU-journalistiek.

Uitgangspunt: alleen feiten met een bron. De site rangschikt niet en geeft geen oordeel;
volgorde en selectie kies je zelf met filters en sortering.

Onderdelen:
- eu_nieuws.py   nieuws uit RSS (media en officiële EU-communicatie apart)
- dossiers.py    alle lopende procedures (open data van het Parlement en OEIL)
- stemmingen.py  hoofdstemmingen van de laatste twee zittingen (HowTheyVote.eu)
- parlement.py   agenda (4 weken) en debatten (laatste drie zittingen)
- wetgeving.json eigen samenvattingen bij enkele dossiers, met bron
- onderdelen/    sjabloon, stijl, script, begrippen, bronnenpagina

Gratis, zonder AI. Staat volledig los van ~/nieuws."""

import html
import json
import os
from datetime import date, datetime, timedelta

import dossiers
import eu_nieuws
import parlement
import stemmingen
from bronnen import MAP, met_cache

ONDERDELEN = MAP / "onderdelen"
UITVOER = MAP / "index.html"
MAANDEN = eu_nieuws.MAANDEN
DAGEN = eu_nieuws.DAGEN
AFGEROND_TONEN_DAGEN = 183


def e(t):
    return html.escape(str(t if t is not None else ""), quote=True)


def js(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def moment(m):
    return m.replace("T", " ")[:16] if m else ""


def nieuws_blokken(media, officieel):
    def regel(b):
        return (f'<li><a href="{e(b["link"])}" target="_blank" rel="noopener"><div class="regel">{e(b["titel"])}</div>'
                f'<div class="meta2"><span>{e(b["bron"])}</span>' + (f'<span>{e(b["soort"])}</span>' if b.get("soort") else "")
                + f'<span>{b["datum"]:%d-%m %H:%M}</span>'
                + ('<span class="label voorstel">Voorstel</span>' if b["voorstel"] else "")
                + ('<span class="label taal">EN</span>' if b["taal"] == "en" else "") + "</div></a></li>")
    uit = []
    if media:
        uit.append('<div class="kop-met-link"><h2>Laatste nieuws uit de media</h2><a href="#nieuws">Alle berichten</a></div>'
                   '<p class="intro">Op tijd, het nieuwste eerst.</p>'
                   f'<div class="kaart"><ul class="lijst">{"".join(regel(b) for b in media[:6])}</ul></div>')
    if officieel:
        uit.append('<div class="kop-met-link"><h2>Uit Brussel zelf</h2><a href="#nieuws">Alle berichten</a></div>'
                   '<p class="intro"><span class="label officieel">Officieel</span> Persberichten en verklaringen van de Commissie en de Raad, op tijd.</p>'
                   f'<div class="kaart"><ul class="lijst officieel">{"".join(regel(b) for b in officieel[:5])}</ul></div>')
    return "\n".join(uit)


FRACTIE_BEGRIP = {"EVP": "EVP", "S&D": "S&D", "PfE": "PfE", "ECR": "ECR", "Renew Europe": "Renew",
                  "Groenen/EVA": "Groenen", "Links": "Links", "ESN": "ESN", "Niet-ingeschreven": "Niet-ingeschreven"}


def begrippen(leden):
    """Uitleg bij begrippen; bij fracties vullen we de Nederlandse partijen automatisch in uit de ledenlijst."""
    import re
    lijst = json.loads((ONDERDELEN / "begrippen.json").read_text(encoding="utf-8"))
    per = {}
    for l in leden.values():
        if l.get("land") == "NL":
            per.setdefault(l["fractie"], {}).setdefault(l["partij"], 0)
            per[l["fractie"]][l["partij"]] += 1
    for b in lijst:
        f = FRACTIE_BEGRIP.get(b["term"])
        if not f or not leden:
            continue
        tekst = re.sub(r"\s*(Nederlandse partij(en)?:.*|Er zitten geen Nederlandse partijen in\.)$", "", b["uitleg"]).strip()
        p = per.get(f)
        b["uitleg"] = tekst + (" Nederlandse leden nu: " + ", ".join(f"{k} ({v})" for k, v in sorted(p.items())) + "."
                               if p else " Er zitten nu geen Nederlandse leden in.")
    return lijst


def mooie_naam(n):
    import re
    return re.sub(r"(?<=\S )(Von|Der|Van|De|Den|Ter|Ten)\b(?= )", lambda m: m.group(1).lower(), n or "")


def dossiers_ophalen(eigen_refs):
    try:
        if os.environ.get("EU_ALLEEN_CACHE"):
            raise RuntimeError("alleen bewaarde gegevens gebruikt")
        lijst, opgehaald, fouten, rest = dossiers.bijwerken(extra=eigen_refs)
        fout = f"{len(fouten)} dossiers konden niet worden opgehaald" if fouten else None
        if rest:
            fout = (fout + "; " if fout else "") + f"{rest} dossiers nog niet opgehaald (volgt bij de volgende runs)"
        return lijst, fout, False
    except Exception as ex:
        # bron niet bereikbaar: gebruik wat er al bewaard is
        lijst = []
        for pad in sorted(dossiers.MAP_DOSSIERS.glob("*.json")):
            try:
                d = json.loads(pad.read_text(encoding="utf-8"))
                if not d.get("onbekend"):
                    lijst.append(d)
            except Exception:
                pass
        return lijst, f"lijst met dossiers niet bereikbaar ({ex}); bewaarde versie gebruikt", True


def main():
    nu = datetime.now().astimezone()
    meta, meldingen = {}, []

    nieuws, nieuws_fouten = eu_nieuws.berichten()
    media = [b for b in nieuws if b["kanaal"] == "media"]
    officieel = [b for b in nieuws if b["kanaal"] == "officieel"]
    if nieuws_fouten:
        meldingen.append("Niet alle nieuwsbronnen werkten: " + "; ".join(nieuws_fouten))

    st, st_fout, st_oud = met_cache("stemmingen", stemmingen.alles)
    st = st or {"zittingen": [], "stemmen": [], "leden": {}}
    meta["stemmen"] = {"moment": moment(st_oud) if st_fout else nu.strftime("%Y-%m-%d %H:%M"), "oud": bool(st_fout)}
    if st_fout:
        meldingen.append(f"Stemmingen: ophalen lukte nu niet ({st_fout})." + (f" Je ziet de versie van {moment(st_oud)}." if st_oud else ""))

    p, p_fout, p_oud = met_cache("parlement", lambda: parlement.alles(st["leden"]))
    p = p or {"debatten": [], "agenda": [], "zittingen": [], "later": []}
    meta["parlement"] = {"moment": moment(p_oud) if p_fout else nu.strftime("%Y-%m-%d %H:%M"), "oud": bool(p_fout)}
    if p_fout:
        meldingen.append(f"Agenda en debatten: ophalen lukte nu niet ({p_fout})." + (f" Je ziet de versie van {moment(p_oud)}." if p_oud else ""))

    eigen = {w["procedure"]: w for w in json.loads((MAP / "wetgeving.json").read_text(encoding="utf-8"))}
    alle_dossiers, d_fout, d_oud = dossiers_ophalen(list(eigen))
    meta["dossiers"] = {"moment": nu.strftime("%Y-%m-%d %H:%M"), "oud": d_oud}
    if d_fout:
        meldingen.append("Dossiers: " + d_fout + ".")
    grens = (date.today() - timedelta(days=AFGEROND_TONEN_DAGEN)).isoformat()
    pagina_dossiers = []
    for d in alle_dossiers:
        if d.get("afgerond") and d.get("laatst", "") < grens and d["ref"] not in eigen:
            continue
        d = {k: v for k, v in d.items() if k not in ("status_en", "oeil_wijziging")}
        d["soort_naam"] = dossiers.SOORTEN.get(d["soort"], d["soort"])
        d["commissaris"] = mooie_naam(d.get("commissaris"))
        if d["ref"] in eigen:
            d["eigen"] = {k: v for k, v in eigen[d["ref"]].items() if k != "procedure"}
        pagina_dossiers.append(d)
    pagina_dossiers.sort(key=lambda d: d.get("laatst", ""), reverse=True)

    meldingen_html = "".join(f'<div class="melding" style="margin-top:calc(14px + env(safe-area-inset-top))">{e(m)}</div>' for m in meldingen)
    terrein_namen = [n for n, _ in eu_nieuws.TERREINEN] + ["Overig"]

    def opgehaald(sleutel, wat):
        m = meta[sleutel]
        return f'<p class="opgehaald">{wat} opgehaald: {e(m["moment"])}' + (" · <b>niet vers</b>" if m["oud"] else "") + "</p>"

    vervang = {
        "{{STIJL}}": (ONDERDELEN / "stijl.css").read_text(encoding="utf-8"),
        "{{MELDINGEN}}": meldingen_html,
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
        "{{OPGEHAALD_PARLEMENT}}": opgehaald("parlement", "Agenda en debatten"),
        "{{OPGEHAALD_DOSSIERS}}": opgehaald("dossiers", "Dossiers"),
        "{{OPGEHAALD_STEMMEN}}": opgehaald("stemmen", "Stemmingen"),
        "{{BRONNEN}}": (ONDERDELEN / "bronnen.html").read_text(encoding="utf-8"),
        "{{BEGRIPPEN}}": js(begrippen(st["leden"])),
        "{{DATA_META}}": js(meta),
        "{{DATA_DOSSIERS}}": js(pagina_dossiers),
        "{{DATA_STEMMEN}}": js({"zittingen": st["zittingen"], "stemmen": st["stemmen"]}),
        "{{DATA_PARLEMENT}}": js(p),
        "{{DATA_LEDEN}}": js(st["leden"]),
        "{{APP}}": (ONDERDELEN / "app.js").read_text(encoding="utf-8"),
    }
    pagina = (ONDERDELEN / "sjabloon.html").read_text(encoding="utf-8")
    for sleutel, waarde in vervang.items():
        pagina = pagina.replace(sleutel, waarde)
    UITVOER.write_text(pagina, encoding="utf-8")
    print(f"{nu:%Y-%m-%d %H:%M} — {len(nieuws)} berichten, {len(pagina_dossiers)} dossiers op de pagina "
          f"({len(alle_dossiers)} bekend), {len(st['stemmen'])} stemmingen, {len(p['debatten'])} debatten, "
          f"{len(p['agenda'])} vergaderdagen in de agenda, {len(UITVOER.read_bytes()) // 1024} kB"
          + (f" | {' | '.join(meldingen)}" if meldingen else ""))


if __name__ == "__main__":
    main()

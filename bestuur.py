#!/usr/bin/env python3
"""Bestuur: de Europese Commissie en de Nederlandse bewindspersonen in de Raad, met perscontacten.

Bronnen (alleen officiële sites, niets verzonnen):
- commission.europa.eu: het College (voorzitter, vicevoorzitters, commissarissen, portefeuilles)
  en de woordvoerders van de Commissie (Spokesperson's Service), met e-mail, telefoon en hun
  onderwerpen. Een woordvoerder hoort bij een commissaris als hun onderwerpen overlappen.
- rijksoverheid.nl: de bewindspersonen, en per ministerie de pagina 'Woordvoerders'.
- In welke raadsformatie een bewindspersoon Nederland meestal vertegenwoordigt, volgt uit de
  portefeuille (vaste lijst hieronder). Dat is gebruikelijk, geen garantie per vergadering.
Wordt gebruikt door europa.py."""

import html
import re
from concurrent.futures import ThreadPoolExecutor

from bronnen import ophalen

COLLEGE = "https://commission.europa.eu/about/organisation/college-commissioners_en"
WOORDVOERDERS = "https://commission.europa.eu/about/contact/press-services/press-contacts/commissions-spokespersons-service_en"
REGERING = "https://www.rijksoverheid.nl/regering/bewindspersonen"
RO = "https://www.rijksoverheid.nl"

ROLLEN = {"The President": "Voorzitter van de Commissie",
          "Executive Vice-Presidents and High Representative": "Uitvoerend vicevoorzitter",
          "Commissioners": "Commissaris"}

# deel van de functie -> raadsformaties waarin die bewindspersoon Nederland meestal vertegenwoordigt
FORMATIES = [
    ("Algemene Zaken", ["Europese Raad (EU-top)"]),
    ("Buitenlandse Handel", ["Raad Buitenlandse Zaken (handel)", "Raad Buitenlandse Zaken (ontwikkeling)"]),
    ("Buitenlandse Zaken", ["Raad Buitenlandse Zaken", "Raad Algemene Zaken"]),
    ("Defensie", ["Raad Buitenlandse Zaken (defensie)"]),
    ("Asiel en Migratie", ["Raad Justitie en Binnenlandse Zaken"]),
    ("Justitie en Veiligheid", ["Raad Justitie en Binnenlandse Zaken"]),
    ("Financiën", ["Ecofin-Raad"]),
    ("Infrastructuur en Waterstaat", ["Raad Vervoer, Telecommunicatie en Energie (vervoer)", "Raad Milieu"]),
    ("Klimaat en Groene Groei", ["Raad Milieu (klimaat)", "Raad Vervoer, Telecommunicatie en Energie (energie)"]),
    ("Economische Zaken", ["Raad Concurrentievermogen"]),
    ("Digitale Economie", ["Raad Vervoer, Telecommunicatie en Energie (telecommunicatie)"]),
    ("Landbouw, Visserij", ["Raad Landbouw en Visserij"]),
    ("Sociale Zaken en Werkgelegenheid", ["Raad Werkgelegenheid, Sociaal Beleid, Volksgezondheid en Consumentenzaken"]),
    ("Werk en Participatie", ["Raad Werkgelegenheid, Sociaal Beleid, Volksgezondheid en Consumentenzaken"]),
    ("Volksgezondheid", ["Raad Werkgelegenheid, Sociaal Beleid, Volksgezondheid en Consumentenzaken (gezondheid)"]),
    ("Onderwijs, Cultuur en Wetenschap", ["Raad Onderwijs, Jeugd, Cultuur en Sport", "Raad Concurrentievermogen (onderzoek)"]),
    ("Onderwijs en Emancipatie", ["Raad Onderwijs, Jeugd, Cultuur en Sport (onderwijs)"]),
    ("Jeugd en Sport", ["Raad Onderwijs, Jeugd, Cultuur en Sport (jeugd en sport)"]),
]
# ministerie in de functie -> deel van het webadres op rijksoverheid.nl
MINISTERIES = [
    ("Algemene Zaken", "ministerie-van-algemene-zaken"), ("Buitenlandse Handel", "ministerie-van-buitenlandse-zaken"),
    ("Buitenlandse Zaken", "ministerie-van-buitenlandse-zaken"), ("Defensie", "ministerie-van-defensie"),
    ("Asiel en Migratie", "ministerie-van-asiel-en-migratie"), ("Justitie en Veiligheid", "ministerie-van-justitie-en-veiligheid"),
    ("Binnenlandse Zaken", "ministerie-van-binnenlandse-zaken-en-koninkrijksrelaties"),
    ("Koninkrijksrelaties", "ministerie-van-binnenlandse-zaken-en-koninkrijksrelaties"),
    ("Volkshuisvesting", "ministerie-van-volkshuisvesting-en-ruimtelijke-ordening"),
    ("Onderwijs", "ministerie-van-onderwijs-cultuur-en-wetenschap"), ("Financiën", "ministerie-van-financien"),
    ("Toeslagen", "ministerie-van-financien"), ("Infrastructuur en Waterstaat", "ministerie-van-infrastructuur-en-waterstaat"),
    ("Economische Zaken", "ministerie-van-economische-zaken"), ("Digitale Economie", "ministerie-van-economische-zaken"),
    ("Klimaat en Groene Groei", "ministerie-van-klimaat-en-groene-groei"),
    ("Landbouw", "ministerie-van-landbouw-visserij-voedselzekerheid-en-natuur"),
    ("Sociale Zaken", "ministerie-van-sociale-zaken-en-werkgelegenheid"), ("Werk en Participatie", "ministerie-van-sociale-zaken-en-werkgelegenheid"),
    ("Volksgezondheid", "ministerie-van-volksgezondheid-welzijn-en-sport"), ("Langdurige Zorg", "ministerie-van-volksgezondheid-welzijn-en-sport"),
]


def tekst(t):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t or "", flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip()


def woorden(t):
    return {w for w in re.findall(r"[a-z]{5,}", t.lower())} - {"european", "union", "policy", "affairs", "general"}


# ---------- Commissie ----------

def college():
    t = ophalen(COLLEGE).decode("utf-8", "replace")
    leden, rol = [], None
    for stuk in re.split(r"(<h3>.*?</h3>)", t):
        kop = re.match(r"<h3>(.*?)</h3>", stuk)
        if kop:
            rol = ROLLEN.get(tekst(kop.group(1)), rol)
            continue
        if not rol:
            continue
        for blok in stuk.split('data-untranslated-label="')[1:]:
            link = re.search(r'href="(/about/organisation/(?:college-commissioners/[a-z-]+_en|president_en))"', blok)
            if not link or "calendar-items" in link.group(1) or "former-colleges" in link.group(1) or "project-groups" in link.group(1):
                continue
            naam = html.unescape(blok.split('"', 1)[0])
            besch = re.search(r'ecl-content-block__description.*?<p>(.*?)</p>', blok, re.S)
            portefeuille = [tekst(x) for x in re.split(r"<br\s*/?>", besch.group(1))] if besch else []
            leden.append({"id": "c-" + link.group(1).rsplit("/", 1)[-1].replace("_en", ""), "soort": "commissie", "naam": naam,
                          "functie": rol, "portefeuille": [p for p in portefeuille if p],
                          "url": "https://commission.europa.eu" + link.group(1)})
    if len(leden) < 20:
        raise RuntimeError(f"College: maar {len(leden)} leden gevonden")
    return leden


def woordvoerders():
    t = ophalen(WOORDVOERDERS).decode("utf-8", "replace")
    uit = []
    for m in re.finditer(r"<h2 class='ecl-u-type-heading-2'>(.*?)</h2>\s*</div>\s*<article(.*?)</article>", t, re.S):
        naam, blok = tekst(m.group(1)), m.group(2)
        functie = re.search(r'ecl-featured-item__title[^>]*>(.*?)</div>', blok, re.S)
        mail = re.search(r"\(([\w.\-]+)\[at\]([\w\[\].\-]+)\)", blok)
        tel = re.findall(r'href="tel:[^"]*">([^<]+)</a>', blok)
        onderwerpen = [tekst(x) for x in re.findall(r"<li>(.*?)</li>", blok, re.S)]
        uit.append({"naam": naam, "functie": tekst(functie.group(1)) if functie else "Woordvoerder",
                    "mail": (mail.group(1) + "@" + mail.group(2)).replace("[dot]", ".") if mail else "",
                    "tel": [x.strip() for x in tel], "onderwerpen": onderwerpen})
    if not uit:
        raise RuntimeError("geen woordvoerders gevonden")
    return uit


def commissie():
    leden, sprekers = college(), woordvoerders()
    for lid in leden:
        w = woorden(" ".join(lid["portefeuille"]))
        score = [(len(w & woorden(" ".join(s["onderwerpen"]))), "pokesperson" in s["functie"], s) for s in sprekers if s["onderwerpen"]]
        score = [x for x in score if x[0]]
        score.sort(key=lambda x: (-x[1], -x[0]))
        lid["woordvoerders"] = [x[2] for x in score[:3]]
        if lid["functie"] == "Voorzitter van de Commissie":
            lid["woordvoerders"] = [s for s in sprekers if "Chief Spokesperson" in s["functie"]][:3]
    return {"leden": leden, "woordvoerders": sprekers, "bron": WOORDVOERDERS}


# ---------- Nederlandse bewindspersonen ----------

def ministerie_van(functie):
    return next((slug for sleutel, slug in MINISTERIES if sleutel in functie), None)


TEL = r"(?:\+31[\d ]{9,15}\d|\b0[1-9][\d \-]{7,12}\d)"
MAIL = r"[\w.\-]+@[\w\-]+(?:\.[\w\-]+)+"


def ministerie_woordvoerders(slug):
    """De pagina 'Woordvoerders' (of 'Persinformatie') van een ministerie. Per contact: de tekst
    ervoor (functie, naam), telefoon en e-mail, zoals ze op de pagina staan. Teams per
    bewindspersoon ('Team minister Heinen') blijven bij elkaar."""
    contact = ophalen(f"{RO}/ministeries/{slug}/contact").decode("utf-8", "replace")
    links = sorted(set(re.findall(r'href="(/ministeries/[^"]*/contact/persinformatie[^"#?]*)"', contact)), key=len)
    if not links:
        return {"url": f"{RO}/ministeries/{slug}/contact", "teams": []}
    url = RO + links[0]
    pagina = ophalen(url).decode("utf-8", "replace")
    w = sorted(set(re.findall(r'href="([^"]*/woordvoerders?[^"#?]*)"', pagina)), key=len)
    if w:
        url = RO + w[0] if w[0].startswith("/") else w[0]
        pagina = ophalen(url).decode("utf-8", "replace")
    t = tekst(pagina).split("Heeft deze informatie u geholpen")[0].split("De Rijksoverheid. Voor Nederland")[0]
    t = re.sub(r"^.*(alleen (te )?bereik(baar|en) voor (de )?media\.?|1400 \(op werkdagen[^)]*\)\.?)", "", t, count=1, flags=re.S)
    teams, huidig = [], {"naam": "", "mensen": []}
    vorige = 0
    for m in re.finditer(r"(Team (?:minister-president |minister |staatssecretaris )?[A-Z][\w\-]+(?: (?:van|de|der|den) [A-Z][\w\-]+)?)|(" + TEL + r")|(" + MAIL + r")", t):
        if m.group(1):
            if huidig["mensen"]:
                teams.append(huidig)
            huidig = {"naam": m.group(1).strip(), "mensen": []}
            vorige = m.end()
            continue
        stuk = t[vorige:m.start()].strip(" :.,")
        stuk = re.sub(r"\b(Telefoon|E-mailadres|E-mail|Tel\.?)\s*:?\s*$", "", stuk).strip(" :.,")
        laatste = huidig["mensen"][-1] if huidig["mensen"] else None
        if m.group(2):
            if laatste is not None and not stuk and not laatste.get("mail"):
                laatste["tel"].append(m.group(2).strip())
            else:
                huidig["mensen"].append({"tekst": stuk[-160:], "tel": [m.group(2).strip()], "mail": ""})
        else:
            if laatste is not None and not laatste["mail"] and len(stuk) < 25:
                laatste["mail"] = m.group(3)
            else:
                huidig["mensen"].append({"tekst": stuk[-160:], "tel": [], "mail": m.group(3)})
        vorige = m.end()
    if huidig["mensen"]:
        teams.append(huidig)
    return {"url": url, "teams": teams}


def bewindspersonen():
    t = ophalen(REGERING).decode("utf-8", "replace")
    uit, gezien = [], set()
    for m in re.finditer(r'<a[^>]+href="(/regering/bewindspersonen/[^"/]+)"[^>]*>(.*?)</a>', t, re.S):
        delen = [x.strip() for x in re.sub(r"<[^>]+>", "|", m.group(2)).split("|") if x.strip()]
        if len(delen) < 2 or m.group(1) in gezien:
            continue
        gezien.add(m.group(1))
        naam, functie = html.unescape(delen[0]), html.unescape(delen[1])
        formaties = []
        for sleutel, f in FORMATIES:
            if sleutel in functie and not (sleutel == "Buitenlandse Zaken" and "Buitenlandse Handel" in functie):
                formaties += [x for x in f if x not in formaties]
        uit.append({"id": "nl-" + m.group(1).rsplit("/", 1)[-1], "soort": "raad", "naam": naam, "functie": functie,
                    "land": "NL", "formaties": formaties, "url": RO + m.group(1), "ministerie": ministerie_van(functie)})
    if len(uit) < 10:
        raise RuntimeError(f"Regering: maar {len(uit)} bewindspersonen gevonden")
    # woordvoerders per ministerie (één keer per ministerie), het team van deze bewindspersoon eerst
    slugs = sorted({p["ministerie"] for p in uit if p["ministerie"]})

    def veilig(slug):
        try:
            return slug, ministerie_woordvoerders(slug)
        except Exception:
            return slug, {"url": f"{RO}/ministeries/{slug}/contact", "teams": []}
    with ThreadPoolExecutor(4) as pool:
        pers = dict(pool.map(veilig, slugs))
    for p in uit:
        info = pers.get(p["ministerie"]) or {"url": "", "teams": []}
        achternaam = p["naam"].split()[-1].split("-")[0]
        eigen = [tm for tm in info["teams"] if tm["naam"] and achternaam in tm["naam"]]
        p["pers"] = {"url": info["url"], "teams": eigen or [tm for tm in info["teams"] if not tm["naam"].startswith("Team ")] or info["teams"]}
        p.pop("ministerie", None)
    return uit


def alles():
    return {"commissie": commissie(), "ministers": bewindspersonen()}


if __name__ == "__main__":
    a = alles()
    for l in a["commissie"]["leden"]:
        print(l["functie"], "|", l["naam"], "|", "; ".join(l["portefeuille"]), "|", [w["naam"] for w in l["woordvoerders"]])
    for m in a["ministers"]:
        print(m["naam"], "|", m["functie"], "|", m["formaties"], "|", [(t["naam"], len(t["mensen"])) for t in m["pers"]["teams"]])

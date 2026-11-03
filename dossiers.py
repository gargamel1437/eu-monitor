"""Dossiers: alle lopende procedures van het Europees Parlement, met de stand van zaken uit de
Legislative Observatory (OEIL).

- De lijst met procedurenummers komt uit de open data van het Parlement (snel en compleet).
- De details per dossier komen van de OEIL-pagina van dat dossier (betrouwbaarder dan de API).
- Alles wordt bewaard in data/dossiers/. Afgeronde dossiers halen we niet opnieuw op; lopende dossiers
  alleen als OEIL meldt dat er iets veranderd is, of als onze versie ouder is dan een paar dagen."""

import html
import json
import re
import sys
import urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

from bronnen import CACHE, ophalen, ophalen_json

OEIL = "https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference="
OEIL_EXPORT = "https://oeil.europarl.europa.eu/oeil/en/search/export/XML?searchType=procedure&year="
EP = "https://data.europarl.europa.eu/api/v2"
MAP_DOSSIERS = CACHE / "dossiers"

EERSTE_JAAR = 2016
WETGEVEND = {"COD", "CNS", "APP"}           # alle jaren vanaf EERSTE_JAAR
OVERIG = {"NLE", "BUD", "INI", "INL", "RSP"}  # alleen deze zittingsperiode (vanaf 2024)
SOORTEN = {
    "COD": "Wetgeving (gewone procedure)", "CNS": "Raadpleging", "APP": "Instemming (APP)",
    "NLE": "Niet-wetgevend (instemming/advies)", "BUD": "Begroting", "INI": "Initiatiefverslag",
    "INL": "Wetgevingsinitiatief", "RSP": "Resolutie",
}
FASEN = ["Voorstel", "Parlement", "Raad", "Triloog", "Aangenomen", "In werking"]
VERS_DAGEN = 4          # lopende dossiers minstens zo vaak opnieuw ophalen
MAX_PER_RUN = 450       # om de bronnen niet te overvragen; de rest volgt bij de volgende run

# (begin van de Engelse gebeurtenis, Nederlands, fase)
GEBEURTENISSEN = [
    ("Legislative proposal published", "Voorstel gepubliceerd door de Commissie", 0),
    ("Initial legislative proposal published", "Oorspronkelijk voorstel gepubliceerd", 0),
    ("Non-legislative basic document published", "Basisdocument gepubliceerd", 0),
    ("Preparatory document", "Voorbereidend document", 0),
    ("Committee referral announced", "Doorverwezen naar een parlementscommissie", 1),
    ("Referral to associated committees", "Doorverwezen naar meebeslissende commissies", 1),
    ("Urgent procedure requested", "Spoedprocedure aangevraagd", 1),
    ("Vote scheduled in committee", "Stemming in parlementscommissie gepland", 1),
    ("Vote in committee", "Stemming in de parlementscommissie", 1),
    ("Committee draft report", "Ontwerpverslag van de parlementscommissie", 1),
    ("Committee report tabled for plenary", "Verslag ingediend voor de plenaire vergadering", 1),
    ("Committee decision to open interinstitutional negotiations", "Parlementscommissie besluit tot onderhandelingen (triloog)", 3),
    ("Committee decision to enter into interinstitutional negotiations announced", "Onderhandelingsmandaat aangekondigd in de plenaire", 3),
    ("Committee decision to enter into interinstitutional negotiations confirmed", "Onderhandelingsmandaat bevestigd door het Parlement", 3),
    ("Matter referred back to the committee responsible for interinstitutional negotiations", "Teruggestuurd naar de parlementscommissie om te onderhandelen (triloog)", 3),
    ("Approval in committee of the text agreed", "Akkoord uit de triloog goedgekeurd in de parlementscommissie", 3),
    ("Coreper letter confirming interinstitutional agreement", "Coreper bevestigt akkoord", 3),
    ("Debate in Parliament", "Debat in het Parlement", 1),
    ("Debate scheduled", "Debat gepland", 1),
    ("Decision by Parliament", "Besluit van het Parlement", 1),
    ("Results of vote in Parliament", None, None),
    ("Resolution/conclusions adopted by Parliament", "Resolutie aangenomen door het Parlement", 1),
    ("Text adopted by Parliament", "Tekst aangenomen door het Parlement", 1),
    ("Debate in Council", "Besproken in de Raad", 2),
    ("Council position", "Standpunt van de Raad", 2),
    ("Approval in Council", "Goedkeuring in de Raad", 2),
    ("Act adopted by Council", "Raad keurt de wet goed", 4),
    ("Decision by Council", "Besluit van de Raad", 4),
    ("Final act signed", "Wet ondertekend", 4),
    ("End of procedure in Parliament", "Einde van de procedure in het Parlement", 4),
    ("Final act published in Official Journal", "Gepubliceerd in het Publicatieblad", 5),
    ("Commission response to text adopted", "Reactie van de Commissie op aangenomen tekst", None),
    ("Formal meeting of Parliament", "Formele vergadering van het Parlement", 1),
    ("Indicative plenary sitting date", "Verwachte plenaire behandeling", None),
    ("Proposal withdrawn by Commission", "Voorstel ingetrokken door de Commissie", None),
]
STATUS = {
    "Preparatory phase in Parliament": "Voorbereiding in het Parlement",
    "Awaiting committee decision": "Wacht op besluit van een parlementscommissie",
    "Awaiting Parliament's position in 1st reading": "Wacht op standpunt van het Parlement (1e lezing)",
    "Awaiting Parliament 1st reading / single reading / budget 1st stage": "Wacht op stemming in het Parlement",
    "Awaiting Council's 1st reading position": "Wacht op standpunt van de Raad",
    "Awaiting Parliament's vote": "Wacht op stemming in het Parlement",
    "Awaiting plenary debate/vote": "Wacht op plenair debat of stemming",
    "Provisional agreement between Parliament and Council on final act": "Voorlopig akkoord tussen Parlement en Raad",
    "Awaiting signature of act": "Wacht op ondertekening",
    "Awaiting final decision": "Wacht op definitief besluit",
    "Awaiting Council decision": "Wacht op besluit van de Raad",
    "Awaiting Council's 2nd reading position": "Wacht op standpunt van de Raad (2e lezing)",
    "Awaiting Parliament 2nd reading": "Wacht op stemming in het Parlement (2e lezing)",
    "Budgetary conciliation committee convened": "Bemiddelingscomité voor de begroting bijeen",
    "Procedure completed": "Afgerond",
    "Procedure completed, awaiting publication in Official Journal": "Afgerond, wacht op publicatie",
    "Procedure completed - delegated act enters into force": "Afgerond",
    "Procedure lapsed or withdrawn": "Ingetrokken of vervallen",
    "Procedure rejected": "Verworpen",
}

# OEIL-onderwerpcodes -> beleidsterrein (op basis van de officiële indeling van OEIL)
ONDERWERPEN = [
    ("3.70", "Klimaat & milieu"), ("3.60", "Energie"), ("3.10", "Landbouw & visserij"), ("3.15", "Landbouw & visserij"),
    ("3.20", "Transport"), ("3.30", "Digitaal & media"), ("3.40", "Industrie & onderzoek"), ("3.50", "Industrie & onderzoek"),
    ("2.", "Interne markt & economie"), ("5.", "Economie & financiën"), ("8.70", "Begroting"),
    ("4.20", "Gezondheid"), ("4.30", "Civiele bescherming"), ("4.10", "Sociaal & werk"), ("4.15", "Sociaal & werk"),
    ("4.40", "Onderwijs & cultuur"), ("4.45", "Onderwijs & cultuur"), ("4.60", "Consumenten"), ("4.70", "Regio's & cohesie"),
    ("4.", "Sociaal & werk"), ("6.10", "Defensie & veiligheid"), ("6.20", "Handel"), ("6.30", "Ontwikkeling & hulp"),
    ("6.50", "Ontwikkeling & hulp"), ("6.40", "Buitenlandse betrekkingen"), ("6.", "Buitenlandse betrekkingen"),
    ("7.10", "Migratie & asiel"), ("7.30", "Justitie & politie"), ("7.40", "Justitie & politie"), ("7.", "Justitie & politie"),
    ("8.20", "Uitbreiding"), ("1.", "Grondrechten & democratie"), ("0.", "Grondrechten & democratie"), ("8.", "Instellingen"),
]


# Fractienamen zoals OEIL ze schrijft -> korte Nederlandse naam (zie ook bronnen.VOLGORDE_FRACTIES)
FRACTIE_OEIL = {"EPP": "EVP", "S&D": "S&D", "PfE": "PfE", "ECR": "ECR", "Renew": "Renew", "Greens/EFA": "Groenen",
                "The Left": "Links", "ESN": "ESN", "NI": "Niet-ingeschreven"}


def mooie_naam(n):
    """'Ursula Von Der Leyen' -> 'Ursula von der Leyen'."""
    return re.sub(r"(?<=\S )(Von|Der|Van|De|Den|Ter|Ten)\b(?= )", lambda m: m.group(1).lower(), n or "")


def schoon(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def bestand(ref):
    return MAP_DOSSIERS / (re.sub(r"[^\w]", "_", ref) + ".json")


def iso(d):
    try:
        return datetime.strptime(d, "%d/%m/%Y").date().isoformat()
    except Exception:
        return ""


def vertaal(engels):
    for begin, nl, fase in GEBEURTENISSEN:
        if engels.startswith(begin):
            return nl, fase
    return engels, None


def terreinen(onderwerpen):
    uit = []
    for code, _ in onderwerpen:
        for prefix, naam in ONDERWERPEN:
            if code.startswith(prefix):
                if naam not in uit:
                    uit.append(naam)
                break
    return uit


def personen(stuk):
    """Alle europarlementariërs (link naar profiel) in een stuk HTML: [{id, naam, fractie}]."""
    uit = []
    for mep, tekst in re.findall(r'href="https?://www\.europarl\.europa\.eu/meps/\w+/(\d+)"[^>]*>\s*<span>([^<]+)</span>', stuk):
        tekst = html.unescape(tekst).strip()
        m = re.match(r"(.+?) \(([^)]+)\)$", tekst)
        naam, fractie = (m.group(1), m.group(2)) if m else (tekst, "")
        # OEIL schrijft ACHTERNAAM Voornaam
        delen = naam.split()
        achter = [w for w in delen if w.isupper() and len(w) > 1 or w in ("D'", "DE", "VAN", "DER")]
        voor = [w for w in delen if w not in achter]
        mooi = " ".join(voor + [w.capitalize() if w.isupper() else w for w in achter]) if voor else naam.title()
        mooi = re.sub(r"\b(Van|De|Der|Den|Ter|Ten)\b(?= [A-Z])", lambda x: x.group(1).lower(), mooi)
        uit.append({"id": mep, "naam": mooi, "fractie": fractie})
    return uit


def secties(pagina):
    delen = re.split(r'<h2 class="es_title-h2[^"]*">', pagina)
    uit = {}
    for d in delen[1:]:
        kop = schoon(d[: d.find("</h2>")])
        uit.setdefault(kop, d)
    return uit


def sectie_id(pagina, n):
    i = pagina.find(f'id="section{n}"')
    if i < 0:
        return ""
    j = pagina.find('id="section', i + 10)
    return pagina[i: j if j > 0 else None]


def rijen(stuk):
    return re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", stuk)


def cellen(rij):
    return re.findall(r"(?s)<t[dh][^>]*>(.*?)</t[dh]>", rij)


def parse(ref, pagina):
    pagina = re.sub(r"(?s)<(script|style|svg)\b.*?</\1>", "", pagina)
    s = secties(pagina)
    titel = schoon(pagina[pagina.find("<h2 class=\"es_title-h2"): pagina.find("</h2>", pagina.find("<h2 class=\"es_title-h2"))]) \
        if "es_title-h2" in pagina else ""
    basis = schoon(s.get("Basic information", ""))
    status_en = ""
    m = re.search(r"Status (.+?)(?: Please go to| Legislative priorities| Notes |$)", basis)
    if m:
        status_en = m.group(1).strip()
    soort = (re.search(r"\(([A-Z]{3})\)$", ref) or re.search(r"([A-Z]{3})", ref)).group(1)
    instrument = ""
    mi = re.search(r"procedure\)?\s+(Regulation|Directive|Decision|Budgetary|Recommendation|Resolution|Report)", basis)
    if mi:
        instrument = mi.group(1)
    onderwerpen = re.findall(r"(\d\.\d\d(?:\.\d\d)?) ([^\d]+?)(?= \d\.\d\d| Legislative priorities| Status| Geographical| Notes|$)",
                             basis.split("Subject", 1)[1] if "Subject" in basis else "")
    onderwerpen = [(c, t.strip()) for c, t in onderwerpen][:8]

    # sleutelspelers
    kp = s.get("Key players", "")
    commissies, schaduw = [], []
    for tabel in re.findall(r"(?s)<table.*?</table>", kp):
        kopcel = cellen(rijen(tabel)[0])[0] if rijen(tabel) else ""
        rol = schoon(kopcel)
        if "ommittee" not in rol:
            continue
        laatste = None
        for r in rijen(tabel)[1:]:
            code = re.search(r'es_badge-committee[^>]*>([A-Z]{3,6})<', r)
            if code:
                kop_cel = cellen(r)[0] if cellen(r) else r
                naam = schoon(kop_cel).replace(code.group(1), "", 1).strip()
                deel = r.split("collapseShadowRapporteur")[0]
                c = {"code": code.group(1), "naam": naam, "rol": rol, "rapporteurs": personen(deel),
                     "wacht": "Pending final decision" in schoon(r)}
                commissies.append(c)
                laatste = c
                if "collapseShadowRapporteur" in r:
                    schaduw += [dict(p, commissie=c["code"]) for p in personen(r.split("collapseShadowRapporteur", 1)[1])]
            elif "collapseShadowRapporteur" in r or "Shadow rapporteur" in r:
                schaduw += [dict(p, commissie=laatste["code"] if laatste else "") for p in personen(r)]
    dg, commissaris = "", ""
    kp_tekst = schoon(kp)
    mc = re.search(r"Commission DG Commissioner (.+?) ([A-ZÀ-Ž][A-ZÀ-Ž'\-]+(?: [A-ZÀ-Ž][A-ZÀ-Ž'\-]+)*) ([A-ZÀ-Ž][a-zà-ž\-]+(?: [A-ZÀ-Ž][a-zà-ž\-]+)?)(?= European| Council|$)", kp_tekst)
    if mc:
        achter = re.sub(r"\bMc([a-z])", lambda x: "Mc" + x.group(1).upper(), mc.group(2).title())
        dg, commissaris = mc.group(1), f"{mc.group(3)} {achter}"
    raad = []
    mr = re.search(r"Council configuration Meetings Date (.+?)(?= European Commission|$)", kp_tekst)
    if mr:
        for conf, n, dat in re.findall(r"(.+?) (\d+) (\d\d/\d\d/\d{4})", mr.group(1)):
            raad.append({"configuratie": conf.strip(), "datum": iso(dat)})

    # belangrijkste gebeurtenissen
    gebeurtenissen, fase = [], 0
    for r in rijen(s.get("Key events", "")):
        c = cellen(r)
        if len(c) < 2 or not re.search(r"\d\d/\d\d/\d{4}", c[0]):
            continue
        engels = schoon(c[1])
        nl, f = vertaal(engels)
        if nl is None:
            continue
        links = re.findall(r'href="([^"]+)"[^>]*>\s*([^<\s][^<]*)</a>', c[2]) if len(c) > 2 else []
        doc = [(t.strip(), u) for u, t in links if t.strip()]
        if f is not None:
            fase = max(fase, f)
        g = {"datum": iso(schoon(c[0])), "wat": nl, "fase": f}
        if doc:
            g["doc"], g["url"] = doc[0]
        if gebeurtenissen and gebeurtenissen[-1]["datum"] == g["datum"] and gebeurtenissen[-1]["wat"] == nl:
            continue
        gebeurtenissen.append(g)

    # verwachte stappen
    vooruit = []
    for r in rijen(s.get("Forecasts", "")):
        c = cellen(r)
        if len(c) >= 2 and re.search(r"\d\d/\d\d/\d{4}", c[0]):
            engels = schoon(c[1])
            nl, _ = vertaal(engels)
            vooruit.append({"datum": iso(schoon(c[0])), "wat": nl or engels})

    # documenten (sectie 'Documentation gateway')
    documenten = []
    for r in rijen(sectie_id(pagina, 6)):
        c = cellen(r)
        if len(c) < 4:
            continue
        datum = next((iso(m) for m in re.findall(r"\d\d/\d\d/\d{4}", " ".join(c))), "")
        link = re.search(r'href="(http[^"]+)"[^>]*>\s*([^<]+?)\s*</a>', r)
        soort_doc = schoon(c[0])
        if not link or not datum or soort_doc.startswith("Amendments tabled"):
            continue
        documenten.append({"soort": soort_doc, "ref": html.unescape(link.group(2)), "url": html.unescape(link.group(1)), "datum": datum})
    documenten = documenten[:40]

    # transparantie: ontmoetingen van (schaduw)rapporteurs met belangenvertegenwoordigers
    transp = []
    for r in rijen(sectie_id(pagina, 8)):
        c = [schoon(x) for x in cellen(r)]
        if len(c) >= 5 and re.search(r"\d\d/\d\d/\d{4}", c[3]):
            transp.append({"wie": c[0], "rol": c[1], "commissie": c[2], "datum": iso(c[3]), "met": c[4][:160]})

    afgerond = status_en.startswith(("Procedure completed", "Procedure lapsed", "Procedure rejected"))
    if status_en.startswith("Procedure completed"):
        fase = max(fase, 5 if any("Publicatieblad" in g["wat"] for g in gebeurtenissen) else 4)
    if "Provisional agreement" in status_en:
        fase = max(fase, 3)
    if soort not in ("COD",):
        fase = None
    return {
        "ref": ref, "soort": soort, "titel": titel, "instrument": instrument,
        "status_en": status_en, "status": STATUS.get(status_en, status_en), "afgerond": afgerond, "fase": fase,
        "onderwerpen": onderwerpen, "terreinen": terreinen(onderwerpen),
        "commissies": commissies, "schaduw": schaduw, "dg": dg, "commissaris": commissaris, "raad": raad,
        "gebeurtenissen": gebeurtenissen, "vooruit": vooruit, "documenten": documenten,
        "transparantie": transp[:40], "transparantie_aantal": len(transp),
        "begin": gebeurtenissen[0]["datum"] if gebeurtenissen else "",
        "laatst": max((g["datum"] for g in gebeurtenissen), default=""),
        "url": OEIL + ref,
    }


# ---------- welke dossiers bestaan er, en welke zijn veranderd ----------

def alle_refs():
    refs = []
    for jaar in range(EERSTE_JAAR, date.today().year + 1):
        data = ophalen_json(f"{EP}/procedures?format=application%2Fld%2Bjson&limit=5000&year={jaar}", 90).get("data", [])
        for x in data:
            t = x.get("process_type", "")
            if t in WETGEVEND or (t in OVERIG and jaar >= 2024):
                refs.append(x["label"])
    return refs


def oeil_wijzigingen():
    """Per jaar de 500 laatst bijgewerkte dossiers volgens OEIL: {ref: datum}."""
    uit = {}
    for jaar in range(EERSTE_JAAR, date.today().year + 1):
        try:
            root = ET.fromstring(ophalen(OEIL_EXPORT + str(jaar), 60))
        except Exception:
            continue
        for item in root.iter("item"):
            ref = (item.findtext("reference") or "").strip()
            d = (item.findtext("lastpubdate") or "").strip()
            try:
                uit[ref] = datetime.strptime(d, "%a %b %d %Y").date().isoformat()
            except Exception:
                pass
    return uit


def lees(ref):
    try:
        return json.loads(bestand(ref).read_text(encoding="utf-8"))
    except Exception:
        return None


def haal(ref, wijziging):
    try:
        pagina = ophalen(OEIL + ref, 40, pogingen=2).decode("utf-8", "replace")
    except urllib.error.HTTPError as ex:
        if ex.code == 404:  # bestaat niet in OEIL (bijv. opgesplitst in A/B): niet steeds opnieuw proberen
            d = {"ref": ref, "onbekend": True, "afgerond": True, "opgehaald": date.today().isoformat()}
            bestand(ref).write_text(json.dumps(d), encoding="utf-8")
            return d
        raise
    d = parse(ref, pagina)
    d["opgehaald"] = date.today().isoformat()
    d["oeil_wijziging"] = wijziging or ""
    bestand(ref).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    return d


def bijwerken(max_per_run=MAX_PER_RUN, extra=()):
    """Werkt de cache bij en geeft (lijst van alle dossiers, aantal opgehaald, fouten)."""
    MAP_DOSSIERS.mkdir(parents=True, exist_ok=True)
    refs = list(dict.fromkeys(list(extra) + alle_refs()))
    wijz = oeil_wijzigingen()
    vandaag = date.today()
    nodig = []
    for ref in refs:
        oud = lees(ref)
        if oud is None:
            nodig.append((0, ref))
        elif not oud.get("afgerond"):
            w = wijz.get(ref, "")
            if w and w > oud.get("oeil_wijziging", ""):
                nodig.append((1, ref))
            elif (vandaag - date.fromisoformat(oud.get("opgehaald", "2000-01-01"))).days >= VERS_DAGEN:
                nodig.append((2, ref))
    # eerst eigen dossiers, dan nieuwe (nieuwste jaren eerst), dan gewijzigde, dan verouderde
    eigen = set(extra)
    nodig.sort(key=lambda x: (0 if x[1] in eigen else 1, x[0], -int(x[1][:4]), x[1]), reverse=False)
    nodig = [r for _, r in nodig][:max_per_run]
    fouten = []

    def veilig(ref):
        try:
            return haal(ref, wijz.get(ref))
        except Exception as e:
            fouten.append(f"{ref}: {e}")
            return None
    # rustig aan: OEIL weigert bij te veel verzoeken tegelijk (HTTP 429)
    with ThreadPoolExecutor(2) as pool:
        list(pool.map(veilig, nodig))
    alles = [d for d in (lees(r) for r in refs) if d and not d.get("onbekend")]
    nog_te_doen = sum(1 for r in refs if lees(r) is None)
    return alles, len(nodig), fouten, nog_te_doen


if __name__ == "__main__":
    # handmatig de hele cache vullen: python3 dossiers.py alles
    n = 100000 if "alles" in sys.argv else MAX_PER_RUN
    alles, opgehaald, fouten, rest = bijwerken(n)
    print(f"{len(alles)} dossiers bekend, {opgehaald} opgehaald, {len(fouten)} fouten, nog {rest} te doen")

"""Gedeelde hulpjes voor alle onderdelen van de EU-monitor.

- ophalen(): iets van internet halen, met een paar nieuwe pogingen als het misgaat.
- met_cache(): lukt ophalen niet, gebruik dan de laatste versie die wél lukte. De pagina laat
  dat zien met een melding: er wordt nooit iets verzonnen.
- Vaste lijsten (fracties, maanden) die meerdere onderdelen gebruiken."""

import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

MAP = Path(__file__).resolve().parent
CACHE = MAP / "data"
AGENT = "Mozilla/5.0 (persoonlijke EU-monitor)"

# Fracties in het Europees Parlement: codes van de bronnen -> korte Nederlandse naam
FRACTIES = {"EPP": "EVP", "SD": "S&D", "PFE": "PfE", "ECR": "ECR", "RENEW": "Renew",
            "GREEN_EFA": "Groenen", "GUE_NGL": "Links", "ESN": "ESN", "NI": "Niet-ingeschreven"}
VOLGORDE_FRACTIES = ["EVP", "S&D", "PfE", "ECR", "Renew", "Groenen", "Links", "ESN", "Niet-ingeschreven"]

MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
           "augustus", "september", "oktober", "november", "december"]
DAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"]


def ophalen(url, timeout=45, pogingen=3):
    """Haalt een adres op. Zegt een site 'te veel verzoeken' (HTTP 429), dan wachten we zo lang als
    de site vraagt (Retry-After) of steeds wat langer, en proberen we het vaker opnieuw."""
    req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json, text/html, */*"})
    poging, max_pogingen = 0, pogingen
    while True:
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                max_pogingen = max(max_pogingen, 5)
                if poging >= max_pogingen - 1:
                    raise
                try:
                    wacht = int(e.headers.get("Retry-After") or 0)
                except ValueError:
                    wacht = 0
                time.sleep(min(max(wacht, 10 * (poging + 1)), 60))
            elif poging >= max_pogingen - 1:
                raise
            else:
                time.sleep(2 * (poging + 1))
        except Exception:
            if poging >= max_pogingen - 1:
                raise
            time.sleep(2 * (poging + 1))
        poging += 1


def ophalen_json(url, timeout=30):
    return json.loads(ophalen(url, timeout))


def met_cache(naam, functie):
    """Voert functie() uit en bewaart het resultaat. Mislukt dat, dan de vorige versie.
    Geeft (gegevens, fout, moment_van_vorige_versie) terug. Met EU_ALLEEN_CACHE in de omgeving
    (de snelle nieuwsronde) altijd de bewaarde versie, met fout None en het moment van die versie."""
    CACHE.mkdir(exist_ok=True)
    bestand = CACHE / f"{naam}.json"
    # snelle nieuwsronde (europa.py --alleen-nieuws): alleen de bewaarde versie, niets ophalen
    if os.environ.get("EU_ALLEEN_CACHE") and bestand.exists():
        oud = json.loads(bestand.read_text(encoding="utf-8"))
        return oud["gegevens"], None, oud["moment"]
    try:
        gegevens = functie()
        bestand.write_text(json.dumps({"moment": datetime.now().isoformat(timespec="minutes"),
                                       "gegevens": gegevens}, ensure_ascii=False), encoding="utf-8")
        return gegevens, None, None
    except Exception as e:
        fout = f"{type(e).__name__}: {e}"
        if bestand.exists():
            oud = json.loads(bestand.read_text(encoding="utf-8"))
            return oud["gegevens"], fout, oud["moment"]
        return None, fout, None


def naam_mooi(voornaam, achternaam):
    """'VAN DEN BERG' -> 'van den Berg', 'MCGRATH' -> 'McGrath'."""
    a = " ".join(w.capitalize() for w in (achternaam or "").lower().split())
    a = re.sub(r"\b(Van|De|Der|Den|Het|Ten|Ter|Von)\b", lambda m: m.group(1).lower(), a)
    a = re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), a)
    a = a[:1].upper() + a[1:] if a and not re.match(r"(van|de|der|den|het|ten|ter|von)\b", a) else a
    return f"{voornaam} {a}".strip()

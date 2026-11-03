"""Gedeelde hulpjes: ophalen van internet en een simpele cache.

Lukt het ophalen niet, dan gebruiken we de laatste versie die wél lukte.
De pagina laat dan zien dat de gegevens niet vers zijn: er wordt nooit iets verzonnen."""

import json
import time
import urllib.request
from datetime import datetime
from pathlib import Path

MAP = Path(__file__).resolve().parent
CACHE = MAP / "data"
AGENT = "Mozilla/5.0 (persoonlijke EU-monitor)"


def ophalen(url, timeout=45, pogingen=3):
    req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json, text/html, */*"})
    for poging in range(pogingen):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception:
            if poging == pogingen - 1:
                raise
            time.sleep(2 * (poging + 1))


def ophalen_json(url, timeout=30):
    return json.loads(ophalen(url, timeout))


def met_cache(naam, functie):
    """Voert functie() uit en bewaart het resultaat. Mislukt dat, dan de vorige versie.
    Geeft (gegevens, fout, moment_van_ophalen) terug."""
    CACHE.mkdir(exist_ok=True)
    bestand = CACHE / f"{naam}.json"
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

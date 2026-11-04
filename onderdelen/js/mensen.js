// =====================================================================
//  mensen.js: alle europarlementariërs met hun rollen in dossiers, debatten en stemgedrag.
// =====================================================================

var MENSEN = null, MENSEN_INDEX = {};
var LANDEN = { AT: "Oostenrijk", BE: "België", BG: "Bulgarije", CY: "Cyprus", CZ: "Tsjechië", DE: "Duitsland", DK: "Denemarken",
  EE: "Estland", ES: "Spanje", FI: "Finland", FR: "Frankrijk", GR: "Griekenland", HR: "Kroatië", HU: "Hongarije", IE: "Ierland",
  IT: "Italië", LT: "Litouwen", LU: "Luxemburg", LV: "Letland", MT: "Malta", NL: "Nederland", PL: "Polen", PT: "Portugal",
  RO: "Roemenië", SE: "Zweden", SI: "Slovenië", SK: "Slowakije" };
var LETTER = { v: "FOR", t: "AGAINST", o: "ABSTENTION", g: "DID_NOT_VOTE" };

// In mensen.json staat het stemgedrag kort: één letter per stemming (volgorde in stemvolgorde),
// en de nummers van de stemmingen waarin iemand anders stemde dan partij (ap) of fractie (af).
// Hier maken we daar per persoon een lijst van: [id, positie, anders dan partij, anders dan fractie].
function mensenLaden() {
  return laden("mensen").then(function (d) {
    if (!MENSEN) {
      var lijst = d.mensen || d, volgorde = d.stemvolgorde || [];
      lijst.forEach(function (p) {
        var ap = {}, af = {};
        (p.ap || []).forEach(function (n) { ap[n] = 1; }); (p.af || []).forEach(function (n) { af[n] = 1; });
        p.stemmen = p.stemmen || [];
        (p.st || "").split("").forEach(function (c, n) { if (LETTER[c]) p.stemmen.push([volgorde[n], LETTER[c], ap[n] ? 1 : 0, af[n] ? 1 : 0]); });
        MENSEN_INDEX[p.id] = p;
      });
      MENSEN = lijst;
    }
    return MENSEN;
  });
}
// oud-leden: niet meer in de huidige ledenlijst, wel nog in een dossier
function isOud(p) { return !!(p.oud || !p.land); }
function landNaam(c) { return LANDEN[c] || c || ""; }
// Debatten staan als nummer in debatten.json.
function gestemd(p) { return p.stemmen.filter(function (x) { return x[1] !== "DID_NOT_VOTE"; }).length; }
// Rollen staan als [procedurenummer, parlementscommissie, afgerond]; titels komen uit dossiers-kort.json.
var DKORT = {};
function lopend(l) { return l.filter(function (x) { return !x[2]; }).length; }

function actiefLamp() { return '<span class="lamp" aria-label="actief" title="Loopt nog"></span>'; }
function contactIconen(id) {
  var c = CONTACTEN && CONTACTEN[id];
  if (!c) return "";
  var h = "";
  if (c.mail) h += '<a class="ic" href="mailto:' + esc(c.mail) + '" aria-label="Mail ' + esc(c.mail) + '"><svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg></a>';
  var t = (c.tel || []).filter(function (x) { return x.plaats === "Brussel"; })[0] || (c.tel || [])[0];
  if (t) h += '<a class="ic" href="tel:' + esc(t.nummer.replace(/[^+\d]/g, "")) + '" aria-label="Bel ' + esc(t.nummer) + '"><svg viewBox="0 0 24 24"><path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/></svg></a>';
  return h ? '<span class="iconen">' + h + "</span>" : "";
}
function persoonKaart(p) {
  var feiten = [];
  if (p.rap.length) feiten.push("rapporteur " + p.rap.length);
  if (p.schaduw.length) feiten.push("schaduw " + p.schaduw.length);
  if (p.debatten.length) feiten.push(p.debatten.length + " debatten");
  return '<div class="kaart compact mkaart k-ep" data-id="' + esc(p.id) + '" role="button" tabindex="0">'
    + '<div class="kaartkop"><h3>' + esc(p.naam) + "</h3>" + contactIconen(p.id) + "</div>"
    + '<div class="klein"><i class="stip"></i>' + (isOud(p) ? "oud-lid · " : "") + (p.partij ? esc(p.partij) + " · " : "") + (p.fractie ? tokLabel("m", "fractie", p.fractie, p.fractie, "frlab") : "") + (p.land ? " · " + tokLabel("m", "land", p.land, landNaam(p.land), "landlab") : "") + "</div>"
    + (feiten.length ? '<div class="klein feitregel">' + feiten.join(" · ") + "</div>" : "")
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}

// ---------- contact ----------
var CONTACTEN = null, BESTUUR = null;
function telLink(n) { return '<a href="tel:' + esc(String(n).replace(/[^+\d]/g, "")) + '">' + esc(n) + "</a>"; }
function mailLink(m) { return m ? '<a href="mailto:' + esc(m) + '">' + esc(m) + "</a>" : ""; }
function contactRijen(rijen) {
  rijen = rijen.filter(function (r) { return r[1]; });
  return rijen.length ? '<div class="contact">' + rijen.map(function (r) { return "<div><span>" + esc(r[0]) + "</span><b>" + r[1] + "</b></div>"; }).join("") + "</div>" : "";
}
function contactMep(p, c) {
  if (c === undefined) return '<p class="klein">Contactgegevens laden…</p>';
  if (c === null) return '<p class="klein">Contactgegevens konden niet worden geladen. Controleer je verbinding en open de persoon opnieuw.</p>';
  if (!c) return '<p class="klein">Het Parlement publiceert voor deze persoon geen contactgegevens (bijvoorbeeld een oud-lid). Kijk op het profiel bij het Parlement of bel de persdienst van de fractie.</p>';
  var rijen = [["E-mail", mailLink(c.mail)]];
  (c.tel || []).forEach(function (t) { rijen.push(["Telefoon" + (t.plaats ? " " + t.plaats : ""), telLink(t.nummer) + (t.kantoor ? ' <span class="klein">kantoor ' + esc(t.kantoor) + "</span>" : "")]); });
  if (c.web) rijen.push(["Website", a(c.web, c.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))]);
  if ((c.sociaal || []).length) rijen.push(["Sociale media", c.sociaal.map(function (x) { return a(x.url, x.naam); }).join(" · ")]);
  return contactRijen(rijen) || '<p class="klein">Geen contactgegevens bij het Parlement.</p>';
}
function woordvoerderHtml(w) {
  return '<div class="wv"><b>' + esc(w.naam) + '</b><div class="klein">' + esc(w.functie) + (w.onderwerpen && w.onderwerpen.length ? " · " + esc(w.onderwerpen.join(", ")) : "") + "</div>"
    + contactRijen([["E-mail", mailLink(w.mail)]].concat((w.tel || []).map(function (t, i) { return [i ? "Mobiel" : "Telefoon", telLink(t)]; }))) + "</div>";
}
var _contactenBezig = null;
function contactenLaden() {
  if (CONTACTEN) return Promise.resolve(CONTACTEN);
  _contactenBezig = _contactenBezig || laden("contacten").then(function (d) { CONTACTEN = d || {}; return CONTACTEN; }).catch(function (e) { _contactenBezig = null; throw e; });
  return _contactenBezig;
}
function bestuurLaden() { return BESTUUR ? Promise.resolve(BESTUUR) : laden("bestuur").then(function (d) { BESTUUR = d; return d; }); }

// ---------- detail van een europarlementariër ----------
function sectie(titel, n, inhoud, open) {
  return '<details class="sectie"' + (open ? " open" : "") + "><summary>" + titel + (n != null ? ' <span class="teller-klein">' + n + "</span>" : "") + "</summary>" + inhoud + "</details>";
}
function rolTegel(naam, l) {
  var act = lopend(l);
  return '<div class="rol' + (act ? " heeft-actief" : "") + '"><span class="rol-naam">' + naam + "</span><b>" + l.length + "</b><span>totaal</span>"
    + '<span class="rol-actief">' + (act ? actiefLamp() : "") + act + " actief</span></div>";
}
function persoonDetail(p) {
  var ap = p.stemmen.filter(function (x) { return x[2]; }).length, af = p.stemmen.filter(function (x) { return x[3]; }).length;
  var h = '<div class="persoonkop"><img class="foto" loading="lazy" alt="" src="https://www.europarl.europa.eu/mepphoto/' + esc(p.id) + '.jpg" onerror="this.remove()">'
    + '<div><div class="functie">' + (isOud(p) ? "Oud-europarlementariër" : "Europarlementariër") + "</div><h2 class='paneel-kop'>" + esc(p.naam) + "</h2>"
    + '<div class="klein">' + [p.partij ? esc(p.partij) : "", p.fractie ? fr(p.fractie) : "", p.land ? esc(landNaam(p.land)) : ""].filter(Boolean).join(" · ") + "</div></div></div>"
    + '<div class="knoprij">' + a("https://www.europarl.europa.eu/meps/nl/" + p.id, "Profiel bij het Parlement") + deelKnop(p.naam, "https://www.europarl.europa.eu/meps/nl/" + p.id) + "</div>"
    + '<h3 class="sectiekop">Contact</h3><div class="m-contact" data-id="' + esc(p.id) + '">' + contactMep(p, CONTACTEN ? (CONTACTEN[p.id] || false) : undefined) + "</div>"
    + '<h3 class="sectiekop">Activiteit</h3>'
    + '<div class="rollen">' + rolTegel("Rapporteur", p.rap) + rolTegel("Schaduwrapporteur", p.schaduw) + "</div>"
    + '<div class="tegels">'
    + "<div><b>" + p.debatten.length + "</b><span>debatten</span></div>"
    + "<div><b>" + (p.stemmen.length ? gestemd(p) + "/" + p.stemmen.length : "–") + "</b><span>keer gestemd bij hoofdstemmingen</span></div>"
    + "<div><b>" + ap + "</b><span>keer anders dan de partij</span></div>"
    + "<div><b>" + af + "</b><span>keer anders dan de fractie</span></div></div>";
  function dl(l) {
    var s2 = l.slice().sort(function (x, y) { return x[2] - y[2]; });
    return "<ul class='rollijst'>" + s2.map(function (x) {
      return '<li class="' + (x[2] ? "klaar" : "loopt") + '">' + (x[2] ? '<span class="lamp uit"></span>' : actiefLamp()) + '<div><a href="#dossiers?open=' + encodeURIComponent(x[0]) + '">' + esc((DKORT[x[0]] || {}).titel || x[0]) + '</a><div class="klein">' + esc(x[0]) + (x[1] ? " · " + esc(x[1]) : "") + (x[2] ? " · afgerond" : " · loopt nog") + "</div></div></li>";
    }).join("") + "</ul>";
  }
  if (p.rap.length) h += sectie("Rapporteur", p.rap.length, dl(p.rap), true);
  if (p.schaduw.length) h += sectie("Schaduwrapporteur", p.schaduw.length, dl(p.schaduw), !p.rap.length);
  if (p.debatten.length) h += sectie("Debatten", p.debatten.length, "<ul class='punten'>" + p.debatten.map(function (i) {
    var x = DEBATTEN.debatten[i]; return x ? "<li>" + kort(x.datum) + ": " + esc(x.titel) + " · " + a(x.verslag, "verslag") + "</li>" : "";
  }).join("") + "</ul>", false);
  if (p.stemmen.length) h += sectie("Stemgedrag", p.stemmen.length, "<ul class='punten'>" + p.stemmen.map(function (x) {
    var s = STEM_INDEX[x[0]] || { titel: "Stemming " + x[0], moment: "" };
    return "<li>" + kort(s.moment) + ': <a href="#stemmingen?id=' + esc(x[0]) + '">' + esc(s.titel) + "</a>: <b>" + POS[x[1]][1] + "</b>"
      + (x[2] ? ' <span class="label">anders dan partij</span>' : "") + (x[3] ? ' <span class="label">anders dan fractie</span>' : "") + "</li>";
  }).join("") + "</ul>", false);
  if (!p.rap.length && !p.schaduw.length && !p.debatten.length && !p.stemmen.length) h += '<p class="klein">Geen rollen, debatten of stemmen in de opgehaalde gegevens.</p>';
  return h;
}
function openPersoon(id, dieper) {
  var p = MENSEN_INDEX[id];
  if (p) {
    openPaneel(p.naam, persoonDetail(p), { dieper: dieper, vol: true });
    if (!CONTACTEN) contactenLaden().then(function (c) {
      alle('.m-contact[data-id="' + id + '"]').forEach(function (el) { el.innerHTML = contactMep(p, c[p.id] || false); });
    }).catch(function () { alle('.m-contact[data-id="' + id + '"]').forEach(function (el) { el.innerHTML = contactMep(p, null); }); });
    return;
  }
  if (/^(c-|nl-)/.test(id)) bestuurLaden().then(function () { openBestuurder(id, dieper); });
}

// ---------- Commissie, Raad en persdiensten ----------
function bestuurders() { return BESTUUR ? BESTUUR.commissie.leden.concat(BESTUUR.ministers) : []; }
function openBestuurder(id, dieper) {
  var p = bestuurders().filter(function (x) { return x.id === id; })[0];
  if (!p) return;
  var h = '<div class="functie">' + esc(p.functie) + (p.soort === "raad" ? " · Nederland" : " · Europese Commissie") + "</div><h2 class='paneel-kop'>" + esc(p.naam) + "</h2>"
    + '<div class="knoprij">' + a(p.url, p.soort === "raad" ? "Profiel op rijksoverheid.nl" : "Profiel bij de Commissie") + deelKnop(p.naam, p.url) + "</div>";
  if (p.soort === "commissie") {
    if ((p.portefeuille || []).length) h += '<h3 class="sectiekop">Portefeuille</h3><ul class="punten">' + p.portefeuille.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    h += '<h3 class="sectiekop">Contact: woordvoerders</h3>' + ((p.woordvoerders || []).length ? '<p class="klein">Van de Spokesperson’s Service, gekoppeld op onderwerp. Controleer bij twijfel de volledige lijst.</p>' + p.woordvoerders.map(woordvoerderHtml).join("") : '<p class="klein">Geen woordvoerder op onderwerp gevonden.</p>')
      + '<div class="knoprij">' + a(BESTUUR.commissie.bron, "Alle woordvoerders van de Commissie") + "</div>";
  } else {
    h += '<h3 class="sectiekop">Vertegenwoordigt Nederland meestal in</h3>' + ((p.formaties || []).length ? "<ul class='punten'>" + p.formaties.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><p class='klein'>Volgt uit de portefeuille; per vergadering kan iemand anders gaan.</p>" : "<p class='klein'>Geen vaste raadsformatie.</p>");
    h += '<h3 class="sectiekop">Contact: persvoorlichting</h3>';
    var teams = (p.pers || {}).teams || [];
    if (teams.length) h += teams.map(function (t) {
      return (t.naam ? '<div class="klein"><b>' + esc(t.naam) + "</b></div>" : "") + t.mensen.map(function (m) {
        return '<div class="wv"><div>' + esc(m.tekst || "Persvoorlichting") + "</div>" + contactRijen([["Telefoon", (m.tel || []).map(telLink).join(", ")], ["E-mail", mailLink(m.mail)]]) + "</div>";
      }).join("");
    }).join("");
    else h += '<p class="klein">Geen woordvoerders op de pagina van het ministerie gevonden.</p>';
    if ((p.pers || {}).url) h += '<div class="knoprij">' + a(p.pers.url, "Persinformatie van het ministerie") + "</div>";
  }
  openPaneel(p.naam, h, { dieper: dieper, vol: true });
}
function bestuurKaart(p) {
  return '<div class="kaart compact bkaart k-' + (p.soort === "commissie" ? "com" : "raad") + '" data-id="' + esc(p.id) + '" role="button" tabindex="0"><div class="kaartkop"><h3>' + esc(p.naam) + "</h3></div>"
    + '<div class="klein"><i class="stip"></i>' + esc(p.functie) + "</div>"
    + (p.soort === "commissie" ? '<div class="klein feitregel">' + esc((p.portefeuille || []).join(" · ")) + "</div>"
      : ((p.formaties || []).length ? '<div class="klein feitregel">' + esc(p.formaties.join(" · ")) + "</div>" : ""))
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}
function persvoorlichterKaart(w) {
  return '<div class="kaart compact pkaart"><div class="functie"><i class="stip k-com"></i>' + esc(w.dienst) + "</div>" + woordvoerderHtml(w) + "</div>";
}
function contactpuntenHtml(l) {
  return (l || []).map(function (c) { return '<div class="kaart compact"><h3>' + a(c.url, c.naam) + '</h3><div class="klein">' + esc(c.plaats) + " · " + esc(c.wat) + "</div></div>"; }).join("");
}
function bestuurTonen(soort) {
  var doel = document.getElementById("m-lijst"), z = zoeker(MZ.tekst);
  bezig(doel);
  bestuurLaden().then(function (b) {
    var h = "", uitleg = "";
    if (soort === "commissie") {
      var leden = z.ordenen(b.commissie.leden.filter(function (p) { return z.past(p.naam + " " + p.functie + " " + (p.portefeuille || []).join(" ") + " " + (p.woordvoerders || []).map(function (w) { return w.naam; }).join(" "), p); }));
      var wv = z.ordenen(b.commissie.woordvoerders.filter(function (w) { return !z.leeg && z.past(w.naam + " " + w.functie + " " + (w.onderwerpen || []).join(" "), w); }));
      h = leden.map(bestuurKaart).join("") + (wv.length ? "<h2>Woordvoerders</h2>" + wv.map(function (w) { return '<div class="kaart compact">' + woordvoerderHtml(w) + "</div>"; }).join("") : "");
      document.getElementById("m-aantal").textContent = z.leeg ? "" : leden.length + " leden van het College" + (wv.length ? " · " + wv.length + " woordvoerders" : "");
      uitleg = b.commissie.leden.length + " leden van het College en " + b.commissie.woordvoerders.length + " woordvoerders. Bron: " + a("https://commission.europa.eu/about/organisation/college-commissioners_en", "het College") + " en " + a(b.commissie.bron, "de Spokesperson’s Service") + " van de Commissie. Een woordvoerder staat bij een commissaris als hun onderwerpen overlappen.";
    } else if (soort === "raad") {
      var vz = b.voorzitterschap || {};
      var ministers = z.ordenen(b.ministers.filter(function (p) { return z.past(p.naam + " " + p.functie + " " + (p.formaties || []).join(" "), p); }));
      h = (vz.land && z.leeg ? '<div class="kaart"><h3>Voorzitter van de Raad: ' + esc(vz.land) + '</h3><p class="klein">Tot en met ' + esc(lang(plusDagenVan(vz.tot, -1))) + ". Het voorzitterschap leidt de vergaderingen van de Raad (de Raad Buitenlandse Zaken wordt geleid door de Hoge Vertegenwoordiger). " + a(vz.site, "Site van het voorzitterschap") + "</p></div>" : "")
        + "<h2>Nederlandse bewindspersonen</h2>" + ministers.map(bestuurKaart).join("")
        + '<p class="klein uitleg-onder">Ministers van andere lidstaten: zie per vergadering de deelnemerslijst op de ' + a("https://www.consilium.europa.eu/nl/meetings/calendar/", "agenda van de Raad") + ".</p>";
      document.getElementById("m-aantal").textContent = z.leeg ? "" : ministers.length + " Nederlandse bewindspersonen";
      uitleg = b.ministers.length + " Nederlandse bewindspersonen. Bron: " + a("https://www.rijksoverheid.nl/regering/bewindspersonen", "rijksoverheid.nl") + " (bewindspersonen en woordvoerders per ministerie). In welke raadsformatie iemand meestal zit, volgt uit de portefeuille.";
    } else {
      var pv = z.ordenen((b.persvoorlichters || []).filter(function (w) { return z.past(w.naam + " " + w.functie + " " + w.dienst, w); }));
      var pd = (b.contactpunten || []).filter(function (c) { return z.past(c.naam + " " + c.plaats + " " + c.wat, c); });
      h = (pv.length ? "<h2>Persvoorlichters</h2>" + pv.map(persvoorlichterKaart).join("") : "") + (pd.length ? "<h2>Persdiensten</h2>" + contactpuntenHtml(pd) : "");
      document.getElementById("m-aantal").textContent = z.leeg ? "" : pv.length + " persvoorlichters · " + pd.length + " persdiensten";
      uitleg = "Persvoorlichters zoals ze op de perspagina van hun dienst staan (" + a("https://netherlands.representation.ec.europa.eu/nieuws-en-evenementen/persdienst-den-haag_nl", "Vertegenwoordiging van de Commissie in Nederland") + "). De perspagina’s van het Parlement en de Raad laten automatisch ophalen niet toe; daar staat de link naar de dienst." + opgehaald("persdiensten", "Persvoorlichters");
    }
    document.getElementById("m-uitleg").innerHTML = uitleg + opgehaald("bestuur", "Commissie en ministers");
    doel.innerHTML = h || '<p class="leeg">Niemand gevonden.</p>';
    document.getElementById("m-meer").classList.add("verborgen");
  }).catch(function () { laadFout(doel); });
}

// ---------- lijst, zoeken en filteren ----------
var mN = LAAD_STAP, MOPT = {};
var WIE_P = [["parlement", "Europarlementariërs", "parlement europarlement mep"], ["commissie", "Europese Commissie", "commissie commissaris woordvoerder"], ["raad", "Raad en ministers", "raad minister bewindspersoon"], ["persdiensten", "Persdiensten", "pers persdienst contact"]];
var MZ = maakZoekbalk({
  naam: "m", balk: "m-balk",
  soorten: {
    wie: { naam: "Wie", opties: function () { return WIE_P; }, kleur: function (w) { return { parlement: "ep", commissie: "com", raad: "raad" }[w] || ""; } },
    land: { naam: "Land", opties: function () { return MOPT.land || []; } },
    fractie: { naam: "Fractie", opties: function () { return MOPT.fractie || []; } },
    status: { naam: "Status", opties: function () { return [["actief", "Actief", "huidig lid zittend"], ["inactief", "Inactief", "oud-lid voormalig vertrokken"]]; } }
  },
  voorbeelden: { wie: 4, status: 2, land: 3, fractie: 4 },
  opnieuw: function () { mN = LAAD_STAP; if (MENSEN && mensenOpgezet) mensenTonen(); }
});
function mensenWie() { var t = MZ.tokens.filter(function (x) { return x.soort === "wie" && !x.uit; }).pop(); return t ? t.waarde : "parlement"; }
function mensenTonen() {
  var wie = mensenWie();
  if (wie !== "parlement") return bestuurTonen(wie);
  var actief = MENSEN.filter(function (p) { return !isOud(p); }).length;
  document.getElementById("m-uitleg").innerHTML = actief + " zittende europarlementariërs en " + (MENSEN.length - actief) + " oud-leden die nog in een dossier voorkomen. Bron: " + a("https://www.europarl.europa.eu/meps/nl/", "Europees Parlement") + " (leden en contactgegevens) en " + a("https://howtheyvote.eu", "HowTheyVote.eu") + " (stemgedrag).";
  var z = zoeker(MZ.tekst);
  var uit = MENSEN.filter(function (p) {
    if (!MZ.past("land", p.land) || !MZ.past("fractie", p.fractie)) return false;
    if (!MZ.past("status", isOud(p) ? "inactief" : "actief")) return false;
    return z.past(p.naam + " " + p.partij + " " + p.fractie + " " + landNaam(p.land) + " " + (p.land || ""), p);
  }).sort(function (x, y) { return (x.land === "NL" ? 0 : 1) - (y.land === "NL" ? 0 : 1) || landNaam(x.land).localeCompare(landNaam(y.land)) || (x.fractie || "").localeCompare(y.fractie || "") || (x.partij || "").localeCompare(y.partij || "") || x.naam.localeCompare(y.naam); });
  uit = z.ordenen(uit);
  document.getElementById("m-aantal").textContent = MZ.leeg() ? "" : uit.length + (uit.length === 1 ? " persoon" : " personen");
  var doel = document.getElementById("m-lijst");
  doel.innerHTML = uit.slice(0, mN).map(persoonKaart).join("") || '<p class="leeg">Niemand gevonden. Haal een filter weg of tik op × om alles te wissen.</p>';
  document.getElementById("m-meer").classList.toggle("verborgen", uit.length <= mN);
}
function mensenOpzetten() {
  var landen = {}, fracties = {};
  MENSEN.forEach(function (p) { if (p.land) landen[p.land] = 1; if (p.fractie) fracties[p.fractie] = 1; });
  MOPT.land = Object.keys(landen).sort(function (x, y) { return landNaam(x).localeCompare(landNaam(y)); }).map(function (c) { return [c, landNaam(c), c]; });
  MOPT.fractie = Object.keys(fracties).sort().map(function (f) { return [f, f]; });
  document.getElementById("m-meer").addEventListener("click", function () { mN += LAAD_STAP; mensenTonen(); });
  bijKaartTik(document.getElementById("m-lijst"), ".mkaart", function (k) { openPersoon(k.dataset.id); });
  bijKaartTik(document.getElementById("m-lijst"), ".bkaart", function (k) { openBestuurder(k.dataset.id); });
}
var mensenOpgezet = false;
// alle gegevens die het detail van een persoon nodig heeft
function mensenKlaar() {
  return Promise.all([mensenLaden(), laden("debatten"), laden("stemmen"), laden("dossiers-kort")]).then(function (r) {
    if (!Object.keys(DKORT).length) r[3].forEach(function (d) { DKORT[d.ref] = d; });
    if (!DEBATTEN) DEBATTEN = r[1];
    if (!STEMMEN) STEMMEN = r[2];
    if (!Object.keys(STEM_INDEX).length) STEMMEN.stemmen.forEach(function (s) { STEM_INDEX[s.id] = s; });
  });
}
function mensenTab(q) {
  var doel = document.getElementById("m-lijst");
  bezig(doel);
  mensenKlaar().then(function () {
    if (!mensenOpgezet) { mensenOpgezet = true; mensenOpzetten(); }
    mensenTonen();
    // contactgegevens op de achtergrond, daarna de iconen in de lijst
    if (!CONTACTEN) contactenLaden().then(function () { if (mensenWie() === "parlement") mensenTonen(); }).catch(function () {});
    if (q && q.id) openPersoon(q.id);
  }).catch(function () { laadFout(doel); });
}

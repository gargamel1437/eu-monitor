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
function landNaam(c) { return LANDEN[c] || c || ""; }
// Debatten staan als nummer in debatten.json.
function gestemd(p) { return p.stemmen.filter(function (x) { return x[1] !== "DID_NOT_VOTE"; }).length; }
// Rollen staan als [procedurenummer, parlementscommissie, afgerond]; titels komen uit dossiers-kort.json.
var DKORT = {};
function lopend(l) { return l.filter(function (x) { return !x[2]; }).length; }

function persoonKaart(p) {
  var feiten = [];
  if (p.rap.length) feiten.push("rapporteur: " + lopend(p.rap) + " lopend");
  if (p.schaduw.length) feiten.push("schaduw: " + lopend(p.schaduw) + " lopend");
  if (p.debatten.length) feiten.push(p.debatten.length + " debatten");
  if (p.stemmen.length) feiten.push("stemde in " + gestemd(p) + "/" + p.stemmen.length);
  return '<div class="kaart compact mkaart" data-id="' + esc(p.id) + '" role="button" tabindex="0">'
    + '<div class="kaartkop"><h3>' + esc(p.naam) + "</h3></div>"
    + '<div class="klein">' + (p.partij ? esc(p.partij) + " · " : "") + fr(p.fractie) + (p.land ? " · " + esc(landNaam(p.land)) : "") + "</div>"
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
  if (!c) return '<p class="klein">Contactgegevens laden…</p>';
  var rijen = [["E-mail", mailLink(c.mail)]];
  (c.tel || []).forEach(function (t) { rijen.push(["Telefoon" + (t.plaats ? " " + t.plaats : ""), telLink(t.nummer) + (t.kantoor ? ' <span class="klein">kantoor ' + esc(t.kantoor) + "</span>" : "")]); });
  if (c.web) rijen.push(["Website", a(c.web, c.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))]);
  if ((c.sociaal || []).length) rijen.push(["Sociale media", c.sociaal.map(function (x) { return a(x.url, x.naam); }).join(" · ")]);
  return contactRijen(rijen) || '<p class="klein">Geen contactgegevens bij het Parlement. Probeer de persdienst van de fractie.</p>';
}
function woordvoerderHtml(w) {
  return '<div class="wv"><b>' + esc(w.naam) + '</b><div class="klein">' + esc(w.functie) + (w.onderwerpen && w.onderwerpen.length ? " · " + esc(w.onderwerpen.join(", ")) : "") + "</div>"
    + contactRijen([["E-mail", mailLink(w.mail)]].concat((w.tel || []).map(function (t, i) { return [i ? "Mobiel" : "Telefoon", telLink(t)]; }))) + "</div>";
}
function contactenLaden() { return CONTACTEN ? Promise.resolve(CONTACTEN) : laden("contacten").then(function (d) { CONTACTEN = d; return d; }); }
function bestuurLaden() { return BESTUUR ? Promise.resolve(BESTUUR) : laden("bestuur").then(function (d) { BESTUUR = d; return d; }); }

// ---------- detail van een europarlementariër ----------
function sectie(titel, n, inhoud, open) {
  return '<details class="sectie"' + (open ? " open" : "") + "><summary>" + titel + (n != null ? ' <span class="teller-klein">' + n + "</span>" : "") + "</summary>" + inhoud + "</details>";
}
function persoonDetail(p) {
  var ap = p.stemmen.filter(function (x) { return x[2]; }).length, af = p.stemmen.filter(function (x) { return x[3]; }).length;
  var rapL = lopend(p.rap), schL = lopend(p.schaduw);
  var h = '<div class="persoonkop"><img class="foto" loading="lazy" alt="" src="https://www.europarl.europa.eu/mepphoto/' + esc(p.id) + '.jpg" onerror="this.remove()">'
    + "<div><h2 class='paneel-kop'>" + esc(p.naam) + "</h2>"
    + '<div class="klein">Europarlementariër · ' + (p.partij ? esc(p.partij) + " · " : "") + fr(p.fractie) + (p.land ? " · " + esc(landNaam(p.land)) : "") + "</div></div></div>"
    + '<div class="knoprij">' + a("https://www.europarl.europa.eu/meps/nl/" + p.id, "Profiel bij het Parlement") + deelKnop(p.naam, "https://www.europarl.europa.eu/meps/nl/" + p.id) + "</div>"
    + "<h4>Contact</h4><div id=\"m-contact\">" + contactMep(p, CONTACTEN && CONTACTEN[p.id]) + "</div>"
    + "<h4>Activiteit</h4><div class=\"tegels\">"
    + "<div><b>" + rapL + "</b><span>rapporteur<br>lopend</span></div>"
    + "<div><b>" + schL + "</b><span>schaduw<br>lopend</span></div>"
    + "<div><b>" + p.debatten.length + "</b><span>debatten<br>(3 zittingen)</span></div>"
    + "<div><b>" + (p.stemmen.length ? gestemd(p) + "/" + p.stemmen.length : "–") + "</b><span>gestemd<br>(hoofdstemmingen)</span></div>"
    + "<div><b>" + ap + "</b><span>anders dan<br>partij</span></div>"
    + "<div><b>" + af + "</b><span>anders dan<br>fractie</span></div></div>";
  function dl(l) {
    var s2 = l.slice().sort(function (x, y) { return x[2] - y[2]; });
    return "<ul class='punten'>" + s2.map(function (x) { return '<li><a href="#dossiers?open=' + encodeURIComponent(x[0]) + '">' + esc((DKORT[x[0]] || {}).titel || x[0]) + '</a> <span class="klein">' + esc(x[0]) + (x[1] ? " · " + esc(x[1]) : "") + (x[2] ? " · afgerond" : "") + "</span></li>"; }).join("") + "</ul>";
  }
  if (p.rap.length) h += sectie("Rapporteur", p.rap.length, dl(p.rap), true);
  if (p.schaduw.length) h += sectie("Schaduwrapporteur", p.schaduw.length, dl(p.schaduw), false);
  if (p.debatten.length) h += sectie("Debatten (laatste drie zittingen)", p.debatten.length, "<ul class='punten'>" + p.debatten.map(function (i) {
    var x = DEBATTEN.debatten[i]; return x ? "<li>" + kort(x.datum) + ": " + esc(x.titel) + " · " + a(x.verslag, "verslag") + "</li>" : "";
  }).join("") + "</ul>", false);
  if (p.stemmen.length) h += sectie("Stemgedrag", p.stemmen.length, "<ul class='punten'>" + p.stemmen.map(function (x) {
    var s = STEM_INDEX[x[0]] || { titel: "Stemming " + x[0], moment: "" };
    return "<li>" + kort(s.moment) + ': <a href="#stemmingen?id=' + esc(x[0]) + '">' + esc(s.titel) + "</a>: <b>" + POS[x[1]][1] + "</b>"
      + (x[2] ? ' <span class="label">anders dan partij</span>' : "") + (x[3] ? ' <span class="label">anders dan fractie</span>' : "") + "</li>";
  }).join("") + "</ul>", false);
  if (!p.rap.length && !p.schaduw.length && !p.debatten.length && !p.stemmen.length) h += '<p class="klein">Geen rollen, debatten of stemmen in de opgehaalde gegevens.</p>';
  return h + sectie("Mijn notities", null, notitie("m:" + p.id), !!NOTITIES["m:" + p.id]);
}
function openPersoon(id) {
  var p = MENSEN_INDEX[id];
  if (p) {
    openPaneel(p.naam, persoonDetail(p));
    if (!CONTACTEN) contactenLaden().then(function (c) { var el = document.getElementById("m-contact"); if (el) el.innerHTML = contactMep(p, c[p.id]); }).catch(function () {
      var el = document.getElementById("m-contact"); if (el) el.innerHTML = '<p class="klein">Contactgegevens konden niet laden.</p>';
    });
    return;
  }
  if (/^(c-|nl-)/.test(id)) bestuurLaden().then(function () { openBestuurder(id); });
}

// ---------- Commissie en Raad ----------
function bestuurders() {
  if (!BESTUUR) return [];
  return BESTUUR.commissie.leden.concat(BESTUUR.ministers);
}
function openBestuurder(id) {
  var p = bestuurders().filter(function (x) { return x.id === id; })[0];
  if (!p) return;
  var h = "<h2 class='paneel-kop'>" + esc(p.naam) + "</h2><div class='klein'>" + esc(p.functie) + (p.soort === "raad" ? " · Nederland" : " · Europese Commissie") + "</div>"
    + '<div class="knoprij">' + a(p.url, p.soort === "raad" ? "Profiel op rijksoverheid.nl" : "Profiel bij de Commissie") + deelKnop(p.naam, p.url) + "</div>";
  if (p.soort === "commissie") {
    if ((p.portefeuille || []).length) h += "<h4>Portefeuille</h4><ul class='punten'>" + p.portefeuille.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    h += "<h4>Woordvoerders</h4>" + ((p.woordvoerders || []).length ? '<p class="klein">Van de Spokesperson’s Service, gekoppeld op onderwerp. Controleer bij twijfel de volledige lijst.</p>' + p.woordvoerders.map(woordvoerderHtml).join("") : '<p class="klein">Geen woordvoerder op onderwerp gevonden.</p>')
      + '<div class="knoprij">' + a(BESTUUR.commissie.bron, "Alle woordvoerders van de Commissie") + "</div>";
  } else {
    h += "<h4>Vertegenwoordigt Nederland meestal in</h4>" + ((p.formaties || []).length ? "<ul class='punten'>" + p.formaties.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><p class='klein'>Volgt uit de portefeuille; per vergadering kan iemand anders gaan.</p>" : "<p class='klein'>Geen vaste raadsformatie.</p>");
    h += "<h4>Persvoorlichting</h4>";
    var teams = (p.pers || {}).teams || [];
    if (teams.length) h += teams.map(function (t) {
      return (t.naam ? '<div class="klein"><b>' + esc(t.naam) + "</b></div>" : "") + t.mensen.map(function (m) {
        return '<div class="wv"><div>' + esc(m.tekst || "Persvoorlichting") + "</div>" + contactRijen([["Telefoon", (m.tel || []).map(telLink).join(", ")], ["E-mail", mailLink(m.mail)]]) + "</div>";
      }).join("");
    }).join("");
    else h += '<p class="klein">Geen woordvoerders op de pagina gevonden.</p>';
    if ((p.pers || {}).url) h += '<div class="knoprij">' + a(p.pers.url, "Persinformatie van het ministerie") + "</div>";
  }
  openPaneel(p.naam, h + sectie("Mijn notities", null, notitie("m:" + p.id), !!NOTITIES["m:" + p.id]));
}
function bestuurKaart(p) {
  return '<div class="kaart compact bkaart" data-id="' + esc(p.id) + '" role="button" tabindex="0"><div class="kaartkop"><h3>' + esc(p.naam) + "</h3></div>"
    + '<div class="klein">' + esc(p.functie) + "</div>"
    + (p.soort === "commissie" ? '<div class="klein feitregel">' + esc((p.portefeuille || []).join(" · ")) + "</div>"
      : ((p.formaties || []).length ? '<div class="klein feitregel">' + esc(p.formaties.join(" · ")) + "</div>" : ""))
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}
function bestuurTonen(soort) {
  var doel = document.getElementById("m-lijst"), z = zoeker(mFilter.q);
  bezig(doel);
  bestuurLaden().then(function (b) {
    var h = "";
    if (soort === "commissie") {
      var leden = z.ordenen(b.commissie.leden.filter(function (p) { return z.past(p.naam + " " + p.functie + " " + (p.portefeuille || []).join(" ") + " " + (p.woordvoerders || []).map(function (w) { return w.naam; }).join(" "), p); }));
      var wv = z.ordenen(b.commissie.woordvoerders.filter(function (w) { return !z.leeg && z.past(w.naam + " " + w.functie + " " + (w.onderwerpen || []).join(" "), w); }));
      h = leden.map(bestuurKaart).join("") + (wv.length ? "<h2>Woordvoerders</h2>" + wv.map(function (w) { return '<div class="kaart compact">' + woordvoerderHtml(w) + "</div>"; }).join("") : "");
      document.getElementById("m-aantal").textContent = leden.length + " leden van het College" + (wv.length ? " · " + wv.length + " woordvoerders" : "");
      document.getElementById("m-uitleg").innerHTML = "Het College van commissarissen met portefeuilles en de woordvoerders per onderwerp, van " + a("https://commission.europa.eu/about/organisation/college-commissioners_en", "commission.europa.eu") + ". Zoek op een onderwerp (bijvoorbeeld ‘trade’) om de woordvoerders te vinden." + opgehaald("bestuur", "Commissie en ministers");
    } else {
      var vz = b.voorzitterschap || {};
      var ministers = z.ordenen(b.ministers.filter(function (p) { return z.past(p.naam + " " + p.functie + " " + (p.formaties || []).join(" "), p); }));
      h = (vz.land ? '<div class="kaart"><h3>Voorzitter van de Raad: ' + esc(vz.land) + '</h3><p class="klein">Tot en met ' + esc(lang(plusDagenVan(vz.tot, -1))) + ". Het voorzitterschap leidt de vergaderingen van de Raad (de Raad Buitenlandse Zaken wordt geleid door de Hoge Vertegenwoordiger). " + a(vz.site, "Site van het voorzitterschap") + "</p></div>" : "")
        + "<h2>Nederlandse bewindspersonen</h2>" + ministers.map(bestuurKaart).join("")
        + '<p class="klein uitleg-onder">Ministers van andere lidstaten: zie per vergadering de deelnemerslijst op de ' + a("https://www.consilium.europa.eu/nl/meetings/calendar/", "agenda van de Raad") + ".</p>"
        + "<h2>Contact in Brussel en Den Haag</h2>" + contactpuntenHtml(b.contactpunten);
      document.getElementById("m-aantal").textContent = ministers.length + " Nederlandse bewindspersonen";
      document.getElementById("m-uitleg").innerHTML = "Bewindspersonen en woordvoerders per ministerie van " + a("https://www.rijksoverheid.nl/regering/bewindspersonen", "rijksoverheid.nl") + ". In welke raadsformatie iemand meestal zit, volgt uit de portefeuille." + opgehaald("bestuur", "Commissie en ministers");
    }
    bedoelJe("m-zoek", z);
    doel.innerHTML = h || '<p class="leeg">Niemand gevonden.</p>';
    document.getElementById("m-meer").classList.add("verborgen");
  }).catch(function () { laadFout(doel); });
}
function contactpuntenHtml(l) {
  return (l || []).map(function (c) { return '<div class="kaart compact"><h3>' + a(c.url, c.naam) + '</h3><div class="klein">' + esc(c.plaats) + " · " + esc(c.wat) + "</div></div>"; }).join("");
}
function plusDagenVan(isoDatum, n) { var d = dt(isoDatum); d.setDate(d.getDate() + n); return iso(d); }

var mFilter = { q: "", land: "", fractie: "", rol: false, n: 60, soort: "parlement" };
function mensenTonen() {
  document.getElementById("m-filterknop").classList.toggle("verborgen", mFilter.soort !== "parlement");
  document.getElementById("m-zoek").placeholder = mFilter.soort === "parlement" ? "Naam, partij of land" : mFilter.soort === "commissie" ? "Naam, portefeuille of onderwerp" : "Naam, ministerie of raad";
  if (mFilter.soort !== "parlement") return bestuurTonen(mFilter.soort);
  document.getElementById("m-uitleg").textContent = "Alle 720 europarlementariërs, plus oud-leden die nog een rol in een dossier hebben. Stemgedrag gaat over de hoofdstemmingen van de laatste twee zittingen. Contactgegevens komen van het Parlement.";
  var z = zoeker(mFilter.q);
  var uit = MENSEN.filter(function (p) {
    if (mFilter.land && p.land !== mFilter.land) return false;
    if (mFilter.fractie && p.fractie !== mFilter.fractie) return false;
    if (mFilter.rol && !p.rap.concat(p.schaduw).some(function (x) { return !x[2]; })) return false;
    if (!z.past(p.naam + " " + p.partij + " " + p.fractie + " " + landNaam(p.land) + " " + (p.land || ""), p)) return false;
    return true;
  }).sort(function (x, y) { return (x.land === "NL" ? 0 : 1) - (y.land === "NL" ? 0 : 1) || landNaam(x.land).localeCompare(landNaam(y.land)) || (x.fractie || "").localeCompare(y.fractie || "") || (x.partij || "").localeCompare(y.partij || "") || x.naam.localeCompare(y.naam); });
  uit = z.ordenen(uit);
  bedoelJe("m-zoek", z);
  document.getElementById("m-aantal").textContent = uit.length + " personen";
  var doel = document.getElementById("m-lijst");
  doel.innerHTML = uit.slice(0, mFilter.n).map(persoonKaart).join("") || '<p class="leeg">Niemand gevonden.</p>';
  document.getElementById("m-meer").classList.toggle("verborgen", uit.length <= mFilter.n);
  filterTeller("m-filterknop", (mFilter.land ? 1 : 0) + (mFilter.fractie ? 1 : 0) + (mFilter.rol ? 1 : 0));
}
function mensenOpzetten() {
  var wacht = null;
  var landen = {}, fracties = {};
  MENSEN.forEach(function (p) { if (p.land) landen[p.land] = 1; if (p.fractie) fracties[p.fractie] = 1; });
  document.getElementById("m-land").innerHTML = '<option value="">Alle landen</option>' + Object.keys(landen).sort(function (x, y) { return landNaam(x).localeCompare(landNaam(y)); })
    .map(function (c) { return '<option value="' + esc(c) + '">' + esc(landNaam(c)) + "</option>"; }).join("");
  document.getElementById("m-fractie").innerHTML = '<option value="">Alle fracties</option>' + Object.keys(fracties).sort().map(function (f) { return "<option>" + esc(f) + "</option>"; }).join("");
  document.getElementById("m-zoek").addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { mFilter.q = ev.target.value.trim(); mFilter.n = 60; mensenTonen(); }, 200); });
  document.getElementById("m-land").addEventListener("change", function (ev) { mFilter.land = ev.target.value; mFilter.n = 60; mensenTonen(); });
  document.getElementById("m-fractie").addEventListener("change", function (ev) { mFilter.fractie = ev.target.value; mFilter.n = 60; mensenTonen(); });
  document.getElementById("m-meer").addEventListener("click", function () { mFilter.n += 60; mensenTonen(); });
  document.getElementById("m-rol").addEventListener("change", function (ev) { mFilter.rol = ev.target.checked; mensenTonen(); });
  document.getElementById("m-wis").addEventListener("click", function () {
    mFilter.land = mFilter.fractie = ""; mFilter.rol = false; mFilter.n = 60;
    document.getElementById("m-land").value = document.getElementById("m-fractie").value = ""; document.getElementById("m-rol").checked = false;
    mensenTonen();
  });
  bijKaartTik(document.getElementById("m-lijst"), ".mkaart", function (k) { openPersoon(k.dataset.id); });
  bijKaartTik(document.getElementById("m-lijst"), ".bkaart", function (k) { openBestuurder(k.dataset.id); });
  document.getElementById("m-soort").addEventListener("click", function (ev) {
    var c = ev.target.closest(".chip");
    if (!c) return;
    alle("#m-soort .chip").forEach(function (x) { x.classList.toggle("actief", x === c); });
    mFilter.soort = c.dataset.m; mensenTonen();
  });
}
var mensenOpgezet = false;
function mensenTab(q) {
  var doel = document.getElementById("m-lijst");
  bezig(doel);
  Promise.all([mensenLaden(), laden("debatten"), laden("stemmen"), laden("dossiers-kort")]).then(function (r) {
    if (!Object.keys(DKORT).length) r[3].forEach(function (d) { DKORT[d.ref] = d; });
    if (!DEBATTEN) DEBATTEN = r[1];
    if (!STEMMEN) { STEMMEN = r[2]; STEMMEN.stemmen.forEach(function (s) { STEM_INDEX[s.id] = s; }); }
    if (!mensenOpgezet) { mensenOpgezet = true; mensenOpzetten(); }
    mensenTonen();
    if (q.id) openPersoon(q.id);
  }).catch(function () { laadFout(doel); });
}

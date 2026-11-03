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
    + '<div class="kaartkop"><h3>' + esc(p.naam) + (p.land === "NL" ? " 🇳🇱" : "") + "</h3></div>"
    + '<div class="klein">' + (p.partij ? esc(p.partij) + " · " : "") + fr(p.fractie) + (p.land ? " · " + esc(landNaam(p.land)) : "") + "</div>"
    + (feiten.length ? '<div class="klein feitregel">' + feiten.join(" · ") + "</div>" : "")
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}
function persoonDetail(p) {
  var ap = p.stemmen.filter(function (x) { return x[2]; }).length, af = p.stemmen.filter(function (x) { return x[3]; }).length;
  var h = '<div class="kaartkop"><div class="klein">' + (p.partij ? esc(p.partij) + " · " : "") + fr(p.fractie) + (p.land ? " · " + esc(landNaam(p.land)) : "") + "</div></div>"
    + "<h2 class='paneel-kop'>" + esc(p.naam) + "</h2>"
    + '<div class="knoprij">' + a("https://www.europarl.europa.eu/meps/nl/" + p.id, "Profiel bij het Parlement") + "</div>";
  if (p.stemmen.length) h += '<div class="spelers"><span>Hoofdstemmingen</span><span>stemde in ' + gestemd(p) + " van de " + p.stemmen.length + "</span><span>Anders dan partij</span><span>" + ap + "×</span><span>Anders dan fractie</span><span>" + af + "×</span></div>";
  function dl(l) { return l.map(function (x) { return '<li><a href="#dossiers?open=' + encodeURIComponent(x[0]) + '">' + esc(x[0]) + "</a> " + esc((DKORT[x[0]] || {}).titel || "") + (x[1] ? " (" + esc(x[1]) + ")" : "") + (x[2] ? " · afgerond" : "") + "</li>"; }).join(""); }
  if (p.rap.length) h += "<h4>Rapporteur</h4><ul class='punten'>" + dl(p.rap) + "</ul>";
  if (p.schaduw.length) h += "<h4>Schaduwrapporteur</h4><ul class='punten'>" + dl(p.schaduw) + "</ul>";
  if (p.debatten.length) h += "<h4>Sprak in debatten (laatste drie zittingen)</h4><ul class='punten'>" + p.debatten.map(function (i) {
    var x = DEBATTEN.debatten[i]; return x ? "<li>" + kort(x.datum) + ": " + esc(x.titel) + " · " + a(x.verslag, "verslag") + "</li>" : "";
  }).join("") + "</ul>";
  if (p.stemmen.length) h += "<h4>Hoe " + esc(p.naam) + " stemde</h4><ul class='punten'>" + p.stemmen.map(function (x) {
    var s = STEM_INDEX[x[0]] || { titel: "Stemming " + x[0], moment: "" };
    return "<li>" + kort(s.moment) + ': <a href="#stemmingen?id=' + esc(x[0]) + '">' + esc(s.titel) + "</a>: <b>" + POS[x[1]][1] + "</b>"
      + (x[2] ? ' <span class="label">anders dan partij</span>' : "") + (x[3] ? ' <span class="label">anders dan fractie</span>' : "") + "</li>";
  }).join("") + "</ul>";
  if (!p.rap.length && !p.schaduw.length && !p.debatten.length && !p.stemmen.length) h += '<p class="klein">Geen rollen, debatten of stemmen in de opgehaalde gegevens.</p>';
  return h + notitie("m:" + p.id);
}
function openPersoon(id) { var p = MENSEN_INDEX[id]; if (p) openPaneel(p.naam, persoonDetail(p)); }

var mFilter = { q: "", land: "", fractie: "", rol: false, n: 60 };
function mensenTonen() {
  var q = mFilter.q.toLowerCase();
  var uit = MENSEN.filter(function (p) {
    if (mFilter.land && p.land !== mFilter.land) return false;
    if (mFilter.fractie && p.fractie !== mFilter.fractie) return false;
    if (mFilter.rol && !p.rap.concat(p.schaduw).some(function (x) { return !x[2]; })) return false;
    if (q && (p.naam + " " + p.partij + " " + p.fractie + " " + landNaam(p.land)).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (x, y) { return (x.land === "NL" ? 0 : 1) - (y.land === "NL" ? 0 : 1) || landNaam(x.land).localeCompare(landNaam(y.land)) || (x.fractie || "").localeCompare(y.fractie || "") || (x.partij || "").localeCompare(y.partij || "") || x.naam.localeCompare(y.naam); });
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

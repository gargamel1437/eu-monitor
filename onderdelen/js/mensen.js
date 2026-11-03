// =====================================================================
//  mensen.js: europarlementariërs met hun rollen in dossiers, debatten en stemgedrag.
// =====================================================================

var MENSEN = null, MENSEN_INDEX = {};

function mensenLaden() {
  return laden("mensen").then(function (lijst) {
    if (!MENSEN) { MENSEN = lijst; lijst.forEach(function (p) { MENSEN_INDEX[p.id] = p; }); }
    return MENSEN;
  });
}
// In mensen.json staan stemmen als [id, positie, anders dan partij, anders dan fractie]
// en debatten als nummer in debatten.json.
function gestemd(p) { return p.stemmen.filter(function (x) { return x[1] !== "DID_NOT_VOTE"; }).length; }
// Rollen staan als [procedurenummer, parlementscommissie, afgerond]; titels komen uit dossiers-kort.json.
var DKORT = {};
function lopend(l) { return l.filter(function (x) { return !x[2]; }).length; }

function persoonKaart(p) {
  var feiten = [];
  if (p.rap.length) feiten.push("rapporteur: " + lopend(p.rap) + " lopend");
  if (p.schaduw.length) feiten.push("schaduw: " + lopend(p.schaduw) + " lopend");
  if (p.debatten.length) feiten.push(p.debatten.length + " debatten");
  if (p.land === "NL" && p.stemmen.length) feiten.push("stemde in " + gestemd(p) + "/" + p.stemmen.length);
  return '<div class="kaart compact mkaart" data-id="' + esc(p.id) + '" role="button" tabindex="0">'
    + '<div class="kaartkop"><h3>' + esc(p.naam) + (p.land === "NL" ? " 🇳🇱" : "") + "</h3>" + ster("mensen", p.id) + "</div>"
    + '<div class="klein">' + (p.partij ? esc(p.partij) + " · " : "") + fr(p.fractie) + (p.land && p.land !== "NL" ? " · " + esc(p.land) : "") + "</div>"
    + (feiten.length ? '<div class="klein feitregel">' + feiten.join(" · ") + "</div>" : "")
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}
function persoonDetail(p) {
  var ap = p.stemmen.filter(function (x) { return x[2]; }).length, af = p.stemmen.filter(function (x) { return x[3]; }).length;
  var h = '<div class="kaartkop"><div class="klein">' + (p.partij ? esc(p.partij) + " · " : "") + fr(p.fractie) + (p.land ? " · " + esc(p.land) : "") + "</div>" + ster("mensen", p.id) + "</div>"
    + "<h2 class='paneel-kop'>" + esc(p.naam) + "</h2>"
    + '<div class="knoprij">' + a("https://www.europarl.europa.eu/meps/nl/" + p.id, "Profiel bij het Parlement") + "</div>";
  if (p.land === "NL" && p.stemmen.length) h += '<div class="spelers"><span>Hoofdstemmingen</span><span>stemde in ' + gestemd(p) + " van de " + p.stemmen.length + "</span><span>Anders dan partij</span><span>" + ap + "×</span><span>Anders dan fractie</span><span>" + af + "×</span></div>";
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

var mFilter = { q: "", wie: "NL", volg: false, rol: false };
function mensenTonen() {
  var q = mFilter.q.toLowerCase();
  var uit = MENSEN.filter(function (p) {
    if (mFilter.wie === "NL" && p.land !== "NL") return false;
    if (mFilter.volg && !volgt("mensen", p.id)) return false;
    if (mFilter.rol && !p.rap.concat(p.schaduw).some(function (x) { return !x[2]; })) return false;
    if (q && (p.naam + " " + p.partij + " " + p.fractie).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (x, y) { return (x.fractie || "").localeCompare(y.fractie || "") || (x.partij || "").localeCompare(y.partij || "") || x.naam.localeCompare(y.naam); });
  document.getElementById("m-aantal").textContent = uit.length + " personen";
  var doel = document.getElementById("m-lijst");
  doel.innerHTML = uit.slice(0, 120).map(persoonKaart).join("") || '<p class="leeg">Niemand gevonden.</p>';
  filterTeller("m-filterknop", (mFilter.wie !== "NL" ? 1 : 0) + (mFilter.volg ? 1 : 0) + (mFilter.rol ? 1 : 0));
}
function mensenOpzetten() {
  var wacht = null;
  document.getElementById("m-zoek").addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { mFilter.q = ev.target.value.trim(); mensenTonen(); }, 200); });
  document.getElementById("m-wie").addEventListener("change", function (ev) { mFilter.wie = ev.target.value; mensenTonen(); });
  document.getElementById("m-volg").addEventListener("change", function (ev) { mFilter.volg = ev.target.checked; mensenTonen(); });
  document.getElementById("m-rol").addEventListener("change", function (ev) { mFilter.rol = ev.target.checked; mensenTonen(); });
  document.getElementById("m-wis").addEventListener("click", function () {
    mFilter.wie = "NL"; mFilter.volg = mFilter.rol = false;
    document.getElementById("m-wie").value = "NL"; document.getElementById("m-volg").checked = document.getElementById("m-rol").checked = false;
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

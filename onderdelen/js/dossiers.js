// =====================================================================
//  dossiers.js: alle lopende procedures. Compacte kaarten; tik voor alle details.
// =====================================================================

var DOSSIERS = null, DOSSIER_INDEX = {};

function rapporteursVan(d) {
  var uit = [];
  (d.commissies || []).forEach(function (c) {
    (c.rapporteurs || []).forEach(function (r) { uit.push({ id: r.id, naam: r.naam, fractie: r.fractie, commissie: c.code, rol: c.rol }); });
  });
  return uit;
}
function verantwoordelijk(d) { return (d.commissies || []).filter(function (c) { return /responsible/i.test(c.rol); }); }
function isNLid(id) { return MENSEN_INDEX[id] && MENSEN_INDEX[id].land === "NL"; }
function heeftNL(d) { return rapporteursVan(d).concat(d.schaduw || []).some(function (p) { return isNLid(p.id); }); }
function persoonLink(p, extra) {
  return '<a href="#mensen?id=' + esc(p.id) + '" class="persoon">' + esc(p.naam) + "</a>" + (isNLid(p.id) ? ' <span class="klein">(NL)</span>' : "")
    + " " + fr(FR_OEIL[p.fractie] || p.fractie) + (extra ? ' <span class="klein">' + esc(extra) + "</span>" : "");
}
function toekomstig(d) { return (d.vooruit || []).filter(function (v) { return v.datum >= vandaag(); }); }
function titelVan(d) { return (d.eigen && d.eigen.titel) || d.titel; }

function stappenBalk(d, metNamen) {
  if (d.fase == null) return "";
  var data = {};
  (d.gebeurtenissen || []).forEach(function (g) { if (g.fase != null && !(g.fase in data)) data[g.fase] = g.datum; });
  return '<div class="stappen' + (metNamen ? "" : " mini-stappen") + '">' + FASEN.map(function (n, i) {
    var k = i === d.fase && i < 5 ? "nu" : (i <= d.fase ? "ja" : "");
    return '<div class="stap ' + k + '"><i></i>' + (metNamen ? n + "<small>" + (i in data && i <= d.fase ? kort(data[i]) : "&nbsp;") + "</small>" : "") + "</div>";
  }).join("") + "</div>";
}

function feitenDossier(d) {
  var r = [d.ref + " — " + (d.eigen && d.eigen.titel ? d.eigen.titel + " / " : "") + d.titel,
    "Soort: " + (d.soort_naam || d.soort) + (d.instrument ? " (" + d.instrument + ")" : ""),
    "Stand van zaken: " + d.status + (d.fase != null ? " — fase: " + FASEN[d.fase] : "")];
  if (d.begin) r.push("Eerste stap: " + d.begin + (d.laatst ? " · laatste stap: " + d.laatst : ""));
  verantwoordelijk(d).forEach(function (c) { r.push("Parlementscommissie: " + c.code + " (" + c.naam + ")"); });
  rapporteursVan(d).forEach(function (p) { r.push("Rapporteur (" + p.commissie + "): " + p.naam + " (" + p.fractie + ")"); });
  if ((d.schaduw || []).length) r.push("Schaduwrapporteurs: " + d.schaduw.map(function (p) { return p.naam + " (" + p.fractie + ")"; }).join(", "));
  if (d.commissaris) r.push("Eurocommissaris: " + d.commissaris + (d.dg ? " · DG: " + d.dg : ""));
  toekomstig(d).forEach(function (v) { r.push("Gepland: " + v.datum + " — " + v.wat); });
  (d.gebeurtenissen || []).slice(-5).forEach(function (g) { r.push("Stap: " + g.datum + " — " + g.wat + (g.doc ? " (" + g.doc + ")" : "")); });
  (d.stemmen || []).forEach(function (s) { r.push(""); r.push(feitenStemKort(s)); });
  r.push("", "Bron: " + d.url);
  return r.join("\n");
}

function dossierKaart(d) {
  var rap = rapporteursVan(d).filter(function (p) { return /responsible/i.test(p.rol); })[0];
  var plan = toekomstig(d)[0];
  var feiten = [];
  if (rap) feiten.push("Rapporteur " + esc(rap.naam) + (isNLid(rap.id) ? " (NL)" : ""));
  else if (verantwoordelijk(d)[0]) feiten.push(esc(verantwoordelijk(d)[0].code));
  if (plan) feiten.push("gepland " + kort(plan.datum));
  else if (d.laatst) feiten.push("laatste stap " + kort(d.laatst));
  return '<div class="kaart compact dkaart" data-ref="' + esc(d.ref) + '" role="button" tabindex="0">'
    + '<div class="kaartkop"><div class="klein">' + esc(d.ref) + " · " + esc(d.soort_naam || d.soort) + (d.eigen && d.eigen.titel ? ' · <span class="label">eigen samenvatting</span>' : "") + ((d.pers || []).length ? ' · <span class="label officieel">' + d.pers.length + " uit Brussel</span>" : "") + "</div></div>"
    + '<h3 class="twee-regels">' + esc(titelVan(d)) + "</h3>"
    + '<div class="klein status">' + esc(d.status) + "</div>"
    + stappenBalk(d, false)
    + (feiten.length ? '<div class="klein feitregel">' + feiten.join(" · ") + "</div>" : "")
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}

function dossierDetail(d) {
  var e = d.eigen || {};
  KOPIEER["d:" + d.ref] = function () { return feitenDossier(d); };
  var h = '<div class="kaartkop"><div class="klein">' + esc(d.ref) + " · " + esc(d.soort_naam || d.soort) + (d.instrument ? " · " + esc(d.instrument) : "") + "</div></div>"
    + "<h2 class='paneel-kop'>" + esc(titelVan(d)) + "</h2>" + (e.titel ? '<p class="klein en">' + esc(d.titel) + "</p>" : "")
    + '<p class="klein">Stand: <b>' + esc(d.status) + "</b></p>" + stappenBalk(d, true)
    + '<div class="knoprij"><button class="mini" data-kopieer="d:' + esc(d.ref) + '">Kopieer feiten</button>' + deelKnop(titelVan(d) + " (" + d.ref + ")", d.url) + a(d.url, "Legislative Observatory") + "</div>";
  if (e.probleem || e.verandert) {
    h += '<h4>Eigen samenvatting</h4><dl class="feiten">' + (e.probleem ? "<dt>Aanleiding (volgens de Commissie)</dt><dd>" + esc(e.probleem) + "</dd>" : "")
      + (e.verandert ? "<dt>Wat het voorstel inhoudt</dt><dd>" + esc(e.verandert) + "</dd>" : "") + "</dl>"
      + ((e.links || []).length ? '<p class="klein">Bron: ' + e.links.map(function (l) { return a(l[1], l[0]); }).join(" · ") + "</p>" : "");
  }
  if ((d.pers || []).length) h += '<h4>Persberichten</h4><div class="officieel-koppel"><p class="klein">Persberichten van Commissie of Raad die automatisch aan dit dossier zijn gekoppeld. Het label zegt waarop: procedurenummer, COM-document, eigen bron of trefwoorden in de kop. Controleer zelf of ze echt over dit dossier gaan.</p><ul class="lijst officieel">'
    + d.pers.map(function (b) { return lijstRegel(b.link, esc(b.titel), "<span>" + esc(b.bron) + "</span><span>" + kort(b.datum) + "</span>" + (b.soort ? "<span>" + esc(b.soort) + "</span>" : "") + '<span class="label">' + esc(b.hoe) + "</span>", true); }).join("") + "</ul></div>";
  var plan = toekomstig(d);
  if (plan.length) h += "<h4>Gepland</h4><ul class='punten'>" + plan.map(function (v) { return "<li><b>" + kort(v.datum) + "</b>: " + esc(v.wat) + " " + icsKnop(v.wat + ": " + titelVan(d), v.datum, d.ref, d.url, v.ics) + "</li>"; }).join("") + "</ul>";
  h += "<h4>Wie is betrokken</h4>";
  (d.commissies || []).forEach(function (c) {
    var rol = c.rol.replace("Joint committee responsible", "samen verantwoordelijk").replace("Committee responsible", "verantwoordelijk")
      .replace("Committee for opinion", "geeft advies").replace("Committee for budgetary assessment", "begrotingsadvies");
    h += '<p class="klein"><b>' + esc(c.code) + "</b> " + esc(c.naam) + " — " + esc(rol) + (c.wacht ? " (verwijzing nog niet definitief)" : "") + "<br>"
      + ((c.rapporteurs || []).length ? c.rapporteurs.map(function (p) { return persoonLink(p); }).join(", ") : "geen rapporteur bekend") + "</p>";
  });
  if ((d.schaduw || []).length) h += '<p class="klein"><b>Schaduwrapporteurs</b><br>' + d.schaduw.map(function (p) { return persoonLink(p, p.commissie); }).join("<br>") + "</p>";
  if (d.commissaris || d.dg) h += '<p class="klein"><b>Europese Commissie</b><br>' + esc(d.commissaris || "") + (d.dg ? " · DG " + esc(d.dg) : "") + "</p>";
  if ((d.raad || []).length) h += '<p class="klein"><b>Raad</b><br>' + d.raad.map(function (r) { return esc(r.configuratie) + " · " + kort(r.datum); }).join("<br>") + "</p>";
  h += "<h4>Alle stappen</h4>" + ((d.gebeurtenissen || []).length ? '<ol class="tijdlijn">' + d.gebeurtenissen.map(function (g) {
    return "<li><time>" + kort(g.datum) + "</time>" + esc(g.wat) + (g.doc ? " · " + a(g.url, g.doc) : "") + "</li>";
  }).join("") + "</ol>" : '<p class="klein">Geen stappen bekend.</p>');
  if ((d.stemmen || []).length) h += "<h4>Stemmingen in het Parlement</h4>" + d.stemmen.map(function (s) {
    return '<p class="klein">' + kort(s.moment) + ": " + esc(s.titel) + " — " + uitslag(s.uitslag) + " " + (s.totaal.FOR || 0) + "–" + (s.totaal.AGAINST || 0) + "–" + (s.totaal.ABSTENTION || 0)
      + ' · <a href="#stemmingen?id=' + esc(s.id) + '">details</a></p>';
  }).join("");
  if ((d.documenten || []).length) h += "<h4>Documenten</h4><ul class='punten'>" + d.documenten.map(function (x) { return "<li>" + kort(x.datum) + " · " + esc(x.soort) + ": " + a(x.url, x.ref) + "</li>"; }).join("") + "</ul>";
  if (d.transparantie_aantal) h += "<h4>Ontmoetingen met belangenvertegenwoordigers</h4><p class='klein'>Opgegeven door (schaduw)rapporteurs" + (d.transparantie_aantal >= 10 ? "; OEIL toont er 10 per pagina, zie de bron voor alles" : "") + ".</p><ul class='punten'>"
    + d.transparantie.map(function (t) { return "<li>" + kort(t.datum) + " · " + esc(t.wie) + " (" + esc(t.rol) + "): " + esc(t.met) + "</li>"; }).join("") + "</ul>";
  if ((d.onderwerpen || []).length) h += '<p class="klein">Onderwerpen (OEIL): ' + d.onderwerpen.map(function (o) { return esc(o[0] + " " + o[1]); }).join("; ") + "</p>";
  return h + notitie("d:" + d.ref);
}
function openDossier(ref, dieper) { var d = DOSSIER_INDEX[ref]; if (d) openPaneel(d.ref, dossierDetail(d), { dieper: dieper }); }
// alleen de gegevens klaarzetten (ook als je een dossier vanuit een ander scherm opent)
function dossiersLaden() {
  return Promise.all([laden("dossiers"), mensenLaden()]).then(function (r) {
    if (!DOSSIERS) { DOSSIERS = r[0]; dossiersOpzetten(); }
    return DOSSIERS;
  });
}

var dZoek = "", dN = 30, DOPT = {};
var DF = maakFilter("d", [
  { id: "sort", naam: "Sorteren", meer: false, standaard: "laatst", opties: [["laatst", "Laatst bijgewerkt"], ["nieuw", "Nieuwste eerst"], ["gepland", "Eerstvolgende geplande stap"], ["naam", "Op naam"]] },
  { id: "fase", naam: "Fase", meer: true, standaard: [], opties: FASEN.map(function (f) { return [f, f]; }) },
  { id: "terrein", naam: "Onderwerp", meer: true, standaard: [], opties: function () { return DOPT.terrein || []; } },
  { id: "commissie", naam: "Parlementscommissie", meer: true, standaard: [], opties: function () { return DOPT.commissie || []; } },
  { id: "soort", naam: "Soort procedure", meer: true, standaard: [], opties: function () { return DOPT.soort || []; } },
  { id: "jaar", naam: "Jaar", meer: true, standaard: [], opties: function () { return DOPT.jaar || []; } },
  { id: "rapporteur", naam: "Rapporteur", meer: true, standaard: [], opties: [["nl", "Nederlandse (schaduw)rapporteur"]] },
  { id: "ook", naam: "Ook tonen", meer: true, alles: false, standaard: [], opties: [["afgerond", "Afgeronde dossiers (laatste 6 maanden)"]] }
], function () { dN = 30; if (DOSSIERS) dossiersTonen(); });
function dossiersTonen() {
  var z = zoeker(dZoek);
  var uit = DOSSIERS.filter(function (d) {
    if (!DF.aan("ook", "afgerond") && d.afgerond && !(d.eigen && d.eigen.titel) && z.leeg) return false;
    if (!DF.past("fase", d.fase == null ? "-" : FASEN[d.fase])) return false;
    if (!DF.past("terrein", d.terreinen || [])) return false;
    if (!DF.past("commissie", verantwoordelijk(d).map(function (c) { return c.code; }))) return false;
    if (!DF.past("soort", d.soort) || !DF.past("jaar", d.ref.slice(0, 4))) return false;
    if (DF.aan("rapporteur", "nl") && !heeftNL(d)) return false;
    return z.past(d.ref + " " + d.titel + " " + ((d.eigen || {}).titel || "") + " " + rapporteursVan(d).map(function (p) { return p.naam; }).join(" ") + " " + (d.commissaris || ""), d);
  });
  var s = DF.w("sort");
  uit.sort(function (x, y) {
    if (s === "naam") return titelVan(x).localeCompare(titelVan(y));
    if (s === "nieuw") return (y.begin || "").localeCompare(x.begin || "") || y.ref.localeCompare(x.ref);
    if (s === "gepland") return ((toekomstig(x)[0] || {}).datum || "9999").localeCompare((toekomstig(y)[0] || {}).datum || "9999");
    return (y.laatst || "").localeCompare(x.laatst || "");
  });
  uit = z.ordenen(uit);
  bedoelJe("d-zoek", z);
  var doel = document.getElementById("d-lijst");
  document.getElementById("d-aantal").textContent = uit.length + " dossiers";
  doel.innerHTML = uit.slice(0, dN).map(dossierKaart).join("") || '<p class="leeg">Geen dossiers met deze filters.</p>';
  document.getElementById("d-meer").classList.toggle("verborgen", uit.length <= dN);
  window.euMarkeer(doel);
  return uit;
}

function dossiersOpzetten() {
  var ter = {}, com = {}, soort = {}, jaar = {};
  DOSSIERS.forEach(function (d) {
    DOSSIER_INDEX[d.ref] = d;
    (d.terreinen || []).forEach(function (t) { ter[t] = 1; });
    verantwoordelijk(d).forEach(function (c) { com[c.code] = c.naam || c.code; });
    soort[d.soort] = d.soort_naam || d.soort; jaar[d.ref.slice(0, 4)] = 1;
  });
  DOPT.terrein = Object.keys(ter).sort().map(function (t) { return [t, t]; });
  DOPT.commissie = Object.keys(com).sort().map(function (c) { return [c, c + " – " + com[c]]; });
  DOPT.soort = Object.keys(soort).sort().map(function (s) { return [s, soort[s] + " (" + s + ")"]; });
  DOPT.jaar = Object.keys(jaar).sort().reverse().map(function (j) { return [j, j]; });
  var wacht = null;
  document.getElementById("d-zoek").addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { dZoek = ev.target.value.trim(); dN = 30; dossiersTonen(); }, 200); });
  document.getElementById("d-meer").addEventListener("click", function () { dN += 30; dossiersTonen(); });
  bijKaartTik(document.getElementById("d-lijst"), ".dkaart", function (k) { openDossier(k.dataset.ref); });
}

function dossiersTab(q) {
  var doel = document.getElementById("d-lijst");
  bezig(doel);
  dossiersLaden().then(function () {
    if (q.q != null) { dZoek = q.q; document.getElementById("d-zoek").value = q.q; }
    var uit = dossiersTonen();
    if (q.open && DOSSIER_INDEX[q.open]) openDossier(q.open);
    else if (q.q && uit.length === 1) openDossier(uit[0].ref);
  }).catch(function () { laadFout(doel); });
}

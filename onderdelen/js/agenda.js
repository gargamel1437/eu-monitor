// =====================================================================
//  agenda.js: de komende 4 weken en de debatten van de laatste drie zittingen.
// =====================================================================

var AGENDA = null, DEBATTEN = null;

var aFilter = { soort: "", q: "" };
function agendaTonen() {
  var q = aFilter.q.toLowerCase();
  var items = AGENDA.items.filter(function (i) {
    return (!aFilter.soort || i.soort === aFilter.soort) && (!q || (i.titel + " " + (i.punten || []).join(" ")).toLowerCase().indexOf(q) >= 0);
  });
  var h = "", huidig = null;
  items.forEach(function (i) {
    if (i.datum !== huidig) { if (huidig) h += "</div>"; h += '<h2 class="dag">' + esc(lang(i.datum)) + '</h2><div class="kaart">'; huidig = i.datum; }
    h += '<div class="agendapunt"><div class="meta2"><span class="label">' + esc(i.soort) + "</span>" + icsKnop(i.titel, i.datum, (i.punten || []).join("\n"), i.url) + "</div>"
      + '<div class="regel">' + (i.ref ? '<a href="#dossiers?q=' + encodeURIComponent(i.ref) + '">' + esc(i.titel) + "</a>" : esc(i.titel)) + "</div>"
      + ((i.punten || []).length ? '<ul class="punten">' + i.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : "")
      + (i.extra ? '<p class="klein">' + esc(i.extra) + "</p>" : "")
      + (i.url && !i.ref ? '<p class="klein">' + a(i.url, "Officiële agenda") + "</p>" : "") + "</div>";
  });
  if (huidig) h += "</div>";
  if ((AGENDA.later || []).length) h += '<p class="klein" style="margin:8px 4px">Daarna: plenaire vergadering vanaf ' + kort(AGENDA.later[0].datum) + " in " + esc(AGENDA.later[0].plaats) + ".</p>";
  var doel = document.getElementById("a-lijst");
  doel.innerHTML = h || '<p class="leeg">Niets gevonden voor de komende 4 weken.</p>';
  filterTeller("a-filterknop", aFilter.soort ? 1 : 0);
  window.euMarkeer(doel);
}

var dbFilter = { nl: false, sort: "datum", q: "" };
function sprekers(x) { return (x.fracties || []).reduce(function (s, f) { return s + f[1]; }, 0); }
function debatDetail(x) {
  return '<div class="klein">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</div><h2 class='paneel-kop'>" + esc(x.titel) + "</h2>"
    + '<p class="klein">' + (x.sprekers_bekend ? sprekers(x) + " sprekers uit het Parlement" + (x.overige_sprekers ? " · " + x.overige_sprekers + " overige sprekers (bijvoorbeeld Commissie of Raad)" : "") : "Sprekers niet beschikbaar") + "</p>"
    + '<div class="fracties">' + (x.fracties || []).map(function (f) { return "<span><i style='background:" + (KLEUR[f[0]] || "#999") + "'></i>" + esc(f[0]) + " " + f[1] + "</span>"; }).join("") + "</div>"
    + ((x.nederlanders || []).length ? "<h4>Nederlandse sprekers</h4><ul class='punten'>" + x.nederlanders.map(function (p) { return '<li><a href="#mensen?id=' + esc(p.id) + '">' + esc(p.naam) + "</a> (" + esc(p.partij) + ")</li>"; }).join("") + "</ul>" : "")
    + '<div class="knoprij">' + a(x.verslag, "Verslag van het debat") + "</div>" + notitie("db:" + x.datum + ":" + x.nummer);
}
function debattenTonen() {
  var q = dbFilter.q.toLowerCase();
  var l = DEBATTEN.debatten.filter(function (x) { return (!dbFilter.nl || (x.nederlanders || []).length) && (!q || x.titel.toLowerCase().indexOf(q) >= 0); });
  l.sort(function (x, y) { return dbFilter.sort === "sprekers" ? sprekers(y) - sprekers(x) : (y.datum.localeCompare(x.datum) || x.nummer - y.nummer); });
  var h = "", huidig = null;
  l.forEach(function (x, i) {
    if (dbFilter.sort === "datum" && x.datum !== huidig) { h += '<h2 class="dag">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</h2>"; huidig = x.datum; }
    var nl = (x.nederlanders || []).map(function (p) { return esc(p.naam); });
    h += '<div class="kaart compact dbkaart" data-i="' + DEBATTEN.debatten.indexOf(x) + '" role="button" tabindex="0">'
      + (dbFilter.sort !== "datum" ? '<div class="klein">' + kort(x.datum) + "</div>" : "")
      + '<h3 class="twee-regels">' + esc(x.titel) + "</h3>"
      + '<div class="klein feitregel">' + (x.sprekers_bekend ? sprekers(x) + " sprekers" : "sprekers onbekend") + (nl.length ? " · 🇳🇱 " + nl.join(", ") : "") + "</div>"
      + '<span class="pijl" aria-hidden="true">›</span></div>';
  });
  var doel = document.getElementById("db-lijst");
  doel.innerHTML = ((DEBATTEN.zittingen || []).length ? '<p class="intro">Zittingen: ' + DEBATTEN.zittingen.map(function (z) { return kort(z.begin) + "–" + kort(z.eind) + " (" + esc(z.plaats) + ")"; }).join(", ") + ".</p>" : "")
    + (h || '<p class="leeg">Geen debatten gevonden.</p>');
  filterTeller("db-filterknop", (dbFilter.nl ? 1 : 0) + (dbFilter.sort !== "datum" ? 1 : 0));
  window.euMarkeer(doel);
}
function agendaOpzetten() {
  document.getElementById("a-soort").addEventListener("change", function (ev) { aFilter.soort = ev.target.value; agendaTonen(); });
  var w1 = null, w2 = null;
  document.getElementById("a-zoek").addEventListener("input", function (ev) { clearTimeout(w1); w1 = setTimeout(function () { aFilter.q = ev.target.value.trim(); agendaTonen(); }, 200); });
  document.getElementById("db-nl").addEventListener("change", function (ev) { dbFilter.nl = ev.target.checked; debattenTonen(); });
  document.getElementById("db-sort").addEventListener("change", function (ev) { dbFilter.sort = ev.target.value; debattenTonen(); });
  document.getElementById("db-zoek").addEventListener("input", function (ev) { clearTimeout(w2); w2 = setTimeout(function () { dbFilter.q = ev.target.value.trim(); debattenTonen(); }, 200); });
  bijKaartTik(document.getElementById("db-lijst"), ".dbkaart", function (k) { var x = DEBATTEN.debatten[+k.dataset.i]; openPaneel("Debat", debatDetail(x)); });
}
function agendaTab() {
  var doel = document.getElementById("a-lijst");
  bezig(doel);
  Promise.all([laden("agenda"), laden("debatten")]).then(function (r) {
    if (!AGENDA) { AGENDA = r[0]; DEBATTEN = DEBATTEN || r[1]; agendaOpzetten(); }
    agendaTonen(); debattenTonen();
  }).catch(function () { laadFout(doel); });
}

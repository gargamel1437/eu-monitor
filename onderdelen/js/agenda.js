// =====================================================================
//  agenda.js: deze week, de weken daarna (tot 4 weken vooruit): Parlement, Raad, EU-toppen
//  en dossierstappen. Daarnaast de planning van de Commissie (per kwartaal) en de debatten
//  van de laatste drie zittingen. Elk item staat maar één keer: onder Deze week of onder Daarna.
// =====================================================================

var AGENDA = null, DEBATTEN = null;

var aFilter = { soort: "", q: "", informeel: true };
function soortLabel(s) { return '<span class="label soort-' + esc(s.toLowerCase().replace(/[^a-z]+/g, "-")) + '">' + esc(s) + "</span>"; }
// Tijden staan in Brusselse tijd (dezelfde als in Nederland). Alleen tonen wat de bron geeft.
function uur(isoTijd) { return isoTijd && isoTijd.length > 10 ? isoTijd.slice(11, 16) : ""; }
function tijdTekst(i) { var b = uur(i.begin), e = uur(i.eind); return b ? b + (e && e !== b ? "–" + e : "") : ""; }
function agendaTekst(i) {
  return [i.titel, i.soort, i.extra || "", (i.punten || []).join(" "), i.ref || "",
    (i.blokken || []).map(function (b) { return b.soort + " " + b.punten.join(" "); }).join(" "),
    (i.dossiers || []).map(function (d) { return d.ref + " " + d.titel; }).join(" ")].join(" ");
}
// zondag van deze week (n = 0) of van over n weken
function zondag(n) { var d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7 + 7 * n); return iso(d); }
function agendaPunt(i) {
  var tijd = tijdTekst(i), h = '<div class="agendapunt"><div class="meta2"><span class="links">' + soortLabel(i.soort)
    + "</span>"
    + icsKnop(i.titel, i.datum, (i.punten || []).join("\n"), i.url, i.ics) + "</div>"
    + '<div class="regel">' + (tijd ? '<span class="tijd">' + tijd + "</span> " : "") + (i.ref ? '<a href="#dossiers?open=' + encodeURIComponent(i.ref) + '">' + esc(i.titel) + "</a>" : esc(i.titel)) + "</div>";
  if ((i.blokken || []).length) {
    h += '<div class="blokken">' + i.blokken.map(function (b) {
      return '<div class="blok"><div class="blokkop"><span class="tijd">' + esc(b.begin) + (b.eind ? "–" + esc(b.eind) : "") + "</span><span>" + esc(b.soort) + "</span></div>"
        + (b.punten.length ? '<ul class="punten">' + b.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
    }).join("") + "</div>";
  } else if ((i.punten || []).length) h += '<ul class="punten">' + i.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
  if ((i.dossiers || []).length) h += '<details class="verwacht"><summary>' + i.dossiers.length + (i.dossiers.length === 1 ? " dossier" : " dossiers") + " verwacht in deze zitting (OEIL)</summary><ul class=\"punten\">"
    + i.dossiers.map(function (d) { return '<li><a href="#dossiers?open=' + encodeURIComponent(d.ref) + '">' + esc(d.titel) + '</a> <span class="klein">' + esc(d.ref) + "</span></li>"; }).join("") + "</ul></details>";
  if (i.extra) h += '<p class="klein">' + esc(i.extra) + "</p>";
  if (i.url && !i.ref) h += '<p class="klein">' + a(i.url, i.soort === "Plenaire vergadering" ? "Officiële agenda" : "Meer bij het voorzitterschap") + "</p>";
  return h + "</div>";
}
function agendaTonen() {
  var z = zoeker(aFilter.q);
  var items = AGENDA.items.filter(function (i) {
    return (!aFilter.soort || i.soort === aFilter.soort) && (aFilter.informeel || !/^Informele ministers/.test(i.titel)) && z.past(agendaTekst(i), i);
  });
  // indeling in kalenderweken (maandag t/m zondag), met Vandaag en Morgen bij de dag
  var delen = [["Deze week", zondag(0)], ["Volgende week", zondag(1)], ["Later", "9999"]];
  var h = "", vandaagIso = vandaag(), morgen = plusDagen(1);
  delen.forEach(function (deel, n) {
    var van = n ? delen[n - 1][1] : "", hier = items.filter(function (i) { return i.datum > van && i.datum <= deel[1]; });
    if (!hier.length && n > 0) return;
    h += "<h2>" + deel[0] + "</h2>";
    if (!hier.length) { h += '<p class="intro">Niets meer gepland deze week.</p>'; return; }
    var huidig = null;
    hier.forEach(function (i) {
      if (i.datum !== huidig) {
        if (huidig) h += "</div>";
        var wanneer = i.datum === vandaagIso ? "Vandaag · " : i.datum === morgen ? "Morgen · " : "";
        h += '<h2 class="dag">' + (wanneer ? '<span class="wanneer">' + wanneer + "</span>" : "") + esc(lang(i.datum)) + '</h2><div class="kaart">';
        huidig = i.datum;
      }
      h += agendaPunt(i);
    });
    h += "</div>";
  });
  if (!items.length) h = '<p class="leeg">Niets gevonden voor de komende 4 weken.</p>';
  (AGENDA.toppen_later || []).forEach(function (x) {
    h += '<p class="klein" style="margin:8px 4px">Daarna: <span class="label soort-eu-top">EU-top</span> ' + a(x.url, x.titel) + " op " + esc(lang(x.datum)) + (x.eind ? " t/m " + esc(lang(x.eind)) : "") + (x.plaats ? " in " + esc(x.plaats) : "") + ".</p>";
  });
  if ((AGENDA.later || []).length) h += '<p class="klein" style="margin:8px 4px">Daarna: plenaire vergadering vanaf ' + kort(AGENDA.later[0].datum) + " in " + esc(AGENDA.later[0].plaats) + ".</p>";
  h += opgehaald("parlement", "Parlement") + opgehaald("raad", "Raad en EU-toppen");
  var doel = document.getElementById("a-lijst");
  doel.innerHTML = h;
  bedoelJe("a-zoek", z);
  filterTeller("a-filterknop", (aFilter.soort ? 1 : 0) + (aFilter.informeel ? 0 : 1));
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
  var z = zoeker(dbFilter.q);
  var l = DEBATTEN.debatten.filter(function (x) { return (!dbFilter.nl || (x.nederlanders || []).length) && z.past(x.titel + " " + (x.nederlanders || []).map(function (p) { return p.naam; }).join(" "), x); });
  l.sort(function (x, y) { return dbFilter.sort === "sprekers" ? sprekers(y) - sprekers(x) : (y.datum.localeCompare(x.datum) || x.nummer - y.nummer); });
  if (dbFilter.sort !== "datum") l = z.ordenen(l);
  bedoelJe("db-zoek", z);
  var h = "", huidig = null;
  l.forEach(function (x, i) {
    if (dbFilter.sort === "datum" && x.datum !== huidig) { h += '<h2 class="dag">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</h2>"; huidig = x.datum; }
    var nl = (x.nederlanders || []).map(function (p) { return esc(p.naam); });
    h += '<div class="kaart compact dbkaart" data-i="' + DEBATTEN.debatten.indexOf(x) + '" role="button" tabindex="0">'
      + (dbFilter.sort !== "datum" ? '<div class="klein">' + kort(x.datum) + "</div>" : "")
      + '<h3 class="twee-regels">' + esc(x.titel) + "</h3>"
      + '<div class="klein feitregel">' + (x.sprekers_bekend ? sprekers(x) + " sprekers" : "sprekers onbekend") + (nl.length ? " · Nederlands: " + nl.join(", ") : "") + "</div>"
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
  document.getElementById("a-informeel").addEventListener("change", function (ev) { aFilter.informeel = ev.target.checked; agendaTonen(); });
  var w1 = null, w2 = null;
  document.getElementById("a-zoek").addEventListener("input", function (ev) { clearTimeout(w1); w1 = setTimeout(function () { aFilter.q = ev.target.value.trim(); agendaTonen(); }, 200); });
  document.getElementById("db-nl").addEventListener("change", function (ev) { dbFilter.nl = ev.target.checked; debattenTonen(); });
  document.getElementById("db-sort").addEventListener("change", function (ev) { dbFilter.sort = ev.target.value; debattenTonen(); });
  document.getElementById("db-zoek").addEventListener("input", function (ev) { clearTimeout(w2); w2 = setTimeout(function () { dbFilter.q = ev.target.value.trim(); debattenTonen(); }, 200); });
  bijKaartTik(document.getElementById("db-lijst"), ".dbkaart", function (k) { var x = DEBATTEN.debatten[+k.dataset.i]; openPaneel("Debat", debatDetail(x)); });
}
// ---------- planning van de Commissie (per kwartaal) ----------
var PLANNING = null, cFilter = { q: "", soort: "", onderwerp: "", achter: true };
var KW = ["", "1e", "2e", "3e", "4e"];
function planningTonen() {
  var z = zoeker(cFilter.q);
  var uit = PLANNING.items.filter(function (x) {
    if (!cFilter.achter && x.achter) return false;
    if (cFilter.soort && x.soort_naam !== cFilter.soort) return false;
    if (cFilter.onderwerp && (x.onderwerpen || []).indexOf(cFilter.onderwerp) < 0) return false;
    return z.past(x.titel + " " + x.titel_en + " " + x.dg + " " + x.samenvatting + " " + (x.onderwerpen || []).join(" "), x);
  });
  bedoelJe("c-zoek", z);
  var h = "", huidig = null;
  uit.forEach(function (x) {
    var kop = x.gepland;
    if (kop !== huidig) {
      if (huidig) h += "</div>";
      h += '<h2 class="dag">' + KW[x.kwartaal] + " kwartaal " + x.jaar + (kop === PLANNING.huidig ? " · nu" : "") + (x.achter ? " · nog niet aangenomen" : "") + '</h2><div class="kaart">';
      huidig = kop;
    }
    h += '<div class="agendapunt"><div class="meta2"><span class="label soort-commissie">' + esc(x.soort_naam) + "</span>" + (x.dg ? '<span class="klein">DG ' + esc(x.dg) + "</span>" : "") + "</div>"
      + '<div class="regel">' + a(x.url, x.titel) + "</div>"
      + (x.titel_en && x.titel_en !== x.titel ? '<p class="klein en">' + esc(x.titel_en) + "</p>" : "")
      + (x.reactie_tot ? '<p class="klein">Reageren kan tot ' + esc(lang(x.reactie_tot)) + "</p>" : "") + "</div>";
  });
  if (huidig) h += "</div>";
  document.getElementById("c-aantal").textContent = uit.length + " geplande initiatieven";
  var doel = document.getElementById("c-lijst");
  doel.innerHTML = (h || '<p class="leeg">Niets gevonden in de planning.</p>') + opgehaald("commissie", "Planning");
  filterTeller("c-filterknop", (cFilter.soort ? 1 : 0) + (cFilter.onderwerp ? 1 : 0) + (cFilter.achter ? 0 : 1));
  window.euMarkeer(doel);
}
function planningOpzetten() {
  var soort = {}, ond = {};
  PLANNING.items.forEach(function (x) { soort[x.soort_naam] = 1; (x.onderwerpen || []).forEach(function (o) { ond[o] = 1; }); });
  document.getElementById("c-soort").innerHTML = '<option value="">Alle soorten</option>' + Object.keys(soort).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  document.getElementById("c-onderwerp").innerHTML = '<option value="">Alle onderwerpen (Engels)</option>' + Object.keys(ond).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  document.getElementById("c-soort").addEventListener("change", function (ev) { cFilter.soort = ev.target.value; planningTonen(); });
  document.getElementById("c-onderwerp").addEventListener("change", function (ev) { cFilter.onderwerp = ev.target.value; planningTonen(); });
  document.getElementById("c-achter").addEventListener("change", function (ev) { cFilter.achter = ev.target.checked; planningTonen(); });
  var w = null;
  document.getElementById("c-zoek").addEventListener("input", function (ev) { clearTimeout(w); w = setTimeout(function () { cFilter.q = ev.target.value.trim(); planningTonen(); }, 200); });
}
function planningTab() {
  var doel = document.getElementById("c-lijst");
  bezig(doel);
  laden("commissie").then(function (d) {
    if (!PLANNING) { PLANNING = d; planningOpzetten(); }
    planningTonen();
  }).catch(function () { laadFout(doel); });
}
document.addEventListener("eu-segment", function (ev) { if (ev.detail === "a-commissie") planningTab(); });

function agendaTab() {
  var doel = document.getElementById("a-lijst");
  bezig(doel);
  Promise.all([laden("agenda"), laden("debatten")]).then(function (r) {
    if (!AGENDA) { AGENDA = r[0]; DEBATTEN = DEBATTEN || r[1]; agendaOpzetten(); }
    agendaTonen(); debattenTonen();
    if (!document.getElementById("a-commissie").classList.contains("verborgen")) planningTab();
  }).catch(function () { laadFout(doel); });
}

// =====================================================================
//  agenda.js: één agenda met filterknoppen bovenaan (Alles · Parlement · Raad · EU-top ·
//  Commissie · Dossiers · Eerder). De lijst is kort: per item soort, titel, locatie en datum.
//  Pas als je op een item tikt, zie je het programma met exacte tijden, de locatie, de
//  livestream en ＋ Agenda (de hele zitting, één dag of één dagdeel).
//  - Commissie: de vaste punten (midday briefing, College) en daaronder de planning per kwartaal.
//  - Eerder: de debatten van de laatste drie zittingen.
// =====================================================================

var AGENDA = null, DEBATTEN = null;

var aFilter = { weergave: "alles", q: "", informeel: INST.informeel, vast: INST.vastePunten };
var AGENDA_SOORT = { parlement: ["Plenaire vergadering"], raad: ["Raad"], top: ["EU-top"], commissie: ["Commissie"], dossiers: ["Parlementscommissie", "Dossierstap"] };
function soortLabel(s) { return '<span class="label soort-' + esc(s.toLowerCase().replace(/[^a-z]+/g, "-")) + '">' + esc(s === "Plenaire vergadering" ? "Parlement" : s) + "</span>"; }
// Tijden staan in Brusselse tijd (dezelfde als in Nederland). Alleen tonen wat de bron geeft.
function uur(isoTijd) { return isoTijd && isoTijd.length > 10 ? isoTijd.slice(11, 16) : ""; }
function tijdTekst(i) { var b = uur(i.begin), e = uur(i.eind); return b ? b + (e && e !== b ? "–" + e : "") : ""; }
function agendaTekst(i) {
  return [i.titel, i.soort, i.plaats || "", i.gebouw || "", i.extra || "", (i.punten || []).join(" "), i.ref || "",
    (i.dagen || []).map(function (d) { return (d.blokken || []).map(function (b) { return b.soort + " " + b.punten.join(" "); }).join(" "); }).join(" "),
    (i.dossiers || []).map(function (d) { return d.ref + " " + d.titel; }).join(" ")].join(" ");
}
function periode(i) {
  if (!i.eind_datum || i.eind_datum === i.datum) return "";
  var a1 = dt(i.datum), b1 = dt(i.eind_datum);
  return a1.getMonth() === b1.getMonth() ? a1.getDate() + "–" + b1.getDate() + " " + MK[b1.getMonth()] : kort(i.datum) + " – " + kort(i.eind_datum);
}
function locatie(i) { return [i.gebouw, i.plaats].filter(Boolean).join(", "); }
function kaartLink(plek) { return plek ? a("https://maps.apple.com/?q=" + encodeURIComponent(plek), plek) : ""; }
// zondag van deze week (n = 0) of van over n weken
function zondag(n) { var d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7 + 7 * n); return iso(d); }
function loopt(i, dag) { return i.datum <= dag && (i.eind_datum || i.datum) >= dag; }
function agendaKnop(bestand, label) { return bestand ? '<a class="mini" href="' + esc(bestand) + '">＋ ' + esc(label || "Agenda") + "</a>" : ""; }

// ---------- één regel in de lijst ----------
function agendaRij(i) {
  var meta = [];
  if (i.plaats) meta.push(esc(i.plaats));
  if (periode(i)) meta.push(periode(i));
  if (i.vast === "briefing") meta.push("12:00");
  if ((i.dossiers || []).length) meta.push(i.dossiers.length + " dossiers");
  return '<div class="arij" role="button" tabindex="0" data-i="' + AGENDA.items.indexOf(i) + '">'
    + '<span class="streep s-' + esc(i.soort.toLowerCase().replace(/[^a-z]+/g, "-")) + '" aria-hidden="true"></span>'
    + '<div class="arij-tekst"><div class="regel">' + esc(i.titel) + "</div>"
    + '<div class="klein">' + soortLabel(i.soort) + (meta.length ? " " + meta.join(" · ") : "") + (/^Informele/.test(i.titel) ? " · informeel" : "") + "</div></div>"
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}

// ---------- het detail ----------
function blokHtml(b) {
  return '<div class="blok"><div class="blokkop"><span class="tijd">' + esc(b.begin) + (b.eind ? "–" + esc(b.eind) : "") + "</span><span>" + esc(b.soort) + "</span>"
    + agendaKnop(b.ics, "dagdeel") + "</div>"
    + (b.punten.length ? '<ul class="punten">' + b.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : '<p class="klein">Agendapunten nog niet gepubliceerd.</p>') + "</div>";
}
function agendaDetail(i) {
  var plek = locatie(i), wanneer = esc(lang(i.datum)) + (i.eind_datum ? " t/m " + esc(lang(i.eind_datum)) : "") + (tijdTekst(i) ? " · " + tijdTekst(i) : "");
  var h = '<div class="klein">' + soortLabel(i.soort) + "</div><h2 class='paneel-kop'>" + esc(i.titel) + "</h2>"
    + '<div class="feiten"><div><span>Wanneer</span><b>' + wanneer + "</b></div>"
    + (plek ? "<div><span>Waar</span><b>" + kaartLink(plek) + "</b></div>" : "") + "</div>"
    + '<div class="knoprij">' + agendaKnop(i.ics, (i.dagen || []).length > 1 ? "Hele zitting" : (tijdTekst(i) ? "Agenda" : "Hele dag"))
    + (i.livestream ? a(i.livestream, "Livestream") : "") + (i.url ? a(i.url, i.soort === "Plenaire vergadering" ? "Officiële agenda" : "Bron") : "")
    + deelKnop(i.titel + " · " + lang(i.datum), i.url) + "</div>";
  if (i.extra) h += '<p class="klein">' + esc(i.extra) + "</p>";
  (i.dagen || []).forEach(function (d) {
    var t = tijdTekst(d);
    h += '<h4 class="dagkop">' + esc(lang(d.datum)) + (t ? ' <span class="tijd">' + t + "</span>" : "") + agendaKnop(d.ics, "dag") + "</h4>";
    if ((d.blokken || []).length) h += d.blokken.map(blokHtml).join("");
    else if (d.debatten.length) h += '<ul class="punten">' + d.debatten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
    else h += '<p class="klein">Programma nog niet gepubliceerd.</p>';
  });
  if (!(i.dagen || []).length && (i.punten || []).length) h += "<h4>Op de agenda (dossiers)</h4><ul class='punten'>" + i.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
  if ((i.dossiers || []).length) h += "<h4>Dossiers die OEIL in deze zitting verwacht (" + i.dossiers.length + ")</h4><ul class='punten'>"
    + i.dossiers.map(function (d) { return '<li><a href="#dossiers?open=' + encodeURIComponent(d.ref) + '">' + esc(d.titel) + '</a> <span class="klein">' + esc(d.ref) + "</span></li>"; }).join("") + "</ul>";
  if (i.ref) h += '<div class="knoprij"><a class="mini" href="#dossiers?open=' + encodeURIComponent(i.ref) + '">Naar het dossier ' + esc(i.ref) + "</a></div>";
  if (i.soort === "Plenaire vergadering") h += '<p class="klein">Tijden in Brusselse tijd, volgens de agenda van het Parlement. Die kan nog veranderen.</p>';
  return h + notitie("ag:" + i.datum + ":" + i.titel);
}
function openAgenda(n) { var i = AGENDA && AGENDA.items[n]; if (i) openPaneel(i.soort === "Plenaire vergadering" ? "Parlement" : i.soort, agendaDetail(i)); }

// ---------- de lijst ----------
function zichtbaarInWeergave(i) {
  var w = aFilter.weergave, vandaagIso = vandaag();
  if (!aFilter.informeel && /^Informele ministers/.test(i.titel)) return false;
  if (i.vast && !aFilter.vast) return false;
  if (w === "alles") {
    var groep = Object.keys(AGENDA_SOORT).filter(function (k) { return AGENDA_SOORT[k].indexOf(i.soort) >= 0; })[0];
    if (INST.agendaAlles.indexOf(groep) < 0) return false;
    // de midday briefing staat in Alles alleen vandaag; alle dagen onder Commissie
    return i.vast !== "briefing" || i.datum === vandaagIso;
  }
  return (AGENDA_SOORT[w] || []).indexOf(i.soort) >= 0;
}
function agendaTonen() {
  var w = aFilter.weergave;
  document.getElementById("a-lijst").classList.toggle("verborgen", w === "eerder");
  document.getElementById("a-commissie").classList.toggle("verborgen", w !== "commissie");
  document.getElementById("a-afgelopen").classList.toggle("verborgen", w !== "eerder");
  alle("#a-filters [data-voor]").forEach(function (el) { el.classList.toggle("verborgen", !(el.dataset.voor === "komend" ? w !== "eerder" : el.dataset.voor === w)); });
  document.getElementById("a-zoek").placeholder = w === "eerder" ? "Zoek een debat" : w === "commissie" ? "Zoek in agenda en planning" : "Zoek in de agenda";
  if (w === "eerder") { dbFilter.q = aFilter.q; if (DEBATTEN) debattenTonen(); return; }
  if (w === "commissie") { cFilter.q = aFilter.q; planningTab(); }
  var z = zoeker(aFilter.q);
  var items = AGENDA.items.filter(function (i) { return zichtbaarInWeergave(i) && z.past(agendaTekst(i), i); });
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
        h += '<h2 class="dag plakdag">' + (wanneer ? '<span class="wanneer">' + wanneer + "</span>" : "") + esc(lang(i.datum)) + '</h2><div class="kaart lijstkaart">';
        huidig = i.datum;
      }
      h += agendaRij(i);
    });
    h += "</div>";
  });
  if (!items.length) h = '<p class="leeg">Niets gevonden in de komende 4 weken.' + (aFilter.q ? " Probeer minder woorden of een Engels woord." : "") + "</p>";
  if (w === "alles" || w === "top") (AGENDA.toppen_later || []).forEach(function (x) {
    h += '<p class="klein" style="margin:8px 4px">Daarna: <span class="label soort-eu-top">EU-top</span> ' + a(x.url, x.titel) + " op " + esc(lang(x.datum)) + (x.eind ? " t/m " + esc(lang(x.eind)) : "") + (x.plaats ? " in " + esc(x.plaats) : "") + ".</p>";
  });
  if ((w === "alles" || w === "parlement") && (AGENDA.later || []).length) h += '<p class="klein" style="margin:8px 4px">Daarna: plenaire vergadering vanaf ' + kort(AGENDA.later[0].datum) + " in " + esc(AGENDA.later[0].plaats) + ".</p>";
  h += opgehaald("parlement", "Parlement") + opgehaald("raad", "Raad en EU-toppen");
  var doel = document.getElementById("a-lijst");
  doel.innerHTML = h;
  bedoelJe("a-zoek", z);
  filterTeller("a-filterknop", (aFilter.informeel ? 0 : 1) + (aFilter.vast ? 0 : 1) + (w === "eerder" ? (dbFilter.nl ? 1 : 0) + (dbFilter.sort !== "datum" ? 1 : 0) : 0)
    + (w === "commissie" ? (cFilter.soort ? 1 : 0) + (cFilter.onderwerp ? 1 : 0) + (cFilter.achter ? 0 : 1) : 0));
  window.euMarkeer(doel);
}

// ---------- eerdere debatten ----------
var dbFilter = { nl: false, sort: "datum", q: "" };
function sprekers(x) { return (x.fracties || []).reduce(function (s, f) { return s + f[1]; }, 0); }
function debatDetail(x) {
  return '<div class="klein">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</div><h2 class='paneel-kop'>" + esc(x.titel) + "</h2>"
    + '<p class="klein">' + (x.sprekers_bekend ? sprekers(x) + " sprekers uit het Parlement" + (x.overige_sprekers ? " · " + x.overige_sprekers + " overige sprekers (bijvoorbeeld Commissie of Raad)" : "") : "Sprekers niet beschikbaar") + "</p>"
    + '<div class="fracties">' + (x.fracties || []).map(function (f) { return "<span><i style='background:" + (KLEUR[f[0]] || "#999") + "'></i>" + esc(f[0]) + " " + f[1] + "</span>"; }).join("") + "</div>"
    + ((x.nederlanders || []).length ? "<h4>Nederlandse sprekers</h4><ul class='punten'>" + x.nederlanders.map(function (p) { return '<li><a href="#mensen?id=' + esc(p.id) + '">' + esc(p.naam) + "</a> (" + esc(p.partij) + ")</li>"; }).join("") + "</ul>" : "")
    + '<div class="knoprij">' + a(x.verslag, "Verslag van het debat") + deelKnop(x.titel, x.verslag) + "</div>" + notitie("db:" + x.datum + ":" + x.nummer);
}
function debattenTonen() {
  var z = zoeker(dbFilter.q);
  var l = DEBATTEN.debatten.filter(function (x) { return (!dbFilter.nl || (x.nederlanders || []).length) && z.past(x.titel + " " + (x.nederlanders || []).map(function (p) { return p.naam; }).join(" "), x); });
  l.sort(function (x, y) { return dbFilter.sort === "sprekers" ? sprekers(y) - sprekers(x) : (y.datum.localeCompare(x.datum) || x.nummer - y.nummer); });
  if (dbFilter.sort !== "datum") l = z.ordenen(l);
  bedoelJe("a-zoek", z);
  var h = "", huidig = null;
  l.forEach(function (x) {
    if (dbFilter.sort === "datum" && x.datum !== huidig) { h += '<h2 class="dag">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</h2>"; huidig = x.datum; }
    var nl = (x.nederlanders || []).map(function (p) { return esc(p.naam); });
    h += '<div class="kaart compact dbkaart" data-i="' + DEBATTEN.debatten.indexOf(x) + '" role="button" tabindex="0">'
      + (dbFilter.sort !== "datum" ? '<div class="klein">' + kort(x.datum) + "</div>" : "")
      + '<h3 class="twee-regels">' + esc(x.titel) + "</h3>"
      + '<div class="klein feitregel">' + (x.sprekers_bekend ? sprekers(x) + " sprekers" : "sprekers onbekend") + (nl.length ? " · Nederlands: " + nl.join(", ") : "") + "</div>"
      + '<span class="pijl" aria-hidden="true">›</span></div>';
  });
  var doel = document.getElementById("db-lijst");
  doel.innerHTML = ((DEBATTEN.zittingen || []).length ? '<p class="intro">Debatten van de zittingen ' + DEBATTEN.zittingen.map(function (z) { return kort(z.begin) + "–" + kort(z.eind) + " (" + esc(z.plaats) + ")"; }).join(", ") + ".</p>" : "")
    + (h || '<p class="leeg">Geen debatten gevonden.</p>');
  filterTeller("a-filterknop", (dbFilter.nl ? 1 : 0) + (dbFilter.sort !== "datum" ? 1 : 0));
  window.euMarkeer(doel);
}
var agendaOpgezet = false;
function agendaOpzetten() {
  if (agendaOpgezet) return;
  agendaOpgezet = true;
  document.getElementById("a-informeel").checked = aFilter.informeel;
  document.getElementById("a-vast").checked = aFilter.vast;
  document.getElementById("a-informeel").addEventListener("change", function (ev) { aFilter.informeel = ev.target.checked; agendaTonen(); });
  document.getElementById("a-vast").addEventListener("change", function (ev) { aFilter.vast = ev.target.checked; agendaTonen(); });
  var w1 = null;
  document.getElementById("a-zoek").addEventListener("input", function (ev) { clearTimeout(w1); w1 = setTimeout(function () { aFilter.q = ev.target.value.trim(); agendaTonen(); }, 200); });
  document.getElementById("db-nl").addEventListener("change", function (ev) { dbFilter.nl = ev.target.checked; debattenTonen(); });
  document.getElementById("db-sort").addEventListener("change", function (ev) { dbFilter.sort = ev.target.value; debattenTonen(); });
  document.getElementById("a-chips").addEventListener("click", function (ev) {
    var k = ev.target.closest(".chip");
    if (!k) return;
    alle("#a-chips .chip").forEach(function (c) { c.classList.toggle("actief", c === k); });
    aFilter.weergave = k.dataset.a;
    agendaTonen();
    var rij = document.querySelector("#agenda .plakrij");
    if (window.scrollY > rij.offsetTop) window.scrollTo(0, Math.max(0, segBeginY(rij.querySelector(".chips"))));
  });
  bijKaartTik(document.getElementById("a-lijst"), ".arij", function (k) { openAgenda(+k.dataset.i); });
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
  window.euMarkeer(doel);
}
function planningOpzetten() {
  var soort = {}, ond = {};
  PLANNING.items.forEach(function (x) { soort[x.soort_naam] = 1; (x.onderwerpen || []).forEach(function (o) { ond[o] = 1; }); });
  document.getElementById("c-soort").innerHTML = '<option value="">Alle soorten</option>' + Object.keys(soort).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  document.getElementById("c-onderwerp").innerHTML = '<option value="">Alle onderwerpen (Engels)</option>' + Object.keys(ond).sort().map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");
  document.getElementById("c-soort").addEventListener("change", function (ev) { cFilter.soort = ev.target.value; planningTonen(); agendaTonen(); });
  document.getElementById("c-onderwerp").addEventListener("change", function (ev) { cFilter.onderwerp = ev.target.value; planningTonen(); agendaTonen(); });
  document.getElementById("c-achter").addEventListener("change", function (ev) { cFilter.achter = ev.target.checked; planningTonen(); agendaTonen(); });
}
function planningTab() {
  var doel = document.getElementById("c-lijst");
  bezig(doel);
  laden("commissie").then(function (d) {
    if (!PLANNING) { PLANNING = d; planningOpzetten(); }
    planningTonen();
  }).catch(function () { laadFout(doel); });
}

function agendaTab(q) {
  var doel = document.getElementById("a-lijst");
  bezig(doel);
  Promise.all([laden("agenda"), laden("debatten")]).then(function (r) {
    if (!AGENDA) AGENDA = r[0];
    if (!DEBATTEN) DEBATTEN = r[1];
    agendaOpzetten();
    agendaTonen();
    if (q && q.item != null) openAgenda(+q.item);
  }).catch(function () { laadFout(doel); });
}

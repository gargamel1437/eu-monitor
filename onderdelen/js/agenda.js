// =====================================================================
//  agenda.js: één agenda zoals Apple Agenda.
//  - Weergave Week (lijst per week), Maand (kalender) of Jaar (twaalf mini-maanden). Wisselen
//    met de schakelaar of door met twee vingers te knijpen (uit) of te spreiden (in).
//  - Filters (knop naast het zoekveld): wat er gebeurt, wie het doet, periode, ook tonen.
//    De categorieën staan al op elk item (europa.py: "wat" en "wie").
//  - In de lijst alleen label, titel, plaats en datum. Tik = details, tijden, locatie,
//    livestream en ＋ Agenda (hele zitting, dag of dagdeel).
//  - De planning van de Commissie per kwartaal staat in een inklapbaar blok onderaan.
// =====================================================================

var AGENDA = null, DEBATTEN = null, AGENDA_INDEX = {};
var WAT = ["Stemmingen en besluiten", "Debatten", "Ministersoverleg", "Toppen", "Persmomenten", "Wetgevingsstappen"];
var WIE = ["Europees Parlement", "Raad van de EU", "Europese Raad", "Europese Commissie", "Internationaal"];
var WIE_KLEUR = { "Europees Parlement": "ep", "Raad van de EU": "raad", "Europese Raad": "top", "Europese Commissie": "com", "Internationaal": "int" };
var aZoek = "", aWeergave = "week", aMaand = null, aDag = null;

var AF = maakFilter("a", [
  { id: "periode", naam: "Periode", meer: false, standaard: "komend", opties: [["komend", "Komende weken"], ["eerder", "Afgelopen debatten"]] },
  { id: "sort", naam: "Sorteren", meer: false, standaard: "datum", opties: [["datum", "Op datum"], ["sprekers", "Op aantal sprekers"]], toon: function () { return AF.w("periode") === "eerder"; } },
  { id: "wat", naam: "Wat", meer: true, standaard: [], opties: WAT.map(function (x) { return [x, x]; }), toon: function () { return AF.w("periode") === "komend"; } },
  { id: "wie", naam: "Wie", meer: true, standaard: [], opties: WIE.map(function (x) { return [x, x]; }), toon: function () { return AF.w("periode") === "komend"; } },
  { id: "ook", naam: "Ook tonen", meer: true, alles: false, standaard: ["informeel", "briefing"], opties: [["informeel", "Informele ministersbijeenkomsten"], ["briefing", "Dagelijkse midday briefing"]], toon: function () { return AF.w("periode") === "komend"; } },
  { id: "sprekers", naam: "Sprekers", meer: true, standaard: [], opties: [["nl", "Met Nederlandse sprekers"]], toon: function () { return AF.w("periode") === "eerder"; } }
], function () { if (AGENDA) agendaTonen(); });

function soortLabel(s) { return '<span class="label soort-' + esc(s.toLowerCase().replace(/[^a-z]+/g, "-")) + '">' + esc(s === "Plenaire vergadering" ? "Parlement" : s) + "</span>"; }
function watLabel(i) { var w = (i.wat || [])[0]; return w ? '<span class="label wat">' + esc(w) + "</span>" : soortLabel(i.soort); }
function kleurVan(i) { return WIE_KLEUR[(i.wie || [])[0]] || "int"; }
// Tijden staan in Brusselse tijd (dezelfde als in Nederland). Alleen tonen wat de bron geeft.
function uur(isoTijd) { return isoTijd && isoTijd.length > 10 ? isoTijd.slice(11, 16) : ""; }
function tijdTekst(i) { var b = uur(i.begin), e = uur(i.eind); return b ? b + (e && e !== b ? "–" + e : "") : ""; }
function agendaTekst(i) {
  return [i.titel, i.soort, (i.wat || []).join(" "), (i.wie || []).join(" "), i.plaats || "", i.gebouw || "", i.extra || "", (i.punten || []).join(" "), i.ref || "",
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
function zondag(n) { var d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7 + 7 * n); return iso(d); }
function maandag(isoZondag) { var d = dt(isoZondag); d.setDate(d.getDate() - 6); return iso(d); }
function plusDagenVan(isoDatum, n) { var d = dt(isoDatum); d.setDate(d.getDate() + n); return iso(d); }
function loopt(i, dag) { return i.datum <= dag && (i.eind_datum || i.datum) >= dag; }
function agendaKnop(bestand, label) { return bestand ? '<a class="mini" href="' + esc(bestand) + '">＋ ' + esc(label || "Agenda") + "</a>" : ""; }

// ---------- welke items ----------
function zichtbaarItem(i) {
  if (/^Informele ministers/.test(i.titel) && !AF.aan("ook", "informeel")) return false;
  if (i.vast === "briefing" && !AF.aan("ook", "briefing")) return false;
  return AF.past("wat", i.wat || []) && AF.past("wie", i.wie || []);
}
function agendaItems(metVerder) {
  var z = zoeker(aZoek), l = AGENDA.items.concat(metVerder ? AGENDA.verder || [] : []);
  var uit = l.filter(function (i) { return zichtbaarItem(i) && z.past(agendaTekst(i), i); });
  bedoelJe("a-zoek", z);
  return uit;
}

// ---------- één regel in de lijst ----------
function agendaRij(i) {
  var meta = [];
  if (i.plaats) meta.push(esc(i.plaats));
  if (periode(i)) meta.push(periode(i));
  if (i.vast === "briefing") meta.push("12:00");
  if ((i.dossiers || []).length) meta.push(i.dossiers.length + " dossiers");
  if (/^Informele/.test(i.titel)) meta.push("informeel");
  return '<div class="arij" role="button" tabindex="0" data-id="' + esc(i.id) + '">'
    + '<span class="streep k-' + kleurVan(i) + '" aria-hidden="true"></span>'
    + '<div class="arij-tekst"><div class="regel">' + esc(i.titel) + "</div>"
    + '<div class="klein">' + watLabel(i) + (meta.length ? '<span class="arij-meta">' + meta.join(" · ") + "</span>" : "") + "</div></div>"
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}
function dagLijst(items, vanaf) {
  var h = "", huidig = null, vandaagIso = vandaag(), morgen = plusDagen(1);
  items.forEach(function (i) {
    var dag = vanaf && i.datum < vanaf ? vanaf : i.datum;
    if (dag !== huidig) {
      if (huidig) h += "</div>";
      var wanneer = dag === vandaagIso ? "Vandaag" : dag === morgen ? "Morgen" : "";
      h += '<div class="dagkop-lijst"><span class="dagnaam">' + esc(WEEKDAGEN[dt(dag).getDay()]) + '</span><span class="dagnr">' + dt(dag).getDate() + " " + MK[dt(dag).getMonth()] + "</span>"
        + (wanneer ? '<span class="wanneer">' + wanneer + "</span>" : "") + '</div><div class="kaart lijstkaart">';
      huidig = dag;
    }
    h += agendaRij(i);
  });
  return h + (huidig ? "</div>" : "");
}

// ---------- weekweergave: deze week, volgende week, later ----------
function weekTonen(items) {
  var vandaagIso = vandaag();
  var delen = [["Deze week", zondag(0)], ["Volgende week", zondag(1)], ["Later", "9999"]];
  var h = "";
  delen.forEach(function (deel, n) {
    var van = n ? delen[n - 1][1] : "";
    var hier = items.filter(function (i) { return (i.datum > van || (n === 0 && loopt(i, vandaagIso))) && i.datum <= deel[1]; });
    var datums = n < 2 ? (n === 0 ? kort(vandaagIso) : kort(maandag(deel[1]))) + " – " + kort(deel[1]) : "vanaf " + kort(plusDagenVan(delen[1][1], 1));
    h += '<section class="weekblok"><h2 class="weekkop">' + deel[0] + " <small>" + esc(datums) + "</small></h2>";
    h += hier.length ? dagLijst(hier, n === 0 ? vandaagIso : "") : '<p class="leeg-week">Niets gepland.</p>';
    h += "</section>";
  });
  if (!items.length) h = '<p class="leeg">Niets gevonden in de komende 4 weken.' + (aZoek ? " Probeer minder woorden of een Engels woord." : " Kijk bij Filters wat er aan staat.") + "</p>";
  (AGENDA.toppen_later || []).forEach(function (x) {
    h += '<p class="klein" style="margin:8px 4px">Daarna: <span class="label soort-eu-top">EU-top</span> ' + a(x.url, x.titel) + " op " + esc(lang(x.datum)) + (x.eind ? " t/m " + esc(lang(x.eind)) : "") + (x.plaats ? " in " + esc(x.plaats) : "") + ".</p>";
  });
  return h + opgehaald("parlement", "Parlement") + opgehaald("raad", "Raad en toppen");
}

// ---------- maand en jaar ----------
function perDag(items) {
  var m = {};
  items.forEach(function (i) {
    var d = dt(i.datum), eind = dt(i.eind_datum || i.datum);
    for (var x = new Date(d); x <= eind; x.setDate(x.getDate() + 1)) { var k = iso(x); (m[k] = m[k] || []).push(i); }
  });
  return m;
}
function maandRaster(jaar, maand, dagen, klein) {
  var eerste = new Date(jaar, maand, 1), start = (eerste.getDay() + 6) % 7, aantal = new Date(jaar, maand + 1, 0).getDate();
  var h = '<div class="raster' + (klein ? " klein" : "") + '">' + (klein ? "" : ["ma", "di", "wo", "do", "vr", "za", "zo"].map(function (d) { return '<span class="rkop">' + d + "</span>"; }).join(""));
  for (var i = 0; i < start; i++) h += "<span></span>";
  for (var n = 1; n <= aantal; n++) {
    var k = iso(new Date(jaar, maand, n)), l = dagen[k] || [];
    var kleuren = {};
    l.forEach(function (x) { kleuren[kleurVan(x)] = 1; });
    var tag = klein ? "span" : "button";
    h += "<" + tag + (klein ? "" : ' type="button"') + ' class="rdag' + (k === vandaag() ? " vandaag" : "") + (k === aDag ? " gekozen" : "") + (l.length ? " vol" : "") + '" data-dag="' + k + '">'
      + "<span>" + n + '</span><i class="punten-rij">' + Object.keys(kleuren).slice(0, 3).map(function (c) { return '<b class="k-' + c + '"></b>'; }).join("") + "</i></" + tag + ">";
  }
  return h + "</div>";
}
function maandTonen(items) {
  var nu = new Date();
  if (!aMaand) aMaand = [nu.getFullYear(), nu.getMonth()];
  var dagen = perDag(items);
  var h = '<div class="maandkop"><button type="button" class="linkknop" data-maand="-1" aria-label="Vorige maand">‹</button><h2>' + MAANDEN[aMaand[1]] + " " + aMaand[0]
    + '</h2><button type="button" class="linkknop" data-maand="1" aria-label="Volgende maand">›</button></div>'
    + maandRaster(aMaand[0], aMaand[1], dagen, false);
  var dag = aDag && dagen[aDag] ? aDag : null;
  if (dag) h += '<h3 class="dagtitel">' + esc(lang(dag)) + "</h3>" + '<div class="kaart lijstkaart">' + dagen[dag].map(agendaRij).join("") + "</div>";
  else h += '<p class="klein midden-tekst">Tik op een dag met een puntje.</p>';
  return h + legenda();
}
function jaarTonen(items) {
  var nu = new Date(), jaar = aMaand ? aMaand[0] : nu.getFullYear(), dagen = perDag(items);
  var h = '<div class="maandkop"><button type="button" class="linkknop" data-jaar="-1" aria-label="Vorig jaar">‹</button><h2>' + jaar + '</h2><button type="button" class="linkknop" data-jaar="1" aria-label="Volgend jaar">›</button></div><div class="jaarraster">';
  for (var m = 0; m < 12; m++) h += '<button type="button" class="minimaand" data-naar-maand="' + jaar + "-" + m + '"><b>' + MAANDEN[m] + "</b>" + maandRaster(jaar, m, dagen, true) + "</button>";
  return h + '</div><p class="klein">Verder dan 4 weken vooruit staan alleen de bekende plenaire zittingen, Raadsvergaderingen en toppen.</p>' + legenda();
}
function legenda() {
  return '<div class="legenda">' + WIE.map(function (w) { return '<span><b class="k-' + WIE_KLEUR[w] + '"></b>' + esc(w) + "</span>"; }).join("") + "</div>";
}

// ---------- tonen ----------
function agendaTonen() {
  var eerder = AF.w("periode") === "eerder";
  document.getElementById("a-kalender").classList.toggle("verborgen", eerder);
  document.getElementById("a-afgelopen").classList.toggle("verborgen", !eerder);
  document.getElementById("a-weergave").classList.toggle("uit", eerder);
  document.getElementById("a-zoek").placeholder = eerder ? "Zoek een debat" : "Zoek in de agenda";
  if (eerder) { if (DEBATTEN) debattenTonen(); return; }
  ["week", "maand", "jaar"].forEach(function (w) {
    document.getElementById("a-" + (w === "week" ? "lijst" : w)).classList.toggle("verborgen", w !== aWeergave);
  });
  alle("#a-weergave button").forEach(function (b) { b.classList.toggle("actief", b.dataset.weergave === aWeergave); });
  zetBel(document.getElementById("a-weergave"), document.querySelector("#a-weergave button.actief"));
  var items = agendaItems(aWeergave !== "week");
  var doel = document.getElementById(aWeergave === "week" ? "a-lijst" : "a-" + aWeergave);
  doel.innerHTML = aWeergave === "week" ? weekTonen(items) : aWeergave === "maand" ? maandTonen(items) : jaarTonen(items);
  window.euMarkeer(doel);
}
function zetWeergave(w) {
  if (w === aWeergave) return;
  var VOLG = ["week", "maand", "jaar"], oud = aWeergave;
  aWeergave = w;
  agendaTonen();
  var doel = document.getElementById(w === "week" ? "a-lijst" : "a-" + w);
  if (!MINDER_BEWEGING) { doel.classList.remove("zoom-in", "zoom-uit"); doel.offsetWidth; doel.classList.add(VOLG.indexOf(w) > VOLG.indexOf(oud) ? "zoom-uit" : "zoom-in"); }
}

// ---------- het detail ----------
function blokHtml(b) {
  return '<div class="blok"><span class="tijd">' + esc(b.begin) + (b.eind ? "–" + esc(b.eind) : "") + '</span><div class="blok-inhoud"><div class="blokkop"><span>' + esc(b.soort) + "</span>"
    + agendaKnop(b.ics, "dagdeel") + "</div>"
    + (b.punten.length ? '<ul class="punten">' + b.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : '<p class="klein">Agendapunten nog niet gepubliceerd.</p>') + "</div></div>";
}
function agendaDetail(i) {
  var plek = locatie(i), wanneer = esc(lang(i.datum)) + (i.eind_datum ? " t/m " + esc(lang(i.eind_datum)) : "") + (tijdTekst(i) ? " · " + tijdTekst(i) : "");
  var h = '<div class="klein labels-rij">' + (i.wat || []).map(function (w) { return '<span class="label wat">' + esc(w) + "</span>"; }).join("")
    + (i.wie || []).map(function (w) { return '<span class="label wie k-' + WIE_KLEUR[w] + '">' + esc(w) + "</span>"; }).join("") + "</div>"
    + "<h2 class='paneel-kop'>" + esc(i.titel) + "</h2>"
    + '<div class="feiten"><div><span>Wanneer</span><b>' + wanneer + "</b></div>"
    + (plek ? "<div><span>Waar</span><b>" + kaartLink(plek) + "</b></div>" : "") + "</div>"
    + '<div class="knoprij">' + agendaKnop(i.ics, (i.dagen || []).length > 1 ? "Hele zitting" : (tijdTekst(i) ? "Agenda" : "Hele dag"))
    + (i.livestream ? a(i.livestream, "Livestream") : "") + (i.url ? a(i.url, i.soort === "Plenaire vergadering" ? "Officiële agenda" : "Bron") : "")
    + deelKnop(i.titel + " · " + lang(i.datum), i.url) + "</div>";
  if (i.extra) h += '<p class="klein">' + esc(i.extra) + "</p>";
  if (i.verder) h += '<p class="klein">Verder dan 4 weken vooruit: het programma volgt later.</p>';
  (i.dagen || []).forEach(function (d) {
    var t = tijdTekst(d);
    h += '<div class="dagkop"><div><b>' + esc(lang(d.datum)) + "</b>" + (t ? ' <span class="tijd">' + t + "</span>" : "") + "</div>" + agendaKnop(d.ics, "dag") + "</div>";
    if ((d.blokken || []).length) h += d.blokken.map(blokHtml).join("");
    else if (d.debatten.length) h += '<ul class="punten">' + d.debatten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
    else h += '<p class="klein">Programma nog niet gepubliceerd.</p>';
  });
  if (!(i.dagen || []).length && (i.punten || []).length) h += "<h4>Op de agenda (dossiers)</h4><ul class='punten'>" + i.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
  if ((i.dossiers || []).length) h += "<h4>Dossiers die OEIL in deze zitting verwacht (" + i.dossiers.length + ")</h4><ul class='punten'>"
    + i.dossiers.map(function (d) { return '<li><a href="#dossiers?open=' + encodeURIComponent(d.ref) + '">' + esc(d.titel) + '</a> <span class="klein">' + esc(d.ref) + "</span></li>"; }).join("") + "</ul>";
  if (i.ref) h += '<div class="knoprij"><a class="mini" href="#dossiers?open=' + encodeURIComponent(i.ref) + '">Naar het dossier ' + esc(i.ref) + "</a></div>";
  if (i.soort === "Plenaire vergadering" && (i.dagen || []).length) h += '<p class="klein">Tijden in Brusselse tijd, volgens de agenda van het Parlement. Die kan nog veranderen.</p>';
  return h + notitie("ag:" + i.datum + ":" + i.titel);
}
function openAgenda(id, dieper) {
  var i = AGENDA_INDEX[id];
  if (i) openPaneel(i.soort === "Plenaire vergadering" ? "Parlement" : i.soort, agendaDetail(i), { dieper: dieper });
}

// ---------- eerdere debatten ----------
function sprekers(x) { return (x.fracties || []).reduce(function (s, f) { return s + f[1]; }, 0); }
function debatDetail(x) {
  return '<div class="klein">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</div><h2 class='paneel-kop'>" + esc(x.titel) + "</h2>"
    + '<p class="klein">' + (x.sprekers_bekend ? sprekers(x) + " sprekers uit het Parlement" + (x.overige_sprekers ? " · " + x.overige_sprekers + " overige sprekers (bijvoorbeeld Commissie of Raad)" : "") : "Sprekers niet beschikbaar") + "</p>"
    + '<div class="fracties">' + (x.fracties || []).map(function (f) { return "<span><i style='background:" + (KLEUR[f[0]] || "#999") + "'></i>" + esc(f[0]) + " " + f[1] + "</span>"; }).join("") + "</div>"
    + ((x.nederlanders || []).length ? "<h4>Nederlandse sprekers</h4><ul class='punten'>" + x.nederlanders.map(function (p) { return '<li><a href="#mensen?id=' + esc(p.id) + '">' + esc(p.naam) + "</a> (" + esc(p.partij) + ")</li>"; }).join("") + "</ul>" : "")
    + '<div class="knoprij">' + a(x.verslag, "Verslag van het debat") + deelKnop(x.titel, x.verslag) + "</div>" + notitie("db:" + x.datum + ":" + x.nummer);
}
function debattenTonen() {
  var z = zoeker(aZoek);
  var l = DEBATTEN.debatten.filter(function (x) { return (!AF.aan("sprekers", "nl") || (x.nederlanders || []).length) && z.past(x.titel + " " + (x.nederlanders || []).map(function (p) { return p.naam; }).join(" "), x); });
  var opSprekers = AF.w("sort") === "sprekers";
  l.sort(function (x, y) { return opSprekers ? sprekers(y) - sprekers(x) : (y.datum.localeCompare(x.datum) || x.nummer - y.nummer); });
  if (opSprekers) l = z.ordenen(l);
  bedoelJe("a-zoek", z);
  var h = "", huidig = null;
  l.forEach(function (x) {
    if (!opSprekers && x.datum !== huidig) { h += '<h2 class="dag">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</h2>"; huidig = x.datum; }
    var nl = (x.nederlanders || []).map(function (p) { return esc(p.naam); });
    h += '<div class="kaart compact dbkaart" data-i="' + DEBATTEN.debatten.indexOf(x) + '" role="button" tabindex="0">'
      + (opSprekers ? '<div class="klein">' + kort(x.datum) + "</div>" : "")
      + '<h3 class="twee-regels">' + esc(x.titel) + "</h3>"
      + '<div class="klein feitregel">' + (x.sprekers_bekend ? sprekers(x) + " sprekers" : "sprekers onbekend") + (nl.length ? " · Nederlands: " + nl.join(", ") : "") + "</div>"
      + '<span class="pijl" aria-hidden="true">›</span></div>';
  });
  var doel = document.getElementById("db-lijst");
  doel.innerHTML = ((DEBATTEN.zittingen || []).length ? '<p class="intro">Debatten van de zittingen ' + DEBATTEN.zittingen.map(function (z) { return kort(z.begin) + "–" + kort(z.eind) + " (" + esc(z.plaats) + ")"; }).join(", ") + ".</p>" : "")
    + (h || '<p class="leeg">Geen debatten gevonden.</p>');
  window.euMarkeer(doel);
}

// ---------- knijpen om te zoomen (week ↔ maand ↔ jaar) ----------
(function () {
  var p = null, VOLG = ["week", "maand", "jaar"];
  function afstand(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  document.addEventListener("touchstart", function (ev) {
    if (ev.touches.length === 2 && ev.target.closest && ev.target.closest("#a-kalender") && AF.w("periode") === "komend") p = { d: afstand(ev.touches), klaar: false };
  }, { passive: true });
  document.addEventListener("touchmove", function (ev) {
    if (!p || ev.touches.length !== 2) return;
    ev.preventDefault();   // geen browserzoom in de agenda
    if (p.klaar) return;
    var r = afstand(ev.touches) / p.d, i = VOLG.indexOf(aWeergave);
    if (r < 0.72 && i < 2) { p.klaar = true; zetWeergave(VOLG[i + 1]); }
    else if (r > 1.35 && i > 0) { p.klaar = true; zetWeergave(VOLG[i - 1]); }
  }, { passive: false });
  document.addEventListener("touchend", function (ev) { if (ev.touches.length < 2) p = null; }, { passive: true });
  // Safari: ook de eigen knijpzoom van de pagina tegenhouden binnen de agenda
  document.addEventListener("gesturestart", function (ev) { if (ev.target.closest && ev.target.closest("#a-kalender")) ev.preventDefault(); });
})();

var agendaOpgezet = false;
function agendaOpzetten() {
  if (agendaOpgezet) return;
  agendaOpgezet = true;
  var w1 = null;
  document.getElementById("a-zoek").addEventListener("input", function (ev) { clearTimeout(w1); w1 = setTimeout(function () { aZoek = ev.target.value.trim(); agendaTonen(); }, 200); });
  document.getElementById("a-weergave").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-weergave]"); if (b) zetWeergave(b.dataset.weergave); });
  var kal = document.getElementById("a-kalender");
  kal.addEventListener("click", function (ev) {
    var t = ev.target;
    var m = t.closest("[data-maand]");
    if (m) { var d = new Date(aMaand[0], aMaand[1] + +m.dataset.maand, 1); aMaand = [d.getFullYear(), d.getMonth()]; aDag = null; agendaTonen(); return; }
    var j = t.closest("[data-jaar]");
    if (j) { aMaand = [(aMaand ? aMaand[0] : new Date().getFullYear()) + +j.dataset.jaar, 0]; agendaTonen(); return; }
    var mm = t.closest("[data-naar-maand]");
    if (mm) { var x = mm.dataset.naarMaand.split("-"); aMaand = [+x[0], +x[1]]; aDag = null; zetWeergave("maand"); return; }
    var dag = t.closest("button.rdag[data-dag]");
    if (dag) { aDag = dag.dataset.dag; agendaTonen(); }
  });
  bijKaartTik(kal, ".arij", function (k) { openAgenda(k.dataset.id); });
  bijKaartTik(document.getElementById("db-lijst"), ".dbkaart", function (k) { var x = DEBATTEN.debatten[+k.dataset.i]; openPaneel("Debat", debatDetail(x)); });
  // de planning laadt pas als je het blok openklapt
  document.getElementById("a-planning").addEventListener("toggle", function (ev) { if (ev.target.open) planningTab(); });
}

// ---------- planning van de Commissie (per kwartaal) ----------
var PLANNING = null, cZoek = "";
var KW = ["", "1e", "2e", "3e", "4e"];
function uniek(l) { var m = {}; l.forEach(function (x) { if (x) m[x] = 1; }); return Object.keys(m).sort().map(function (x) { return [x, x]; }); }
var CF = maakFilter("c", [
  { id: "soort", naam: "Soort initiatief", meer: true, standaard: [], opties: function () { return PLANNING ? uniek(PLANNING.items.map(function (x) { return x.soort_naam; })) : []; } },
  { id: "onderwerp", naam: "Onderwerp (Engels)", meer: true, standaard: [], opties: function () { return PLANNING ? uniek([].concat.apply([], PLANNING.items.map(function (x) { return x.onderwerpen || []; }))) : []; } },
  { id: "ook", naam: "Ook tonen", meer: true, alles: false, standaard: ["achter"], opties: [["achter", "Eerder gepland, nog niet aangenomen"]] }
], function () { if (PLANNING) planningTonen(); });
function planningTonen() {
  var z = zoeker(cZoek);
  var uit = PLANNING.items.filter(function (x) {
    if (!CF.aan("ook", "achter") && x.achter) return false;
    return CF.past("soort", x.soort_naam) && CF.past("onderwerp", x.onderwerpen || []) && z.past(x.titel + " " + x.titel_en + " " + x.dg + " " + x.samenvatting + " " + (x.onderwerpen || []).join(" "), x);
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
  document.getElementById("c-aantal").textContent = uit.length;
  var doel = document.getElementById("c-lijst");
  doel.innerHTML = (h || '<p class="leeg">Niets gevonden in de planning.</p>') + opgehaald("commissie", "Planning");
  window.euMarkeer(doel);
}
var planningOpgezet = false;
function planningTab() {
  var doel = document.getElementById("c-lijst");
  bezig(doel);
  laden("commissie").then(function (d) {
    PLANNING = PLANNING || d;
    if (!planningOpgezet) {
      planningOpgezet = true;
      var w = null;
      document.getElementById("c-zoek").addEventListener("input", function (ev) { clearTimeout(w); w = setTimeout(function () { cZoek = ev.target.value.trim(); planningTonen(); }, 200); });
    }
    planningTonen(); CF.toon();
  }).catch(function () { laadFout(doel); });
}

function agendaLaden() {
  return Promise.all([laden("agenda"), laden("debatten")]).then(function (r) {
    if (!AGENDA) {
      AGENDA = r[0];
      AGENDA.items.concat(AGENDA.verder || []).forEach(function (i) { AGENDA_INDEX[i.id] = i; });
    }
    if (!DEBATTEN) DEBATTEN = r[1];
    return AGENDA;
  });
}
function agendaTab(q) {
  var doel = document.getElementById("a-lijst");
  bezig(doel);
  agendaLaden().then(function () {
    agendaOpzetten();
    agendaTonen();
    if (q && q.item) openAgenda(q.item);
    if (document.getElementById("a-planning").open) planningTab();
  }).catch(function () { laadFout(doel); });
}

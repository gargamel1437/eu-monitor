// =====================================================================
//  agenda.js: de agenda als één doorlopende tijdlijn.
//  - Links de datum, rechts de items. Lege dagen samengevoegd tot één dunne regel.
//  - Knijpen (of − + op de computer): Ruim, Compact of Overzicht (per week één kaart).
//  - Bovenaan een datumstrook die meeloopt; tik op een dag = erheen.
//  - Meerdaagse items staan op elke dag als gewone kaart: instelling · plaats · 2/4.
//  - Tik op een item: een wolkje met Zet in agenda en Meer info (programma, livestream…).
//  - Zoeken en filteren met tokens: Wie, Wat, Waar, Raad (welke raad).
//  - Zacht bovenaan: de planning van de Commissie en de eerdere debatten.
//  Kleuren per instelling zijn overal hetzelfde: ep, raad, top (Europese Raad), com, int.
// =====================================================================

var AGENDA = null, DEBATTEN = null, AGENDA_INDEX = {}, PLANNING = null;
var WAT = ["Stemmingen en besluiten", "Debatten", "Ministersoverleg", "Toppen", "Persmomenten", "Wetgevingsstappen"];
var WIE = ["Europees Parlement", "Raad van de EU", "Europese Raad", "Europese Commissie", "Internationaal"];
var WIE_KLEUR = { "Europees Parlement": "ep", "Raad van de EU": "raad", "Europese Raad": "top", "Europese Commissie": "com", "Internationaal": "int" };
var WIE_KORT = { "Europees Parlement": "Parlement", "Raad van de EU": "Raad", "Europese Raad": "Europese Raad", "Europese Commissie": "Commissie", "Internationaal": "Internationaal" };
var KW = ["", "1e", "2e", "3e", "4e"];
var aDicht = +(lees("eu-a-dicht") || 0);

function kleurVan(i) { return WIE_KLEUR[(i.wie || [])[0]] || "int"; }
function wieKort(i) { return WIE_KORT[(i.wie || [])[0]] || i.soort; }
function soortLabel(s) { return '<span class="label">' + esc(s === "Plenaire vergadering" ? "Parlement" : s) + "</span>"; }
function watLabel(i) { var w = (i.wie || [])[0]; return '<span class="label k-' + kleurVan(i) + ' wie">' + esc(WIE_KORT[w] || i.soort) + "</span>"; }
// Tijden staan in Brusselse tijd (dezelfde als in Nederland). Alleen tonen wat de bron geeft.
function uur(isoTijd) { return isoTijd && isoTijd.length > 10 ? isoTijd.slice(11, 16) : ""; }
function tijdTekst(i) { var b = uur(i.begin), e = uur(i.eind); return b ? b + (e && e !== b ? "–" + e : "") : ""; }
function loopt(i, dag) { return i.datum <= dag && (i.eind_datum || i.datum) >= dag; }
function plusDagenVan(isoDatum, n) { var d = dt(isoDatum); d.setDate(d.getDate() + n); return iso(d); }
function aantalDagen(i) { return i.eind_datum ? Math.round((dt(i.eind_datum) - dt(i.datum)) / 864e5) + 1 : 1; }
function dagVan(i, d) { return (Math.round((dt(d) - dt(i.datum)) / 864e5) + 1) + "/" + aantalDagen(i); }
function weekNr(s) { var d = dt(s); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); var w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }
function maandagVan(s) { return plusDagenVan(s, -((dt(s).getDay() + 6) % 7)); }
function korteDatum(s) { var d = dt(s); return d.getDate() + " " + MK[d.getMonth()]; }
var DL = ["zo", "ma", "di", "wo", "do", "vr", "za"];
function agendaTekst(i) {
  return [i.titel, i.soort, i.raad || "", (i.wat || []).join(" "), (i.wie || []).join(" "), i.plaats || "", i.gebouw || "", i.extra || "", (i.punten || []).join(" "), i.ref || "",
    (i.dagen || []).map(function (d) { return (d.blokken || []).map(function (b) { return b.soort + " " + b.punten.join(" "); }).join(" "); }).join(" "),
    (i.dossiers || []).map(function (d) { return d.ref + " " + d.titel; }).join(" ")].join(" ");
}
function agendaKnop(bestand, label) { return bestand ? '<a class="mini" href="' + esc(bestand) + '">＋ ' + esc(label || "Agenda") + "</a>" : ""; }

// ---------- zoeken en filteren ----------
function alleAgenda() { return AGENDA ? AGENDA.items.concat(AGENDA.verder || []) : []; }
function uniekeWaarden(f) { var m = {}; alleAgenda().forEach(function (i) { var w = f(i); (Array.isArray(w) ? w : [w]).forEach(function (x) { if (x) m[x] = 1; }); }); return Object.keys(m).sort(); }
var AZ = maakZoekbalk({
  naam: "a", balk: "a-balk",
  soorten: {
    wie: { naam: "Wie", opties: function () { return WIE.map(function (w) { return [w, WIE_KORT[w], w]; }); }, kleur: function (w) { return WIE_KLEUR[w]; } },
    wat: { naam: "Wat", opties: function () { return WAT.map(function (w) { return [w, w, w === "Stemmingen en besluiten" ? "besluit stemming" : ""]; }); } },
    waar: { naam: "Waar", opties: function () { return uniekeWaarden(function (i) { return i.plaats; }).map(function (p) { return [p, p]; }); } },
    raad: { naam: "Raad", opties: function () { return uniekeWaarden(function (i) { return i.raad; }).map(function (r) { return [r, r, "raad ministers"]; }); }, kleur: function () { return "raad"; } }
  },
  voorbeelden: { wie: 4, wat: 3, waar: 3, raad: 0 },
  telling: function (tokens, tekst) { return alleAgenda().filter(function (i) { return agendaPast(i, tokens, tekst); }).length; },
  opnieuw: function () { if (AGENDA) agendaTonen(); }
});
function agendaPast(i, tokens, tekst) {
  if (/^Informele ministers/.test(i.titel) && !INST.informeel) return false;
  if (i.vast && !INST.vastePunten) return false;
  if (!AZ.past("wie", i.wie || [], tokens) || !AZ.past("wat", i.wat || [], tokens) || !AZ.past("waar", i.plaats || "", tokens) || !AZ.past("raad", i.raad || "", tokens)) return false;
  return !tekst || zoeker(tekst).past(agendaTekst(i));
}
var LIJST = [];
function opDag(d) { return LIJST.filter(function (i) { return loopt(i, d); }).sort(function (a, b) { return (uur(a.begin) || "99").localeCompare(uur(b.begin) || "99") || (a.vast ? 1 : 0) - (b.vast ? 1 : 0); }); }

// ---------- de items ----------
function itemHtml(i, d) {
  var t = i.vast === "briefing" ? "12:00" : (aantalDagen(i) === 1 ? tijdTekst(i) : "");
  return '<div class="item k-' + kleurVan(i) + '" role="button" tabindex="0" data-id="' + esc(i.id) + '"><div class="t">' + esc(i.titel) + "</div>"
    + '<div class="m">' + (t ? '<span class="duur">' + t + "</span>" : "")
    + tokLabel("a", "wie", (i.wie || [])[0] || "", wieKort(i), "k-" + kleurVan(i))
    + (i.plaats ? '<span class="plaats">' + esc(i.plaats) + "</span>" : "")
    + (aantalDagen(i) > 1 ? '<span class="duur">' + dagVan(i, d) + "</span>" : "")
    + (/^Informele/.test(i.titel) ? '<span class="plaats">informeel</span>' : "") + "</div></div>";
}
function laatsteDag() { var m = vandaag(); LIJST.forEach(function (i) { var e = i.eind_datum || i.datum; if (e > m) m = e; }); return m; }
function tijdlijnHtml() {
  var h = "", d = vandaag(), eind = laatsteDag(), vorigeWeek = null, leeg = [];
  function leegAf() {
    if (!leeg.length) return;
    var a = dt(leeg[0]), b = dt(leeg[leeg.length - 1]);
    var t = leeg.length === 1 ? DL[a.getDay()] + " " + a.getDate() : DL[a.getDay()] + " " + a.getDate() + " – " + DL[b.getDay()] + " " + b.getDate();
    h += '<div class="leegrij" data-dag="' + leeg[0] + '" data-dagen="' + leeg.join(" ") + '"><div></div><div class="items">' + t + " · niets gepland</div></div>";
    leeg = [];
  }
  while (d <= eind) {
    var w = weekNr(d);
    if (w !== vorigeWeek) {
      leegAf();
      var ma = maandagVan(d);
      h += '<div class="weekregel">Week ' + w + " · " + korteDatum(ma < vandaag() ? vandaag() : ma) + "–" + korteDatum(plusDagenVan(ma, 6)) + "</div>";
      vorigeWeek = w;
    }
    var deze = opDag(d);
    if (!deze.length) leeg.push(d);
    else {
      leegAf();
      var x = dt(d);
      h += '<div class="dag' + (d === vandaag() ? " vandaag" : "") + '" data-dag="' + d + '"><div class="datum"><span class="l">' + DL[x.getDay()] + '</span><span class="n">' + x.getDate() + '</span></div><div class="items">'
        + deze.map(function (i) { return itemHtml(i, d); }).join("") + "</div></div>";
    }
    d = plusDagenVan(d, 1);
  }
  leegAf();
  return h;
}
// overzicht: per week één kaart, één regel per item; de dagelijkse briefing samengevat
function overzichtHtml() {
  var h = "", ma = maandagVan(vandaag()), eind = laatsteDag();
  while (ma <= eind) {
    var zo = plusDagenVan(ma, 6), van = ma < vandaag() ? vandaag() : ma, l = [];
    for (var d = van; d <= zo; d = plusDagenVan(d, 1)) opDag(d).filter(function (i) { return i.vast !== "briefing"; }).forEach(function (i) { l.push({ i: i, d: d }); });
    var briefings = LIJST.filter(function (i) { return i.vast === "briefing" && i.datum >= van && i.datum <= zo; }).length;
    h += '<div class="owek' + (van === vandaag() ? " deze" : "") + '" data-dag="' + van + '"><div class="owek-kop"><b>' + (van === vandaag() ? "Deze week" : "Week " + weekNr(ma)) + "</b><span>" + korteDatum(ma) + "–" + korteDatum(zo) + "</span><em>" + l.length + (l.length === 1 ? " item" : " items") + "</em></div>";
    l.forEach(function (r) {
      var i = r.i, a = dt(r.d);
      h += '<div class="orij k-' + kleurVan(i) + '" role="button" tabindex="0" data-id="' + esc(i.id) + '" data-dag="' + r.d + '"><span class="odag">' + DL[a.getDay()] + " " + a.getDate() + "</span><i></i>"
        + '<span class="ot">' + esc(i.titel) + '</span><span class="op">' + esc(i.plaats || "") + (aantalDagen(i) > 1 ? " · " + dagVan(i, r.d) : "") + "</span></div>";
    });
    if (briefings) h += '<div class="orij routine k-com" data-dag="' + van + '"><span class="odag">werkdagen</span><i></i><span class="ot">Midday briefing van de Commissie, 12:00</span><span class="op">' + briefings + "×</span></div>";
    if (!l.length && !briefings) h += '<div class="niets">Niets gepland.</div>';
    h += "</div>";
    ma = plusDagenVan(ma, 7);
  }
  return h;
}
function strookHtml() {
  var d = maandagVan(vandaag()), eind = laatsteDag(), h = "";
  while (d <= eind) {
    var l = opDag(d), x = dt(d);
    h += '<button type="button" class="sdag' + (d === vandaag() ? " vandaag" : "") + (x.getDay() % 6 === 0 ? " weekend" : "") + '" data-dag="' + d + '"' + (d < vandaag() ? " disabled" : "") + ">"
      + '<span class="l">' + DL[x.getDay()].charAt(0) + '</span><span class="n">' + x.getDate() + '</span><span class="vol">'
      + l.slice(0, 4).map(function (i) { return '<b class="k-' + kleurVan(i) + '"></b>'; }).join("") + "</span></button>";
    d = plusDagenVan(d, 1);
  }
  return h;
}
function zachteRij() {
  var h = '<div class="zachtrij">';
  if (PLANNING) {
    var nu = PLANNING.items.filter(function (x) { return x.gepland === PLANNING.huidig; }).length;
    h += '<button type="button" data-zacht="planning"><span>Gepland door de Commissie</span><b>' + (nu ? nu + " dit kwartaal" : PLANNING.items.length) + "</b><i>›</i></button>";
  } else h += '<button type="button" data-zacht="planning"><span>Gepland door de Commissie</span><b>per kwartaal</b><i>›</i></button>';
  h += '<button type="button" data-zacht="debatten"><span>Eerdere debatten</span><b>' + (DEBATTEN ? DEBATTEN.debatten.length : "") + "</b><i>›</i></button></div>";
  return h;
}
function agendaTonen() {
  LIJST = alleAgenda().filter(function (i) { return agendaPast(i, AZ.tokens, AZ.tekst); });
  var doel = document.getElementById("a-tijdlijn");
  doel.className = "tijdlijn d" + aDicht;
  var lijst = aDicht === 2 ? overzichtHtml() : tijdlijnHtml();
  doel.innerHTML = zachteRij() + (LIJST.length ? lijst : '<p class="leeg-filter">Niets gevonden. Haal een filter weg of tik op × om alles te wissen.</p>')
    + opgehaald("parlement", "Parlement") + opgehaald("raad", "Raad en toppen");
  document.getElementById("a-strook").innerHTML = strookHtml();
  document.getElementById("a-uit").disabled = aDicht === 2;
  document.getElementById("a-in").disabled = aDicht === 0;
  window.euMarkeer(doel);
  volgStrook();
}

// ---------- dichtheid: knijpen, met de dag onder je vingers op zijn plek ----------
function zetDichtheid(n, y) {
  n = Math.max(0, Math.min(2, n));
  if (n === aDicht) return;
  y = y == null ? window.innerHeight / 3 : y;
  var anker = null, ankerY = 0;
  alle("#a-tijdlijn .dag, #a-tijdlijn .leegrij, #a-tijdlijn .orij[data-dag]").some(function (el) { var r = el.getBoundingClientRect(); if (r.bottom > y) { anker = el.dataset.dag; ankerY = r.top; return true; } return false; });
  aDicht = n; bewaar("eu-a-dicht", String(n));
  agendaTonen();
  if (anker) { var el = vindDag(anker); if (el) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - ankerY); }
}
function vindDag(d) {
  var beste = null;
  alle("#a-tijdlijn .dag, #a-tijdlijn .leegrij, #a-tijdlijn .orij[data-dag]").forEach(function (el) { if (el.dataset.dag <= d) beste = el; });
  return beste;
}
(function () {
  var p = null;
  function afst(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  document.addEventListener("touchstart", function (e) { if (e.touches.length === 2 && e.target.closest && e.target.closest("#a-tijdlijn")) p = { d: afst(e.touches), y: (e.touches[0].clientY + e.touches[1].clientY) / 2, klaar: false }; }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!p || e.touches.length !== 2) return;
    e.preventDefault();
    if (p.klaar) return;
    var r = afst(e.touches) / p.d;
    if (r < 0.75) { p.klaar = true; zetDichtheid(aDicht + 1, p.y); } else if (r > 1.33) { p.klaar = true; zetDichtheid(aDicht - 1, p.y); }
  }, { passive: false });
  document.addEventListener("touchend", function (e) { if (e.touches.length < 2) p = null; }, { passive: true });
  document.addEventListener("gesturestart", function (e) { if (e.target.closest && e.target.closest("#a-tijdlijn")) e.preventDefault(); });
  var som = 0, wacht = 0;
  document.addEventListener("wheel", function (e) {
    if (!e.ctrlKey || !e.target.closest || !e.target.closest("#a-tijdlijn")) return;
    e.preventDefault();
    if (Date.now() < wacht) return;
    som += e.deltaY;
    if (som > 40) { zetDichtheid(aDicht + 1, e.clientY); som = 0; wacht = Date.now() + 450; } else if (som < -40) { zetDichtheid(aDicht - 1, e.clientY); som = 0; wacht = Date.now() + 450; }
  }, { passive: false });
})();

// ---------- datumstrook loopt mee ----------
function volgStrook() {
  if (huidigeTab() !== "agenda") return;
  var strook = document.getElementById("a-strook"), grens = document.querySelector("#agenda .agenda-plak").getBoundingClientRect().bottom + 10, eerste = null;
  alle("#a-tijdlijn .dag, #a-tijdlijn .leegrij, #a-tijdlijn .orij[data-dag]").some(function (el) { if (el.getBoundingClientRect().bottom > grens) { eerste = el.dataset.dag; return true; } return false; });
  if (!eerste) { strookMaand(); return; }
  alle(".sdag", strook).forEach(function (b) { b.classList.toggle("zicht", b.dataset.dag === eerste); });
  var knop = strook.querySelector('.sdag[data-dag="' + eerste + '"]');
  if (knop && !volgStrook.bezig) {
    var links = knop.offsetLeft - 12;
    if (links < strook.scrollLeft || links + knop.offsetWidth > strook.scrollLeft + strook.clientWidth) strook.scrollTo({ left: links - strook.clientWidth / 3, behavior: "smooth" });
  }
  strookMaand();
}
// De maand boven de datumstrook hoort bij de dagen die in de strook in beeld zijn: de meeste
// zichtbare dagen bepalen de maand (schuif je de strook opzij, dan loopt de maand mee).
function strookMaand() {
  var strook = document.getElementById("a-strook"), links = strook.scrollLeft, rechts = links + strook.clientWidth, tel = {}, beste = null;
  alle(".sdag", strook).forEach(function (b) {
    var m = b.offsetLeft + b.offsetWidth / 2;
    if (m < links || m > rechts) return;
    var k = b.dataset.dag.slice(0, 7);
    tel[k] = (tel[k] || 0) + 1;
    if (!beste || tel[k] > tel[beste]) beste = k;
  });
  if (!beste) return;
  var tekst = MAANDEN[+beste.slice(5, 7) - 1] + " " + beste.slice(0, 4), el = document.getElementById("a-maand");
  if (el.textContent !== tekst) el.textContent = tekst;
}
window.addEventListener("scroll", function () { cancelAnimationFrame(volgStrook.f); volgStrook.f = requestAnimationFrame(volgStrook); }, { passive: true });

// ---------- het wolkje bij een item ----------
function agendaPop(i, el) {
  sluitAgendaPop(true);
  var pop = document.createElement("div"), achter = document.createElement("div");
  achter.className = "apop-achter"; pop.className = "apop k-" + kleurVan(i); pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", i.titel);
  var wanneer = korteDatum(i.datum) + (i.eind_datum ? " t/m " + korteDatum(i.eind_datum) : "") + (tijdTekst(i) && aantalDagen(i) === 1 ? " · " + tijdTekst(i) : (i.vast === "briefing" ? " · 12:00" : ""));
  pop.innerHTML = '<button type="button" class="apop-sluit" aria-label="Sluiten">×</button>'
    + '<div class="poplab"><i></i>' + esc(wieKort(i)) + ((i.wat || [])[0] ? " · " + esc(i.wat[0]) : "") + "</div>"
    + "<h3>" + esc(i.titel) + "</h3>"
    + (basisInfo(i) ? '<p class="apop-wat">' + basisInfo(i) + "</p>" : "")
    + '<div class="feit"><span>Wanneer</span><b>' + wanneer + "</b></div>"
    + (i.plaats ? '<div class="feit"><span>Waar</span><b>' + esc([i.gebouw, i.plaats].filter(Boolean).join(", ")) + "</b></div>" : "")
    + '<div class="apop-knoppen">' + (i.ics ? '<a class="hoofd" href="' + esc(i.ics) + '"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M12 13v5M9.5 15.5h5"/></svg>Zet in agenda</a>' : "")
    + '<button type="button" data-meer><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/></svg>Meer info</button></div>';
  document.body.appendChild(achter); document.body.appendChild(pop);
  var r = el.getBoundingClientRect(), h = pop.offsetHeight, H = window.innerHeight;
  var onder = r.bottom + 10, top = onder + h < H - 100 ? onder : Math.max(60, r.top - h - 10);
  pop.style.top = top + "px";
  pop.style.setProperty("--oy", (r.top + r.height / 2 - top) + "px");
  pop.style.setProperty("--ox", (r.left + 60) + "px");
  el.classList.add("gekozen");
  requestAnimationFrame(function () { pop.classList.add("open"); achter.classList.add("open"); });
  achter.onclick = function () { sluitAgendaPop(); };
  pop.querySelector(".apop-sluit").onclick = function () { sluitAgendaPop(); };
  pop.querySelector("[data-meer]").onclick = function () { bronRect = pop.getBoundingClientRect(); sluitAgendaPop(true); openAgenda(i.id); };
}
// Een of twee zinnen over wat het is: uit de bron zelf (programma, agendapunten, dossier) of
// een vaste omschrijving van de vergadering. Geen samenvatting of invalshoek.
var RAAD_WAT = [
  [/Algemene Zaken/, "Ministers (meestal van Europese Zaken) bereiden de Europese Raad voor en bespreken onder meer uitbreiding, de rechtsstaat en het meerjarig budget."],
  [/Buitenlandse Zaken \(defensie\)/, "Ministers van Defensie, onder leiding van de Hoge Vertegenwoordiger: Europese defensie en veiligheid."],
  [/Buitenlandse Zaken \(handel\)/, "Ministers van Handel: handelsakkoorden en handelsbeleid van de EU."],
  [/Buitenlandse Zaken/, "Ministers van Buitenlandse Zaken, onder leiding van de Hoge Vertegenwoordiger: buitenlands beleid, sancties en ontwikkelingssamenwerking."],
  [/Ecofin.*begroting/, "Ministers van Financiën stellen het standpunt van de Raad over de EU-begroting vast."],
  [/Ecofin/, "Ministers van Financiën: economisch beleid, belastingen, financiële regels en het herstelfonds."],
  [/Eurogroep/, "Informeel overleg van de ministers van Financiën van de eurolanden, met de ECB en de Commissie."],
  [/Justitie en Binnenlandse Zaken/, "Ministers van Justitie en van Binnenlandse Zaken: migratie, Schengen, politie- en justitiesamenwerking."],
  [/Werkgelegenheid|Sociaal Beleid|Volksgezondheid|EPSCO/i, "Ministers van Sociale Zaken en van Volksgezondheid: werk, sociale rechten, gezondheid en consumentenzaken."],
  [/Concurrentievermogen/, "Ministers van Economische Zaken en van Onderzoek: interne markt, industrie, ruimtevaart en onderzoek."],
  [/Vervoer|Telecommunicatie|Energie/, "Ministers van Vervoer, Telecom of Energie (afhankelijk van het deel): netwerken, digitale markt en energiemarkt."],
  [/Landbouw en Visserij/, "Ministers van Landbouw en Visserij: landbouwbeleid, visquota en voedselveiligheid."],
  [/Milieu/, "Ministers van Milieu: klimaat, natuur, lucht- en waterkwaliteit en internationale klimaatonderhandelingen."],
  [/Onderwijs|Jeugd|Cultuur|Sport/, "Ministers van Onderwijs, Jeugd, Cultuur of Sport (afhankelijk van het deel)."]
];
function lijstje(l, n) { return l.slice(0, n).map(esc).join("; ") + (l.length > n ? " en nog " + (l.length - n) : ""); }
function basisInfo(i) {
  if (i.extra) return esc(i.extra);
  if ((i.punten || []).length) return "Onder meer op de agenda: " + lijstje(i.punten, 2) + ".";
  var dagpunten = [];
  (i.dagen || []).forEach(function (d) { (d.debatten || []).forEach(function (p) { if (dagpunten.indexOf(p) < 0) dagpunten.push(p); }); });
  if (dagpunten.length) return "Onder meer op de agenda: " + lijstje(dagpunten, 2) + ".";
  if (/^Informele/.test(i.titel)) return "Informele bijeenkomst: de ministers praten, maar nemen geen formele besluiten.";
  if (i.soort === "Raad") { var w = RAAD_WAT.filter(function (x) { return x[0].test(i.raad || i.titel); })[0]; if (w) return esc(w[1]); }
  if (i.soort === "EU-top") return "Bijeenkomst van regeringsleiders. De onderwerpen staan op de pagina van de bijeenkomst (Meer info).";
  if (i.ref) return "Geplande stap in het dossier " + esc(i.ref) + ".";
  return "";
}
function sluitAgendaPop(direct) {
  alle(".gekozen").forEach(function (x) { x.classList.remove("gekozen"); });
  alle(".apop, .apop-achter").forEach(function (x) {
    if (direct) { x.remove(); return; }
    x.classList.remove("open"); setTimeout(function () { x.remove(); }, 220);
  });
}
window.addEventListener("scroll", function () { if (document.querySelector(".apop")) sluitAgendaPop(); }, { passive: true });
document.addEventListener("keydown", function (e) { if (e.key === "Escape") sluitAgendaPop(); });

// ---------- Meer info: het hele detail ----------
function blokHtml(b) {
  var lijst = b.punten.map(function (p, n) { return "<li" + (n >= 4 ? " hidden" : "") + ">" + esc(p) + "</li>"; }).join("");
  return '<div class="blok"><span class="tijd">' + esc(b.begin) + (b.eind ? "–" + esc(b.eind) : "") + '</span><div class="blok-inhoud"><div class="blokkop"><span>' + esc(b.soort) + "</span>" + agendaKnop(b.ics, "dagdeel") + "</div>"
    + (b.punten.length ? '<ul class="punten">' + lijst + "</ul>" + (b.punten.length > 4 ? '<button type="button" class="linkknop meer-punten">Nog ' + (b.punten.length - 4) + " punten</button>" : "") : '<p class="klein">Agendapunten nog niet gepubliceerd.</p>') + "</div></div>";
}
function agendaDetail(i) {
  var plek = [i.gebouw, i.plaats].filter(Boolean).join(", ");
  var wanneer = esc(lang(i.datum)) + (i.eind_datum ? " t/m " + esc(lang(i.eind_datum)) : "") + (tijdTekst(i) && aantalDagen(i) === 1 ? " · " + tijdTekst(i) : "");
  var h = '<div class="klein labels-rij">' + (i.wie || []).map(function (w) { return '<span class="label wie k-' + WIE_KLEUR[w] + '">' + esc(WIE_KORT[w]) + "</span>"; }).join("")
    + (i.wat || []).map(function (w) { return '<span class="label">' + esc(w) + "</span>"; }).join("") + "</div>"
    + "<h2 class='paneel-kop'>" + esc(i.titel) + "</h2>"
    + '<div class="feiten"><div><span>Wanneer</span><b>' + wanneer + "</b></div>" + (plek ? "<div><span>Waar</span><b>" + a("https://maps.apple.com/?q=" + encodeURIComponent(plek), plek) + "</b></div>" : "") + "</div>"
    + '<div class="knoprij">' + agendaKnop(i.ics, (i.dagen || []).length > 1 ? "Hele zitting" : "Agenda") + (i.livestream ? a(i.livestream, "Livestream") : "")
    + (i.url ? a(i.url, i.soort === "Plenaire vergadering" ? "Officiële agenda" : "Bron") : "") + deelKnop(i.titel + " · " + lang(i.datum), i.url) + "</div>";
  if (i.extra) h += '<p class="klein">' + esc(i.extra) + "</p>";
  if ((i.dagen || []).length) {
    h += '<h3 class="sectiekop">Programma</h3>';
    i.dagen.forEach(function (d) {
      var t = tijdTekst(d);
      h += '<div class="dagkop"><div><b>' + esc(lang(d.datum)) + "</b>" + (t ? ' <span class="tijd">' + t + "</span>" : "") + "</div>" + agendaKnop(d.ics, "dag") + "</div>";
      if ((d.blokken || []).length) h += d.blokken.map(blokHtml).join("");
      else if (d.debatten.length) h += '<ul class="punten">' + d.debatten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
      else h += '<p class="klein">Programma nog niet gepubliceerd.</p>';
    });
    h += '<p class="klein">Tijden in Brusselse tijd, volgens de agenda van het Parlement. Die kan nog veranderen.</p>';
  } else if (i.verder) h += '<p class="klein">Verder dan 4 weken vooruit: het programma volgt later.</p>';
  else if (i.soort === "Raad" || i.soort === "EU-top") h += '<p class="klein">Het voorzitterschap publiceert geen tijden. De onderwerpen staan op de pagina van de vergadering (Bron).</p>';
  if ((i.punten || []).length && !(i.dagen || []).length) h += "<h3 class='sectiekop'>Op de agenda (dossiers)</h3><ul class='punten'>" + i.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
  if ((i.dossiers || []).length) h += "<h3 class='sectiekop'>Dossiers die OEIL in deze zitting verwacht <span class='teller-klein'>" + i.dossiers.length + "</span></h3><ul class='punten'>"
    + i.dossiers.map(function (d) { return '<li><a href="#dossiers?open=' + encodeURIComponent(d.ref) + '">' + esc(d.titel) + '</a> <span class="klein">' + esc(d.ref) + "</span></li>"; }).join("") + "</ul>";
  if (i.ref) h += '<div class="knoprij"><a class="mini" href="#dossiers?open=' + encodeURIComponent(i.ref) + '">Naar het dossier ' + esc(i.ref) + "</a></div>";
  return h;
}
function openAgenda(id, dieper) {
  var i = AGENDA_INDEX[id];
  if (i) openPaneel(wieKort(i), agendaDetail(i), { dieper: dieper });
}
paneelLijf.addEventListener("click", function (e) {
  var m = e.target.closest(".meer-punten");
  if (m) { alle("li[hidden]", m.parentNode).forEach(function (li) { li.hidden = false; }); m.remove(); }
});

// ---------- eerdere debatten en de planning van de Commissie (als wolkje) ----------
function sprekers(x) { return (x.fracties || []).reduce(function (s, f) { return s + f[1]; }, 0); }
function debatDetail(x) {
  return '<div class="klein">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</div><h2 class='paneel-kop'>" + esc(x.titel) + "</h2>"
    + '<p class="klein">' + (x.sprekers_bekend ? sprekers(x) + " sprekers uit het Parlement" + (x.overige_sprekers ? " · " + x.overige_sprekers + " overige sprekers (bijvoorbeeld Commissie of Raad)" : "") : "Sprekers niet beschikbaar") + "</p>"
    + '<div class="fracties">' + (x.fracties || []).map(function (f) { return "<span><i style='background:" + (KLEUR[f[0]] || "#999") + "'></i>" + esc(f[0]) + " " + f[1] + "</span>"; }).join("") + "</div>"
    + ((x.nederlanders || []).length ? "<h3 class='sectiekop'>Nederlandse sprekers</h3><ul class='punten'>" + x.nederlanders.map(function (p) { return '<li><a href="#mensen?id=' + esc(p.id) + '">' + esc(p.naam) + "</a> (" + esc(p.partij) + ")</li>"; }).join("") + "</ul>" : "")
    + '<div class="knoprij">' + a(x.verslag, "Verslag van het debat") + deelKnop(x.titel, x.verslag) + "</div>";
}
var debatSort = lees("eu-sort-db") || "datum";
function debattenHtml() {
  var l = DEBATTEN.debatten.slice();
  l.sort(function (x, y) { return debatSort === "sprekers" ? sprekers(y) - sprekers(x) : (y.datum.localeCompare(x.datum) || x.nummer - y.nummer); });
  var h = '<div class="lijstbalk"><span class="telling">' + l.length + ' debatten</span><span class="seg-klein"><button type="button" data-dbsort="datum" class="' + (debatSort === "datum" ? "actief" : "") + '">Op datum</button><button type="button" data-dbsort="sprekers" class="' + (debatSort === "sprekers" ? "actief" : "") + '">Op sprekers</button></span></div>';
  var huidig = null;
  l.forEach(function (x) {
    if (debatSort === "datum" && x.datum !== huidig) { h += '<h4 class="dagkop-lijst"><span class="dagnaam">' + esc(lang(x.datum)) + "</span><span class='dagnr'>" + esc(x.plaats) + "</span></h4>"; huidig = x.datum; }
    var nl = (x.nederlanders || []).map(function (p) { return esc(p.naam); });
    h += '<div class="kaart compact dbkaart k-ep" data-i="' + DEBATTEN.debatten.indexOf(x) + '" role="button" tabindex="0">' + (debatSort !== "datum" ? '<div class="klein">' + kort(x.datum) + "</div>" : "")
      + '<h3 class="twee-regels">' + esc(x.titel) + '</h3><div class="klein feitregel">' + (x.sprekers_bekend ? sprekers(x) + " sprekers" : "sprekers onbekend") + (nl.length ? " · Nederlands: " + nl.join(", ") : "") + "</div><span class='pijl'>›</span></div>";
  });
  return h;
}
function planningHtml() {
  var h = '<p class="klein">Wat de Commissie zelf zegt te willen voorstellen, per kwartaal. Alleen het kwartaal is bekend, geen datum, en de planning schuift vaak. Bron: ' + a("https://ec.europa.eu/info/law/better-regulation/have-your-say_nl", "Geef uw mening") + ".</p>";
  var huidig = null;
  PLANNING.items.forEach(function (x) {
    if (x.gepland !== huidig) { h += (huidig ? "</div>" : "") + '<h4 class="dagkop-lijst"><span class="dagnaam">' + KW[x.kwartaal] + " kwartaal " + x.jaar + "</span>" + (x.gepland === PLANNING.huidig ? '<span class="wanneer">nu</span>' : "") + (x.achter ? "<span class='dagnr'>nog niet aangenomen</span>" : "") + '</h4><div class="kaart lijstkaart">'; huidig = x.gepland; }
    h += '<a class="planrij k-com" href="' + esc(x.url) + '" target="_blank" rel="noopener"><span class="label k-com wie">' + esc(x.soort_naam) + "</span><b>" + esc(x.titel) + "</b>" + (x.dg ? '<span class="klein">DG ' + esc(x.dg) + "</span>" : "") + "</a>";
  });
  return h + (huidig ? "</div>" : "") + opgehaald("commissie", "Planning");
}
document.addEventListener("click", function (e) {
  var z = e.target.closest && e.target.closest("[data-zacht]");
  if (z) {
    if (z.dataset.zacht === "debatten") openPaneel("Eerdere debatten", debattenHtml());
    else laden("commissie").then(function (d) { PLANNING = PLANNING || d; openPaneel("Gepland door de Commissie", planningHtml()); });
    return;
  }
  var s = e.target.closest && e.target.closest("[data-dbsort]");
  if (s) { debatSort = s.dataset.dbsort; bewaar("eu-sort-db", debatSort); paneelLijf.innerHTML = debattenHtml(); return; }
  var db = e.target.closest && e.target.closest("#paneel-lijf .dbkaart");
  if (db) openPaneel("Debat", debatDetail(DEBATTEN.debatten[+db.dataset.i]), { dieper: true });
});

var agendaOpgezet = false;
function agendaOpzetten() {
  if (agendaOpgezet) return;
  agendaOpgezet = true;
  document.getElementById("a-uit").onclick = function () { zetDichtheid(aDicht + 1); };
  document.getElementById("a-in").onclick = function () { zetDichtheid(aDicht - 1); };
  var tl = document.getElementById("a-tijdlijn");
  tl.addEventListener("click", function (e) {
    if (e.target.closest("[data-tok-zoeker], [data-zacht], a")) return;
    var it = e.target.closest(".item, .orij[data-id]");
    if (it) agendaPop(AGENDA_INDEX[it.dataset.id], it);
  });
  document.getElementById("a-strook").addEventListener("scroll", function () { cancelAnimationFrame(strookMaand.f); strookMaand.f = requestAnimationFrame(strookMaand); }, { passive: true });
  document.getElementById("a-strook").addEventListener("click", function (e) {
    var b = e.target.closest(".sdag"); if (!b || b.disabled) return;
    var el = vindDag(b.dataset.dag); if (!el) return;
    volgStrook.bezig = true;
    var plak = document.querySelector("#agenda .agenda-plak").getBoundingClientRect().bottom;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - plak - 8, behavior: MINDER_BEWEGING ? "auto" : "smooth" });
    setTimeout(function () { volgStrook.bezig = false; volgStrook(); }, 600);
  });
}
function agendaLaden() {
  return Promise.all([laden("agenda"), laden("debatten")]).then(function (r) {
    if (!AGENDA) {
      AGENDA = r[0];
      alleAgenda().forEach(function (i) { AGENDA_INDEX[i.id] = i; });
    }
    if (!DEBATTEN) DEBATTEN = r[1];
    return AGENDA;
  });
}
function agendaTab(q) {
  var doel = document.getElementById("a-tijdlijn");
  bezig(doel);
  agendaLaden().then(function () {
    agendaOpzetten();
    agendaTonen();
    AZ.teken();
    if (q && q.item) openAgenda(q.item);
    if (!PLANNING) laden("commissie").then(function (d) { PLANNING = d; if (huidigeTab() === "agenda") agendaTonen(); }).catch(function () {});
  }).catch(function () { laadFout(doel); });
}

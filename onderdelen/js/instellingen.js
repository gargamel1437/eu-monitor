// =====================================================================
//  instellingen.js: het tandwiel rechtsboven, zoals Instellingen op de iPhone.
//  Het eerste scherm toont alleen de categorieën; tik = één niveau dieper. Terug (knop of
//  vegen) gaat één niveau terug. Alles wordt alleen in deze browser bewaard.
// =====================================================================

var TAB_NAMEN = { agenda: "Agenda", nieuws: "Nieuws", overzicht: "Overzicht", dossiers: "Dossiers", stemmingen: "Stemmen" };
var INST_IK = {
  algemeen: ['#8e8e93', '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'],
  nieuws: ['#ff3b30', '<path d="M5 5h11v14H7a2 2 0 0 1-2-2z"/><path d="M16 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/>'],
  agenda: ['#ff9500', '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'],
  overzicht: ['#007aff', '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'],
  notities: ['#ffcc00', '<path d="M6 4h12v16H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>'],
  over: ['#34c759', '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.5v.01"/>']
};
function ikoon(k) { var x = INST_IK[k]; return '<span class="inst-ik" style="background:' + x[0] + '"><svg viewBox="0 0 24 24">' + x[1] + "</svg></span>"; }
function instRij(label, control, uitleg) {
  return '<div class="inst-rij"><div class="inst-label">' + label + (uitleg ? '<span class="klein">' + uitleg + "</span>" : "") + "</div>" + control + "</div>";
}
function instKnopRij(label, actie, waarde, ik) {
  return '<button type="button" class="inst-rij inst-link" data-inst="' + actie + '">' + (ik ? ikoon(ik) : "") + '<span class="inst-label">' + label + "</span>" + (waarde ? '<span class="fs-waarde">' + waarde + "</span>" : "") + '<span class="pijl">›</span></button>';
}
function schakel(sleutel, aan, extra) {
  return '<label class="schakelaar"><input type="checkbox" data-sleutel="' + sleutel + '"' + (extra ? ' data-extra="' + esc(extra) + '"' : "") + (aan ? " checked" : "") + "><span></span></label>";
}
function vinkLijst(sleutel, waarden, huidig) {
  return '<div class="inst-lijst">' + Object.keys(waarden).map(function (k) {
    return '<button type="button" class="inst-rij" data-kies="' + sleutel + '" data-waarde="' + k + '"><span class="inst-label">' + waarden[k] + '</span><span class="vink' + (k === huidig ? " aan" : "") + '">✓</span></button>';
  }).join("") + "</div>";
}
function groep(titel, inhoud, voet) { return '<div class="inst-groep">' + (titel ? "<h4>" + titel + "</h4>" : "") + '<div class="inst-lijst">' + inhoud + "</div>" + (voet ? '<p class="klein inst-voet">' + voet + "</p>" : "") + "</div>"; }
var TEKST = { klein: "Klein", standaard: "Standaard", groot: "Groot", groter: "Groter" };

// ---------- de schermen ----------
var INST_SCHERM = {
  hoofd: function () {
    var n = Object.keys(NOTITIES).length;
    return groep("", instKnopRij("Algemeen", "algemeen", "", "algemeen") + instKnopRij("Nieuws", "nieuws", "", "nieuws") + instKnopRij("Agenda", "agenda", "", "agenda") + instKnopRij("Overzicht", "overzicht", "", "overzicht"))
      + groep("", instKnopRij("Mijn notities", "notities", n ? String(n) : "", "notities") + instKnopRij("Over deze site", "over", "", "over"));
  },
  algemeen: function () {
    return groep("", instKnopRij("Openen met", "start", TAB_NAMEN[INST.start]) + instKnopRij("Tekstgrootte", "tekst", TEKST[INST.tekst]))
      + groep("", instRij("Minder beweging", schakel("minder", INST.beweging === "minder")), "Zet schuif- en zoomanimaties uit.");
  },
  start: function () { return vinkLijst("start", TAB_NAMEN, INST.start); },
  tekst: function () { return vinkLijst("tekst", TEKST, INST.tekst); },
  nieuws: function () {
    var b = {};
    alle("li.bericht").forEach(function (li) { b[li.dataset.bron] = li.classList.contains("officieel") ? "Persberichten" : "Media"; });
    var namen = Object.keys(b).sort(function (x, y) { return b[x].localeCompare(b[y]) || x.localeCompare(y); });
    return groep("", instKnopRij("Standaard tonen", "nieuwsDeel", INST.nieuwsDeel === "kanaal-officieel" ? "Persberichten" : "Media") + instRij("Engelstalige berichten", schakel("engels", INST.engels)))
      + groep("Bronnen", namen.map(function (x) { return instRij(esc(x), schakel("bron", INST.bronnenUit.indexOf(x) < 0, x), b[x]); }).join(""), "Uitgezette bronnen zie je niet in Nieuws, Overzicht en zoeken.");
  },
  nieuwsDeel: function () { return vinkLijst("nieuwsDeel", { "kanaal-media": "Media", "kanaal-officieel": "Persberichten" }, INST.nieuwsDeel); },
  agenda: function () {
    return groep("Filters van de agenda", ["wat", "wie", "ook"].map(function (id) { var v = AF.veld(id); return instKnopRij(esc(v.naam), "af-" + id, esc(AF.samenvatting(v))); }).join(""),
      "Dezelfde filters als onder de knop Filters in de agenda.");
  },
  overzicht: function () { return '<div id="ov-bewerk-wrap">' + bewerkHtml() + "</div>"; },
  notities: function () {
    var k = Object.keys(NOTITIES);
    if (!k.length) return '<p class="leeg">Nog geen notities. Onder elk dossier, elke stemming, persoon en agenda-item staat een notitieveld.</p>';
    return k.map(function (x) { return '<div class="kaart compact"><div class="klein"><b>' + esc(notitieLabel(x)) + "</b></div><p>" + esc(NOTITIES[x]).replace(/\n/g, "<br>") + "</p></div>"; }).join("")
      + groep("", '<button type="button" class="inst-rij inst-link" data-inst-doe="kopieer"><span class="inst-label">Kopieer alles</span></button>'
        + '<button type="button" class="inst-rij inst-link" data-inst-doe="deel"><span class="inst-label">Delen of bewaren</span></button>'
        + '<button type="button" class="inst-rij inst-link" data-inst-doe="download"><span class="inst-label">Als tekstbestand</span></button>')
      + groep("", '<button type="button" class="inst-rij inst-link rood" data-inst-doe="wis"><span class="inst-label">Alle notities wissen</span></button>');
  },
  over: function () {
    var sw = navigator.serviceWorker && navigator.serviceWorker.controller, volgende = document.getElementById("volgende-update");
    return groep("", instKnopRij("Bronnen en beperkingen", "bronnen"))
      + groep("", instRij("Bijgewerkt", '<span class="fs-waarde">' + esc(META.bijgewerkt || "") + "</span>")
        + instRij("Volgende update", '<span class="fs-waarde">' + esc(volgende ? volgende.textContent.replace(/^volgende /, "") : "") + "</span>")
        + instRij("Zonder internet", '<span class="fs-waarde">' + (sw ? "beschikbaar" : "nog niet") + "</span>"))
      + groep("", '<button type="button" class="inst-rij inst-link rood" data-inst-doe="reset"><span class="inst-label">Alle instellingen terugzetten</span></button>', "Je notities blijven bewaard.");
  }
};
var INST_TITEL = { hoofd: "Instellingen", algemeen: "Algemeen", start: "Openen met", tekst: "Tekstgrootte", nieuws: "Nieuws", nieuwsDeel: "Standaard tonen",
  agenda: "Agenda", overzicht: "Overzicht inrichten", notities: "Mijn notities", over: "Over deze site" };
function notitieLabel(k) {
  var d = k.split(":"), soort = { m: "Persoon", s: "Stemming", d: "Dossier", db: "Debat", ag: "Agenda" }[d[0]] || "Notitie";
  if (d[0] === "m" && MENSEN_INDEX[d[1]]) return soort + ": " + MENSEN_INDEX[d[1]].naam;
  if (d[0] === "s" && STEM_INDEX[d[1]]) return soort + ": " + STEM_INDEX[d[1]].titel;
  return soort + ": " + d.slice(1).join(" ");
}
function notitiesTekst() { return Object.keys(NOTITIES).map(function (k) { return "# " + notitieLabel(k) + "\n" + NOTITIES[k]; }).join("\n\n"); }
// het huidige scherm opnieuw tekenen (na een wijziging), zonder de stapel te veranderen
var instHuidig = null;
function instTeken() { if (instHuidig && paneelOpen && INST_SCHERM[instHuidig]) paneelLijf.innerHTML = '<div data-inst-scherm="' + instHuidig + '">' + INST_SCHERM[instHuidig]() + "</div>"; }
function instOpen(naam, dieper) {
  var vorige = instHuidig;
  instHuidig = naam;
  openPaneel(INST_TITEL[naam] || "Instellingen", '<div data-inst-scherm="' + naam + '">' + INST_SCHERM[naam]() + "</div>", { dieper: dieper });
  // bij terug: het vorige scherm opnieuw tekenen, zodat het laat zien wat je net koos
  if (dieper) stapel[stapel.length - 1].terug = function () { instHuidig = vorige; instTeken(); };
}
function instFilterScherm(id) {
  var v = AF.veld(id);
  instHuidig = "af-" + id;
  var vorige = "agenda";
  openPaneel(v.naam, '<div data-inst-af="' + id + '">' + fsKeuze(AF, v) + "</div>", { dieper: true });
  stapel[stapel.length - 1].terug = function () { instHuidig = vorige; instTeken(); };
}
document.getElementById("instellingen-knop").addEventListener("click", function () { instOpen("hoofd"); });

paneelLijf.addEventListener("click", function (ev) {
  var t = ev.target;
  if (!t.closest) return;
  var k = t.closest("[data-inst]");
  if (k) {
    var wat = k.dataset.inst;
    if (wat === "bronnen") { sluitPaneel(false, "vervang"); gaNaar("bronnen"); return; }
    if (/^af-/.test(wat)) { instFilterScherm(wat.slice(3)); return; }
    if (INST_SCHERM[wat]) instOpen(wat, true);
    return;
  }
  var keuze = t.closest("[data-kies]");
  if (keuze) {
    INST[keuze.dataset.kies] = keuze.dataset.waarde;
    bewaarInst();
    alle("[data-kies] .vink", keuze.parentNode).forEach(function (v) { v.classList.toggle("aan", v.parentNode === keuze); });
    return;
  }
  var af = t.closest("[data-inst-af] [data-fs-kies]");
  if (af) {
    var id = t.closest("[data-inst-af]").dataset.instAf, v = AF.veld(id);
    AF.zet(id, af.dataset.fsKies === "" && v.meer ? null : af.dataset.fsKies);
    t.closest("[data-inst-af]").innerHTML = fsKeuze(AF, v);
    return;
  }
  var doe = t.closest("[data-inst-doe]");
  if (!doe) return;
  var d = doe.dataset.instDoe;
  if (d === "kopieer") kopieer(notitiesTekst(), doe.querySelector(".inst-label"));
  else if (d === "deel") { if (navigator.share) navigator.share({ title: "Mijn notities (EU-monitor)", text: notitiesTekst() }).catch(function () {}); else kopieer(notitiesTekst(), doe.querySelector(".inst-label")); }
  else if (d === "download") {
    var l = document.createElement("a");
    l.href = URL.createObjectURL(new Blob([notitiesTekst()], { type: "text/plain;charset=utf-8" })); l.download = "eu-monitor-notities.txt";
    document.body.appendChild(l); l.click(); setTimeout(function () { URL.revokeObjectURL(l.href); l.remove(); }, 500);
  }
  else if (d === "wis") { if (confirm("Alle notities wissen? Dit kan niet ongedaan worden gemaakt.")) { NOTITIES = {}; bewaar("eu-notities", "{}"); instTeken(); } }
  else if (d === "reset") { if (confirm("Alle instellingen terugzetten naar standaard? Je notities blijven bewaard.")) { try { localStorage.removeItem("eu-instellingen"); Object.keys(localStorage).filter(function (x) { return /^eu-f-/.test(x); }).forEach(function (x) { localStorage.removeItem(x); }); } catch (e) {} location.reload(); } }
});
paneelLijf.addEventListener("change", function (ev) {
  var el = ev.target, k = el.dataset && el.dataset.sleutel;
  if (!k) return;
  if (k === "minder") INST.beweging = el.checked ? "minder" : "systeem";
  if (k === "engels") INST.engels = el.checked;
  if (k === "bron") {
    var b = el.dataset.extra;
    INST.bronnenUit = INST.bronnenUit.filter(function (x) { return x !== b; });
    if (!el.checked) INST.bronnenUit.push(b);
  }
  bewaarInst();
  if (k === "bron" || k === "engels") { nieuwsInst(); overzichtTonen(); }
});

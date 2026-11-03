// =====================================================================
//  instellingen.js: het tandwiel rechtsboven. Gegroepeerde lijsten zoals Instellingen op de
//  iPhone. Alles wordt bewaard in deze browser (localStorage), niets gaat naar een server.
// =====================================================================

var TAB_NAMEN = { agenda: "Agenda", nieuws: "Nieuws", overzicht: "Overzicht", dossiers: "Dossiers", stemmingen: "Stemmen" };
var GROEP_NAMEN = { parlement: "Parlement", raad: "Raad", top: "EU-toppen", commissie: "Commissie", dossiers: "Dossierstappen" };

function instRij(label, control, uitleg) {
  return '<div class="inst-rij"><div class="inst-label">' + label + (uitleg ? '<span class="klein">' + uitleg + "</span>" : "") + "</div>" + control + "</div>";
}
function instKnopRij(label, actie, waarde) {
  return '<button type="button" class="inst-rij inst-link" data-inst="' + actie + '"><span class="inst-label">' + label + "</span>" + (waarde ? '<span class="klein">' + waarde + "</span>" : "") + '<span class="pijl">›</span></button>';
}
function schakel(sleutel, aan, extra) {
  return '<label class="schakelaar"><input type="checkbox" data-sleutel="' + sleutel + '"' + (extra ? ' data-extra="' + esc(extra) + '"' : "") + (aan ? " checked" : "") + "><span></span></label>";
}
function keuze(sleutel, waarden, huidig) {
  return '<select class="kies klein-kies" data-sleutel="' + sleutel + '">' + Object.keys(waarden).map(function (k) { return '<option value="' + k + '"' + (k === huidig ? " selected" : "") + ">" + waarden[k] + "</option>"; }).join("") + "</select>";
}
function groep(titel, inhoud, voet) { return '<div class="inst-groep"><h4>' + titel + '</h4><div class="inst-lijst">' + inhoud + "</div>" + (voet ? '<p class="klein inst-voet">' + voet + "</p>" : "") + "</div>"; }

function nieuwsBronnen() {
  var b = {};
  alle("li.bericht").forEach(function (li) { b[li.dataset.bron] = li.classList.contains("officieel") ? "Persberichten" : "Media"; });
  return b;
}
function instHoofd() {
  var bronnen = nieuwsBronnen(), namen = Object.keys(bronnen).sort(function (x, y) { return bronnen[x].localeCompare(bronnen[y]) || x.localeCompare(y); });
  var n = Object.keys(NOTITIES).length, sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  var volgende = document.getElementById("volgende-update");
  return groep("Algemeen",
      instRij("Openen met", keuze("start", TAB_NAMEN, INST.start))
      + instRij("Tekstgrootte", keuze("tekst", { klein: "Klein", standaard: "Standaard", groot: "Groot", groter: "Groter" }, INST.tekst))
      + instRij("Minder beweging", schakel("minder", INST.beweging === "minder"), "geen schuif-animaties"))
    + groep("Nieuws",
      instRij("Standaard tonen", keuze("nieuwsDeel", { "kanaal-media": "Media", "kanaal-officieel": "Persberichten" }, INST.nieuwsDeel))
      + instRij("Engelstalige berichten", schakel("engels", INST.engels)))
    + groep("Nieuwsbronnen", namen.map(function (b) { return instRij(esc(b), schakel("bron", INST.bronnenUit.indexOf(b) < 0, b), bronnen[b]); }).join(""), "Uitgezette bronnen zie je niet in Nieuws, Overzicht en zoeken.")
    + groep("Overzicht", instKnopRij("Overzicht inrichten", "overzicht", INST.overzicht.filter(function (b) { return b.aan; }).length + " blokken aan"))
    + groep("Agenda",
      Object.keys(GROEP_NAMEN).map(function (k) { return instRij(GROEP_NAMEN[k], schakel("alles", INST.agendaAlles.indexOf(k) >= 0, k)); }).join("")
      + instRij("Informele ministersbijeenkomsten", schakel("informeel", INST.informeel))
      + instRij("Vaste punten van de Commissie", schakel("vastePunten", INST.vastePunten), "midday briefing en College"), "Wat er onder ‘Alles’ in de agenda staat. Met de knoppen bovenaan de agenda zie je altijd elke soort apart.")
    + groep("Mijn gegevens",
      instKnopRij("Mijn notities", "notities", n ? n + (n === 1 ? " notitie" : " notities") : "geen")
      + instKnopRij("Recente zoekopdrachten wissen", "recent", RECENT.length ? RECENT.length + "" : "geen"), "Notities en zoekopdrachten staan alleen in deze browser.")
    + groep("Contact", instKnopRij("Persdiensten in Brussel en Den Haag", "contact"))
    + groep("Over",
      instKnopRij("Bronnen en beperkingen", "bronnen")
      + instRij("Bijgewerkt", '<span class="klein">' + esc(META.bijgewerkt || "") + (volgende && volgende.textContent ? "<br>" + esc(volgende.textContent) : "") + "</span>")
      + instRij("Zonder internet", '<span class="klein">' + (sw ? "beschikbaar: laatste versie bewaard" : "nog niet (open de site één keer online)") + "</span>")
      + instRij("Versie", '<span class="klein">bouw ' + esc(META.bijgewerkt || "") + "</span>"))
    + '<div class="knoprij"><button type="button" class="knop tweede breed" data-inst="reset">Alle instellingen terugzetten</button></div>';
}
function terugNaarHoofd() { return '<button type="button" class="linkknop inst-terug" data-inst="hoofd">‹ Instellingen</button>'; }
function notitieLabel(k) {
  var d = k.split(":"), soort = { m: "Persoon", s: "Stemming", d: "Dossier", db: "Debat", ag: "Agenda" }[d[0]] || "Notitie";
  if (d[0] === "m" && typeof MENSEN_INDEX !== "undefined" && MENSEN_INDEX[d[1]]) return soort + ": " + MENSEN_INDEX[d[1]].naam;
  if (d[0] === "s" && typeof STEM_INDEX !== "undefined" && STEM_INDEX[d[1]]) return soort + ": " + STEM_INDEX[d[1]].titel;
  return soort + ": " + d.slice(1).join(" ");
}
function notitiesTekst() { return Object.keys(NOTITIES).map(function (k) { return "# " + notitieLabel(k) + "\n" + NOTITIES[k]; }).join("\n\n"); }
function instNotities() {
  var k = Object.keys(NOTITIES);
  return terugNaarHoofd() + "<h2 class='paneel-kop'>Mijn notities</h2>"
    + (k.length ? k.map(function (x) { return '<div class="kaart compact"><div class="klein"><b>' + esc(notitieLabel(x)) + "</b></div><p>" + esc(NOTITIES[x]).replace(/\n/g, "<br>") + "</p></div>"; }).join("")
      + '<div class="knoprij"><button class="mini" type="button" data-inst="kopieer-notities">Kopieer alles</button><button class="mini" type="button" data-inst="deel-notities">Delen of bewaren</button><button class="mini" type="button" data-inst="download-notities">Als tekstbestand</button></div>'
      + '<div class="knoprij"><button class="knop tweede breed" type="button" data-inst="wis-notities">Alle notities wissen</button></div>'
      : '<p class="leeg">Nog geen notities. Onder elk dossier, elke stemming, persoon en agenda-item staat een notitieveld.</p>');
}
function openInstellingen(wat) {
  var h = wat === "notities" ? instNotities() : instHoofd();
  if (paneelOpen) { paneelTitel.textContent = "Instellingen"; paneelLijf.innerHTML = h; paneelLijf.scrollTop = 0; }
  else openPaneel("Instellingen", h);
}
document.getElementById("instellingen-knop").addEventListener("click", function () { openInstellingen(); });

paneelLijf.addEventListener("change", function (ev) {
  var el = ev.target, k = el.dataset && el.dataset.sleutel;
  if (!k) return;
  if (k === "start" || k === "tekst" || k === "nieuwsDeel") INST[k] = el.value;
  if (k === "minder") INST.beweging = el.checked ? "minder" : "systeem";
  if (k === "engels" || k === "informeel" || k === "vastePunten") INST[k] = el.checked;
  if (k === "bron") {
    var b = el.dataset.extra;
    INST.bronnenUit = INST.bronnenUit.filter(function (x) { return x !== b; });
    if (!el.checked) INST.bronnenUit.push(b);
  }
  if (k === "alles") {
    var g = el.dataset.extra;
    INST.agendaAlles = INST.agendaAlles.filter(function (x) { return x !== g; });
    if (el.checked) INST.agendaAlles.push(g);
  }
  bewaarInst();
  // meteen laten zien
  if (k === "bron" || k === "engels") nieuwsInst();
  if (k === "informeel" || k === "vastePunten") { aFilter.informeel = INST.informeel; aFilter.vast = INST.vastePunten; var i1 = document.getElementById("a-informeel"), i2 = document.getElementById("a-vast"); if (i1) i1.checked = INST.informeel; if (i2) i2.checked = INST.vastePunten; }
  if (AGENDA && (k === "alles" || k === "informeel" || k === "vastePunten")) agendaTonen();
  overzichtTonen();
});
paneelLijf.addEventListener("click", function (ev) {
  var k = ev.target.closest && ev.target.closest("[data-inst]");
  if (!k) return;
  var wat = k.dataset.inst;
  if (wat === "hoofd") openInstellingen();
  else if (wat === "notities") openInstellingen("notities");
  else if (wat === "overzicht") { paneelTitel.textContent = "Overzicht inrichten"; paneelLijf.innerHTML = terugNaarHoofd() + bewerkHtml(); bewerkOpzetten(); }
  else if (wat === "recent") { RECENT = []; bewaar("eu-recent", "[]"); overzichtTonen(); openInstellingen(); }
  else if (wat === "bronnen") { sluitPaneel(false, "vervang"); gaNaar("bronnen"); }
  else if (wat === "contact") {
    paneelLijf.innerHTML = terugNaarHoofd() + '<p class="laden">Laden…</p>';
    bestuurLaden().then(function (b) { paneelLijf.innerHTML = terugNaarHoofd() + "<h2 class='paneel-kop'>Persdiensten</h2>" + contactpuntenHtml(b.contactpunten); })
      .catch(function () { paneelLijf.innerHTML = terugNaarHoofd() + '<p class="leeg">Kon de contactpunten niet laden.</p>'; });
  }
  else if (wat === "kopieer-notities") kopieer(notitiesTekst(), k);
  else if (wat === "deel-notities") { if (navigator.share) navigator.share({ title: "Mijn notities (EU-monitor)", text: notitiesTekst() }).catch(function () {}); else kopieer(notitiesTekst(), k); }
  else if (wat === "download-notities") {
    var l = document.createElement("a");
    l.href = URL.createObjectURL(new Blob([notitiesTekst()], { type: "text/plain;charset=utf-8" })); l.download = "eu-monitor-notities.txt";
    document.body.appendChild(l); l.click(); setTimeout(function () { URL.revokeObjectURL(l.href); l.remove(); }, 500);
  }
  else if (wat === "wis-notities") {
    if (confirm("Alle notities wissen? Dit kan niet ongedaan worden gemaakt.")) { NOTITIES = {}; bewaar("eu-notities", "{}"); openInstellingen("notities"); }
  }
  else if (wat === "reset") {
    if (confirm("Alle instellingen terugzetten naar standaard? Je notities blijven bewaard.")) { try { localStorage.removeItem("eu-instellingen"); } catch (e) {} location.reload(); }
  }
});

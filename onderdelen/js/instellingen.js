// =====================================================================
//  instellingen.js: het tandwiel rechtsboven, zoals Instellingen op de iPhone, als wolkje.
//  Het eerste scherm toont alleen de categorieën; tik = één niveau dieper. Terug (knop of
//  vegen) gaat één niveau terug. "Bronnen en beperkingen" staat onder Over, in hetzelfde wolkje.
//  Alles wordt alleen in deze browser bewaard.
// =====================================================================

var TAB_NAMEN = { agenda: "Agenda", nieuws: "Pers", overzicht: "Zoek", dossiers: "Dossiers", mensen: "Personen" };
var INST_IK = {
  algemeen: ["#8e8e93", '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'],
  pers: ["#ff3b30", '<path d="M5 5h11v14H7a2 2 0 0 1-2-2z"/><path d="M16 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/>'],
  agenda: ["#ff9500", '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'],
  over: ["#34c759", '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.5v.01"/>'],
  sleutel: ["#5856d6", '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>'],
  bronnen: ["#007aff", '<path d="M5 4h10l4 4v12H5z"/><path d="M8 11h8M8 15h8"/>']
};
function ikoon(k) { return '<span class="inst-ik"><svg viewBox="0 0 24 24">' + INST_IK[k][1] + "</svg></span>"; }
function instRij(label, control, uitleg) { return '<div class="inst-rij"><div class="inst-label">' + label + (uitleg ? '<span class="klein">' + uitleg + "</span>" : "") + "</div>" + control + "</div>"; }
function instKnopRij(label, actie, waarde, ik) {
  return '<button type="button" class="inst-rij inst-link" data-inst="' + actie + '">' + (ik ? ikoon(ik) : "") + '<span class="inst-label">' + label + "</span>" + (waarde ? '<span class="fs-waarde">' + waarde + "</span>" : "") + '<span class="pijl">›</span></button>';
}
function schakel(sleutel, aan, extra) { return '<label class="schakelaar"><input type="checkbox" data-sleutel="' + sleutel + '"' + (extra ? ' data-extra="' + esc(extra) + '"' : "") + (aan ? " checked" : "") + "><span></span></label>"; }
function vinkLijst(sleutel, waarden, huidig) {
  return '<div class="inst-lijst">' + Object.keys(waarden).map(function (k) {
    return '<button type="button" class="inst-rij" data-kies="' + sleutel + '" data-waarde="' + k + '"><span class="inst-label">' + waarden[k] + '</span><span class="vink' + (k === huidig ? " aan" : "") + '">✓</span></button>';
  }).join("") + "</div>";
}
function groep(titel, inhoud, voet) { return '<div class="inst-groep">' + (titel ? "<h4>" + titel + "</h4>" : "") + '<div class="inst-lijst">' + inhoud + "</div>" + (voet ? '<p class="klein inst-voet">' + voet + "</p>" : "") + "</div>"; }
var TEKST = { klein: "Klein", standaard: "Standaard", groot: "Groot", groter: "Groter" };

var INST_SCHERM = {
  hoofd: function () {
    return groep("", instKnopRij("Algemeen", "algemeen", "", "algemeen") + instKnopRij("Pers", "pers", "", "pers") + instKnopRij("Agenda", "agenda", "", "agenda"))
      + groep("", instKnopRij("GitHub-sleutel", "sleutel", ghSleutel() ? "ingesteld" : "geen", "sleutel"), "Voor echt nieuw nieuws als je in Pers omlaag trekt.")
      + groep("", instKnopRij("Bronnen en beperkingen", "bronnen", "", "bronnen") + instKnopRij("Over deze site", "over", "", "over"))
      + '<p class="klein inst-voet">Het Zoek-scherm pas je aan met Wijzig, of door een widget even vast te houden.</p>';
  },
  algemeen: function () {
    return groep("", instKnopRij("Openen met", "start", TAB_NAMEN[INST.start]) + instKnopRij("Tekstgrootte", "tekst", TEKST[INST.tekst]))
      + groep("", instRij("Minder beweging", schakel("minder", INST.beweging === "minder")), "Zet schuif- en zoomanimaties uit.");
  },
  start: function () { return vinkLijst("start", TAB_NAMEN, INST.start); },
  tekst: function () { return vinkLijst("tekst", TEKST, INST.tekst); },
  pers: function () {
    var b = {};
    alle("li.bericht").forEach(function (li) { (li.dataset.bronnen || li.dataset.bron).split("|").forEach(function (x) { b[x] = li.classList.contains("officieel") ? "Persberichten" : "Media"; }); });
    var namen = Object.keys(b).sort(function (x, y) { return b[x].localeCompare(b[y]) || x.localeCompare(y); });
    return groep("", instKnopRij("Standaard tonen", "nieuwsDeel", INST.nieuwsDeel === "kanaal-officieel" ? "Persberichten" : "Media") + instRij("Engelstalige berichten", schakel("engels", INST.engels)))
      + groep("Verversen", instKnopRij("GitHub-sleutel", "sleutel", ghSleutel() ? "ingesteld" : "geen"),
        ghSleutel() ? "Omlaag trekken in Pers haalt nu echt nieuw nieuws op (een à twee minuten)." : "Zonder sleutel laadt omlaag trekken de laatste versie (07:15, 12:15, 18:15).")
      + groep("Bronnen", namen.map(function (x) { return instRij(esc(x), schakel("bron", INST.bronnenUit.indexOf(x) < 0, x), b[x]); }).join(""), "Uitgezette bronnen zie je niet in Pers, op het Zoek-scherm en bij zoeken.");
  },
  sleutel: function () {
    var heeft = !!ghSleutel();
    return '<div class="inst-groep"><p class="klein inst-voet sleutel-uitleg">Met een sleutel laat omlaag trekken in Pers GitHub meteen het nieuws ophalen, in plaats van te wachten op 07:15, 12:15 of 18:15. Dat duurt een à twee minuten. De sleutel blijft alleen op dit apparaat en mag maar één ding: deze site bijwerken.</p></div>'
      + groep("Zo maak je hem", '<ol class="sleutel-stappen klein">'
        + '<li>Open <a href="https://github.com/settings/personal-access-tokens/new?name=EU-monitor+verversen&amp;description=Pers+verversen+in+de+EU-monitor&amp;target_name=gargamel1437&amp;expires_in=365&amp;actions=write" target="_blank" rel="noopener">deze link</a> en log in. Naam, vervaldatum (een jaar) en het recht Actions staan dan meestal al ingevuld.</li>'
        + "<li>Repository access: <b>Only select repositories</b> en kies <b>eu-monitor</b>.</li>"
        + "<li>Controleer bij Permissions dat <b>Actions</b> op <b>Read and write</b> staat. Verder niets.</li>"
        + "<li>Tik op <b>Generate token</b>, kopieer hem en plak hem hieronder.</li></ol>")
      + groep("Sleutel", '<div class="inst-rij sleutel-rij"><input id="gh-sleutel" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" value="' + esc(ghSleutel()) + '"></div>'
        + '<button type="button" class="inst-rij inst-link" data-inst-doe="sleutel-bewaar"><span class="inst-label">Bewaren en testen</span></button>'
        + (heeft ? '<button type="button" class="inst-rij inst-link rood" data-inst-doe="sleutel-weg"><span class="inst-label">Verwijderen</span></button>' : ""),
        '<span id="sleutel-uitslag"></span>');
  },
  nieuwsDeel: function () { return vinkLijst("nieuwsDeel", { "kanaal-media": "Media", "kanaal-officieel": "Persberichten" }, INST.nieuwsDeel); },
  agenda: function () {
    return groep("", instRij("Informele ministersbijeenkomsten", schakel("informeel", INST.informeel)) + instRij("Vaste punten van de Commissie", schakel("vastePunten", INST.vastePunten), "midday briefing en College"),
      "Filteren op wie, wat of waar doe je in het zoekveld van de agenda: typ bijvoorbeeld “wie”.");
  },
  bronnen: function () { return '<div class="bronnen-tekst">' + document.getElementById("bronnen-inhoud").innerHTML + "</div>"; },
  over: function () {
    var sw = navigator.serviceWorker && navigator.serviceWorker.controller, volgende = document.getElementById("volgende-update");
    return groep("", instRij("Bijgewerkt", '<span class="fs-waarde">' + esc(META.bijgewerkt || "") + "</span>")
        + instRij("Volgende update", '<span class="fs-waarde">' + esc(volgende ? volgende.textContent.replace(/^volgende /, "") : "") + "</span>")
        + instRij("Zonder internet", '<span class="fs-waarde">' + (sw ? "beschikbaar" : "nog niet") + "</span>"))
      + groep("", '<button type="button" class="inst-rij inst-link rood" data-inst-doe="reset"><span class="inst-label">Alle instellingen terugzetten</span></button>', "Filters, widgets en voorkeuren gaan terug naar standaard.");
  }
};
var INST_TITEL = { sleutel: "GitHub-sleutel", hoofd: "Instellingen", algemeen: "Algemeen", start: "Openen met", tekst: "Tekstgrootte", pers: "Pers", nieuwsDeel: "Standaard tonen",
  agenda: "Agenda", bronnen: "Bronnen", over: "Over deze site" };
var instHuidig = null;
function instTeken() { if (instHuidig && paneelOpen && INST_SCHERM[instHuidig]) paneelLijf.innerHTML = '<div data-inst-scherm="' + instHuidig + '">' + INST_SCHERM[instHuidig]() + "</div>"; }
function instOpen(naam, dieper) {
  var vorige = instHuidig;
  instHuidig = naam;
  bronRect = document.getElementById("instellingen-knop").getBoundingClientRect();
  openPaneel(INST_TITEL[naam] || "Instellingen", '<div data-inst-scherm="' + naam + '">' + INST_SCHERM[naam]() + "</div>", { dieper: dieper, vol: true });
  if (dieper) stapel[stapel.length - 1].terug = function () { instHuidig = vorige; instTeken(); };
}
document.getElementById("instellingen-knop").addEventListener("click", function () { instOpen("hoofd"); });

paneelLijf.addEventListener("click", function (ev) {
  var t = ev.target;
  if (!t.closest) return;
  var k = t.closest("[data-inst]");
  if (k) { if (INST_SCHERM[k.dataset.inst]) instOpen(k.dataset.inst, true); return; }
  var keuze = t.closest("[data-kies]");
  if (keuze) {
    INST[keuze.dataset.kies] = keuze.dataset.waarde;
    bewaarInst();
    alle("[data-kies] .vink", keuze.parentNode).forEach(function (v) { v.classList.toggle("aan", v.parentNode === keuze); });
    return;
  }
  var doe = t.closest("[data-inst-doe]");
  if (doe && doe.dataset.instDoe === "sleutel-bewaar") {
    var waarde = (document.getElementById("gh-sleutel").value || "").trim(), uit = document.getElementById("sleutel-uitslag");
    if (!waarde) { uit.textContent = "Plak eerst een sleutel."; return; }
    bewaar("eu-gh-sleutel", waarde);
    uit.textContent = "Even testen…";
    gh("/actions/workflows/" + GH.workflow).then(function () {
      uit.textContent = "Werkt. Trek in Pers omlaag om nieuw nieuws op te halen.";
    }, function (e) {
      uit.textContent = e && e.message === "sleutel" ? "GitHub accepteert deze sleutel niet. Kijk of hij bij eu-monitor hoort en Actions: Read and write heeft." : "Testen lukte niet (internet?). De sleutel is wel bewaard.";
    });
    return;
  }
  if (doe && doe.dataset.instDoe === "sleutel-weg") {
    try { localStorage.removeItem("eu-gh-sleutel"); } catch (e) {}
    instTeken();
    return;
  }
  if (doe && doe.dataset.instDoe === "reset") {
    if (doe.dataset.zeker) {
      try { Object.keys(localStorage).filter(function (x) { return /^eu-(instellingen|f-|z-|sort-|a-dicht)/.test(x); }).forEach(function (x) { localStorage.removeItem(x); }); } catch (e) {}
      location.reload();
    } else { doe.dataset.zeker = "1"; doe.querySelector(".inst-label").textContent = "Tik nog een keer om alles terug te zetten"; }
  }
});
paneelLijf.addEventListener("change", function (ev) {
  var el = ev.target, k = el.dataset && el.dataset.sleutel;
  if (!k) return;
  if (k === "minder") INST.beweging = el.checked ? "minder" : "systeem";
  if (k === "engels" || k === "informeel" || k === "vastePunten") INST[k] = el.checked;
  if (k === "bron") {
    var b = el.dataset.extra;
    INST.bronnenUit = INST.bronnenUit.filter(function (x) { return x !== b; });
    if (!el.checked) INST.bronnenUit.push(b);
  }
  bewaarInst();
  if (k === "bron" || k === "engels") { nieuwsInst(); overzichtTonen(); }
  if ((k === "informeel" || k === "vastePunten") && AGENDA) agendaTonen();
});

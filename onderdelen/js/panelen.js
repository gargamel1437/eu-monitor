// =====================================================================
//  panelen.js: twee iOS-achtige lagen over de pagina heen.
//  - Filtersheet: schuift van onderen omhoog (knop "Filters" met teller).
//  - Detailpaneel: schuift van rechts over het hele scherm, met "Terug" en terugvegen.
// =====================================================================

var achtergrond = document.getElementById("laag-achter");
var openSheetId = null;

function openSheet(id) {
  var s = document.getElementById(id);
  if (!s) return;
  openSheetId = id;
  achtergrond.classList.add("zichtbaar");
  s.classList.add("open");
  document.body.classList.add("geen-scroll");
}
function sluitSheet() {
  if (!openSheetId) return;
  document.getElementById(openSheetId).classList.remove("open");
  openSheetId = null;
  if (!paneelOpen) achtergrond.classList.remove("zichtbaar");
  if (!paneelOpen) document.body.classList.remove("geen-scroll");
}
document.addEventListener("click", function (ev) {
  var k = ev.target.closest && ev.target.closest("[data-sheet]");
  if (k) { ev.preventDefault(); openSheet(k.dataset.sheet); return; }
  if (ev.target.closest && ev.target.closest("[data-sluit-sheet]")) { ev.preventDefault(); sluitSheet(); }
});
achtergrond.addEventListener("click", function () { sluitSheet(); });

// Teller op de filterknop: hoeveel filters staan er aan?
function filterTeller(knopId, n) {
  var k = document.getElementById(knopId);
  if (!k) return;
  k.querySelector(".teller").textContent = n ? n : "";
  k.classList.toggle("actief", n > 0);
}

// ---------- detailpaneel ----------
// Terug kan op vier manieren: de knop Terug, zelf vegen, de terugveeg van iOS vanaf de rand en de
// terugknop van de browser. Er mag altijd maar één animatie te zien zijn:
// - sluit iOS of de browser het paneel (popstate) vlak na een veeg vanaf de rand, dan heeft iOS al
//   zelf geschoven en verdwijnt het paneel meteen, zonder tweede schuifbeweging;
// - in Safari (niet als web-app) laat ons eigen vegen de rand met rust, zodat het niet dubbel gaat.
var paneel = document.getElementById("paneel");
var paneelLijf = document.getElementById("paneel-lijf");
var paneelTitel = document.getElementById("paneel-titel");
var paneelOpen = false;
var randVeeg = 0;   // moment van de laatste aanraking vlak bij de rand

// Een stapel schermen, zoals in iOS: dieper gaan (Instellingen > Agenda, persoon > stemming >
// dossier) en met Terug of terugvegen precies één stap terug. Pas op het eerste scherm sluit
// Terug het paneel. De knop Terug toont de naam van het vorige scherm.
var stapel = [];
var TERUG_IK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
function terugKnop() {
  var vorige = stapel[stapel.length - 1];
  document.getElementById("paneel-terug").innerHTML = TERUG_IK + '<span>' + esc(vorige ? vorige.titel : "Terug") + "</span>";
}
function schuifIn(richting) {
  if (MINDER_BEWEGING) return;
  paneelLijf.classList.remove("in-vooruit", "in-terug");
  paneelLijf.offsetWidth;
  paneelLijf.classList.add(richting === "terug" ? "in-terug" : "in-vooruit");
}
function openPaneel(titel, html, opties) {
  if (paneelOpen && opties && opties.dieper) {
    var frag = document.createDocumentFragment();
    while (paneelLijf.firstChild) frag.appendChild(paneelLijf.firstChild);
    stapel.push({ titel: paneelTitel.textContent, inhoud: frag, scroll: paneelLijf.scrollTop });
    paneelTitel.textContent = titel;
    paneelLijf.innerHTML = html;
    paneelLijf.scrollTop = 0;
    terugKnop(); schuifIn("vooruit");
    window.euMarkeer(paneelLijf);
    return;
  }
  stapel = [];
  terugKnop();
  paneelTitel.textContent = titel;
  paneelLijf.innerHTML = html;
  paneelLijf.scrollTop = 0;
  paneel.classList.remove("direct");
  paneel.style.transform = paneel.style.transition = "";
  paneel.classList.add("open");
  document.body.classList.add("geen-scroll");
  // in Safari een eigen stap in de geschiedenis (de terugknop sluit dan het paneel); als web-app niet
  if (!paneelOpen && !ALS_APP) history.pushState({ paneel: 1 }, "", location.href);
  paneelOpen = true;
  window.euMarkeer(paneelLijf);
}
// één scherm terug; op het eerste scherm: dicht
function paneelTerug(zonderAnimatie) {
  if (!stapel.length) { sluitPaneel(false); return; }
  var v = stapel.pop();
  paneelTitel.textContent = v.titel;
  paneelLijf.innerHTML = "";
  paneelLijf.appendChild(v.inhoud);
  paneelLijf.scrollTop = v.scroll;
  terugKnop();
  if (!zonderAnimatie) schuifIn("terug");
  if (typeof v.terug === "function") v.terug();
}
// hoe: "animeer" (standaard), "direct" (iOS schoof al) of "vervang" (een link naar elders)
function sluitPaneel(vanGeschiedenis, hoe) {
  if (!paneelOpen) return;
  paneelOpen = false;
  stapel = [];
  if (hoe === "direct") { paneel.classList.add("direct"); paneel.style.transition = "none"; }
  paneel.classList.remove("open");
  paneel.style.transform = "";
  if (hoe === "direct") { paneel.offsetWidth; paneel.style.transition = ""; setTimeout(function () { paneel.classList.remove("direct"); }, 50); }
  if (!openSheetId) document.body.classList.remove("geen-scroll");
  if (!vanGeschiedenis && hoe !== "vervang" && history.state && history.state.paneel) history.back();
}
document.getElementById("paneel-terug").addEventListener("click", function () { paneelTerug(); });
document.addEventListener("touchstart", function (ev) {
  var x = ev.touches[0].clientX;
  if (x < 30 || x > window.innerWidth - 30) randVeeg = performance.now();
}, { passive: true, capture: true });
window.addEventListener("popstate", function () {
  if (!paneelOpen) return;
  var doorIOS = performance.now() - randVeeg < 2500;
  if (doorIOS) geenTabAnimatieTot = performance.now() + 600;
  sluitPaneel(true, doorIOS ? "direct" : "animeer");
});
// Links in het paneel: naar een stemming, dossier, persoon of agenda-item gaat één scherm
// dieper (terug brengt je hier terug). Andere links (een lijst, zoeken) gaan naar die tab.
var DIEP = /^#(stemmingen\?id=|dossiers\?open=|mensen\?id=|agenda\?item=)/;
paneelLijf.addEventListener("click", function (ev) {
  var l = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!l) return;
  ev.preventDefault();
  var doel = l.getAttribute("href");
  if (DIEP.test(doel) && typeof openDiep === "function") { openDiep(doel); return; }
  var hadPaneel = history.state && history.state.paneel;
  sluitPaneel(false, "vervang");
  if (ALS_APP) gaNaar(doel);
  else if (hadPaneel) { history.replaceState(null, "", doel); toonTab(); zetLens(actieveLink()); }
  else location.hash = doel.slice(1);
});

// Terugvegen: veeg naar rechts. Met een vorig scherm schuift alleen de inhoud weg (één stap
// terug); op het eerste scherm schuift het hele paneel weg. Als web-app ook vanaf de rand.
(function () {
  var start = null;
  paneel.addEventListener("touchstart", function (ev) {
    var t = ev.touches[0], rand = t.clientX < 30;
    start = null;
    if (rand && !ALS_APP) return;   // dat doet Safari zelf
    if (ev.target.closest && ev.target.closest("textarea, input, select, .greep, .schakelaar")) return;
    start = { x: t.clientX, y: t.clientY, rand: rand, bezig: false, laag: stapel.length ? paneelLijf : paneel };
  }, { passive: true });
  paneel.addEventListener("touchmove", function (ev) {
    if (!start) return;
    var t = ev.touches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (!start.bezig) {
      if (Math.abs(dx) < 12 || Math.abs(dy) > Math.abs(dx)) { if (Math.abs(dy) > 12) start = null; return; }
      if (!start.rand && dx < 40) return;
      start.bezig = true;
    }
    if (dx > 0) { start.laag.style.transition = "none"; start.laag.style.transform = "translateX(" + dx + "px)"; if (start.laag === paneelLijf) paneelLijf.style.opacity = String(1 - Math.min(dx / window.innerWidth, 1) * 0.5); }
  }, { passive: true });
  function los(ev) {
    if (!start || !start.bezig) { start = null; return; }
    var dx = ev.changedTouches[0].clientX - start.x, laag = start.laag;
    start = null;
    var ver = ev.type !== "touchcancel" && dx > Math.min(120, window.innerWidth * 0.3);
    if (laag === paneelLijf) {
      laag.style.transition = "transform .22s ease, opacity .22s ease";
      if (ver) {
        laag.style.transform = "translateX(100%)"; laag.style.opacity = "0";
        setTimeout(function () { laag.style.transition = "none"; laag.style.transform = ""; laag.style.opacity = ""; paneelTerug(true); laag.offsetWidth; laag.style.transition = ""; }, 220);
      } else { laag.style.transform = ""; laag.style.opacity = ""; }
      return;
    }
    laag.style.transition = "";
    if (ver) sluitPaneel(false); else laag.style.transform = "";
  }
  paneel.addEventListener("touchend", los);
  paneel.addEventListener("touchcancel", los);
})();

// Een kaart aantikken opent het detailpaneel (behalve als je op een knop of link tikt).
function bijKaartTik(lijst, selector, open) {
  lijst.addEventListener("click", function (ev) {
    if (ev.target.closest("button, a, textarea, input, select, label")) return;
    var k = ev.target.closest(selector);
    if (k) open(k);
  });
}

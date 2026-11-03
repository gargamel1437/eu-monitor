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

function openPaneel(titel, html) {
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
// hoe: "animeer" (standaard), "direct" (iOS schoof al) of "vervang" (een link naar elders)
function sluitPaneel(vanGeschiedenis, hoe) {
  if (!paneelOpen) return;
  paneelOpen = false;
  if (hoe === "direct") { paneel.classList.add("direct"); paneel.style.transition = "none"; }
  paneel.classList.remove("open");
  paneel.style.transform = "";
  if (hoe === "direct") { paneel.offsetWidth; paneel.style.transition = ""; setTimeout(function () { paneel.classList.remove("direct"); }, 50); }
  if (!openSheetId) document.body.classList.remove("geen-scroll");
  if (!vanGeschiedenis && hoe !== "vervang" && history.state && history.state.paneel) history.back();
}
document.getElementById("paneel-terug").addEventListener("click", function () { sluitPaneel(false); });
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
// Een link in het paneel naar een ander tabblad: het paneel maakt plaats voor dat adres
// (geen history.back() plus nieuw adres, want die twee liepen door elkaar).
paneelLijf.addEventListener("click", function (ev) {
  var l = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!l) return;
  ev.preventDefault();
  var doel = l.getAttribute("href");
  var hadPaneel = history.state && history.state.paneel;
  sluitPaneel(false, "vervang");
  if (ALS_APP) gaNaar(doel);
  else if (hadPaneel) { history.replaceState(null, "", doel); toonTab(); zetLens(actieveLink()); }
  else location.hash = doel.slice(1);
});

// Terugvegen: veeg naar rechts om te sluiten (als web-app ook vanaf de rand).
(function () {
  var start = null;
  paneel.addEventListener("touchstart", function (ev) {
    var t = ev.touches[0], rand = t.clientX < 30;
    start = null;
    if (rand && !ALS_APP) return;   // dat doet Safari zelf
    if (ev.target.closest && ev.target.closest("textarea, input, select")) return;
    start = { x: t.clientX, y: t.clientY, rand: rand, bezig: false };
  }, { passive: true });
  paneel.addEventListener("touchmove", function (ev) {
    if (!start) return;
    var t = ev.touches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (!start.bezig) {
      if (Math.abs(dx) < 12 || Math.abs(dy) > Math.abs(dx)) { if (Math.abs(dy) > 12) start = null; return; }
      if (!start.rand && dx < 40) return;
      start.bezig = true;
    }
    if (dx > 0) { paneel.style.transition = "none"; paneel.style.transform = "translateX(" + dx + "px)"; }
  }, { passive: true });
  function los(ev) {
    if (!start || !start.bezig) { start = null; return; }
    var dx = ev.changedTouches[0].clientX - start.x;
    start = null;
    paneel.style.transition = "";
    if (ev.type !== "touchcancel" && dx > Math.min(120, window.innerWidth * 0.3)) sluitPaneel(false);
    else paneel.style.transform = "";
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

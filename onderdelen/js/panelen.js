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
var paneel = document.getElementById("paneel");
var paneelLijf = document.getElementById("paneel-lijf");
var paneelTitel = document.getElementById("paneel-titel");
var paneelOpen = false;

function openPaneel(titel, html) {
  paneelTitel.textContent = titel;
  paneelLijf.innerHTML = html;
  paneelLijf.scrollTop = 0;
  paneel.classList.add("open");
  paneel.style.transform = "";
  document.body.classList.add("geen-scroll");
  if (!paneelOpen) history.pushState({ paneel: 1 }, "", location.href);
  paneelOpen = true;
  window.euMarkeer(paneelLijf);
}
function sluitPaneel(vanGeschiedenis) {
  if (!paneelOpen) return;
  paneelOpen = false;
  paneel.classList.remove("open");
  paneel.style.transform = "";
  if (!openSheetId) document.body.classList.remove("geen-scroll");
  if (!vanGeschiedenis && history.state && history.state.paneel) history.back();
}
document.getElementById("paneel-terug").addEventListener("click", function () { sluitPaneel(false); });
window.addEventListener("popstate", function () { if (paneelOpen) sluitPaneel(true); });
// Een link in het paneel naar een ander tabblad: eerst het paneel sluiten.
paneelLijf.addEventListener("click", function (ev) {
  var l = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!l) return;
  ev.preventDefault();
  var doel = l.getAttribute("href");
  sluitPaneel(false);
  setTimeout(function () { location.hash = doel.slice(1); }, 60);
});

// Terugvegen: veeg vanaf de linkerkant (of ergens horizontaal) naar rechts om te sluiten.
(function () {
  var start = null;
  paneel.addEventListener("touchstart", function (ev) {
    var t = ev.touches[0];
    start = { x: t.clientX, y: t.clientY, rand: t.clientX < 30, bezig: false };
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
  paneel.addEventListener("touchend", function (ev) {
    if (!start || !start.bezig) { start = null; return; }
    var dx = ev.changedTouches[0].clientX - start.x;
    paneel.style.transition = "";
    if (dx > Math.min(120, window.innerWidth * 0.3)) sluitPaneel(false); else paneel.style.transform = "";
    start = null;
  });
})();

// Een kaart aantikken opent het detailpaneel (behalve als je op een knop of link tikt).
function bijKaartTik(lijst, selector, open) {
  lijst.addEventListener("click", function (ev) {
    if (ev.target.closest("button, a, textarea, input, select, label")) return;
    var k = ev.target.closest(selector);
    if (k) open(k);
  });
}

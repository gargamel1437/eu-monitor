// =====================================================================
//  panelen.js: details openen als een wolkje (popup) dat vanuit het aangetikte item opengroeit,
//  in plaats van een scherm dat van opzij inschuift.
//  - Tik = openen. Lang indrukken = een kleinere voorvertoning (peek); tik erop om hem helemaal
//    te openen, tik ernaast om te sluiten.
//  - Een stapel schermen (persoon > stemming > dossier, Instellingen > Algemeen): Terug,
//    naar rechts vegen of de terugknop van Safari gaat precies één stap terug.
//  - Naar beneden vegen bovenin, op het kruisje tikken of naast het wolkje tikken = dicht.
// =====================================================================

var achtergrond = document.getElementById("laag-achter");
var paneel = document.getElementById("paneel");
var paneelLijf = document.getElementById("paneel-lijf");
var paneelTitel = document.getElementById("paneel-titel");
var paneelOpen = false, openSheetId = null;
var stapel = [], geduwd = 0, peekModus = false, bronRect = null;

// onthoud waar je tikte: het wolkje groeit vanaf die plek open
document.addEventListener("pointerdown", function (ev) {
  var k = ev.target.closest && ev.target.closest(".kaart, .arij, .item, li.bericht, ul.lijst li, .orij, .widget, .wv, .bkaart");
  if (k) bronRect = k.getBoundingClientRect();
}, true);

function terugKnop() {
  var vorige = stapel[stapel.length - 1];
  var k = document.getElementById("paneel-terug");
  k.classList.toggle("verborgen", !vorige);
  k.querySelector("span").textContent = vorige ? vorige.titel : "Terug";
}
function zetOorsprong() {
  var r = bronRect, w = window.innerWidth, h = window.innerHeight;
  var x = r ? r.left + r.width / 2 : w / 2, y = r ? r.top + r.height / 2 : h / 2;
  paneel.style.setProperty("--ox", x + "px");
  paneel.style.setProperty("--oy", y + "px");
}
function schuifIn(richting) {
  if (MINDER_BEWEGING) return;
  paneelLijf.classList.remove("in-vooruit", "in-terug");
  paneelLijf.offsetWidth;
  paneelLijf.classList.add(richting === "terug" ? "in-terug" : "in-vooruit");
}
function duw() { if (!ALS_APP) { history.pushState({ paneel: stapel.length + 1 }, "", location.href); geduwd++; } }

function openPaneel(titel, html, opties) {
  opties = opties || {};
  if (paneelOpen && opties.dieper) {
    var frag = document.createDocumentFragment();
    while (paneelLijf.firstChild) frag.appendChild(paneelLijf.firstChild);
    stapel.push({ titel: paneelTitel.textContent, inhoud: frag, scroll: paneelLijf.scrollTop });
    paneelTitel.textContent = titel;
    paneelLijf.innerHTML = html;
    paneelLijf.scrollTop = 0;
    paneel.classList.remove("peek");
    terugKnop(); schuifIn("vooruit"); duw(); kopTitel();
    window.euMarkeer(paneelLijf);
    return;
  }
  var wasOpen = paneelOpen;
  stapel = [];
  terugKnop();
  paneelTitel.textContent = titel;
  paneelLijf.innerHTML = html;
  paneelLijf.scrollTop = 0;
  paneel.classList.toggle("peek", peekModus);
  paneel.classList.toggle("vol", !!opties.vol);
  peekModus = false;
  kopTitel();
  if (!wasOpen) {
    zetOorsprong();
    paneel.classList.remove("direct", "dicht-gaat");
    paneel.style.transform = paneel.style.transition = "";
    paneel.classList.add("open");
    achtergrond.classList.add("zichtbaar", "voor-paneel");
    document.body.classList.add("geen-scroll");
    paneelOpen = true;
    geduwd = 0; duw();
  }
  window.euMarkeer(paneelLijf);
}
// één scherm terug; op het eerste scherm: dicht
function paneelTerug(vanGeschiedenis) {
  if (!stapel.length) { sluitPaneel(vanGeschiedenis); return; }
  if (!vanGeschiedenis && geduwd > 1) { history.back(); return; }   // popstate doet de stap
  if (vanGeschiedenis) geduwd = Math.max(0, geduwd - 1);
  var v = stapel.pop();
  paneelTitel.textContent = v.titel;
  paneelLijf.innerHTML = "";
  paneelLijf.appendChild(v.inhoud);
  paneelLijf.scrollTop = v.scroll;
  terugKnop();
  schuifIn("terug");
  kopTitel();
  if (typeof v.terug === "function") v.terug();
}
// hoe: "animeer" (standaard), "direct" (iOS schoof al) of "vervang" (een link naar elders)
function sluitPaneel(vanGeschiedenis, hoe) {
  if (!paneelOpen) return;
  paneelOpen = false;
  stapel = [];
  zetOorsprong();
  if (hoe === "direct" || MINDER_BEWEGING) paneel.classList.add("direct");
  paneel.classList.remove("open", "peek");
  paneel.style.transform = "";
  setTimeout(function () { paneel.classList.remove("direct"); }, 60);
  achtergrond.classList.remove("voor-paneel");
  if (!openSheetId) { achtergrond.classList.remove("zichtbaar"); document.body.classList.remove("geen-scroll"); }
  var n = geduwd; geduwd = 0;
  if (!vanGeschiedenis && hoe !== "vervang" && n && history.state && history.state.paneel) history.go(-n);
}
// Staat dezelfde naam bovenin het wolkje én als kop in de inhoud, dan alleen de kop tonen;
// de naam bovenin verschijnt pas als je de kop voorbij scrollt (zoals op de iPhone).
function kopTitel() {
  var h = paneelLijf.querySelector(".paneel-kop");
  paneel.classList.toggle("titel-dubbel", !!h && h.textContent.trim() === paneelTitel.textContent.trim());
  titelScroll();
}
function titelScroll() {
  if (!paneel.classList.contains("titel-dubbel")) { paneel.classList.remove("titel-zicht"); return; }
  var h = paneelLijf.querySelector(".paneel-kop");
  paneel.classList.toggle("titel-zicht", !!h && h.getBoundingClientRect().bottom < paneelLijf.getBoundingClientRect().top + 4);
}
paneelLijf.addEventListener("scroll", titelScroll, { passive: true });
document.getElementById("paneel-terug").addEventListener("click", function () { paneelTerug(); });
document.getElementById("paneel-sluit").addEventListener("click", function () { sluitPaneel(false); });
achtergrond.addEventListener("click", function () { if (paneelOpen) sluitPaneel(false); else sluitSheet(); });
// voorvertoning: tik erop = helemaal openen
paneel.addEventListener("click", function () { if (paneel.classList.contains("peek")) paneel.classList.remove("peek"); }, true);
window.addEventListener("popstate", function () {
  if (!paneelOpen) return;
  if (stapel.length) paneelTerug(true);
  else { geduwd = 0; sluitPaneel(true, "direct"); }
});

// Links in het wolkje: naar een stemming, dossier, persoon of agenda-item gaat één scherm
// dieper (Terug brengt je hier terug). Andere links (een lijst) gaan naar die tab.
var DIEP = /^#(stemmingen\?id=|dossiers\?open=|mensen\?id=|agenda\?item=)/;
paneelLijf.addEventListener("click", function (ev) {
  var l = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!l) return;
  ev.preventDefault();
  var doel = l.getAttribute("href");
  if (DIEP.test(doel) && typeof openDiep === "function") { openDiep(doel); return; }
  var n = geduwd;
  sluitPaneel(false, "vervang");
  if (ALS_APP) gaNaar(doel);
  else { if (n > 1) history.go(-(n - 1)); setTimeout(function () { history.replaceState(null, "", doel); toonTab(); zetLens(actieveLink()); }, n > 1 ? 60 : 0); }
});

// Vegen in het wolkje: naar rechts = één stap terug (met een vorig scherm), naar beneden vanaf
// de bovenkant = dicht. Het wolkje volgt je vinger.
(function () {
  var s = null;
  paneel.addEventListener("touchstart", function (ev) {
    if (ev.touches.length !== 1 || (ev.target.closest && ev.target.closest("textarea, input, select, .greep, .schakelaar"))) { s = null; return; }
    var t = ev.touches[0];
    s = { x: t.clientX, y: t.clientY, richting: null, bovenaan: paneelLijf.scrollTop <= 0 };
  }, { passive: true });
  paneel.addEventListener("touchmove", function (ev) {
    if (!s) return;
    var t = ev.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.richting) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.3 && stapel.length) s.richting = "terug";
      else if (dy > 0 && Math.abs(dy) > Math.abs(dx) && s.bovenaan) s.richting = "dicht";
      else { s = null; return; }
    }
    if (s.richting === "terug") { paneelLijf.style.transition = "none"; paneelLijf.style.transform = "translateX(" + Math.max(0, dx) + "px)"; paneelLijf.style.opacity = String(1 - Math.min(dx / 400, .5)); }
    else { ev.preventDefault(); paneel.style.transition = "none"; paneel.style.transform = "translateY(" + Math.max(0, dy) + "px) scale(" + (1 - Math.min(dy / 2000, .05)) + ")"; }
  }, { passive: false });
  function los(ev) {
    if (!s || !s.richting) { s = null; return; }
    var t = ev.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y, r = s.richting;
    s = null;
    if (r === "terug") {
      paneelLijf.style.transition = "transform .2s ease, opacity .2s ease";
      if (dx > 80) { paneelLijf.style.transform = "translateX(60%)"; paneelLijf.style.opacity = "0"; setTimeout(function () { paneelLijf.style.transition = "none"; paneelLijf.style.transform = paneelLijf.style.opacity = ""; paneelTerug(); paneelLijf.offsetWidth; paneelLijf.style.transition = ""; }, 200); }
      else { paneelLijf.style.transform = paneelLijf.style.opacity = ""; }
      return;
    }
    paneel.style.transition = "";
    if (dy > 110) sluitPaneel(false); else paneel.style.transform = "";
  }
  paneel.addEventListener("touchend", los);
  paneel.addEventListener("touchcancel", los);
})();

// Een kaart aantikken opent het detail; lang indrukken geeft eerst een voorvertoning.
function bijKaartTik(lijst, selector, open) {
  var houd = null, gehouden = false;
  lijst.addEventListener("pointerdown", function (ev) {
    var k = ev.target.closest(selector);
    if (!k || ev.target.closest("button, a, textarea, input, select, label, .lab")) return;
    gehouden = false;
    clearTimeout(houd);
    houd = setTimeout(function () {
      gehouden = true; peekModus = true;
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
      open(k);
    }, 480);
  });
  ["pointerup", "pointercancel", "pointerleave", "pointermove"].forEach(function (t) {
    lijst.addEventListener(t, function (ev) { if (t !== "pointermove" || Math.abs(ev.movementY || 0) + Math.abs(ev.movementX || 0) > 3) clearTimeout(houd); });
  });
  lijst.addEventListener("contextmenu", function (ev) { if (ev.target.closest(selector) && gehouden) ev.preventDefault(); });
  lijst.addEventListener("click", function (ev) {
    if (gehouden) { gehouden = false; ev.preventDefault(); return; }
    if (ev.target.closest("button, a, textarea, input, select, label, .lab")) return;
    var k = ev.target.closest(selector);
    if (k) { peekModus = false; open(k); }
  });
}

// ---------- oude sheets (alleen nog gebruikt door onderdelen die er een hebben) ----------
function openSheet(id) {
  var s = document.getElementById(id);
  if (!s) return;
  openSheetId = id;
  achtergrond.classList.add("zichtbaar");
  s.classList.add("open");
}
function sluitSheet() {
  if (!openSheetId) return;
  var s = document.getElementById(openSheetId);
  if (s) s.classList.remove("open");
  openSheetId = null;
  if (!paneelOpen) { achtergrond.classList.remove("zichtbaar"); document.body.classList.remove("geen-scroll"); }
}
function filterTeller() {}

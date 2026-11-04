// =====================================================================
//  basis.js: opslag, tabbladen, het glazen selectiebolletje, uitleg bij begrippen,
//  en gedeelde hulpjes (datums, links, fracties, notities, kopiëren, agenda).
//  Licht of donker volgt altijd het systeem (prefers-color-scheme in stijl.css).
//  Alle scripts worden bij het bouwen samengevoegd tot één script (zie europa.py).
// =====================================================================
function bewaar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lees(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function alle(sel, ouder) { return Array.prototype.slice.call((ouder || document).querySelectorAll(sel)); }

// een vroeger handmatig gekozen thema opruimen: het systeem bepaalt nu
try { localStorage.removeItem("eu-thema"); } catch (e) {}

// ---- instellingen (alleen in deze browser bewaard) ----
var STANDAARD = {
  start: "overzicht", nieuwsDeel: "kanaal-media", engels: true, tekst: "standaard", beweging: "systeem",
  bronnenUit: [], informeel: true, vastePunten: true,
  // widgets op het Zoek-scherm, zoals op het beginscherm van de iPhone: maat klein (half breed),
  // middel of groot (meer regels)
  widgets: [
    { id: "agenda", aan: true, maat: "m" }, { id: "pers", aan: true, maat: "m" },
    { id: "dossiers", aan: true, maat: "k" }, { id: "stemmen", aan: true, maat: "k" },
    { id: "persberichten", aan: false, maat: "m" }, { id: "personen", aan: false, maat: "m" }
  ]
};
var INST = (function () {
  var bewaard = {};
  try { bewaard = JSON.parse(localStorage.getItem("eu-instellingen") || "{}") || {}; } catch (e) {}
  var uit = JSON.parse(JSON.stringify(STANDAARD));
  Object.keys(bewaard).forEach(function (k) { if (k in uit) uit[k] = bewaard[k]; });
  // nieuwe blokken die er later bij kwamen, achteraan toevoegen
  var ids = STANDAARD.widgets.map(function (b) { return b.id; });
  uit.widgets = (uit.widgets || []).filter(function (b) { return ids.indexOf(b.id) >= 0; });
  STANDAARD.widgets.forEach(function (b) { if (!uit.widgets.some(function (x) { return x.id === b.id; })) uit.widgets.push(JSON.parse(JSON.stringify(b))); });
  return uit;
})();
function bewaarInst() { bewaar("eu-instellingen", JSON.stringify(INST)); pasInstToe(); }
function pasInstToe() {
  var h = document.documentElement;
  h.dataset.tekst = INST.tekst; h.dataset.beweging = INST.beweging;
  if (typeof MINDER_BEWEGING !== "undefined") MINDER_BEWEGING = INST.beweging === "minder" || SYSTEEM_MINDER;
}

// Als web-app op het beginscherm bouwen we geen eigen geschiedenis op: een tab of link vervangt
// het adres (replaceState) en een paneel maakt geen nieuwe stap. Dan heeft iOS niets om "terug"
// naar te vegen, en schuift alleen ons eigen paneel weg (zonder dat de pagina erachter meeschuift).
// In Safari zelf blijft de gewone geschiedenis werken (terugknop).
var ALS_APP = !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches));
function gaNaar(hash) {
  hash = String(hash).replace(/^#/, "");
  if (!ALS_APP) { if (location.hash === "#" + hash) toonTab(); else location.hash = hash; return; }
  history.replaceState(null, "", "#" + hash);
  toonTab();
  zetLens(actieveLink());
}
document.addEventListener("click", function (ev) {
  if (!ALS_APP || ev.defaultPrevented) return;
  var l = ev.target.closest && ev.target.closest('a[href^="#"]');
  if (!l) return;
  ev.preventDefault();
  gaNaar(l.getAttribute("href"));
});
// starttab: als je de app opent zonder adres
if (!location.hash && INST.start && INST.start !== "overzicht") history.replaceState(null, "", "#" + INST.start);

// ---- tabbladen ----
var tabs = alle("section.tab").map(function (s) { return s.id; });
// oude of extra adressen en het tabblad waar ze nu staan
var extra = { stemmingen: "dossiers", stemmen: "dossiers", zoek: "overzicht", bronnen: "overzicht", personen: "mensen" };
function hashNaam() { return (location.hash || "#overzicht").slice(1).split("?")[0]; }
function huidigeTab() {
  var doel = hashNaam();
  return tabs.indexOf(doel) >= 0 ? doel : (extra[doel] || "overzicht");
}
// De volgorde van de tabs onderin: daarmee schuift een nieuwe tab zacht van links of rechts in.
var TAB_VOLGORDE = ["agenda", "nieuws", "overzicht", "dossiers", "mensen"];
var vorigeTab = null, geenTabAnimatieTot = 0;
function toonTab() {
  var doel = hashNaam();
  var naam = huidigeTab();
  var anders = naam !== vorigeTab;
  alle("section.tab").forEach(function (s) {
    s.classList.toggle("actief", s.id === naam);
    s.classList.remove("in-r", "in-l");
  });
  if (anders && vorigeTab && performance.now() > geenTabAnimatieTot) {
    var sectie = document.getElementById(naam);
    sectie.offsetWidth;  // animatie opnieuw laten starten
    sectie.classList.add(TAB_VOLGORDE.indexOf(naam) >= TAB_VOLGORDE.indexOf(vorigeTab) ? "in-r" : "in-l");
  }
  alle("nav.tabs a").forEach(function (a) { a.classList.toggle("actief", a.dataset.tab === naam); });
  document.getElementById("kleine-titel").textContent = document.getElementById(naam).dataset.titel;
  // alleen bij een andere tab naar boven; een link binnen dezelfde tab laat de pagina staan
  if (anders) { window.scrollTo(0, 0); requestAnimationFrame(function () { window.scrollTo(0, 0); kleineTitel(); }); }
  vorigeTab = naam;
  kleineTitel();
  document.dispatchEvent(new CustomEvent("eu-tab", { detail: naam, adres: doel }));
}
window.addEventListener("hashchange", toonTab);
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.addEventListener("load", function () { window.scrollTo(0, 0); kleineTitel(); });

// ---- grote titel wordt klein bij scrollen ----
var balk = document.getElementById("topbalk");
function kleineTitel() { balk.classList.toggle("zichtbaar", window.scrollY > 60); }
window.addEventListener("scroll", kleineTitel, { passive: true });
toonTab();

// ---- schakelaars (segmenten) ----
// Elk deel onthoudt zijn eigen scrollpositie. Een glazen bel achter de gekozen knop loopt mee,
// ook tijdens het vegen (zie hieronder).
var SYSTEEM_MINDER = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
var MINDER_BEWEGING = SYSTEEM_MINDER || INST.beweging === "minder";
var segScroll = {};
// Waar de delen beginnen (net onder de vaste schakelaar): daar kom je in een deel dat je nog niet bekeek.
function segBeginY(schakel) {
  var rij = schakel.closest(".plakrij") || schakel, el = rij.nextElementSibling;
  while (el && el.classList.contains("verborgen")) el = el.nextElementSibling;
  if (!el) return 0;
  var plak = parseFloat(getComputedStyle(rij).top) || 0;
  return Math.max(0, el.getBoundingClientRect().top + window.scrollY - plak - rij.offsetHeight - 8);
}
// Wisselen van deel laat alles op zijn plek: ben je nog niet voorbij het begin van de lijst, dan
// verandert de scrollpositie niet. Ben je er wel voorbij, dan kom je in het andere deel terug waar
// je was (elk deel onthoudt zijn plek), of aan het begin van dat deel, net onder het vaste blok.
function segDoelY(id, schakel, y) {
  var b = segBeginY(schakel);
  if (y <= b) return y;
  return segScroll[id] != null && segScroll[id] > b ? segScroll[id] : b;
}
function zetBel(schakel, van, naar, f) {
  var bel = schakel.querySelector(".schakel-bel");
  if (!bel || !van) return;
  var x = van.offsetLeft, w = van.offsetWidth;
  if (naar) { x += (naar.offsetLeft - van.offsetLeft) * f; w += (naar.offsetWidth - van.offsetWidth) * f; }
  bel.style.transform = "translateX(" + x + "px)";
  bel.style.width = w + "px";
}
function belDirect(schakel) {
  var bel = schakel.querySelector(".schakel-bel");
  if (!bel) return;
  bel.style.transition = "none";
  zetBel(schakel, schakel.querySelector("button.actief"));
  bel.offsetWidth; bel.style.transition = "";
}
function kiesSegment(knop) {
  var schakel = knop.parentNode, oud = schakel.querySelector("button[data-toon].actief");
  var y = window.scrollY, doelY = null;
  if (oud && oud !== knop) { segScroll[oud.dataset.toon] = y; doelY = segDoelY(knop.dataset.toon, schakel, y); }
  alle("button[data-toon]", schakel).forEach(function (b) {
    b.classList.toggle("actief", b === knop);
    var doel = document.getElementById(b.dataset.toon);
    if (doel) doel.classList.toggle("verborgen", b !== knop);
    // onderdelen die bij een deel horen maar in het vaste blok staan (zoekbalk)
    alle('[data-hoort="' + b.dataset.toon + '"]').forEach(function (el) { el.classList.toggle("verborgen", b !== knop); });
  });
  // eerst de inhoud van het nieuwe deel klaarzetten (anders is de pagina even te kort en springt hij omhoog)
  knop.dispatchEvent(new CustomEvent("eu-segment", { bubbles: true, detail: knop.dataset.toon }));
  if (doelY != null) { window.scrollTo(0, doelY); kleineTitel(); }
  zetBel(schakel, knop);
}
function toonSegment(id) { var k = document.querySelector('.schakel button[data-toon="' + id + '"]'); if (k && !k.classList.contains("actief")) kiesSegment(k); }
alle(".schakel").forEach(function (schakel) {
  if (!schakel.querySelector("button")) return;
  var bel = document.createElement("span");
  bel.className = "schakel-bel"; bel.setAttribute("aria-hidden", "true");
  schakel.insertBefore(bel, schakel.firstChild);
});
// Elk deel is een eigen blok (flow-root): dan liggen de marges binnenin precies hetzelfde, of het
// deel nu tijdens het vegen los naast het andere staat of daarna gewoon in de pagina. Anders
// verspringt de inhoud aan het eind van het vegen een stukje.
alle(".schakel button[data-toon]").forEach(function (knop) { var d = document.getElementById(knop.dataset.toon); if (d) d.classList.add("segdeel"); });
alle(".schakel button[data-toon]").forEach(function (knop) {
  knop.addEventListener("click", function () { if (!knop.classList.contains("actief")) kiesSegment(knop); });
});
function alleBellen() { alle("section.tab.actief .schakel").forEach(belDirect); }
document.addEventListener("eu-tab", function () { requestAnimationFrame(alleBellen); });
window.addEventListener("resize", alleBellen);
window.addEventListener("load", alleBellen);

// ---- vegen tussen de delen van een tab (Nieuws: Media | Uit Brussel zelf, enz.) ----
// De inhoud schuift met je vinger mee en het volgende deel schuift ernaast in, zoals op iOS.
// Verticaal scrollen blijft scrollen: pas na een duidelijk horizontale beweging pakt dit het vast.
// Vlak aan de linker- of rechterrand doet het niets: daar zit het terugvegen van iOS.
(function () {
  var g = null, bezig = false, TUSSEN = 16;
  function scrolltHorizontaal(el, tot) {
    for (; el && el !== tot; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 2) { var o = getComputedStyle(el).overflowX; if (o === "auto" || o === "scroll") return true; }
    }
    return false;
  }
  function opruimen(el) { if (el) { el.style.transform = el.style.transition = el.style.position = el.style.top = el.style.left = el.style.width = el.style.zIndex = el.style.willChange = ""; } }
  document.addEventListener("touchstart", function (ev) {
    g = null;
    if (bezig || ev.touches.length !== 1 || (typeof paneelOpen !== "undefined" && paneelOpen) || (typeof openSheetId !== "undefined" && openSheetId)) return;
    var t = ev.touches[0], el = ev.target;
    if (t.clientX < 24 || t.clientX > window.innerWidth - 24 || !el.closest) return;
    if (el.closest("input, textarea, select, .sheet, nav.tabs, #paneel, .chips, [data-geen-veeg]")) return;
    var sectie = el.closest("section.tab.actief");
    if (!sectie || scrolltHorizontaal(el, sectie)) return;
    var schakel = sectie.querySelector(".schakel");
    var knoppen = schakel ? alle("button[data-toon]", schakel) : [];
    if (knoppen.length < 2) return;
    var i = knoppen.findIndex(function (b) { return b.classList.contains("actief"); });
    var huidig = document.getElementById(knoppen[i].dataset.toon);
    if (!huidig) return;
    g = { x: t.clientX, y: t.clientY, sectie: sectie, schakel: schakel, knoppen: knoppen, i: i, huidig: huidig, vast: false, d: 0, v: 0, t: performance.now() };
  }, { passive: true });

  function begin(richting) {
    var j = g.i + richting;
    g.richting = richting;
    g.w = g.huidig.offsetWidth;
    g.buurKnop = g.knoppen[j] || null;
    g.buur = g.buurKnop ? document.getElementById(g.buurKnop.dataset.toon) : null;
    g.huidig.style.transition = "none";
    g.huidig.style.willChange = "transform";
    document.body.classList.add("veegt");
    if (!g.buur) return;
    // het buurdeel naast het huidige zetten, op de hoogte waar je straks uitkomt
    var y = window.scrollY, doelY = segDoelY(g.buur.id, g.schakel, y);
    g.doelY = doelY;
    g.buur.classList.remove("verborgen");
    var s = g.buur.style;
    s.position = "absolute"; s.zIndex = "1"; s.transition = "none";
    s.left = g.huidig.offsetLeft + "px"; s.width = g.w + "px";
    s.top = (g.huidig.offsetTop + y - doelY) + "px";
    s.transform = "translate3d(" + richting * (g.w + TUSSEN) + "px,0,0)"; s.willChange = "transform";
    // gegevens van het buurdeel alvast laden (Mensen, planning van de Commissie)
    g.buurKnop.dispatchEvent(new CustomEvent("eu-segment", { bubbles: true, detail: g.buurKnop.dataset.toon }));
  }
  function zet(d) {
    if (!g.buur) d = d / (1 + Math.abs(d) / 60) ;   // geen buurdeel: rekt een beetje mee en veert terug
    g.d = d;
    g.huidig.style.transform = "translate3d(" + d + "px,0,0)";
    if (g.buur) {
      g.buur.style.transform = "translate3d(" + (g.richting * (g.w + TUSSEN) + d) + "px,0,0)";
      zetBel(g.schakel, g.knoppen[g.i], g.buurKnop, Math.min(1, Math.abs(d) / g.w));
    }
  }
  document.addEventListener("touchmove", function (ev) {
    if (!g) return;
    var t = ev.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.vast) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.3) { g = null; return; }
      g.vast = true; g.basis = dx;
      var bel = g.schakel.querySelector(".schakel-bel"); if (bel) bel.style.transition = "none";
      begin(dx < 0 ? 1 : -1);
    }
    ev.preventDefault();
    var nu = performance.now(), d = dx - g.basis;
    // van richting wisselen tijdens het vegen: buurdeel aan de andere kant
    if (g.buur && d * g.richting > 0) { opruimen(g.buur); g.buur.classList.add("verborgen"); begin(-g.richting); }
    g.v = (d - g.d) / Math.max(nu - g.t, 1); g.t = nu;
    g.nieuw = d;
    if (!g.raf) { var gg = g; g.raf = requestAnimationFrame(function () { gg.raf = 0; if (g === gg) zet(gg.nieuw); }); }
  }, { passive: false });

  function klaar(ev) {
    if (!g || !g.vast) { g = null; return; }
    var x = g; g = null; bezig = true;
    if (x.raf) { cancelAnimationFrame(x.raf); x.raf = 0; }
    if (x.nieuw != null) x.d = x.nieuw;
    var naar = -x.richting, ga = !!x.buur && ev.type !== "touchcancel" && (naar * x.d > x.w * 0.3 || (naar * x.v > 0.35 && naar * x.d > 20));
    var bel = x.schakel.querySelector(".schakel-bel");
    var duur = MINDER_BEWEGING ? 0 : 320, curve = "transform " + duur + "ms cubic-bezier(.2,.9,.25,1)";
    if (bel) bel.style.transition = "";
    x.huidig.style.transition = curve;
    if (x.buur) x.buur.style.transition = curve;
    if (ga) {
      x.huidig.style.transform = "translate3d(" + (naar * (x.w + TUSSEN)) + "px,0,0)";
      x.buur.style.transform = "translate3d(0,0,0)";
      zetBel(x.schakel, x.buurKnop);
    } else {
      x.huidig.style.transform = "translate3d(0,0,0)";
      if (x.buur) x.buur.style.transform = "translate3d(" + x.richting * (x.w + TUSSEN) + "px,0,0)";
      zetBel(x.schakel, x.knoppen[x.i]);
    }
    setTimeout(function () {
      // in één keer omzetten, zonder tussenbeeld: het buurdeel staat al waar het moet staan
      opruimen(x.huidig);
      if (ga) { opruimen(x.buur); x.buurKnop.click(); }
      else if (x.buur) { opruimen(x.buur); x.buur.classList.add("verborgen"); }
      document.body.classList.remove("veegt");
      bezig = false;
    }, duur + 20);
  }
  document.addEventListener("touchend", klaar, { passive: true });
  document.addEventListener("touchcancel", klaar, { passive: true });
})();


// ---- glazen selectiebolletje: volgt de tab en is te verslepen ----
var pil = document.querySelector("nav.tabs .pil");
var lens = document.getElementById("lens");
var tabLinks = alle("nav.tabs a");
function zetLens(a, direct) {
  lens.classList.toggle("weg", !a);   // bijvoorbeeld op de pagina Bronnen
  if (!a) return;
  var p = pil.getBoundingClientRect(), r = a.getBoundingClientRect();
  if (direct) lens.style.transition = "none";
  lens.style.left = (r.left - p.left) + "px";
  lens.style.width = r.width + "px";
  if (direct) { lens.offsetWidth; lens.style.transition = ""; }
}
function actieveLink() { return document.querySelector("nav.tabs a.actief"); }
window.addEventListener("hashchange", function () { zetLens(actieveLink()); });
function herstel() { if (!sleep) zetLens(actieveLink(), true); }
window.addEventListener("resize", herstel);
window.addEventListener("load", herstel);
if (window.ResizeObserver) new ResizeObserver(herstel).observe(pil);
zetLens(actieveLink(), true);

var sleep = null;
function dichtstbij(x) {
  var beste = null, afstand = 1e9;
  tabLinks.forEach(function (a) {
    var r = a.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - x);
    if (d < afstand) { afstand = d; beste = a; }
  });
  return beste;
}
pil.addEventListener("pointerdown", function (ev) {
  if (ev.button !== undefined && ev.button !== 0) return;
  var p = pil.getBoundingClientRect(), l = lens.getBoundingClientRect();
  sleep = { startX: ev.clientX, x: ev.clientX, t: performance.now(), v: 0, bewogen: false,
            offset: ev.clientX - (l.left + l.width / 2), id: ev.pointerId, p: p, w: l.width };
  // pak je de lens niet vast, dan springt hij naar je vinger
  if (Math.abs(sleep.offset) > l.width / 2) sleep.offset = 0;
});
pil.addEventListener("pointermove", function (ev) {
  if (!sleep || ev.pointerId !== sleep.id) return;
  if (!sleep.bewogen && Math.abs(ev.clientX - sleep.startX) < 6) return;
  if (!sleep.bewogen) {
    sleep.bewogen = true;
    try { pil.setPointerCapture(ev.pointerId); } catch (e) {}
    lens.classList.add("sleept");
    lens.style.transition = "transform .2s ease, box-shadow .2s ease";
  }
  var nu = performance.now(), dt = Math.max(nu - sleep.t, 1);
  sleep.v = (ev.clientX - sleep.x) / dt; sleep.x = ev.clientX; sleep.t = nu;
  var p = sleep.p, half = sleep.w / 2;
  var midden = Math.min(Math.max(ev.clientX - sleep.offset - p.left, half + 4), p.width - half - 4);
  lens.style.left = (midden - half) + "px";
  // vervormt een beetje met de snelheid, zoals vloeibaar glas
  var rek = Math.min(Math.abs(sleep.v) * 0.12, 0.22);
  lens.style.transform = "scale(" + (1.1 + rek) + "," + (1.1 - rek / 2) + ")";
  var onder = dichtstbij(p.left + midden);
  tabLinks.forEach(function (a) { a.classList.toggle("onder-lens", a === onder); });
});
function loslaten(ev) {
  if (!sleep || (ev && ev.pointerId !== sleep.id)) return;
  var was = sleep; sleep = null;
  tabLinks.forEach(function (a) { a.classList.remove("onder-lens"); });
  lens.classList.remove("sleept");
  lens.style.transform = "";
  lens.style.transition = "";
  if (!was.bewogen) return;  // gewoon tikken: de link doet zijn werk
  var l = lens.getBoundingClientRect();
  var doel = dichtstbij(l.left + l.width / 2);
  pil.dataset.netGesleept = "1";
  setTimeout(function () { delete pil.dataset.netGesleept; }, 80);
  if (doel && "#" + doel.dataset.tab !== location.hash) gaNaar(doel.dataset.tab);
  else zetLens(actieveLink());
}
tabLinks.forEach(function (a) { a.setAttribute("draggable", "false"); });
pil.addEventListener("dragstart", function (ev) { ev.preventDefault(); });
pil.addEventListener("pointerup", loslaten);
pil.addEventListener("pointercancel", loslaten);
pil.addEventListener("click", function (ev) {
  if (pil.dataset.netGesleept) { ev.preventDefault(); delete pil.dataset.netGesleept; }
}, true);

// ---- begrippen: uitleg als je er even op blijft staan ----
var begrippen = [];
try { begrippen = JSON.parse(document.getElementById("begrippen").textContent); } catch (e) {}
window.euMarkeer = function () {};
if (begrippen.length) {
  var patroon = new RegExp(begrippen.map(function (b) { return "(" + b.patroon.replace(/(^|[^\\])\((?!\?)/g, "$1(?:") + ")"; }).join("|"), "g");
  var NIET = { SCRIPT: 1, STYLE: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, BUTTON: 1, H1: 1, NAV: 1, LABEL: 1, HEADER: 1, SUMMARY: 1 };
  function markeer(wortel) {
    var gezienPerBlok = new Map();
    var walker = document.createTreeWalker(wortel, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var el = n.parentElement; el && el !== wortel; el = el.parentElement) {
          if (NIET[el.tagName] || el.classList.contains("begrip") || el.classList.contains("schakel") || el.classList.contains("chips")) return NodeFilter.FILTER_REJECT;
        }
        return patroon.test(n.nodeValue) ? (patroon.lastIndex = 0, NodeFilter.FILTER_ACCEPT) : NodeFilter.FILTER_REJECT;
      }
    });
    var knopen = [];
    while (walker.nextNode()) knopen.push(walker.currentNode);
    knopen.forEach(function (n) {
      var blok = n.parentElement.closest(".kaart, li, p, h2") || wortel;
      var gezien = gezienPerBlok.get(blok) || {};
      gezienPerBlok.set(blok, gezien);
      var tekst = n.nodeValue, frag = document.createDocumentFragment(), laatst = 0, m;
      patroon.lastIndex = 0;
      while ((m = patroon.exec(tekst))) {
        var i = 1; while (i < m.length && m[i] === undefined) i++;
        var b = begrippen[i - 1];
        if (!b || gezien[b.term]) continue;  // per blok alleen de eerste keer
        gezien[b.term] = 1;
        frag.appendChild(document.createTextNode(tekst.slice(laatst, m.index)));
        var span = document.createElement("span");
        span.className = "begrip"; span.dataset.i = i - 1; span.textContent = m[0];
        frag.appendChild(span);
        laatst = m.index + m[0].length;
      }
      if (laatst === 0) return;
      frag.appendChild(document.createTextNode(tekst.slice(laatst)));
      n.parentNode.replaceChild(frag, n);
    });
  }
  window.euMarkeer = markeer;
  alle("section.tab").forEach(markeer);

  var pop = document.getElementById("uitlegpop"), timer = null, verberg = null, huidig = null, langGedrukt = false;
  function toon(el) {
    var b = begrippen[+el.dataset.i];
    if (!b) return;
    if (huidig) huidig.classList.remove("actief");
    huidig = el; el.classList.add("actief");
    pop.querySelector("b").textContent = b.term;
    pop.querySelector("p").textContent = b.uitleg;
    pop.hidden = false;
    var r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var x = Math.min(Math.max(r.left + r.width / 2 - w / 2, 12), innerWidth - w - 12);
    var y = r.top - h - 10 < 10 ? r.bottom + 10 : r.top - h - 10;
    pop.style.left = x + "px"; pop.style.top = y + "px";
    requestAnimationFrame(function () { pop.classList.add("zichtbaar"); });
  }
  function weg() {
    clearTimeout(timer); if (huidig) huidig.classList.remove("actief"); huidig = null;
    pop.classList.remove("zichtbaar");
    setTimeout(function () { if (!huidig) pop.hidden = true; }, 200);
  }
  // muis: even stil houden
  document.addEventListener("mouseover", function (ev) {
    var el = ev.target.closest && ev.target.closest(".begrip");
    if (el) { clearTimeout(verberg); clearTimeout(timer); timer = setTimeout(function () { toon(el); }, 650); }
    else if (ev.target.closest && ev.target.closest("#uitlegpop")) { clearTimeout(verberg); }
  });
  document.addEventListener("mouseout", function (ev) {
    var el = ev.target.closest && (ev.target.closest(".begrip") || ev.target.closest("#uitlegpop"));
    if (el) { clearTimeout(timer); verberg = setTimeout(weg, 180); }
  });
  // aanraken: lang indrukken
  document.addEventListener("touchstart", function (ev) {
    var el = ev.target.closest && ev.target.closest(".begrip");
    langGedrukt = false;
    if (!el) { if (!ev.target.closest("#uitlegpop")) weg(); return; }
    clearTimeout(timer);
    timer = setTimeout(function () { langGedrukt = true; toon(el); }, 450);
  }, { passive: true });
  document.addEventListener("touchmove", function () { clearTimeout(timer); }, { passive: true });
  document.addEventListener("touchend", function () { clearTimeout(timer); }, { passive: true });
  document.addEventListener("click", function (ev) {
    if (langGedrukt) { ev.preventDefault(); ev.stopPropagation(); langGedrukt = false; }
  }, true);
  document.addEventListener("contextmenu", function (ev) { if (ev.target.closest && ev.target.closest(".begrip")) ev.preventDefault(); });
  window.addEventListener("scroll", function () { if (huidig) weg(); }, { passive: true });
}


// ---------- vaste lijsten ----------
var META = (function () { try { return JSON.parse(document.getElementById("data-meta").textContent); } catch (e) { return {}; } })();
var MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
var MK = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
var WEEKDAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
var FASEN = ["Voorstel", "Parlement", "Raad", "Triloog", "Aangenomen", "In werking"];
var KLEUR = { "EVP": "#3d8bfd", "S&D": "#e0313a", "PfE": "#3b2a7a", "ECR": "#1f78b4", "Renew": "#f2b705",
  "Groenen": "#3aa346", "Links": "#9b1c31", "ESN": "#7a5230", "Niet-ingeschreven": "#9aa0a6" };
var FR_OEIL = { "EPP": "EVP", "S&D": "S&D", "PfE": "PfE", "ECR": "ECR", "Renew": "Renew", "Greens/EFA": "Groenen",
  "The Left": "Links", "ESN": "ESN", "NI": "Niet-ingeschreven" };
var POS = { FOR: ["v", "voor"], AGAINST: ["t", "tegen"], ABSTENTION: ["o", "onthouden"], DID_NOT_VOTE: ["g", "niet gestemd"] };

// ---------- tekst en datums ----------
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function dt(s) { var p = (s || "").slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function kort(s) { if (!s) return ""; var d = dt(s); return d.getDate() + " " + MK[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""); }
function lang(s) { var d = dt(s); return WEEKDAGEN[d.getDay()] + " " + d.getDate() + " " + MAANDEN[d.getMonth()]; }
function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function vandaag() { return iso(new Date()); }
function plusDagen(n) { var d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
function a(url, tekst) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(tekst) + "</a>" : esc(tekst); }
function fr(naam) { return naam ? '<span class="frl"><i style="background:' + (KLEUR[naam] || "#999") + '"></i>' + esc(naam) + "</span>" : ""; }
function uitslag(u) { var ja = u === "ADOPTED"; return '<span class="uitslag ' + (ja ? "ja" : "nee") + '">' + (ja ? "Aangenomen" : "Verworpen") + "</span>"; }
function opgehaald(sleutel, wat) {
  var m = META[sleutel];
  return m ? '<p class="opgehaald">' + esc(wat) + " opgehaald: " + esc(m.moment || "") + (m.oud ? " · <b>niet vers</b>: ophalen lukte niet" : "") + "</p>" : "";
}
function leesJSON(k, standaard) { try { return JSON.parse(lees(k) || "") || standaard; } catch (e) { return standaard; } }

// ---------- zoeken dat tikfouten vergeeft (gebruikt door elk zoekveld) ----------
// - hoofdletters en accenten tellen niet (é = e, ø = o);
// - het begin van een woord is genoeg ("migr" vindt migratie), ook midden in een samenstelling
//   ("handel" vindt wapenhandel) vanaf 4 letters; de volgorde van de woorden doet niet ter zake;
// - kleine tikfouten mogen: 1 fout vanaf 4 letters, 2 vanaf 8 (omgedraaide letters tellen als 1);
// - afkortingen en Nederlands/Engels: AI = KI, NL = Nederland, Commissie = EC, enz.
// Treffers zonder tikfout komen eerst; daarna de bijna-treffers, met "Bedoel je …?".
function normaal(t) {
  return String(t == null ? "" : t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ß/g, "ss").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
var SYNONIEMEN = {};
[["ai", "ki", "artificial", "kunstmatige"], ["nl", "nederland", "nederlands", "nederlandse", "netherlands", "dutch"],
 ["commissie", "ec", "commission", "commissaris", "commissioner"], ["parlement", "ep", "parliament", "europarlement", "europarlementarier", "mep"],
 ["raad", "council"], ["top", "summit", "eu-top"], ["klimaat", "climate"], ["landbouw", "agriculture", "agri", "boeren", "farmers"],
 ["defensie", "defence", "defense"], ["handel", "trade"], ["energie", "energy"], ["begroting", "budget"], ["migratie", "migration"],
 ["asiel", "asylum"], ["oekraine", "ukraine"], ["rusland", "russia"], ["sancties", "sanctions"], ["stemming", "vote", "stemmingen", "votes"],
 ["debat", "debate", "debatten", "debates"], ["verkiezing", "verkiezingen", "election", "elections"], ["gezondheid", "health", "volksgezondheid"],
 ["vervoer", "transport"], ["visserij", "fisheries"], ["milieu", "environment"], ["mededinging", "competition"],
 ["rechtsstaat", "rechtsstatelijkheid"], ["uitbreiding", "enlargement"], ["veiligheid", "security"], ["digitaal", "digital"], ["kanker", "cancer"],
 ["geneesmiddelen", "medicines", "medicinal"], ["belasting", "tax", "taxation", "btw", "vat"], ["visum", "visa"], ["grens", "border", "grenzen", "borders"],
 ["voorstel", "proposal"], ["verordening", "regulation"], ["richtlijn", "directive"]
].forEach(function (groep) { groep.forEach(function (w) { SYNONIEMEN[normaal(w)] = groep.map(normaal); }); });

var _zoektekst = new Map();
function zoektekst(t) {
  var z = _zoektekst.get(t);
  if (!z) {
    var n = normaal(t), woorden = {};
    n.split(" ").forEach(function (w) { if (w) woorden[w] = 1; });
    z = { tekst: " " + n + " ", woorden: Object.keys(woorden) };
    if (_zoektekst.size > 30000) _zoektekst.clear();
    _zoektekst.set(t, z);
  }
  return z;
}
// Damerau-Levenshtein (met omgedraaide buren), stopt zodra het meer dan max wordt
function afstand(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  var vv = [], v = [], i, j;
  for (j = 0; j <= b.length; j++) v[j] = j;
  for (i = 1; i <= a.length; i++) {
    var n = [i], laagste = i;
    for (j = 1; j <= b.length; j++) {
      var k = a[i - 1] === b[j - 1] ? 0 : 1;
      var x = Math.min(v[j] + 1, n[j - 1] + 1, v[j - 1] + k);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) x = Math.min(x, vv[j - 2] + 1);
      n[j] = x; if (x < laagste) laagste = x;
    }
    if (laagste > max) return max + 1;
    vv = v; v = n;
  }
  return v[b.length];
}
function zoeker(q) {
  var delen = normaal(q).split(" ").filter(Boolean);
  var scores = new Map(), bijnaWoorden = {}, aantalBijna = 0;
  function woord(t, z) {
    var opties = SYNONIEMEN[t] || [t];
    for (var o = 0; o < opties.length; o++) {
      var w = opties[o];
      // een korte afkorting (EC, EP, KI) moet een heel woord zijn; wat je zelf typt mag een begin zijn
      if (w !== t && w.length <= 3) { if (z.tekst.indexOf(" " + w + " ") >= 0) return 2; continue; }
      if (z.tekst.indexOf(" " + w) >= 0 || (w.length >= 4 && z.tekst.indexOf(w) >= 0)) return 2;
    }
    if (t.length < 4 || /^\d+$/.test(t)) return 0;
    var max = t.length >= 8 ? 2 : 1;
    // het woord met de kleinste afstand in deze tekst (zo komt "Bedoel je" uit dezelfde taal)
    var beste = null, besteD = 99;
    for (var i = 0; i < z.woorden.length; i++) {
      var kandidaat = z.woorden[i];
      if (kandidaat.length < 3) continue;
      var dHeel = afstand(t, kandidaat, max);
      var dBegin = kandidaat.length > t.length && t.length >= 5 ? afstand(t, kandidaat.slice(0, t.length), max) + 0.5 : max + 1;
      var d = Math.min(dHeel, dBegin);
      if (d <= max + 0.5 && d < besteD) { beste = kandidaat; besteD = d; if (d <= 1) break; }
    }
    if (beste) {
      var b = bijnaWoorden[t] || (bijnaWoorden[t] = {});
      var x = b[beste] || (b[beste] = { n: 0, d: besteD });
      x.n++; x.d = Math.min(x.d, besteD);
      return 1;
    }
    return 0;
  }
  var z = {
    leeg: !delen.length,
    // past(tekst, item): true als alle zoekwoorden erin staan (of bijna)
    past: function (tekst, item) {
      if (z.leeg) return true;
      var zt = zoektekst(tekst), s = 2;
      for (var i = 0; i < delen.length; i++) {
        var r = woord(delen[i], zt);
        if (!r) return false;
        if (r < s) s = r;
      }
      if (s === 1) aantalBijna++;
      scores.set(item === undefined ? tekst : item, s);
      return true;
    },
    // eerst de treffers zonder tikfout, daarna de bijna-treffers (verder in dezelfde volgorde)
    ordenen: function (lijst) {
      if (z.leeg || !aantalBijna) return lijst;
      return lijst.filter(function (x) { return scores.get(x) !== 1; }).concat(lijst.filter(function (x) { return scores.get(x) === 1; }));
    },
    bijna: function () { return aantalBijna; },
    voorstel: function () {
      if (!aantalBijna) return "";
      var uit = delen.map(function (t) {
        var b = bijnaWoorden[t];
        if (!b) return t;
        // het woord dat het dichtst bij je tikfout ligt (zo blijft het in jouw taal), daarna het vaakst gevonden
        return Object.keys(b).sort(function (x, y) { return b[x].d - b[y].d || b[y].n - b[x].n; })[0];
      }).join(" ");
      return uit === delen.join(" ") ? "" : uit;
    }
  };
  return z;
}
// "Bedoel je …?" net onder het zoekveld; tik erop om dat te zoeken
function bedoelJe(veldId, z) {
  var veld = document.getElementById(veldId);
  if (!veld) return;
  var plek = veld.closest(".zoekrij, .zoekgroot") || veld;
  var p = plek.nextElementSibling && plek.nextElementSibling.classList.contains("bedoel") ? plek.nextElementSibling : null;
  var voorstel = z && !z.leeg ? z.voorstel() : "";
  if (!voorstel) { if (p) p.remove(); return; }
  if (!p) { p = document.createElement("p"); p.className = "bedoel"; plek.parentNode.insertBefore(p, plek.nextSibling); }
  p.innerHTML = (z.bijna() === 1 ? "1 bijna-treffer" : z.bijna() + " bijna-treffers") + ' · Bedoel je: <button type="button" class="linkknop" data-voorstel="' + esc(voorstel) + '" data-veld="' + esc(veldId) + '">' + esc(voorstel) + "</button>?";
}
document.addEventListener("click", function (ev) {
  var k = ev.target.closest && ev.target.closest("[data-voorstel]");
  if (!k) return;
  var veld = document.getElementById(k.dataset.veld);
  if (!veld) return;
  veld.value = k.dataset.voorstel;
  veld.dispatchEvent(new Event("input", { bubbles: true }));
});

// ---------- gegevens per tabblad inladen ----------
var _geladen = {};
function laden(naam) {
  if (!_geladen[naam]) {
    _geladen[naam] = fetch("data/" + naam + ".json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    _geladen[naam].catch(function () { delete _geladen[naam]; });
  }
  return _geladen[naam];
}
function laadFout(doel) {
  doel.innerHTML = '<div class="kaart"><h3>Gegevens niet geladen</h3><p class="klein">' + (location.protocol === "file:"
    ? 'Deze pagina is als bestand geopend. Open de online versie: <a href="https://gargamel1437.github.io/eu-monitor/">gargamel1437.github.io/eu-monitor</a>.'
    : "Controleer je internetverbinding en probeer het opnieuw.") + "</p></div>";
}
function bezig(doel) { if (doel && !doel.children.length) doel.innerHTML = '<p class="laden">Laden…</p>'; }

// ---------- notities (alleen in deze browser) ----------
var NOTITIES = leesJSON("eu-notities", {});
// opslag van de vroegere volglijst en bezoeken opruimen
["eu-volg", "eu-volg-stand", "eu-bezoek"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
function notitie() { return ""; }   // notities zijn uit de site gehaald
document.addEventListener("input", function (ev) {
  var k = ev.target.dataset && ev.target.dataset.notitie;
  if (!k) return;
  if (ev.target.value) NOTITIES[k] = ev.target.value; else delete NOTITIES[k];
  bewaar("eu-notities", JSON.stringify(NOTITIES));
});

// ---------- kopiëren en agenda (.ics) ----------
var KOPIEER = {};
function kopieer(tekst, knop) {
  function klaar() { var oud = knop.textContent; knop.textContent = "Gekopieerd ✓"; setTimeout(function () { knop.textContent = oud; }, 1600); }
  function reserve() { var t = document.createElement("textarea"); t.value = tekst; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); klaar(); } catch (e) {} t.remove(); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tekst).then(klaar, reserve); else reserve();
}
// Met een .ics-bestand op de site (gemaakt door europa.py) opent de iPhone meteen 'Zet in agenda',
// ook als web-app op het beginscherm. Zonder bestand maakt de browser het zelf (werkt op de computer).
function icsKnop(titel, datum, uitleg, url, bestand) {
  if (bestand) return '<a class="mini" href="' + esc(bestand) + '">＋ Agenda</a>';
  return '<button class="mini" data-ics="' + esc(JSON.stringify({ t: titel, d: datum, u: uitleg || "", l: url || "" })) + '">＋ Agenda</button>';
}
function ics(x) {
  var d = x.d.replace(/-/g, ""), e = dt(x.d); e.setDate(e.getDate() + 1);
  function v(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  var tekst = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EU-monitor//NL", "BEGIN:VEVENT",
    "UID:" + d + "-" + Math.random().toString(36).slice(2) + "@eu-monitor", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
    "DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + iso(e).replace(/-/g, ""), "SUMMARY:" + v(x.t), "DESCRIPTION:" + v((x.u ? x.u + "\n" : "") + (x.l || "")),
    x.l ? "URL:" + x.l : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
  var link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([tekst], { type: "text/calendar" })); link.download = "eu-" + d + ".ics";
  document.body.appendChild(link); link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 500);
}

// ---------- klikken: kopiëren, agenda ----------
document.addEventListener("click", function (ev) {
  var k = ev.target.closest && ev.target.closest("[data-kopieer]");
  if (k) { ev.preventDefault(); ev.stopPropagation(); kopieer(KOPIEER[k.dataset.kopieer] ? KOPIEER[k.dataset.kopieer]() : "", k); return; }
  var ic = ev.target.closest && ev.target.closest("[data-ics]");
  if (ic) { ev.preventDefault(); ev.stopPropagation(); ics(JSON.parse(ic.dataset.ics)); }
});

// ---------- wanneer is de site bijgewerkt, en wanneer weer ----------
(function () {
  var el = document.getElementById("volgende-update");
  if (!el || !META.updates) return;
  var nu = new Date(), tijd = ("0" + nu.getHours()).slice(-2) + ":" + ("0" + nu.getMinutes()).slice(-2);
  var volgende = META.updates.filter(function (t) { return t > tijd; })[0];
  el.textContent = volgende ? "volgende rond " + volgende : "volgende morgen rond " + META.updates[0];
})();


// ---------- delen (deelmenu van de iPhone; anders de link kopiëren) ----------
function deelKnop(titel, url) {
  if (!url) return "";
  return '<button class="mini" data-deel="' + esc(JSON.stringify({ t: titel, u: url })) + '"><svg class="ik" viewBox="0 0 24 24"><path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M6 11H5v9.5h14V11h-1"/></svg>Delen</button>';
}
document.addEventListener("click", function (ev) {
  var k = ev.target.closest && ev.target.closest("[data-deel]");
  if (!k) return;
  ev.preventDefault(); ev.stopPropagation();
  var x = JSON.parse(k.dataset.deel);
  if (navigator.share) navigator.share({ title: x.t, url: x.u }).catch(function () {});
  else kopieer(x.t + "\n" + x.u, k);
});

// ---------- offline ----------
(function () {
  var el = document.getElementById("offline-melding");
  function toon() {
    if (!el) return;
    el.textContent = "Offline · je ziet de stand van " + (META.bijgewerkt || "de laatste keer");
    el.classList.toggle("verborgen", navigator.onLine !== false);
  }
  window.addEventListener("online", toon); window.addEventListener("offline", toon); toon();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(function () {}); });
  }
})();

// ---------- recente zoekopdrachten (Overzicht) ----------
var RECENT = leesJSON("eu-recent", []);
function onthoudZoek(q) {
  q = q.trim();
  if (normaal(q).length < 3) return;
  RECENT = [q].concat(RECENT.filter(function (x) { return normaal(x) !== normaal(q); })).slice(0, 12);
  bewaar("eu-recent", JSON.stringify(RECENT));
}


// ---------- meldingen wegklikken (blijven weg tot er een andere melding is) ----------
(function () {
  var weg = leesJSON("eu-meldingen-weg", []);
  alle("#meldingen .melding").forEach(function (m) {
    var sleutel = normaal(m.textContent).replace(/\d+/g, "#").slice(0, 120);
    if (weg.indexOf(sleutel) >= 0) { m.remove(); return; }
    var x = document.createElement("button");
    x.type = "button"; x.className = "melding-weg"; x.setAttribute("aria-label", "Melding wegklikken"); x.textContent = "×";
    x.addEventListener("click", function () {
      weg = [sleutel].concat(weg.filter(function (k) { return k !== sleutel; })).slice(0, 20);
      bewaar("eu-meldingen-weg", JSON.stringify(weg));
      m.classList.add("weg"); setTimeout(function () { m.remove(); }, 200);
    });
    m.appendChild(x);
  });
})();

// ---------- nieuwe versie: korte melding "Bijgewerkt" ----------
(function () {
  var vorige = lees("eu-versie");
  if (META.bijgewerkt && vorige && vorige !== META.bijgewerkt) {
    var t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = "Bijgewerkt · " + META.bijgewerkt.slice(11) + " uur";
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("zichtbaar"); }, 300);
    setTimeout(function () { t.classList.remove("zichtbaar"); setTimeout(function () { t.remove(); }, 400); }, 3200);
  }
  if (META.bijgewerkt) bewaar("eu-versie", META.bijgewerkt);
})();

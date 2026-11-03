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

// ---- tabbladen ----
var tabs = alle("section.tab").map(function (s) { return s.id; });
// oude of extra adressen en het tabblad waar ze nu staan
var extra = { mensen: "stemmingen", zoek: "overzicht", stemmen: "stemmingen" };
function hashNaam() { return (location.hash || "#overzicht").slice(1).split("?")[0]; }
function huidigeTab() {
  var doel = hashNaam();
  return tabs.indexOf(doel) >= 0 ? doel : (extra[doel] || "overzicht");
}
function toonTab() {
  var doel = hashNaam();
  var naam = huidigeTab();
  alle("section.tab").forEach(function (s) { s.classList.toggle("actief", s.id === naam); });
  alle("nav.tabs a").forEach(function (a) { a.classList.toggle("actief", a.dataset.tab === naam); });
  document.getElementById("kleine-titel").textContent = document.getElementById(naam).dataset.titel;
  window.scrollTo(0, 0); requestAnimationFrame(function () { window.scrollTo(0, 0); kleineTitel(); });
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
function kiesSegment(knop) {
  alle("button[data-toon]", knop.parentNode).forEach(function (b) {
    b.classList.toggle("actief", b === knop);
    var doel = document.getElementById(b.dataset.toon);
    if (doel) doel.classList.toggle("verborgen", b !== knop);
  });
  knop.dispatchEvent(new CustomEvent("eu-segment", { bubbles: true, detail: knop.dataset.toon }));
}
function toonSegment(id) { var k = document.querySelector('.schakel button[data-toon="' + id + '"]'); if (k && !k.classList.contains("actief")) kiesSegment(k); }
alle(".schakel button[data-toon]").forEach(function (knop) {
  knop.addEventListener("click", function () { kiesSegment(knop); });
});


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
  if (doel && "#" + doel.dataset.tab !== location.hash) location.hash = doel.dataset.tab;
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
function notitie(sleutel) {
  return '<label class="notitie"><span>Mijn notities</span><textarea data-notitie="' + esc(sleutel) + '" placeholder="Alleen jij ziet dit (bewaard in deze browser)">' + esc(NOTITIES[sleutel] || "") + "</textarea></label>";
}
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
function icsKnop(titel, datum, uitleg, url) {
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

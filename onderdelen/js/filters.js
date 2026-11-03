// =====================================================================
//  filters.js: één manier van filteren voor de hele site, zoals Instellingen op de iPhone.
//  Naast elk zoekveld een knop Filters (met teller). Die opent één paneel van onderen met per
//  filter een rij (naam + wat er gekozen is). Tik op een rij: een lijst waarin je meerdere
//  dingen aanvinkt. Sorteren is één keuze. Boven de lijst staat één regel met wat er aan staat.
//  Elke keuze wordt bewaard in deze browser.
//
//  Een veld: { id, naam, opties: [[waarde, label], ...] of function, meer: true/false,
//              alles: true (lege keuze = alles) of false (vaste aan/uit-lijst), standaard,
//              toon: function () { return true/false } }
// =====================================================================

var FILTERS = {};
function kopie(x) { return JSON.parse(JSON.stringify(x)); }
function maakFilter(naam, velden, opnieuw) {
  var bewaard = leesJSON("eu-f-" + naam, {});
  var f = { naam: naam, velden: velden, opnieuw: opnieuw, staat: {} };
  velden.forEach(function (v) {
    if (v.meer && v.alles === undefined) v.alles = true;
    var b = bewaard[v.id];
    f.staat[v.id] = b !== undefined && (Array.isArray(b) === Array.isArray(v.standaard)) ? b : kopie(v.standaard);
  });
  f.veld = function (id) { return velden.filter(function (v) { return v.id === id; })[0]; };
  f.w = function (id) { return f.staat[id]; };
  // past(id, waarde of lijst): true als de keuze 'alles' is of de waarde gekozen is
  f.past = function (id, waarde) {
    var k = f.staat[id];
    if (!Array.isArray(k) || !k.length) return true;
    var l = Array.isArray(waarde) ? waarde : [waarde];
    return l.some(function (x) { return k.indexOf(x) >= 0; });
  };
  f.aan = function (id, waarde) { return (f.staat[id] || []).indexOf(waarde) >= 0; };
  f.actief = function (v) {
    if (v.toon && !v.toon()) return false;
    return JSON.stringify(f.staat[v.id]) !== JSON.stringify(v.standaard);
  };
  f.opties = function (v) { return typeof v.opties === "function" ? v.opties() : v.opties; };
  f.samenvatting = function (v) {
    var k = f.staat[v.id], o = f.opties(v);
    function label(w) { var x = o.filter(function (p) { return p[0] === w; })[0]; return x ? x[1] : w; }
    if (!v.meer) return label(k);
    if (v.alles && !k.length) return "Alle";
    if (!v.alles && k.length === o.length) return "Alles";
    if (!k.length) return "Geen";
    return k.length <= 2 ? k.map(label).join(", ") : k.length + " gekozen";
  };
  f.zet = function (id, waarde) {
    var v = f.veld(id);
    if (!v.meer) f.staat[id] = waarde;
    else if (waarde === null) f.staat[id] = v.alles ? [] : f.opties(v).map(function (p) { return p[0]; });
    else {
      var k = f.staat[id], i = k.indexOf(waarde);
      if (i >= 0) k.splice(i, 1); else k.push(waarde);
    }
    f.bewaar();
  };
  f.wis = function () { velden.forEach(function (v) { f.staat[v.id] = kopie(v.standaard); }); f.bewaar(); };
  f.bewaar = function () { bewaar("eu-f-" + naam, JSON.stringify(f.staat)); f.toon(); f.opnieuw(); };
  // teller op de knop en de regel boven de lijst
  f.toon = function () {
    var actief = velden.filter(f.actief);
    filterTeller(naam + "-filterknop", actief.length);
    var r = document.getElementById(naam + "-regel");
    if (!r) return;
    r.classList.toggle("verborgen", !actief.length);
    r.innerHTML = actief.map(function (v) { return esc(f.samenvatting(v)); }).join(" · ") + ' <span class="wis" data-wis-filter="' + naam + '">Wis</span>';
  };
  FILTERS[naam] = f;
  setTimeout(f.toon, 0);
  return f;
}

// ---------- het paneel ----------
var fsHuidig = null, fsVeld = null;
function fsHoofd(f) {
  var zichtbaar = f.velden.filter(function (v) { return !v.toon || v.toon(); });
  var gewoon = zichtbaar.filter(function (v) { return v.meer; }), sort = zichtbaar.filter(function (v) { return !v.meer; });
  function rij(v) {
    return '<button type="button" class="inst-rij inst-link" data-fs-veld="' + v.id + '"><span class="inst-label">' + esc(v.naam) + '</span><span class="fs-waarde">' + esc(f.samenvatting(v)) + '</span><span class="pijl">›</span></button>';
  }
  return (sort.length ? '<div class="inst-lijst">' + sort.map(rij).join("") + "</div>" : "")
    + (gewoon.length ? '<div class="inst-lijst">' + gewoon.map(rij).join("") + "</div>" : "")
    + '<button type="button" class="knop tweede breed fs-wis" data-fs-wis>Wis filters</button>';
}
function fsKeuze(f, v) {
  var k = f.staat[v.id], o = f.opties(v);
  function vink(aan) { return '<span class="vink' + (aan ? " aan" : "") + '" aria-hidden="true">✓</span>'; }
  var h = '<div class="inst-lijst">';
  if (v.meer && v.alles) h += '<button type="button" class="inst-rij" data-fs-kies=""><span class="inst-label">Alle</span>' + vink(!k.length) + "</button>";
  h += o.map(function (p) {
    var aan = v.meer ? k.indexOf(p[0]) >= 0 : k === p[0];
    return '<button type="button" class="inst-rij" data-fs-kies="' + esc(p[0]) + '"><span class="inst-label">' + esc(p[1]) + "</span>" + vink(aan) + "</button>";
  }).join("");
  h += "</div>";
  if (v.meer) h += '<p class="klein inst-voet">' + (v.alles ? "Kies er één of meer. Niets gekozen = alles." : "Vink aan wat je wilt zien.") + "</p>";
  return h;
}
function fsTeken() {
  var f = FILTERS[fsHuidig], lijf = document.getElementById("fs-lijf");
  if (!f) return;
  var v = fsVeld && f.veld(fsVeld);
  document.getElementById("fs-titel").textContent = v ? v.naam : "Filters";
  document.getElementById("fs-terug").hidden = !v;
  lijf.innerHTML = v ? fsKeuze(f, v) : fsHoofd(f);
}
function openFilter(naam) {
  if (!FILTERS[naam]) return;
  fsHuidig = naam; fsVeld = null;
  fsTeken();
  openSheet("filtersheet");
}
document.addEventListener("click", function (ev) {
  var t = ev.target;
  if (!t.closest) return;
  var wis = t.closest("[data-wis-filter]");
  if (wis) { ev.preventDefault(); ev.stopPropagation(); var f0 = FILTERS[wis.dataset.wisFilter]; if (f0) f0.wis(); return; }
  var knop = t.closest("[data-filter]");
  if (knop) { ev.preventDefault(); openFilter(knop.dataset.filter); return; }
  if (!t.closest("#filtersheet")) return;
  var f = FILTERS[fsHuidig];
  if (!f) return;
  var rij = t.closest("[data-fs-veld]");
  if (rij) { fsVeld = rij.dataset.fsVeld; fsTeken(); return; }
  var k = t.closest("[data-fs-kies]");
  if (k && fsVeld) {
    var v = f.veld(fsVeld);
    f.zet(fsVeld, k.dataset.fsKies === "" && v.meer ? null : k.dataset.fsKies);
    if (!v.meer) fsVeld = null;   // één keuze: terug naar het overzicht
    fsTeken(); return;
  }
  if (t.closest("[data-fs-wis]")) { f.wis(); fsTeken(); return; }
  if (t.closest("#fs-terug")) { fsVeld = null; fsTeken(); return; }
  if (t.closest("#fs-klaar")) sluitSheet();
});

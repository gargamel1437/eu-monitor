// =====================================================================
//  filters.js: zoeken en filteren in één veld, overal hetzelfde.
//  - Typ je in het zoekveld, dan staan eronder ook passende filters ("Wie: Raad · 8"). Tik =
//    een klein token in het veld; de lijst filtert meteen. Meerdere tokens mag.
//  - Typ je "wie", "wat", "waar" (of een andere soort, of het begin ervan), dan zie je alle
//    keuzes van die soort. In een leeg veld: per soort een paar voorbeelden.
//  - Vasthouden (of rechtsklik) op een label in de lijst: "Alleen … tonen" of "… verbergen".
//  - Na elke wijziging een melding met "Ongedaan maken". Het kruisje wist alles.
//  - Sorteren (alleen waar het iets toevoegt) met een smalle glazen knop en een menu.
//  De gekozen tokens worden bewaard in deze browser.
// =====================================================================

var ZOEKERS = {};
function lijktOpWoord(q, tekst) {
  q = normaal(q); tekst = normaal(tekst);
  if (!q) return false;
  return tekst.split(" ").some(function (w) { return w.indexOf(q) === 0 || (q.length >= 4 && afstand(q, w.slice(0, q.length), 1) <= 1); })
    || (q.length >= 4 && tekst.indexOf(q) >= 0);
}

// cfg: { naam, balk (id), soorten: { sleutel: { naam, opties: function () -> [[waarde, label, extraZoekwoorden]], kleur: function (waarde) -> "ep" } },
//        voorbeelden: { sleutel: aantal }, telling: function (tokens, tekst) -> aantal, opnieuw: function () }
function maakZoekbalk(cfg) {
  var balk = document.getElementById(cfg.balk);
  var invoer = balk.querySelector("input"), tokensEl = balk.querySelector(".tokens"), wis = balk.querySelector(".wis");
  var z = { naam: cfg.naam, cfg: cfg, tokens: leesJSON("eu-z-" + cfg.naam, []), tekst: "", vorige: null };
  z.tokens = z.tokens.filter(function (t) { return cfg.soorten[t.soort]; });
  function label(t) {
    var s = cfg.soorten[t.soort], o = (s.opties() || []).filter(function (x) { return x[0] === t.waarde; })[0];
    return (t.uit ? "Zonder " : "") + (o ? o[1] : t.waarde);
  }
  z.label = label;
  // past(soort, waarde of lijst): klopt dit item met de tokens van die soort?
  z.past = function (soort, waarde, tokens) {
    tokens = tokens || z.tokens;
    var l = Array.isArray(waarde) ? waarde : [waarde];
    var mijn = tokens.filter(function (t) { return t.soort === soort; });
    if (mijn.some(function (t) { return t.uit && l.indexOf(t.waarde) >= 0; })) return false;
    var aan = mijn.filter(function (t) { return !t.uit; });
    return !aan.length || aan.some(function (t) { return l.indexOf(t.waarde) >= 0; });
  };
  z.heeft = function (soort, waarde) { return z.tokens.some(function (t) { return t.soort === soort && t.waarde === waarde && !t.uit; }); };
  z.leeg = function () { return !z.tokens.length && !z.tekst; };
  function bewaarTokens() { bewaar("eu-z-" + cfg.naam, JSON.stringify(z.tokens)); }
  z.teken = function () {
    tokensEl.innerHTML = z.tokens.map(function (t, n) {
      var k = cfg.soorten[t.soort].kleur ? cfg.soorten[t.soort].kleur(t.waarde) : "";
      return '<span class="token' + (k ? " k-" + k : "") + (t.uit ? " uit" : "") + '">' + esc(label(t)) + '<button type="button" data-tok-weg="' + n + '" aria-label="Weghalen">×</button></span>';
    }).join("");
    wis.hidden = z.leeg();
  };
  function onthoud() { z.vorige = JSON.stringify({ tokens: z.tokens, tekst: z.tekst }); }
  z.voegToe = function (t, melding) {
    onthoud();
    z.tokens = z.tokens.filter(function (x) { return !(x.soort === t.soort && x.waarde === t.waarde); });
    z.tokens.push(t);
    z.tekst = ""; invoer.value = "";
    bewaarTokens(); z.teken(); verbergSug(); cfg.opnieuw();
    if (melding) ongedaan(melding, z);
  };
  z.weg = function (n) { onthoud(); z.tokens.splice(n, 1); bewaarTokens(); z.teken(); cfg.opnieuw(); };
  z.wis = function () { onthoud(); z.tokens = []; z.tekst = ""; invoer.value = ""; bewaarTokens(); z.teken(); verbergSug(); cfg.opnieuw(); ongedaan("Filters gewist", z); };
  z.herstel = function () { if (!z.vorige) return; var v = JSON.parse(z.vorige); z.tokens = v.tokens; z.tekst = v.tekst; invoer.value = z.tekst; z.vorige = null; bewaarTokens(); z.teken(); cfg.opnieuw(); };
  z.zetTekst = function (q) { z.tekst = q; invoer.value = q; z.teken(); cfg.opnieuw(); };

  // ---- suggesties onder het veld ----
  function aantal(t) { return cfg.telling ? cfg.telling(z.tokens.concat([t]), "") : null; }
  function woorden(soort, lijst) {
    return '<div class="sgroep"><span class="soort">' + esc(cfg.soorten[soort].naam) + "</span><span>" + lijst.map(function (o) {
      return '<button type="button" class="swoord" data-tok=\'' + esc(JSON.stringify({ soort: soort, waarde: o[0] })) + "'>" + esc(o[1]) + "</button>";
    }).join('<span class="punt">·</span>') + "</span></div>";
  }
  function suggesties() {
    var q = invoer.value.trim(), nq = normaal(q), h = "";
    var soortNamen = Object.keys(cfg.soorten);
    var gevraagd = nq.length >= 2 ? soortNamen.filter(function (s) { return normaal(cfg.soorten[s].naam).indexOf(nq) === 0; }) : [];
    if (!q) {
      h = "<h4>Filter op</h4>" + soortNamen.filter(function (s) { return (cfg.voorbeelden || {})[s] !== 0; }).map(function (s) {
        return woorden(s, cfg.soorten[s].opties().slice(0, (cfg.voorbeelden || {})[s] || 4));
      }).join("");
    } else if (gevraagd.length) {
      h = "<h4>Filter op</h4>" + gevraagd.map(function (s) { return woorden(s, cfg.soorten[s].opties()); }).join("");
    } else {
      var kand = [];
      soortNamen.forEach(function (s) {
        cfg.soorten[s].opties().forEach(function (o) {
          if (kand.length < 8 && lijktOpWoord(q, o[1] + " " + (o[2] || ""))) kand.push({ soort: s, waarde: o[0], label: o[1] });
        });
      });
      h = (kand.length ? "<h4>Filters</h4>" + kand.map(function (t) {
        var n = aantal(t);
        return '<button type="button" class="sug" data-tok=\'' + esc(JSON.stringify({ soort: t.soort, waarde: t.waarde })) + '\'><span class="soort">' + esc(cfg.soorten[t.soort].naam) + '</span><span class="naam">' + esc(t.label) + "</span>" + (n != null ? '<span class="n">' + n + "</span>" : "") + "</button>";
      }).join("") : "")
        + '<h4>Zoeken</h4><button type="button" class="sug" data-tok-zoek><span class="soort"><svg class="ik" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></span><span class="naam">Zoek naar “' + esc(q) + "”</span>"
        + (cfg.telling ? '<span class="n">' + cfg.telling(z.tokens, q) + "</span>" : "") + "</button>";
    }
    var sug = document.getElementById("sug");
    if (!h) { verbergSug(); return; }
    sug.innerHTML = h;
    sug.dataset.zoeker = cfg.naam;
    var r = balk.getBoundingClientRect();
    sug.style.top = (r.bottom + 6) + "px";
    sug.style.left = Math.max(10, r.left) + "px";
    sug.style.width = Math.min(r.width, window.innerWidth - 20) + "px";
    sug.hidden = false;
  }
  var wacht = null;
  invoer.addEventListener("input", function () {
    var q = invoer.value.trim(), nq = normaal(q);
    var isSoort = nq.length >= 2 && Object.keys(cfg.soorten).some(function (s) { return normaal(cfg.soorten[s].naam).indexOf(nq) === 0; });
    suggesties();
    clearTimeout(wacht);
    wacht = setTimeout(function () { z.tekst = isSoort ? "" : q; z.teken(); cfg.opnieuw(); }, 180);
  });
  invoer.addEventListener("focus", suggesties);
  invoer.addEventListener("keydown", function (e) {
    if (e.key === "Backspace" && !invoer.value && z.tokens.length) { z.weg(z.tokens.length - 1); suggesties(); }
    if (e.key === "Enter") { e.preventDefault(); var eerste = document.querySelector("#sug [data-tok]"); if (eerste && invoer.value.trim()) z.voegToe(JSON.parse(eerste.dataset.tok)); else { verbergSug(); invoer.blur(); } }
    if (e.key === "Escape") verbergSug();
  });
  tokensEl.addEventListener("click", function (e) { var b = e.target.closest("[data-tok-weg]"); if (b) z.weg(+b.dataset.tokWeg); });
  wis.addEventListener("click", function () { z.wis(); });
  ZOEKERS[cfg.naam] = z;
  z.teken();
  return z;
}
function verbergSug() { var s = document.getElementById("sug"); if (s) s.hidden = true; }
(function () {
  var sug = document.getElementById("sug");
  sug.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // het veld blijft actief
  sug.addEventListener("click", function (e) {
    var z = ZOEKERS[sug.dataset.zoeker];
    if (!z) return;
    var b = e.target.closest("[data-tok]");
    if (b) { z.voegToe(JSON.parse(b.dataset.tok)); return; }
    if (e.target.closest("[data-tok-zoek]")) { verbergSug(); var i = document.querySelector("#" + z.cfg.balk + " input"); if (i) i.blur(); }
  });
  document.addEventListener("pointerdown", function (e) { if (!e.target.closest("#sug") && !e.target.closest(".zoekbalk") && !e.target.closest(".zoekgroot")) verbergSug(); });
  window.addEventListener("scroll", function () { if (!sug.hidden && document.activeElement && document.activeElement.tagName !== "INPUT") verbergSug(); }, { passive: true });
})();

// ---------- melding met "Ongedaan maken" ----------
var _ongedaanZ = null;
function ongedaan(tekst, z) {
  var t = document.getElementById("ongedaan-toast");
  t.querySelector("span").textContent = tekst;
  _ongedaanZ = z;
  t.classList.add("zichtbaar");
  clearTimeout(ongedaan.w);
  ongedaan.w = setTimeout(function () { t.classList.remove("zichtbaar"); }, 4000);
}
document.querySelector("#ongedaan-toast button").addEventListener("click", function () {
  if (_ongedaanZ) _ongedaanZ.herstel();
  document.getElementById("ongedaan-toast").classList.remove("zichtbaar");
});

// ---------- vasthouden op een label: alleen dit tonen of verbergen ----------
// Een label in een lijst doet mee als het data-tok-zoeker, data-tok-soort en data-tok-waarde heeft.
(function () {
  var houd = null, klaar = false;
  function sluit() { var m = document.querySelector(".tokmenu"); if (m) m.remove(); }
  function menu(lab, x, y) {
    sluit();
    var z = ZOEKERS[lab.dataset.tokZoeker];
    if (!z) return;
    var t = { soort: lab.dataset.tokSoort, waarde: lab.dataset.tokWaarde }, naam = z.label(t);
    var m = document.createElement("div");
    m.className = "tokmenu"; m.setAttribute("role", "menu");
    m.innerHTML = '<button type="button" role="menuitem" data-a="alleen">Alleen ' + esc(naam) + ' tonen</button><button type="button" role="menuitem" data-a="weg">' + esc(naam) + " verbergen</button>";
    document.body.appendChild(m);
    m.style.left = Math.min(Math.max(x - 20, 10), window.innerWidth - m.offsetWidth - 10) + "px";
    m.style.top = Math.min(y + 10, window.innerHeight - m.offsetHeight - 90) + "px";
    m.onclick = function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      if (b.dataset.a === "alleen") z.voegToe(t, "Alleen " + naam);
      else z.voegToe({ soort: t.soort, waarde: t.waarde, uit: true }, naam + " verborgen");
      sluit();
    };
  }
  document.addEventListener("pointerdown", function (e) {
    if (!e.target.closest(".tokmenu")) sluit();
    var lab = e.target.closest && e.target.closest("[data-tok-zoeker]");
    if (!lab) return;
    klaar = false;
    var x = e.clientX, y = e.clientY;
    clearTimeout(houd);
    houd = setTimeout(function () { klaar = true; menu(lab, x, y); }, 450);
  });
  ["pointerup", "pointercancel"].forEach(function (t) { document.addEventListener(t, function () { clearTimeout(houd); }); });
  document.addEventListener("scroll", function () { clearTimeout(houd); }, { passive: true, capture: true });
  document.addEventListener("click", function (e) { if (klaar && e.target.closest && e.target.closest("[data-tok-zoeker]")) { e.preventDefault(); e.stopPropagation(); klaar = false; } }, true);
  document.addEventListener("contextmenu", function (e) {
    var lab = e.target.closest && e.target.closest("[data-tok-zoeker]");
    if (lab) { e.preventDefault(); clearTimeout(houd); menu(lab, e.clientX, e.clientY); }
  });
})();
function tokLabel(zoeker, soort, waarde, tekst, klasse) {
  return '<span class="lab ' + (klasse || "") + '" data-tok-zoeker="' + zoeker + '" data-tok-soort="' + soort + '" data-tok-waarde="' + esc(waarde) + '">' + esc(tekst) + "</span>";
}

// ---------- sorteren: smalle glazen knop met een menu ----------
var SORT_IK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/></svg>';
function maakSorteer(naam, opties, standaard, opnieuw) {
  var knop = document.querySelector('[data-sorteer="' + naam + '"]');
  var s = { waarde: lees("eu-sort-" + naam) || standaard };
  if (!opties.some(function (o) { return o[0] === s.waarde; })) s.waarde = standaard;
  function teken() {
    var o = opties.filter(function (x) { return x[0] === s.waarde; })[0];
    knop.innerHTML = SORT_IK + '<span class="wat">Sorteer</span><span>' + esc(o[2] || o[1]) + '</span><svg class="pijl" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
  }
  knop.setAttribute("aria-haspopup", "menu");
  knop.addEventListener("click", function (e) {
    e.stopPropagation();
    var oud = document.querySelector(".tokmenu");
    if (oud) { oud.remove(); knop.setAttribute("aria-expanded", "false"); return; }
    var m = document.createElement("div");
    m.className = "tokmenu sortmenu"; m.setAttribute("role", "menu");
    m.innerHTML = opties.map(function (o) { return '<button type="button" role="menuitemradio" aria-checked="' + (o[0] === s.waarde) + '" data-w="' + o[0] + '">' + esc(o[1]) + (o[0] === s.waarde ? '<span class="vink aan">✓</span>' : "") + "</button>"; }).join("");
    document.body.appendChild(m);
    var r = knop.getBoundingClientRect();
    m.style.left = Math.min(r.left, window.innerWidth - m.offsetWidth - 10) + "px";
    m.style.top = (r.bottom + 6) + "px";
    knop.setAttribute("aria-expanded", "true");
    m.onclick = function (ev) {
      var b = ev.target.closest("[data-w]"); if (!b) return;
      s.waarde = b.dataset.w; bewaar("eu-sort-" + naam, s.waarde); teken(); m.remove(); knop.setAttribute("aria-expanded", "false"); opnieuw();
    };
  });
  document.addEventListener("pointerdown", function (e) { if (!e.target.closest(".sortmenu") && !e.target.closest('[data-sorteer="' + naam + '"]')) { var m = document.querySelector(".sortmenu"); if (m) { m.remove(); knop.setAttribute("aria-expanded", "false"); } } });
  teken();
  return s;
}

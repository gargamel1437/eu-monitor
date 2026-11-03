
(function () {
  function bewaar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lees(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function alle(sel, ouder) { return Array.prototype.slice.call((ouder || document).querySelectorAll(sel)); }

  // ---- thema ----
  var thema = lees("eu-thema");
  if (thema) document.documentElement.setAttribute("data-theme", thema);
  document.getElementById("thema").addEventListener("click", function (ev) {
    ev.preventDefault();
    var nu = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var nieuw = nu === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nieuw);
    bewaar("eu-thema", nieuw);
  });

  // ---- tabbladen ----
  var tabs = alle("section.tab").map(function (s) { return s.id; });
  var extra = {};
  function huidigeTab() {
    var doel = (location.hash || "#overzicht").slice(1).split("?")[0];
    return tabs.indexOf(doel) >= 0 ? doel : (extra[doel] || "overzicht");
  }
  function toonTab() {
    var doel = (location.hash || "#overzicht").slice(1).split("?")[0];
    var naam = tabs.indexOf(doel) >= 0 ? doel : (extra[doel] || "overzicht");
    alle("section.tab").forEach(function (s) { s.classList.toggle("actief", s.id === naam); });
    alle("nav.tabs a").forEach(function (a) { a.classList.toggle("actief", a.dataset.tab === naam); });
    document.getElementById("kleine-titel").textContent = document.getElementById(naam).dataset.titel;
    var anker = extra[doel] ? document.getElementById(doel) : null;
    if (anker) anker.scrollIntoView(); else { window.scrollTo(0, 0); requestAnimationFrame(function () { window.scrollTo(0, 0); kleineTitel(); }); }
    kleineTitel();
    document.dispatchEvent(new CustomEvent("eu-tab", { detail: naam }));
  }
  window.addEventListener("hashchange", toonTab);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", function () { if (!extra[(location.hash || "").slice(1)]) window.scrollTo(0, 0); kleineTitel(); });

  // ---- grote titel wordt klein bij scrollen ----
  var balk = document.getElementById("topbalk");
  function kleineTitel() { balk.classList.toggle("zichtbaar", window.scrollY > 60); }
  window.addEventListener("scroll", kleineTitel, { passive: true });
  toonTab();

  // ---- schakelaars (segmenten) ----
  alle(".schakel").forEach(function (rij) {
    var knoppen = alle("button[data-toon]", rij);
    knoppen.forEach(function (knop) {
      knop.addEventListener("click", function () {
        knoppen.forEach(function (b) {
          b.classList.toggle("actief", b === knop);
          var doel = document.getElementById(b.dataset.toon);
          if (doel) doel.classList.toggle("verborgen", b !== knop);
        });
      });
    });
  });

  // ---- nieuwsfilters ----
  var filter = { terrein: "", bron: "", zoek: "" };
  function pasToe() {
    var zichtbaar = 0;
    alle("li.bericht").forEach(function (li) {
      var ok = (!filter.terrein || li.dataset.terrein.split("|").indexOf(filter.terrein) >= 0)
        && (!filter.bron || li.dataset.bron === filter.bron)
        && (!filter.zoek || li.textContent.toLowerCase().indexOf(filter.zoek) >= 0);
      li.classList.toggle("verborgen", !ok);
      if (ok) zichtbaar++;
    });
    var paneel = document.querySelector("#nieuws [id^=kanaal-]:not(.verborgen)");
    zichtbaar = paneel ? alle("li.bericht:not(.verborgen)", paneel).length : zichtbaar;
    alle(".nieuwslijst ul.berichten").forEach(function (ul) {
      var leeg = !ul.querySelector("li.bericht:not(.verborgen)");
      ul.classList.toggle("verborgen", leeg);
      ul.previousElementSibling.classList.toggle("verborgen", leeg);
    });
    document.getElementById("niets").classList.toggle("verborgen", zichtbaar > 0);
  }
  function chips(id, doel, sleutel, opnieuw) {
    var rij = document.getElementById(id);
    if (!rij) return;
    rij.addEventListener("click", function (ev) {
      var knop = ev.target.closest(".chip");
      if (!knop) return;
      alle(".chip", rij).forEach(function (c) { c.classList.toggle("actief", c === knop); });
      doel[sleutel] = knop.dataset.waarde;
      opnieuw();
    });
  }
  chips("terrein-knoppen", filter, "terrein", pasToe);
  alle(".bron-knoppen").forEach(function (rij) {
    rij.addEventListener("click", function (ev) {
      var knop = ev.target.closest(".chip");
      if (!knop) return;
      alle(".chip", rij).forEach(function (c) { c.classList.toggle("actief", c === knop); });
      filter.bron = knop.dataset.waarde;
      pasToe();
    });
  });
  // bij wisselen tussen media en officieel: bronfilter terug op 'Alles'
  alle("#kanaal-schakel button").forEach(function (b) {
    b.addEventListener("click", function () {
      filter.bron = "";
      alle(".bron-knoppen .chip").forEach(function (c) { c.classList.toggle("actief", c.dataset.waarde === ""); });
      pasToe();
    });
  });
  document.getElementById("zoek").addEventListener("input", function (ev) {
    filter.zoek = ev.target.value.trim().toLowerCase();
    pasToe();
  });

  // ---- glazen selectiebolletje: volgt de tab en is te verslepen ----
  var pil = document.querySelector("nav.tabs .pil");
  var lens = document.getElementById("lens");
  var tabLinks = alle("nav.tabs a");
  function zetLens(a, direct) {
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

  // =====================================================================
  //  Gegevens-tabbladen: Overzicht, Agenda, Dossiers, Stemmingen, Mensen
  //  Uitgangspunt: alleen feiten met bron. Geen rangschikking of oordeel;
  //  volgorde en selectie kies je zelf met filters en sortering.
  // =====================================================================
  function data(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  var META = data("data-meta") || {};
  var _cache = {};
  function D(naam) { if (!(naam in _cache)) _cache[naam] = data("data-" + naam); return _cache[naam]; }

  var MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  var MK = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  var DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  var FASEN = ["Voorstel", "Parlement", "Raad", "Triloog", "Aangenomen", "In werking"];
  var KLEUR = { "EVP": "#3d8bfd", "S&D": "#e0313a", "PfE": "#3b2a7a", "ECR": "#1f78b4", "Renew": "#f2b705",
    "Groenen": "#3aa346", "Links": "#9b1c31", "ESN": "#7a5230", "Niet-ingeschreven": "#9aa0a6" };
  var FR_OEIL = { "EPP": "EVP", "S&D": "S&D", "PfE": "PfE", "ECR": "ECR", "Renew": "Renew", "Greens/EFA": "Groenen",
    "The Left": "Links", "ESN": "ESN", "NI": "Niet-ingeschreven" };
  var POS = { FOR: ["v", "voor"], AGAINST: ["t", "tegen"], ABSTENTION: ["o", "onthouden"], DID_NOT_VOTE: ["g", "niet gestemd"] };

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dt(s) { var p = (s || "").slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function kort(s) { if (!s) return ""; var d = dt(s); return d.getDate() + " " + MK[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : ""); }
  function lang(s) { var d = dt(s); return DAGEN[d.getDay()] + " " + d.getDate() + " " + MAANDEN[d.getMonth()]; }
  function vandaag() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function plusDagen(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function a(url, tekst) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(tekst) + "</a>" : esc(tekst); }
  function fr(naam) { return '<span class="frl"><i style="background:' + (KLEUR[naam] || "#999") + '"></i>' + esc(naam) + "</span>"; }
  function opgehaald(sleutel) {
    var m = META[sleutel];
    if (!m) return "";
    return '<p class="opgehaald">Opgehaald: ' + esc(m.moment || "") + (m.oud ? " · <b>niet vers</b>: ophalen lukte nu niet" : "") + "</p>";
  }
  function leden() { return D("leden") || {}; }
  function isNL(id) { var l = leden()[id]; return l && l.land === "NL"; }

  // ---------- opslag in de browser: volglijst, notities, bezoeken ----------
  function leesJSON(k, standaard) { try { return JSON.parse(lees(k) || "") || standaard; } catch (e) { return standaard; } }
  var VOLG = leesJSON("eu-volg", { dossiers: [], mensen: [] });
  var NOTITIES = leesJSON("eu-notities", {});
  var STAND = leesJSON("eu-volg-stand", {});
  var BEZOEK = leesJSON("eu-bezoek", {});
  (function () {
    var nu = vandaag();
    if (BEZOEK.huidig !== nu) { BEZOEK.vorig = BEZOEK.huidig || ""; BEZOEK.huidig = nu; bewaar("eu-bezoek", JSON.stringify(BEZOEK)); }
  })();
  function volgt(soort, id) { return VOLG[soort].indexOf(id) >= 0; }
  function wisselVolg(soort, id) {
    var i = VOLG[soort].indexOf(id);
    if (i >= 0) VOLG[soort].splice(i, 1); else VOLG[soort].push(id);
    bewaar("eu-volg", JSON.stringify(VOLG));
  }
  function ster(soort, id) {
    return '<button class="ster' + (volgt(soort, id) ? " aan" : "") + '" data-volg="' + soort + '" data-id="' + esc(id) + '" title="Volgen" aria-label="Volgen">' + (volgt(soort, id) ? "★" : "☆") + "</button>";
  }
  function notitie(sleutel) {
    return '<label class="notitie"><span>Mijn notities</span><textarea data-notitie="' + esc(sleutel) + '" placeholder="Alleen jij ziet dit (bewaard in deze browser)">' + esc(NOTITIES[sleutel] || "") + "</textarea></label>";
  }
  document.addEventListener("input", function (ev) {
    var k = ev.target.dataset && ev.target.dataset.notitie;
    if (!k) return;
    if (ev.target.value) NOTITIES[k] = ev.target.value; else delete NOTITIES[k];
    bewaar("eu-notities", JSON.stringify(NOTITIES));
  });
  document.addEventListener("click", function (ev) {
    var s = ev.target.closest && ev.target.closest("button.ster");
    if (s) {
      ev.preventDefault();
      wisselVolg(s.dataset.volg, s.dataset.id);
      var aan = volgt(s.dataset.volg, s.dataset.id);
      alle('button.ster[data-volg="' + s.dataset.volg + '"][data-id="' + s.dataset.id.replace(/"/g, '\\"') + '"]').forEach(function (b) {
        b.classList.toggle("aan", aan); b.textContent = aan ? "★" : "☆";
      });
      if (s.dataset.volg === "dossiers") { var d = dossierIndex()[s.dataset.id]; if (d) { STAND[d.ref] = d.laatst; bewaar("eu-volg-stand", JSON.stringify(STAND)); } }
      return;
    }
    var k = ev.target.closest && ev.target.closest("[data-kopieer]");
    if (k) { ev.preventDefault(); kopieer(KOPIEER[k.dataset.kopieer] ? KOPIEER[k.dataset.kopieer]() : "", k); return; }
    var ic = ev.target.closest && ev.target.closest("[data-ics]");
    if (ic) { ev.preventDefault(); ics(JSON.parse(ic.dataset.ics)); return; }
    var ga = ev.target.closest && ev.target.closest("[data-ga]");
    if (ga) { ev.preventDefault(); location.hash = ga.dataset.ga; return; }
  });

  // ---------- kopiëren en agenda ----------
  var KOPIEER = {};
  function kopieer(tekst, knop) {
    function klaar() { var oud = knop.textContent; knop.textContent = "Gekopieerd ✓"; setTimeout(function () { knop.textContent = oud; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(tekst).then(klaar, function () { reserve(); }); }
    else reserve();
    function reserve() { var t = document.createElement("textarea"); t.value = tekst; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); klaar(); } catch (e) {} t.remove(); }
  }
  function icsKnop(titel, datum, uitleg, url) {
    return '<button class="mini" data-ics="' + esc(JSON.stringify({ t: titel, d: datum, u: uitleg || "", l: url || "" })) + '">＋ Agenda</button>';
  }
  function ics(x) {
    var d = x.d.replace(/-/g, ""), e = dt(x.d); e.setDate(e.getDate() + 1);
    var d2 = e.getFullYear() + ("0" + (e.getMonth() + 1)).slice(-2) + ("0" + e.getDate()).slice(-2);
    function v(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
    var tekst = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EU-monitor//NL", "BEGIN:VEVENT",
      "UID:" + d + "-" + Math.random().toString(36).slice(2) + "@eu-monitor", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + d2, "SUMMARY:" + v(x.t), "DESCRIPTION:" + v((x.u ? x.u + "\n" : "") + (x.l || "")),
      x.l ? "URL:" + x.l : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
    var blob = new Blob([tekst], { type: "text/calendar" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "eu-" + d + ".ics";
    document.body.appendChild(link); link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 500);
  }

  // ---------- dossiers ----------
  var _dIndex = null;
  function dossierIndex() {
    if (!_dIndex) { _dIndex = {}; (D("dossiers") || []).forEach(function (d) { _dIndex[d.ref] = d; }); }
    return _dIndex;
  }
  function rapporteurs(d) {
    var uit = [];
    (d.commissies || []).forEach(function (c) { (c.rapporteurs || []).forEach(function (r) { uit.push({ id: r.id, naam: r.naam, fractie: r.fractie, commissie: c.code, rol: c.rol }); }); });
    return uit;
  }
  function verantwoordelijk(d) { return (d.commissies || []).filter(function (c) { return /responsible/i.test(c.rol); }); }
  function heeftNL(d) {
    return rapporteurs(d).concat(d.schaduw || []).some(function (p) { return isNL(p.id); });
  }
  function persoon(p, extra) {
    var f = FR_OEIL[p.fractie] || p.fractie;
    return '<a href="#mensen?id=' + esc(p.id) + '" class="persoon">' + esc(p.naam) + "</a>" + (isNL(p.id) ? " 🇳🇱" : "") + (f ? " " + fr(f) : "") + (extra ? ' <span class="klein">' + esc(extra) + "</span>" : "");
  }
  function stappen(d) {
    if (d.fase == null) return "";
    var data = {};
    (d.gebeurtenissen || []).forEach(function (g) { if (g.fase != null && !(g.fase in data)) data[g.fase] = g.datum; });
    return '<div class="stappen">' + FASEN.map(function (n, i) {
      var k = i === d.fase && i < 5 ? "nu" : (i <= d.fase ? "ja" : "");
      return '<div class="stap ' + k + '"><i></i>' + n + "<small>" + (i in data && i <= d.fase ? kort(data[i]) : "&nbsp;") + "</small></div>";
    }).join("") + "</div>";
  }
  function stemmenBij(ref) { return ((D("stemmen") || {}).stemmen || []).filter(function (s) { return s.procedure === ref; }); }
  function feitenDossier(d) {
    var r = [];
    r.push(d.ref + " — " + (d.eigen && d.eigen.titel ? d.eigen.titel + " / " : "") + d.titel);
    r.push("Soort: " + (d.soort_naam || d.soort) + (d.instrument ? " (" + d.instrument + ")" : ""));
    r.push("Stand van zaken: " + d.status + (d.fase != null ? " — fase: " + FASEN[d.fase] : ""));
    if (d.begin) r.push("Eerste stap: " + d.begin + (d.laatst ? " · laatste stap: " + d.laatst : ""));
    verantwoordelijk(d).forEach(function (c) { r.push("Parlementscommissie: " + c.code + " (" + c.naam + ")"); });
    rapporteurs(d).forEach(function (p) { r.push("Rapporteur (" + p.commissie + "): " + p.naam + " (" + p.fractie + ")"); });
    if ((d.schaduw || []).length) r.push("Schaduwrapporteurs: " + d.schaduw.map(function (p) { return p.naam + " (" + p.fractie + ")"; }).join(", "));
    if (d.commissaris) r.push("Eurocommissaris: " + d.commissaris + (d.dg ? " · DG: " + d.dg : ""));
    var toekomst = (d.vooruit || []).filter(function (v) { return v.datum >= vandaag(); });
    toekomst.forEach(function (v) { r.push("Gepland: " + v.datum + " — " + v.wat); });
    (d.gebeurtenissen || []).slice(-5).forEach(function (g) { r.push("Stap: " + g.datum + " — " + g.wat + (g.doc ? " (" + g.doc + ")" : "")); });
    stemmenBij(d.ref).forEach(function (s) { r.push(""); r.push(feitenStem(s)); });
    r.push(""); r.push("Bron: " + d.url);
    return r.join("\n");
  }
  function dossierKaart(d) {
    var rap = rapporteurs(d).filter(function (p) { return /responsible/i.test(p.rol); });
    var toekomst = (d.vooruit || []).filter(function (v) { return v.datum >= vandaag(); });
    var laatsteStap = (d.gebeurtenissen || []).slice(-1)[0];
    var e = d.eigen || {};
    KOPIEER["d:" + d.ref] = function () { return feitenDossier(d); };
    var h = '<div class="kaart dkaart" data-ref="' + esc(d.ref) + '">'
      + '<div class="kaartkop"><div class="klein">' + esc(d.soort_naam || d.soort) + " · " + esc(d.ref) + (e.titel ? ' · <span class="label">eigen uitleg</span>' : "") + "</div>" + ster("dossiers", d.ref) + "</div>"
      + "<h3>" + esc(e.titel || d.titel) + "</h3>" + (e.titel ? '<div class="klein en">' + esc(d.titel) + "</div>" : "")
      + '<div class="klein">Stand: <b>' + esc(d.status) + "</b>" + (d.laatst ? " · laatste stap " + kort(d.laatst) : "") + "</div>"
      + stappen(d)
      + '<div class="spelers">'
      + (verantwoordelijk(d).length ? "<span>Parlementscommissie</span><span>" + verantwoordelijk(d).map(function (c) { return esc(c.code) + (c.wacht ? " (nog niet definitief)" : ""); }).join(", ") + "</span>" : "")
      + "<span>Rapporteur</span><span>" + (rap.length ? rap.map(function (p) { return persoon(p); }).join("<br>") : "nog niet benoemd") + "</span>"
      + (laatsteStap ? "<span>Laatste stap</span><span>" + kort(laatsteStap.datum) + ": " + esc(laatsteStap.wat) + "</span>" : "")
      + (toekomst.length ? "<span>Gepland</span><span>" + toekomst.map(function (v) { return "<b>" + kort(v.datum) + "</b>: " + esc(v.wat) + " " + icsKnop(v.wat + ": " + (e.titel || d.titel), v.datum, d.ref, d.url); }).join("<br>") + "</span>" : "")
      + "</div>"
      + '<details class="meer" data-lui="dossier"><summary>Alles over dit dossier</summary><div class="lui"></div></details>'
      + '<div class="knoprij klein-knoppen"><button class="mini" data-kopieer="d:' + esc(d.ref) + '">Kopieer feiten</button>' + a(d.url, "Legislative Observatory") + "</div>"
      + "</div>";
    return h;
  }
  function dossierDetail(d) {
    var e = d.eigen || {};
    var h = "";
    if (e.probleem || e.verandert) {
      h += '<h4>Eigen samenvatting</h4><dl class="feiten">' + (e.probleem ? "<dt>Aanleiding (volgens de Commissie)</dt><dd>" + esc(e.probleem) + "</dd>" : "")
        + (e.verandert ? "<dt>Wat het voorstel inhoudt</dt><dd>" + esc(e.verandert) + "</dd>" : "") + "</dl>"
        + ((e.links || []).length ? '<p class="klein">Bron: ' + e.links.map(function (l) { return a(l[1], l[0]); }).join(" · ") + "</p>" : "");
    }
    h += "<h4>Alle stappen</h4>" + ((d.gebeurtenissen || []).length ? '<ol class="tijdlijn">' + d.gebeurtenissen.map(function (g) {
      return "<li><time>" + kort(g.datum) + "</time>" + esc(g.wat) + (g.doc ? " · " + a(g.url, g.doc) : "") + "</li>";
    }).join("") + "</ol>" : '<p class="klein">Geen stappen bekend.</p>');
    if ((d.vooruit || []).length) h += "<h4>Gepland volgens OEIL</h4><ul class='punten'>" + d.vooruit.map(function (v) { return "<li>" + kort(v.datum) + ": " + esc(v.wat) + "</li>"; }).join("") + "</ul>";
    h += "<h4>Wie is betrokken</h4>";
    (d.commissies || []).forEach(function (c) {
      h += '<p class="klein"><b>' + esc(c.code) + "</b> " + esc(c.naam) + " — " + esc(c.rol.replace("Committee responsible", "verantwoordelijk").replace("Joint committee responsible", "samen verantwoordelijk").replace("Committee for opinion", "geeft advies").replace("Committee for budgetary assessment", "begrotingsadvies")) + (c.wacht ? " (verwijzing nog niet definitief)" : "") + "<br>"
        + ((c.rapporteurs || []).length ? c.rapporteurs.map(function (p) { return persoon(p); }).join(", ") : "geen rapporteur bekend") + "</p>";
    });
    if ((d.schaduw || []).length) h += '<p class="klein"><b>Schaduwrapporteurs</b><br>' + d.schaduw.map(function (p) { return persoon(p, p.commissie); }).join("<br>") + "</p>";
    if (d.commissaris || d.dg) h += '<p class="klein"><b>Europese Commissie</b><br>' + esc(d.commissaris || "") + (d.dg ? " · DG " + esc(d.dg) : "") + "</p>";
    if ((d.raad || []).length) h += '<p class="klein"><b>Raad</b><br>' + d.raad.map(function (r) { return esc(r.configuratie) + " · " + kort(r.datum); }).join("<br>") + "</p>";
    var st = stemmenBij(d.ref);
    if (st.length) h += "<h4>Stemmingen in het Parlement</h4>" + st.map(function (s) { return stemRegel(s); }).join("");
    if ((d.documenten || []).length) h += "<h4>Documenten</h4><ul class='punten'>" + d.documenten.map(function (x) { return "<li>" + kort(x.datum) + " · " + esc(x.soort) + ": " + a(x.url, x.ref) + "</li>"; }).join("") + "</ul>";
    if (d.transparantie_aantal) h += "<h4>Ontmoetingen met belangenvertegenwoordigers</h4><p class='klein'>Opgegeven door (schaduw)rapporteurs" + (d.transparantie_aantal >= 10 ? "; OEIL toont er per pagina 10, zie de bron voor alles" : "") + ".</p><ul class='punten'>"
      + d.transparantie.map(function (t) { return "<li>" + kort(t.datum) + " · " + esc(t.wie) + " (" + esc(t.rol) + "): " + esc(t.met) + "</li>"; }).join("") + "</ul>";
    if ((d.onderwerpen || []).length) h += '<p class="klein">Onderwerpen (OEIL): ' + d.onderwerpen.map(function (o) { return esc(o[0] + " " + o[1]); }).join("; ") + "</p>";
    h += notitie("d:" + d.ref);
    return h;
  }

  var dFilter = { fase: "", q: "", terrein: "", commissie: "", soort: "", jaar: "", nl: false, volg: false, afgerond: false, sort: lees("eu-d-sort") || "laatst", n: 25 };
  function dossiersRender() {
    var lijst = D("dossiers") || [];
    var q = dFilter.q.toLowerCase();
    var uit = lijst.filter(function (d) {
      if (!dFilter.afgerond && d.afgerond && !(d.eigen && d.eigen.titel)) return false;
      if (dFilter.fase && (d.fase == null || FASEN[d.fase] !== dFilter.fase)) return false;
      if (dFilter.terrein && (d.terreinen || []).indexOf(dFilter.terrein) < 0) return false;
      if (dFilter.commissie && !verantwoordelijk(d).some(function (c) { return c.code === dFilter.commissie; })) return false;
      if (dFilter.soort && d.soort !== dFilter.soort) return false;
      if (dFilter.jaar && d.ref.slice(0, 4) !== dFilter.jaar) return false;
      if (dFilter.nl && !heeftNL(d)) return false;
      if (dFilter.volg && !volgt("dossiers", d.ref)) return false;
      if (q) {
        var t = (d.ref + " " + d.titel + " " + ((d.eigen || {}).titel || "") + " " + rapporteurs(d).map(function (p) { return p.naam; }).join(" ") + " " + (d.commissaris || "")).toLowerCase();
        if (t.indexOf(q) < 0) return false;
      }
      return true;
    });
    var s = dFilter.sort;
    uit.sort(function (x, y) {
      if (s === "naam") return (x.titel || "").localeCompare(y.titel || "");
      if (s === "nieuw") return (y.begin || "").localeCompare(x.begin || "") || y.ref.localeCompare(x.ref);
      if (s === "gepland") {
        var gx = ((x.vooruit || []).filter(function (v) { return v.datum >= vandaag(); })[0] || {}).datum || "9999";
        var gy = ((y.vooruit || []).filter(function (v) { return v.datum >= vandaag(); })[0] || {}).datum || "9999";
        return gx.localeCompare(gy);
      }
      return (y.laatst || "").localeCompare(x.laatst || "");
    });
    var doel = document.getElementById("d-lijst");
    document.getElementById("d-aantal").textContent = uit.length + " dossiers";
    doel.innerHTML = uit.slice(0, dFilter.n).map(dossierKaart).join("") || '<p class="leeg">Geen dossiers met deze filters.</p>';
    document.getElementById("d-meer").classList.toggle("verborgen", uit.length <= dFilter.n);
    window.euMarkeer(doel);
  }
  function dossiersOpzet() {
    var lijst = D("dossiers") || [];
    function opties(id, waarden, alle) {
      document.getElementById(id).innerHTML = '<option value="">' + alle + "</option>" + waarden.map(function (w) { return '<option value="' + esc(w[0]) + '">' + esc(w[1]) + "</option>"; }).join("");
    }
    var ter = {}, com = {}, soort = {}, jaar = {};
    lijst.forEach(function (d) {
      (d.terreinen || []).forEach(function (t) { ter[t] = 1; });
      verantwoordelijk(d).forEach(function (c) { com[c.code] = c.naam || c.code; });
      soort[d.soort] = d.soort_naam || d.soort; jaar[d.ref.slice(0, 4)] = 1;
    });
    opties("d-terrein", Object.keys(ter).sort().map(function (t) { return [t, t]; }), "Alle onderwerpen");
    opties("d-commissie", Object.keys(com).sort().map(function (c) { return [c, c + " – " + com[c]]; }), "Alle parlementscommissies");
    opties("d-soort", Object.keys(soort).sort().map(function (s) { return [s, soort[s] + " (" + s + ")"]; }), "Alle soorten");
    opties("d-jaar", Object.keys(jaar).sort().reverse().map(function (j) { return [j, j]; }), "Alle jaren");
    document.getElementById("d-sort").value = dFilter.sort;
    var fasen = document.getElementById("d-fasen");
    fasen.innerHTML = '<button class="chip actief" data-waarde="">Alle fasen</button>' + FASEN.map(function (f) { return '<button class="chip" data-waarde="' + f + '">' + f + "</button>"; }).join("");
    fasen.addEventListener("click", function (ev) {
      var k = ev.target.closest(".chip"); if (!k) return;
      alle(".chip", fasen).forEach(function (c) { c.classList.toggle("actief", c === k); });
      dFilter.fase = k.dataset.waarde; dFilter.n = 25; dossiersRender();
    });
    [["d-terrein", "terrein"], ["d-commissie", "commissie"], ["d-soort", "soort"], ["d-jaar", "jaar"], ["d-sort", "sort"]].forEach(function (x) {
      document.getElementById(x[0]).addEventListener("change", function (ev) { dFilter[x[1]] = ev.target.value; dFilter.n = 25; if (x[1] === "sort") bewaar("eu-d-sort", ev.target.value); dossiersRender(); });
    });
    [["d-nl", "nl"], ["d-volg", "volg"], ["d-afgerond", "afgerond"]].forEach(function (x) {
      document.getElementById(x[0]).addEventListener("change", function (ev) { dFilter[x[1]] = ev.target.checked; dFilter.n = 25; dossiersRender(); });
    });
    var zoekt = null;
    document.getElementById("d-zoek").addEventListener("input", function (ev) { clearTimeout(zoekt); zoekt = setTimeout(function () { dFilter.q = ev.target.value.trim(); dFilter.n = 25; dossiersRender(); }, 200); });
    document.getElementById("d-meer").addEventListener("click", function () { dFilter.n += 25; dossiersRender(); });
    document.getElementById("d-lijst").addEventListener("toggle", function (ev) {
      var det = ev.target; if (!det.open || det.dataset.klaar) return;
      var d = dossierIndex()[det.closest(".dkaart").dataset.ref];
      det.querySelector(".lui").innerHTML = dossierDetail(d); det.dataset.klaar = 1; window.euMarkeer(det);
    }, true);
  }

  // ---------- stemmingen ----------
  function stemVerdeling(t) {
    var v = t.FOR || 0, te = t.AGAINST || 0, o = t.ABSTENTION || 0, som = Math.max(v + te + o, 1);
    return '<div class="balk"><span class="v" style="width:' + (100 * v / som).toFixed(1) + '%"></span><span class="t" style="width:' + (100 * te / som).toFixed(1) + '%"></span><span class="o" style="width:' + (100 * o / som).toFixed(1) + '%"></span></div>'
      + '<div class="cijfers"><span><b>' + v + "</b> voor</span><span><b>" + te + "</b> tegen</span><span><b>" + o + "</b> onthouden</span><span>" + (t.DID_NOT_VOTE || 0) + " niet gestemd</span></div>";
  }
  function meerderheid(c) { var b = null, n = -1; ["FOR", "AGAINST", "ABSTENTION"].forEach(function (k) { if ((c[k] || 0) > n && c[k]) { n = c[k]; b = k; } }); return b; }
  function nlPartijen(s) {
    return '<div class="nl-stem">' + Object.keys(s.nl_partijen || {}).sort(function (x, y) {
      function som(p) { var c = s.nl_partijen[p]; return (c.FOR || 0) + (c.AGAINST || 0) + (c.ABSTENTION || 0) + (c.DID_NOT_VOTE || 0); }
      return som(y) - som(x);
    }).map(function (p) {
      var c = s.nl_partijen[p], m = meerderheid(c) || "DID_NOT_VOTE";
      var delen = ["FOR", "AGAINST", "ABSTENTION", "DID_NOT_VOTE"].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + " " + POS[k][1]; });
      return '<span class="' + POS[m][0] + '" title="' + esc(delen.join(", ")) + '">' + esc(p) + " " + POS[m][1] + (Object.keys(c).filter(function (k) { return k !== "DID_NOT_VOTE"; }).length > 1 ? " (niet allemaal)" : "") + "</span>";
    }).join("") + "</div>";
  }
  function feitenStem(s) {
    var t = s.totaal || {};
    var r = ["Stemming " + s.moment.slice(0, 10) + ": " + s.titel, "Uitslag: " + (s.uitslag === "ADOPTED" ? "aangenomen" : "verworpen") + " — " + (t.FOR || 0) + " voor, " + (t.AGAINST || 0) + " tegen, " + (t.ABSTENTION || 0) + " onthouden, " + (t.DID_NOT_VOTE || 0) + " niet gestemd"];
    r.push("Nederlandse partijen: " + Object.keys(s.nl_partijen || {}).map(function (p) {
      var c = s.nl_partijen[p];
      return p + " (" + ["FOR", "AGAINST", "ABSTENTION", "DID_NOT_VOTE"].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + " " + POS[k][1]; }).join(", ") + ")";
    }).join("; "));
    if (s.procedure) r.push("Procedure: " + s.procedure);
    r.push("Bron: " + s.url);
    return r.join("\n");
  }
  function stemRegel(s) {
    return '<p class="klein">' + kort(s.moment) + ": " + esc(s.titel) + ' — <span class="uitslag ' + (s.uitslag === "ADOPTED" ? "ja" : "nee") + '">' + (s.uitslag === "ADOPTED" ? "Aangenomen" : "Verworpen") + "</span> "
      + (s.totaal.FOR || 0) + "–" + (s.totaal.AGAINST || 0) + "–" + (s.totaal.ABSTENTION || 0) + ' · <a href="#stemmingen?id=' + esc(s.id) + '">details</a></p>';
  }
  function stemKaart(s) {
    KOPIEER["s:" + s.id] = function () { return feitenStem(s); };
    var ja = s.uitslag === "ADOPTED", d = s.procedure && dossierIndex()[s.procedure];
    var afw = (s.afwijkers || []).map(function (x) { return esc(x.partij) + ": " + POS[x.partij_stem][1] + "; fractie " + esc(x.fractie) + " (meerderheid): " + POS[x.fractie_stem][1]; });
    return '<div class="kaart skaart" data-id="' + esc(s.id) + '">'
      + '<div class="klein">' + esc(lang(s.moment)) + ' · <span class="label taal">EN</span>' + (s.terreinen || []).map(function (t) { return ' <span class="label">' + esc(t) + "</span>"; }).join("") + "</div>"
      + "<h3>" + esc(s.titel) + '</h3><span class="uitslag ' + (ja ? "ja" : "nee") + '">' + (ja ? "Aangenomen" : "Verworpen") + "</span>"
      + stemVerdeling(s.totaal || {})
      + '<div class="klein" style="margin-top:10px">Nederlandse partijen (meeste stemmen binnen de partij):</div>' + nlPartijen(s)
      + (afw.length ? '<p class="klein">Partij stemde anders dan de meerderheid van haar fractie: ' + afw.join(" · ") + "</p>" : "")
      + '<details class="meer" data-lui="stem"><summary>Per fractie, per persoon en deelstemmingen</summary><div class="lui"></div></details>'
      + '<div class="knoprij klein-knoppen"><button class="mini" data-kopieer="s:' + esc(s.id) + '">Kopieer feiten</button>' + a(s.url, "HowTheyVote") + (s.document ? a(s.document, "Tekst") : "")
      + (d ? '<a href="#dossiers?q=' + encodeURIComponent(s.procedure) + '">Dossier ' + esc(s.procedure) + "</a>" : (s.procedure ? a("https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=" + s.procedure, s.procedure) : "")) + "</div></div>";
  }
  function stemDetail(s) {
    var h = "<h4>Per fractie</h4><div class='tabel-scroll'><table><tr><th>Fractie</th><th>voor</th><th>tegen</th><th>onth.</th><th>niet</th></tr>"
      + Object.keys(s.per_fractie || {}).map(function (f) { var c = s.per_fractie[f]; return "<tr><td>" + fr(f) + "</td><td>" + (c.FOR || 0) + "</td><td>" + (c.AGAINST || 0) + "</td><td>" + (c.ABSTENTION || 0) + "</td><td>" + (c.DID_NOT_VOTE || 0) + "</td></tr>"; }).join("") + "</table></div>";
    h += "<h4>Nederlandse europarlementariërs</h4><ul class='punten'>" + (s.nl_leden || []).slice().sort(function (x, y) { return x.partij.localeCompare(y.partij) || x.naam.localeCompare(y.naam); }).map(function (m) {
      return '<li><a href="#mensen?id=' + esc(m.id) + '">' + esc(m.naam) + "</a> (" + esc(m.partij) + ", " + esc(m.fractie) + "): <b>" + POS[m.positie][1] + "</b>"
        + (m.anders_dan_partij ? ' <span class="label">anders dan partij</span>' : "") + (m.anders_dan_fractie ? ' <span class="label">anders dan fractie</span>' : "") + "</li>";
    }).join("") + "</ul>";
    if ((s.verwant || []).length) h += "<h4>Deelstemmingen en amendementen</h4><ul class='punten'>" + s.verwant.map(function (v) {
      return "<li>" + esc(v.nummer && v.nummer !== "§" ? "Amendement " + v.nummer + " (" + v.onderwerp + ")" : (v.wat || v.onderwerp)) + ": " + (v.uitslag === "ADOPTED" ? "aangenomen" : "verworpen") + " · " + a("https://howtheyvote.eu/votes/" + v.id, "details") + "</li>";
    }).join("") + "</ul>";
    h += notitie("s:" + s.id);
    return h;
  }
  var sFilter = { q: "", terrein: "", zitting: "", uitslag: "", verdeeld: false, afwijk: false, sort: "datum" };
  function stemmenRender() {
    var S = D("stemmen") || { stemmen: [] };
    var q = sFilter.q.toLowerCase();
    var uit = S.stemmen.filter(function (s) {
      if (sFilter.terrein && (s.terreinen || []).indexOf(sFilter.terrein) < 0) return false;
      if (sFilter.zitting && !(s.moment.slice(0, 10) >= sFilter.zitting.split("|")[0] && s.moment.slice(0, 10) <= sFilter.zitting.split("|")[1])) return false;
      if (sFilter.uitslag && s.uitslag !== sFilter.uitslag) return false;
      if (sFilter.verdeeld && !s.nl_verdeeld) return false;
      if (sFilter.afwijk && !(s.afwijkers || []).length) return false;
      if (q && (s.titel + " " + (s.procedure || "") + " " + (s.procedure_titel || "")).toLowerCase().indexOf(q) < 0) return false;
      if (sFilter.id && s.id !== sFilter.id) return false;
      return true;
    });
    uit.sort(function (x, y) {
      if (sFilter.sort === "verschil") return Math.abs((x.totaal.FOR || 0) - (x.totaal.AGAINST || 0)) - Math.abs((y.totaal.FOR || 0) - (y.totaal.AGAINST || 0));
      if (sFilter.sort === "onthouden") return (y.totaal.ABSTENTION || 0) - (x.totaal.ABSTENTION || 0);
      if (sFilter.sort === "oud") return x.moment.localeCompare(y.moment);
      return y.moment.localeCompare(x.moment);
    });
    document.getElementById("s-aantal").textContent = uit.length + " hoofdstemmingen" + (sFilter.id ? " (één geselecteerd, " : "") + (sFilter.id ? '<a>' : "");
    document.getElementById("s-aantal").innerHTML = uit.length + " hoofdstemmingen" + (sFilter.id ? ' · <a href="#stemmingen">toon alle</a>' : "");
    var doel = document.getElementById("s-lijst");
    doel.innerHTML = uit.map(stemKaart).join("") || '<p class="leeg">Geen stemmingen met deze filters.</p>';
    window.euMarkeer(doel);
  }
  function stemmenOpzet() {
    var S = D("stemmen") || { stemmen: [], zittingen: [] };
    var ter = {};
    S.stemmen.forEach(function (s) { (s.terreinen || []).forEach(function (t) { ter[t] = 1; }); });
    document.getElementById("s-terrein").innerHTML = '<option value="">Alle onderwerpen</option>' + Object.keys(ter).sort().map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    document.getElementById("s-zitting").innerHTML = '<option value="">Beide zittingen</option>' + (S.zittingen || []).map(function (z) { return '<option value="' + z.begin + "|" + z.eind + '">Zitting ' + kort(z.begin) + " – " + kort(z.eind) + "</option>"; }).join("");
    [["s-terrein", "terrein"], ["s-zitting", "zitting"], ["s-uitslag", "uitslag"], ["s-sort", "sort"]].forEach(function (x) {
      document.getElementById(x[0]).addEventListener("change", function (ev) { sFilter[x[1]] = ev.target.value; stemmenRender(); });
    });
    [["s-verdeeld", "verdeeld"], ["s-afwijk", "afwijk"]].forEach(function (x) {
      document.getElementById(x[0]).addEventListener("change", function (ev) { sFilter[x[1]] = ev.target.checked; stemmenRender(); });
    });
    var t = null;
    document.getElementById("s-zoek").addEventListener("input", function (ev) { clearTimeout(t); t = setTimeout(function () { sFilter.q = ev.target.value.trim(); stemmenRender(); }, 200); });
    document.getElementById("s-lijst").addEventListener("toggle", function (ev) {
      var det = ev.target; if (!det.open || det.dataset.klaar) return;
      var id = det.closest(".skaart").dataset.id, s = S.stemmen.filter(function (x) { return x.id === id; })[0];
      det.querySelector(".lui").innerHTML = stemDetail(s); det.dataset.klaar = 1; window.euMarkeer(det);
    }, true);
  }

  // ---------- mensen ----------
  var _mensen = null;
  function mensen() {
    if (_mensen) return _mensen;
    var m = {};
    var L = leden();
    Object.keys(L).forEach(function (id) { m[id] = { id: id, naam: L[id].naam, partij: L[id].partij, fractie: L[id].fractie, land: L[id].land, rap: [], schaduw: [], debatten: [], stemmen: [] }; });
    (D("dossiers") || []).forEach(function (d) {
      rapporteurs(d).forEach(function (p) {
        if (!m[p.id]) m[p.id] = { id: p.id, naam: p.naam, fractie: FR_OEIL[p.fractie] || p.fractie, partij: "", land: "", rap: [], schaduw: [], debatten: [], stemmen: [] };
        m[p.id].rap.push({ ref: d.ref, titel: (d.eigen || {}).titel || d.titel, commissie: p.commissie, rol: p.rol, af: d.afgerond });
      });
      (d.schaduw || []).forEach(function (p) {
        if (!m[p.id]) m[p.id] = { id: p.id, naam: p.naam, fractie: FR_OEIL[p.fractie] || p.fractie, partij: "", land: "", rap: [], schaduw: [], debatten: [], stemmen: [] };
        m[p.id].schaduw.push({ ref: d.ref, titel: (d.eigen || {}).titel || d.titel, commissie: p.commissie, af: d.afgerond });
      });
    });
    ((D("parlement") || {}).debatten || []).forEach(function (x) {
      (x.sprekers || []).forEach(function (id) { if (m[id]) m[id].debatten.push(x); });
    });
    ((D("stemmen") || {}).stemmen || []).forEach(function (s) {
      (s.nl_leden || []).forEach(function (l) { if (m[l.id]) m[l.id].stemmen.push({ s: s, l: l }); });
    });
    _mensen = m;
    return m;
  }
  function persoonKaart(p) {
    var anderP = p.stemmen.filter(function (x) { return x.l.anders_dan_partij; }).length;
    var anderF = p.stemmen.filter(function (x) { return x.l.anders_dan_fractie; }).length;
    var lopendR = p.rap.filter(function (x) { return !x.af; }), lopendS = p.schaduw.filter(function (x) { return !x.af; });
    return '<div class="kaart mkaart" data-id="' + esc(p.id) + '"><div class="kaartkop"><h3>' + esc(p.naam) + (p.land === "NL" ? " 🇳🇱" : "") + "</h3>" + ster("mensen", p.id) + "</div>"
      + '<div class="klein">' + (p.partij ? esc(p.partij) + " · " : "") + (p.fractie ? fr(p.fractie) : "") + (p.land && p.land !== "NL" ? " · " + esc(p.land) : "") + " · " + a("https://www.europarl.europa.eu/meps/nl/" + p.id, "Profiel bij het Parlement") + "</div>"
      + '<div class="spelers"><span>Rapporteur</span><span>' + lopendR.length + " lopend" + (p.rap.length - lopendR.length ? ", " + (p.rap.length - lopendR.length) + " recent afgerond" : "") + "</span>"
      + "<span>Schaduwrapporteur</span><span>" + lopendS.length + " lopend" + (p.schaduw.length - lopendS.length ? ", " + (p.schaduw.length - lopendS.length) + " recent afgerond" : "") + "</span>"
      + "<span>Debatten</span><span>sprak in " + p.debatten.length + " debatten (laatste drie zittingen)</span>"
      + (p.land === "NL" ? "<span>Stemmingen</span><span>stemde in " + p.stemmen.filter(function (x) { return x.l.positie !== "DID_NOT_VOTE"; }).length + " van de " + p.stemmen.length + " hoofdstemmingen · " + anderP + "× anders dan partij · " + anderF + "× anders dan fractie</span>" : "")
      + "</div>"
      + '<details class="meer" data-lui="mens"><summary>Dossiers, debatten en stemmen</summary><div class="lui"></div></details></div>';
  }
  function persoonDetail(p) {
    var h = "";
    function dl(l) { return l.map(function (x) { return '<li><a href="#dossiers?q=' + encodeURIComponent(x.ref) + '">' + esc(x.ref) + "</a> " + esc(x.titel) + (x.commissie ? " (" + esc(x.commissie) + ")" : "") + (x.af ? " · afgerond" : "") + "</li>"; }).join(""); }
    if (p.rap.length) h += "<h4>Rapporteur</h4><ul class='punten'>" + dl(p.rap) + "</ul>";
    if (p.schaduw.length) h += "<h4>Schaduwrapporteur</h4><ul class='punten'>" + dl(p.schaduw) + "</ul>";
    if (p.debatten.length) h += "<h4>Sprak in debatten</h4><ul class='punten'>" + p.debatten.map(function (x) { return "<li>" + kort(x.datum) + ": " + esc(x.titel) + " · " + a(x.verslag, "verslag") + "</li>"; }).join("") + "</ul>";
    if (p.stemmen.length) h += "<h4>Hoe stemde " + esc(p.naam) + "</h4><ul class='punten'>" + p.stemmen.map(function (x) {
      return "<li>" + kort(x.s.moment) + ': <a href="#stemmingen?id=' + esc(x.s.id) + '">' + esc(x.s.titel) + "</a>: <b>" + POS[x.l.positie][1] + "</b>"
        + (x.l.anders_dan_partij ? ' <span class="label">anders dan partij</span>' : "") + (x.l.anders_dan_fractie ? ' <span class="label">anders dan fractie</span>' : "") + "</li>";
    }).join("") + "</ul>";
    if (!h) h = '<p class="klein">Geen rollen, debatten of stemmen gevonden in de opgehaalde gegevens.</p>';
    return h + notitie("m:" + p.id);
  }
  var mFilter = { q: "", wie: "NL", volg: false, rol: false, id: "" };
  function mensenRender() {
    var M = mensen(), q = mFilter.q.toLowerCase();
    var uit = Object.keys(M).map(function (k) { return M[k]; }).filter(function (p) {
      if (mFilter.id) return p.id === mFilter.id;
      if (mFilter.wie === "NL" && p.land !== "NL") return false;
      if (mFilter.volg && !volgt("mensen", p.id)) return false;
      if (mFilter.rol && !p.rap.concat(p.schaduw).some(function (x) { return !x.af; })) return false;
      if (q && (p.naam + " " + p.partij + " " + p.fractie).toLowerCase().indexOf(q) < 0) return false;
      if (mFilter.wie === "alle" && !q && !mFilter.volg && p.land !== "NL" && !p.rap.length) return false;
      return true;
    }).sort(function (x, y) { return (x.fractie || "").localeCompare(y.fractie || "") || (x.partij || "").localeCompare(y.partij || "") || x.naam.localeCompare(y.naam); });
    document.getElementById("m-aantal").innerHTML = uit.length + " personen" + (mFilter.id ? ' · <a href="#mensen">toon alle</a>' : "");
    var doel = document.getElementById("m-lijst");
    doel.innerHTML = uit.slice(0, 150).map(persoonKaart).join("") || '<p class="leeg">Niemand gevonden.</p>';
    if (mFilter.id) { var det = doel.querySelector("details"); if (det) det.open = true; }
  }
  function mensenOpzet() {
    var t = null;
    document.getElementById("m-zoek").addEventListener("input", function (ev) { clearTimeout(t); t = setTimeout(function () { mFilter.q = ev.target.value.trim(); mFilter.id = ""; mensenRender(); }, 200); });
    document.getElementById("m-wie").addEventListener("change", function (ev) { mFilter.wie = ev.target.value; mFilter.id = ""; mensenRender(); });
    document.getElementById("m-volg").addEventListener("change", function (ev) { mFilter.volg = ev.target.checked; mensenRender(); });
    document.getElementById("m-rol").addEventListener("change", function (ev) { mFilter.rol = ev.target.checked; mensenRender(); });
    document.getElementById("m-lijst").addEventListener("toggle", function (ev) {
      var det = ev.target; if (!det.open || det.dataset.klaar) return;
      det.querySelector(".lui").innerHTML = persoonDetail(mensen()[det.closest(".mkaart").dataset.id]); det.dataset.klaar = 1; window.euMarkeer(det);
    }, true);
  }

  // ---------- agenda ----------
  function agendaItems() {
    var P = D("parlement") || {}, uit = [];
    var grens = plusDagen(28), nu = vandaag();
    (P.agenda || []).forEach(function (dag) {
      uit.push({ datum: dag.datum, soort: "Plenaire vergadering", titel: "Plenaire vergadering in " + dag.plaats, punten: dag.debatten, extra: dag.stemmingen.length ? "Stemmingen om " + dag.stemmingen.join(", ") : "", url: dag.agenda_url });
    });
    (D("dossiers") || []).forEach(function (d) {
      (d.vooruit || []).forEach(function (v) {
        if (v.datum >= nu && v.datum <= grens) uit.push({ datum: v.datum, soort: /commissie/i.test(v.wat) ? "Parlementscommissie" : "Dossierstap", titel: v.wat + ": " + ((d.eigen || {}).titel || d.titel), ref: d.ref, url: d.url });
      });
      (d.raad || []).forEach(function (r) { if (r.datum >= nu && r.datum <= grens) uit.push({ datum: r.datum, soort: "Raad", titel: "Raad (" + r.configuratie + "): " + d.titel, ref: d.ref, url: d.url }); });
    });
    var volgorde = { "Plenaire vergadering": 0, "Raad": 1, "Parlementscommissie": 2, "Dossierstap": 3 };
    uit.sort(function (x, y) { return x.datum.localeCompare(y.datum) || volgorde[x.soort] - volgorde[y.soort] || x.titel.localeCompare(y.titel); });
    return uit;
  }
  var aFilter = { soort: "", q: "" };
  function agendaRender() {
    var items = agendaItems(), q = aFilter.q.toLowerCase();
    items = items.filter(function (i) { return (!aFilter.soort || i.soort === aFilter.soort) && (!q || (i.titel + " " + (i.punten || []).join(" ")).toLowerCase().indexOf(q) >= 0); });
    var h = "", huidig = null;
    items.forEach(function (i) {
      if (i.datum !== huidig) { if (huidig) h += "</div>"; h += '<h2 class="dag">' + esc(lang(i.datum)) + '</h2><div class="kaart"><ul class="lijst">'.replace('<ul class="lijst">', ""); huidig = i.datum; }
      h += '<div class="agendapunt"><div class="meta2"><span class="label">' + esc(i.soort) + "</span>" + icsKnop(i.titel, i.datum, (i.punten || []).join("\n"), i.url) + "</div>"
        + '<div class="regel">' + (i.ref ? '<a href="#dossiers?q=' + encodeURIComponent(i.ref) + '">' + esc(i.titel) + "</a>" : esc(i.titel)) + "</div>"
        + ((i.punten || []).length ? '<ul class="punten">' + i.punten.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : "")
        + (i.extra ? '<p class="klein">' + esc(i.extra) + "</p>" : "") + (i.url ? '<p class="klein">' + a(i.url, i.ref ? "Legislative Observatory" : "Officiële agenda") + "</p>" : "") + "</div>";
    });
    if (huidig) h += "</div>";
    var P = D("parlement") || {};
    if ((P.later || []).length) h += '<p class="klein" style="margin:8px 4px">Daarna: plenaire vergadering vanaf ' + kort(P.later[0].datum) + " in " + esc(P.later[0].plaats) + ".</p>";
    var doel = document.getElementById("a-lijst");
    doel.innerHTML = h || '<p class="leeg">Niets gevonden voor de komende 4 weken.</p>';
    window.euMarkeer(doel);
  }
  var dbFilter = { nl: false, sort: "datum", q: "" };
  function debattenRender() {
    var P = D("parlement") || {}, q = dbFilter.q.toLowerCase();
    var l = (P.debatten || []).filter(function (x) { return (!dbFilter.nl || (x.nederlanders || []).length) && (!q || x.titel.toLowerCase().indexOf(q) >= 0); });
    function n(x) { return (x.fracties || []).reduce(function (s, f) { return s + f[1]; }, 0); }
    l.sort(function (x, y) { return dbFilter.sort === "sprekers" ? n(y) - n(x) : (y.datum.localeCompare(x.datum) || x.nummer - y.nummer); });
    var h = "", huidig = null;
    l.forEach(function (x) {
      if (dbFilter.sort === "datum" && x.datum !== huidig) { h += '<h2 class="dag">' + esc(lang(x.datum)) + " · " + esc(x.plaats) + "</h2>"; huidig = x.datum; }
      h += '<div class="kaart"><div class="klein">' + kort(x.datum) + "</div><h3>" + esc(x.titel) + '</h3><div class="klein">' + (x.sprekers_bekend ? n(x) + " sprekers uit het Parlement" + (x.overige_sprekers ? " · " + x.overige_sprekers + " overige sprekers (zoals Commissie of Raad)" : "") : "Sprekers niet beschikbaar") + "</div>"
        + '<div class="fracties">' + (x.fracties || []).map(function (f) { return "<span><i style='background:" + (KLEUR[f[0]] || "#999") + "'></i>" + esc(f[0]) + " " + f[1] + "</span>"; }).join("") + "</div>"
        + ((x.nederlanders || []).length ? '<p class="klein">🇳🇱 ' + x.nederlanders.map(function (p) { return '<a href="#mensen?id=' + esc(p.id) + '">' + esc(p.naam) + "</a> (" + esc(p.partij) + ")"; }).join(", ") + "</p>" : "")
        + '<p class="klein">' + a(x.verslag, "Verslag van het debat") + "</p>"
        + '<details class="meer"><summary>Mijn notities</summary><div>' + notitie("db:" + x.datum + ":" + x.nummer) + "</div></details></div>";
    });
    var doel = document.getElementById("db-lijst");
    doel.innerHTML = (P.zittingen || []).length ? '<p class="intro">Zittingen: ' + P.zittingen.map(function (z) { return kort(z.begin) + "–" + kort(z.eind) + " (" + esc(z.plaats) + ")"; }).join(", ") + ".</p>" + h : '<p class="leeg">Geen debatten opgehaald.</p>';
    window.euMarkeer(doel);
  }
  function agendaOpzet() {
    document.getElementById("a-soort").addEventListener("change", function (ev) { aFilter.soort = ev.target.value; agendaRender(); });
    var t = null;
    document.getElementById("a-zoek").addEventListener("input", function (ev) { clearTimeout(t); t = setTimeout(function () { aFilter.q = ev.target.value.trim(); agendaRender(); }, 200); });
    document.getElementById("db-nl").addEventListener("change", function (ev) { dbFilter.nl = ev.target.checked; debattenRender(); });
    document.getElementById("db-sort").addEventListener("change", function (ev) { dbFilter.sort = ev.target.value; debattenRender(); });
    var t2 = null;
    document.getElementById("db-zoek").addEventListener("input", function (ev) { clearTimeout(t2); t2 = setTimeout(function () { dbFilter.q = ev.target.value.trim(); debattenRender(); }, 200); });
  }

  // ---------- overzicht ----------
  function overzichtRender() {
    var h = "";
    // volglijst
    var gevolgd = VOLG.dossiers.map(function (r) { return dossierIndex()[r]; }).filter(Boolean);
    var gevolgdM = VOLG.mensen.map(function (id) { return mensen()[id]; }).filter(Boolean);
    h += '<div class="kop-met-link"><h2>Mijn volglijst</h2></div>';
    if (!gevolgd.length && !gevolgdM.length) h += '<p class="intro">Nog leeg. Tik op ☆ bij een dossier of persoon om die hier te zetten.</p>';
    else {
      h += '<div class="kaart"><ul class="lijst">' + gevolgd.map(function (d) {
        var nieuw = STAND[d.ref] && d.laatst > STAND[d.ref];
        var laatste = (d.gebeurtenissen || []).slice(-1)[0];
        return '<li><a href="#dossiers?q=' + encodeURIComponent(d.ref) + '"><div class="regel">' + (nieuw ? '<span class="label voorstel">Gewijzigd</span> ' : "") + esc((d.eigen || {}).titel || d.titel) + '</div><div class="meta2"><span>' + esc(d.ref) + "</span><span>" + esc(d.status) + "</span>" + (laatste ? "<span>" + kort(laatste.datum) + ": " + esc(laatste.wat) + "</span>" : "") + "</div></a></li>";
      }).join("") + gevolgdM.map(function (p) {
        return '<li><a href="#mensen?id=' + esc(p.id) + '"><div class="regel">' + esc(p.naam) + '</div><div class="meta2"><span>' + esc(p.partij || "") + "</span><span>" + esc(p.fractie || "") + "</span></div></a></li>";
      }).join("") + "</ul></div>";
      // markeer als gezien
      gevolgd.forEach(function (d) { STAND[d.ref] = d.laatst; }); bewaar("eu-volg-stand", JSON.stringify(STAND));
    }
    // gewijzigd sinds vorig bezoek
    var vorig = BEZOEK.vorig;
    h += '<div class="kop-met-link"><h2>Gewijzigd sinds je vorige bezoek</h2><a href="#dossiers">Alle dossiers</a></div>';
    if (!vorig) h += '<p class="intro">Dit is je eerste bezoek op dit apparaat. Bij je volgende bezoek staan hier de dossiers die sindsdien een stap verder zijn gegaan.</p>';
    else {
      var gew = (D("dossiers") || []).filter(function (d) { return d.laatst && d.laatst > vorig; }).sort(function (x, y) { return y.laatst.localeCompare(x.laatst); });
      h += '<p class="intro">Vorig bezoek: ' + kort(vorig) + ". " + gew.length + " dossiers met een nieuwe stap (op datum).</p>";
      if (gew.length) h += '<div class="kaart"><ul class="lijst">' + gew.slice(0, 12).map(function (d) {
        var g = (d.gebeurtenissen || []).slice(-1)[0];
        return '<li><a href="#dossiers?q=' + encodeURIComponent(d.ref) + '"><div class="regel">' + esc((d.eigen || {}).titel || d.titel) + '</div><div class="meta2"><span>' + esc(d.ref) + "</span>" + (g ? "<span>" + kort(g.datum) + ": " + esc(g.wat) + "</span>" : "") + "</div></a></li>";
      }).join("") + "</ul></div>";
    }
    // komende 7 dagen
    var week = agendaItems().filter(function (i) { return i.datum <= plusDagen(7); });
    h += '<div class="kop-met-link"><h2>Komende 7 dagen</h2><a href="#agenda">Agenda</a></div>';
    h += week.length ? '<div class="kaart"><ul class="lijst">' + week.slice(0, 12).map(function (i) {
      return '<li><div class="regel">' + (i.ref ? '<a href="#dossiers?q=' + encodeURIComponent(i.ref) + '">' + esc(i.titel) + "</a>" : esc(i.titel)) + '</div><div class="meta2"><span>' + esc(lang(i.datum)) + '</span><span class="label">' + esc(i.soort) + "</span>" + ((i.punten || []).length ? "<span>" + i.punten.length + " debatten</span>" : "") + "</div></li>";
    }).join("") + "</ul></div>" : '<p class="intro">Geen items in de komende 7 dagen.' + (agendaItems()[0] ? " Eerstvolgende: " + esc(lang(agendaItems()[0].datum)) + " (" + esc(agendaItems()[0].soort.toLowerCase()) + ")." : "") + "</p>";
    // laatste stemmingen
    var S = (D("stemmen") || {}).stemmen || [];
    h += '<div class="kop-met-link"><h2>Laatste stemmingen</h2><a href="#stemmingen">Alle stemmingen</a></div>';
    h += S.length ? '<div class="kaart"><ul class="lijst">' + S.slice(0, 5).map(function (s) {
      return '<li><a href="#stemmingen?id=' + esc(s.id) + '"><div class="regel">' + esc(s.titel) + '</div><div class="meta2"><span class="uitslag ' + (s.uitslag === "ADOPTED" ? "ja" : "nee") + '">' + (s.uitslag === "ADOPTED" ? "Aangenomen" : "Verworpen") + "</span><span>" + (s.totaal.FOR || 0) + " voor · " + (s.totaal.AGAINST || 0) + " tegen · " + (s.totaal.ABSTENTION || 0) + " onthouden</span><span>" + kort(s.moment) + "</span></div></a></li>";
    }).join("") + "</ul></div>" + opgehaald("stemmen") : '<p class="intro">Geen stemmingen opgehaald.</p>';
    var doel = document.getElementById("ov-data");
    doel.innerHTML = h;
    window.euMarkeer(doel);
  }

  // ---------- zoeken over alles ----------
  function zoekAlles(q) {
    var doel = document.getElementById("ov-resultaten");
    q = q.trim().toLowerCase();
    if (q.length < 2) { doel.innerHTML = ""; doel.classList.add("verborgen"); return; }
    function blok(titel, items, link) { return items.length ? "<h4>" + titel + " (" + items.length + ")</h4><ul class='lijst'>" + items.slice(0, 8).join("") + "</ul>" + (items.length > 8 && link ? '<p class="klein"><a href="' + link + '">Toon alle ' + items.length + "</a></p>" : "") : ""; }
    var d = (D("dossiers") || []).filter(function (x) { return (x.ref + " " + x.titel + " " + ((x.eigen || {}).titel || "") + " " + rapporteurs(x).map(function (p) { return p.naam; }).join(" ")).toLowerCase().indexOf(q) >= 0; })
      .map(function (x) { return '<li><a href="#dossiers?q=' + encodeURIComponent(x.ref) + '"><div class="regel">' + esc((x.eigen || {}).titel || x.titel) + '</div><div class="meta2"><span>' + esc(x.ref) + "</span><span>" + esc(x.status) + "</span></div></a></li>"; });
    var s = ((D("stemmen") || {}).stemmen || []).filter(function (x) { return (x.titel + " " + (x.procedure || "")).toLowerCase().indexOf(q) >= 0; })
      .map(function (x) { return '<li><a href="#stemmingen?id=' + esc(x.id) + '"><div class="regel">' + esc(x.titel) + '</div><div class="meta2"><span>' + kort(x.moment) + "</span></div></a></li>"; });
    var db = ((D("parlement") || {}).debatten || []).filter(function (x) { return x.titel.toLowerCase().indexOf(q) >= 0; })
      .map(function (x) { return '<li><a href="' + esc(x.verslag) + '" target="_blank" rel="noopener"><div class="regel">' + esc(x.titel) + '</div><div class="meta2"><span>debat ' + kort(x.datum) + "</span></div></a></li>"; });
    var M = mensen();
    var m = Object.keys(M).map(function (k) { return M[k]; }).filter(function (p) { return (p.naam + " " + p.partij).toLowerCase().indexOf(q) >= 0; })
      .map(function (p) { return '<li><a href="#mensen?id=' + esc(p.id) + '"><div class="regel">' + esc(p.naam) + (p.land === "NL" ? " 🇳🇱" : "") + '</div><div class="meta2"><span>' + esc(p.partij || "") + "</span><span>" + esc(p.fractie || "") + "</span></div></a></li>"; });
    var n = alle("li.bericht").filter(function (li) { return li.textContent.toLowerCase().indexOf(q) >= 0; })
      .map(function (li) { var x = li.querySelector("a"); return '<li><a href="' + esc(x.href) + '" target="_blank" rel="noopener"><div class="regel">' + esc(li.querySelector("h3").textContent) + '</div><div class="meta2"><span>' + esc(li.dataset.bron) + "</span></div></a></li>"; });
    var h = blok("Dossiers", d, "#dossiers?q=" + encodeURIComponent(q)) + blok("Stemmingen", s, "#stemmingen") + blok("Debatten", db, "#agenda") + blok("Mensen", m, "#mensen") + blok("Nieuws", n, "#nieuws");
    doel.innerHTML = '<div class="kaart">' + (h || '<p class="klein">Niets gevonden.</p>') + "</div>";
    doel.classList.remove("verborgen");
  }
  var zt = null;
  var zoekveld = document.getElementById("ov-zoek");
  if (zoekveld) zoekveld.addEventListener("input", function (ev) { clearTimeout(zt); zt = setTimeout(function () { zoekAlles(ev.target.value); }, 220); });

  // ---------- tabbladen pas opbouwen als je ze opent ----------
  var opgezet = {};
  function query() { var h = location.hash, i = h.indexOf("?"); var q = {}; if (i < 0) return q; h.slice(i + 1).split("&").forEach(function (p) { var kv = p.split("="); q[kv[0]] = decodeURIComponent(kv[1] || ""); }); return q; }
  function bijTab(naam) {
    var q = query();
    try {
      if (naam === "overzicht") overzichtRender();
      if (naam === "dossiers") {
        if (!opgezet.d) { dossiersOpzet(); opgezet.d = 1; }
        if ("q" in q) { dFilter.q = q.q; dFilter.afgerond = true; document.getElementById("d-zoek").value = q.q; document.getElementById("d-afgerond").checked = true; }
        dossiersRender();
        if ("q" in q) { var det = document.querySelector("#d-lijst details"); if (det && document.querySelectorAll("#d-lijst .dkaart").length === 1) det.open = true; }
      }
      if (naam === "stemmingen") { if (!opgezet.s) { stemmenOpzet(); opgezet.s = 1; } sFilter.id = q.id || ""; stemmenRender(); if (q.id) { var d2 = document.querySelector("#s-lijst details"); if (d2) d2.open = true; } }
      if (naam === "mensen") { if (!opgezet.m) { mensenOpzet(); opgezet.m = 1; } mFilter.id = q.id || ""; mensenRender(); }
      if (naam === "agenda") { if (!opgezet.a) { agendaOpzet(); opgezet.a = 1; } agendaRender(); debattenRender(); }
    } catch (e) { console.error(e); }
  }
  document.addEventListener("eu-tab", function (ev) { bijTab(ev.detail); });
  bijTab(huidigeTab());

})();

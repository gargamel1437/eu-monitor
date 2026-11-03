// =====================================================================
//  overzicht.js: de middelste tab. Eén zoekveld over alles heen, en zolang je niet zoekt
//  vier korte blokken in de volgorde van de tabs: agenda, nieuws, dossiers, stemmen.
//  Alleen koppen met een link naar de tab; de volledige lijsten staan maar op één plek.
// =====================================================================

function lijstRegel(href, titel, meta, extern) {
  return '<li><a href="' + esc(href) + '"' + (extern ? ' target="_blank" rel="noopener"' : "") + '><div class="regel">' + titel + '</div><div class="meta2">' + meta + "</div></a></li>";
}
function ovBlok(titel, link, regels, leeg) {
  return '<div class="kop-met-link"><h2>' + titel + '</h2><a href="' + link + '">Alles ›</a></div>'
    + (regels.length ? '<div class="kaart"><ul class="lijst">' + regels.join("") + "</ul></div>" : '<p class="intro">' + leeg + "</p>");
}

// ---------- blokken (zelf in te richten via "Wijzig" of Instellingen > Overzicht) ----------
var OV_NAAM = { vandaag: "Vandaag", agenda: "Agenda", nieuws: "Nieuws (media)", persberichten: "Persberichten",
  dossiers: "Dossiers", stemmen: "Stemmingen", mensen: "Nederlanders in debatten", recent: "Recent gezocht" };
var OV_DATA = null;
function nieuwsRegels(sel, bron, n) {
  return alle(sel + " li.bericht").filter(function (li) {
    return INST.bronnenUit.indexOf(li.dataset.bron) < 0 && (INST.engels || li.dataset.taal !== "en") && (!bron || li.dataset.bron === bron);
  }).slice(0, n).map(function (li) {
    return lijstRegel(li.querySelector("a").href, esc(li.querySelector("h3").textContent),
      "<span>" + esc(li.dataset.bron) + "</span><span>" + esc(li.dataset.tijd || "") + "</span>", true);
  });
}
function agendaRegel(i, agenda, metTijd) {
  var t = tijdTekst(i), d = (i.dagen || []).filter(function (x) { return x.datum === vandaag(); })[0];
  if (metTijd && d) t = tijdTekst(d);
  if (metTijd && !t && i.vast === "briefing") t = "12:00";
  return lijstRegel("#agenda?item=" + i.id, esc(i.titel),
    (metTijd ? (t ? '<span class="tijd">' + t + "</span>" : "") : "<span>" + esc(lang(i.datum)) + (i.eind_datum ? " t/m " + esc(kort(i.eind_datum)) : "") + "</span>")
    + watLabel(i) + (i.plaats ? "<span>" + esc(i.plaats) + "</span>" : ""));
}
function ovBlokHtml(b, d) {
  var agenda = d.agenda, n = b.n || 3;
  if (b.id === "vandaag") {
    var dag = vandaag(), l = agenda.items.filter(function (i) { return loopt(i, dag) && (i.vast !== "briefing" || AF.aan("ook", "briefing")); });
    l.sort(function (x, y) { return (uur(x.begin) || "99").localeCompare(uur(y.begin) || "99"); });
    return ovBlok("Vandaag <small>" + esc(lang(dag)) + "</small>", "#agenda", l.slice(0, n).map(function (i) { return agendaRegel(i, agenda, true); }), "Vandaag niets in de agenda.");
  }
  if (b.id === "agenda") {
    var wie = b.wie || [];
    var l2 = agenda.items.filter(function (i) { return i.vast !== "briefing" && (!wie.length || (i.wie || []).some(function (w) { return wie.indexOf(w) >= 0; })); });
    return ovBlok("Agenda" + (wie.length ? " <small>" + esc(wie.join(", ")) + "</small>" : ""), "#agenda", l2.slice(0, n).map(function (i) { return agendaRegel(i, agenda, false); }), "Niets gepland in de komende 4 weken.");
  }
  if (b.id === "nieuws") return ovBlok("Nieuws" + (b.bron ? " <small>" + esc(b.bron) + "</small>" : ""), "#nieuws", nieuwsRegels("#kanaal-media", b.bron, n), "Geen berichten.");
  if (b.id === "persberichten") return ovBlok("Persberichten", "#nieuws", nieuwsRegels("#kanaal-officieel", "", n), "Geen persberichten.");
  if (b.id === "dossiers") return ovBlok("Dossiers" + (b.nl ? " <small>met NL-rapporteur</small>" : ""), "#dossiers", d.dossiers.filter(function (x) { return x.laatst && x.laatst <= vandaag() && (!b.nl || x.nl); }).slice(0, n).map(function (x) {
    return lijstRegel("#dossiers?open=" + encodeURIComponent(x.ref), esc(x.titel), "<span>" + esc(x.ref) + "</span><span>" + kort(x.laatst) + ": " + esc(x.stap) + "</span>");
  }), "Geen dossiers.");
  if (b.id === "stemmen") return ovBlok("Stemmingen", "#stemmingen", d.stemmen.stemmen.slice(0, n).map(function (s) {
    return lijstRegel("#stemmingen?id=" + s.id, esc(s.titel), uitslag(s.uitslag) + "<span>" + (s.totaal.FOR || 0) + " voor · " + (s.totaal.AGAINST || 0) + " tegen · " + (s.totaal.ABSTENTION || 0) + " onth.</span><span>" + kort(s.moment) + "</span>");
  }), "Geen stemmingen.");
  if (b.id === "mensen") {
    var regels = [];
    d.debatten.debatten.slice().sort(function (x, y) { return y.datum.localeCompare(x.datum); }).forEach(function (x) {
      (x.nederlanders || []).forEach(function (p) { if (regels.length < n) regels.push(lijstRegel("#mensen?id=" + p.id, esc(p.naam) + " <small>(" + esc(p.partij) + ")</small>", "<span>" + kort(x.datum) + "</span><span>" + esc(x.titel) + "</span>")); });
    });
    return ovBlok("Nederlanders in debatten", "#agenda", regels, "Geen Nederlandse sprekers in de laatste zittingen.");
  }
  if (b.id === "recent") {
    if (!RECENT.length) return "";
    return '<h2>Recent gezocht</h2><div class="kaart lijstkaart">' + RECENT.slice(0, n).map(function (q) { return '<button type="button" class="recent-rij" data-voorstel="' + esc(q) + '" data-veld="ov-zoek"><span class="klokje" aria-hidden="true">🕘</span>' + esc(q) + "</button>"; }).join("") + "</div>";
  }
  return "";
}
function overzichtTonen() {
  if (!OV_DATA) return;
  var h = INST.overzicht.filter(function (b) { return b.aan; }).map(function (b) { return ovBlokHtml(b, OV_DATA); }).join("");
  var doel = document.getElementById("ov-data");
  doel.innerHTML = h || '<p class="leeg">Alle blokken staan uit. Tik rechtsboven op Wijzig om er een paar aan te zetten.</p>';
  window.euMarkeer(doel);
}
function overzichtTab() {
  var doel = document.getElementById("ov-data");
  bezig(doel);
  Promise.all([laden("dossiers-kort"), agendaLaden(), laden("stemmen")]).then(function (r) {
    OV_DATA = { dossiers: r[0], agenda: AGENDA, stemmen: r[2], debatten: DEBATTEN };
    overzichtTonen();
  }).catch(function () { laadFout(doel); });
}

// ---------- het overzicht inrichten, zoals Bediening in iOS ----------
// Twee groepen: wat op het overzicht staat (rood min = weghalen, ≡ = slepen) en de andere
// blokken (groen plus = toevoegen). Tik op een blok voor het aantal regels en een filter.
function blokVan(id) { return INST.overzicht.filter(function (b) { return b.id === id; })[0]; }
function bewerkRij(b) {
  var opties = b.id !== "recent" && b.id !== "persberichten" && b.id !== "stemmen" && b.id !== "vandaag" && b.id !== "mensen";
  return '<li data-id="' + b.id + '" class="' + (b.aan ? "aan" : "uit") + '">'
    + '<button type="button" class="pm ' + (b.aan ? "min" : "plus") + '" data-pm aria-label="' + (b.aan ? "Weghalen" : "Toevoegen") + '"><span></span></button>'
    + '<button type="button" class="bewerk-naam" data-blok="' + b.id + '"><span>' + OV_NAAM[b.id] + '</span><span class="klein">' + (b.n || 3) + " regels" + (opties && blokFilterTekst(b) ? " · " + esc(blokFilterTekst(b)) : "") + '</span></button>'
    + (b.aan ? '<span class="greep" aria-label="Verslepen">≡</span>' : "") + "</li>";
}
function blokFilterTekst(b) {
  if (b.id === "agenda") return (b.wie || []).join(", ");
  if (b.id === "nieuws") return b.bron || "";
  if (b.id === "dossiers") return b.nl ? "met NL-rapporteur" : "";
  return "";
}
function bewerkHtml() {
  var aan = INST.overzicht.filter(function (b) { return b.aan; }), uit = INST.overzicht.filter(function (b) { return !b.aan; });
  return '<p class="klein inst-voet">Het zoekveld staat altijd bovenaan. Sleep met ≡ om de volgorde te wijzigen; tik op een blok voor het aantal regels en een filter.</p>'
    + '<h4 class="groepkop">Op het overzicht</h4><ul class="bewerk" id="ov-bewerk">' + aan.map(bewerkRij).join("") + "</ul>"
    + (uit.length ? '<h4 class="groepkop">Meer blokken</h4><ul class="bewerk" id="ov-meer">' + uit.map(bewerkRij).join("") + "</ul>" : "")
    + '<button class="knop tweede breed" type="button" id="ov-standaard">Standaardindeling</button>';
}
function blokHtmlOpties(b) {
  function vink(aan) { return '<span class="vink' + (aan ? " aan" : "") + '">✓</span>'; }
  var h = '<h4 class="groepkop">Regels</h4><div class="inst-lijst">' + [3, 5, 10].map(function (n) { return '<button type="button" class="inst-rij" data-blok-n="' + n + '"><span class="inst-label">' + n + " regels</span>" + vink((b.n || 3) === n) + "</button>"; }).join("") + "</div>";
  if (b.id === "agenda") h += '<h4 class="groepkop">Alleen van</h4><div class="inst-lijst"><button type="button" class="inst-rij" data-blok-wie=""><span class="inst-label">Alle</span>' + vink(!(b.wie || []).length) + "</button>"
    + WIE.map(function (w) { return '<button type="button" class="inst-rij" data-blok-wie="' + esc(w) + '"><span class="inst-label">' + esc(w) + "</span>" + vink((b.wie || []).indexOf(w) >= 0) + "</button>"; }).join("") + "</div>";
  if (b.id === "nieuws") {
    var bronnen = {}; alle("#kanaal-media li.bericht").forEach(function (li) { bronnen[li.dataset.bron] = 1; });
    h += '<h4 class="groepkop">Bron</h4><div class="inst-lijst"><button type="button" class="inst-rij" data-blok-bron=""><span class="inst-label">Alle bronnen</span>' + vink(!b.bron) + "</button>"
      + Object.keys(bronnen).sort().map(function (x) { return '<button type="button" class="inst-rij" data-blok-bron="' + esc(x) + '"><span class="inst-label">' + esc(x) + "</span>" + vink(b.bron === x) + "</button>"; }).join("") + "</div>";
  }
  if (b.id === "dossiers") h += '<h4 class="groepkop">Filter</h4><div class="inst-lijst"><button type="button" class="inst-rij" data-blok-nl><span class="inst-label">Alleen met Nederlandse (schaduw)rapporteur</span>' + vink(b.nl) + "</button></div>";
  return '<div data-blok-pagina="' + b.id + '">' + h + "</div>";
}
function bewerkVernieuw() {
  var el = document.getElementById("ov-bewerk-wrap");
  if (el) { el.innerHTML = bewerkHtml(); }
}
function openBewerk(dieper) {
  openPaneel("Overzicht inrichten", '<div id="ov-bewerk-wrap">' + bewerkHtml() + "</div>", { dieper: dieper });
}
function bewaarOverzicht() { bewaarInst(); overzichtTonen(); }
paneelLijf.addEventListener("click", function (ev) {
  var t = ev.target;
  if (!t.closest) return;
  var pm = t.closest("[data-pm]");
  if (pm) {
    var b = blokVan(pm.closest("li").dataset.id);
    b.aan = !b.aan;
    // naar het einde van de groep waar het nu in komt
    INST.overzicht.splice(INST.overzicht.indexOf(b), 1);
    var laatsteAan = -1; INST.overzicht.forEach(function (x, i) { if (x.aan) laatsteAan = i; });
    INST.overzicht.splice(b.aan ? laatsteAan + 1 : INST.overzicht.length, 0, b);
    bewaarOverzicht(); bewerkVernieuw(); return;
  }
  var naam = t.closest("[data-blok]");
  if (naam && document.getElementById("ov-bewerk-wrap")) {
    var b2 = blokVan(naam.dataset.blok);
    openPaneel(OV_NAAM[b2.id], blokHtmlOpties(b2), { dieper: true });
    stapel[stapel.length - 1].terug = bewerkVernieuw;
    return;
  }
  var pag = t.closest("[data-blok-pagina]");
  if (pag) {
    var b3 = blokVan(pag.dataset.blokPagina), k;
    if ((k = t.closest("[data-blok-n]"))) b3.n = +k.dataset.blokN;
    else if ((k = t.closest("[data-blok-wie]"))) { var w = k.dataset.blokWie; b3.wie = b3.wie || []; if (!w) b3.wie = []; else { var i = b3.wie.indexOf(w); if (i >= 0) b3.wie.splice(i, 1); else b3.wie.push(w); } }
    else if ((k = t.closest("[data-blok-bron]"))) b3.bron = k.dataset.blokBron;
    else if ((k = t.closest("[data-blok-nl]"))) b3.nl = !b3.nl;
    else return;
    bewaarOverzicht();
    pag.outerHTML = blokHtmlOpties(b3);
    return;
  }
  if (t.closest("#ov-standaard")) { INST.overzicht = JSON.parse(JSON.stringify(STANDAARD.overzicht)); bewaarOverzicht(); bewerkVernieuw(); }
});
// slepen met de greep (vinger en muis); de andere blokken schuiven soepel opzij
(function () {
  var sleep = null;
  paneelLijf.addEventListener("pointerdown", function (ev) {
    var g = ev.target.closest && ev.target.closest("#ov-bewerk .greep");
    if (!g) return;
    ev.preventDefault();
    var li = g.closest("li");
    sleep = { li: li, id: ev.pointerId, lijst: li.parentNode, y0: ev.clientY, top: li.getBoundingClientRect().top };
    li.classList.add("sleept");
    try { g.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  paneelLijf.addEventListener("pointermove", function (ev) {
    if (!sleep || ev.pointerId !== sleep.id) return;
    ev.preventDefault();
    var y = ev.clientY, lijst = sleep.lijst;
    var andere = alle("li", lijst).filter(function (x) { return x !== sleep.li; });
    var voor = andere.filter(function (x) { var r = x.getBoundingClientRect(); return y < r.top + r.height / 2; })[0];
    var eerst = {}; alle("li", lijst).forEach(function (x) { eerst[x.dataset.id] = x.getBoundingClientRect().top; });
    if (voor) { if (sleep.li.nextElementSibling !== voor) lijst.insertBefore(sleep.li, voor); }
    else if (lijst.lastElementChild !== sleep.li) lijst.appendChild(sleep.li);
    // FLIP: verschoven rijen glijden naar hun nieuwe plek
    alle("li", lijst).forEach(function (x) {
      if (x === sleep.li || MINDER_BEWEGING) return;
      var d = eerst[x.dataset.id] - x.getBoundingClientRect().top;
      if (d) { x.style.transition = "none"; x.style.transform = "translateY(" + d + "px)"; x.offsetWidth; x.style.transition = "transform .2s ease"; x.style.transform = ""; }
    });
    sleep.li.style.transform = "translateY(" + (y - sleep.y0 - (sleep.li.getBoundingClientRect().top - sleep.top - (parseFloat((sleep.li.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0))) + "px)";
  });
  function los(ev) {
    if (!sleep || (ev && ev.pointerId !== sleep.id)) return;
    var li = sleep.li, lijst = sleep.lijst;
    sleep = null;
    li.classList.remove("sleept"); li.style.transform = "";
    var volgorde = alle("li", lijst).map(function (x) { return x.dataset.id; });
    INST.overzicht.sort(function (x, y) {
      var a1 = volgorde.indexOf(x.id), b1 = volgorde.indexOf(y.id);
      if (a1 < 0 && b1 < 0) return 0; if (a1 < 0) return 1; if (b1 < 0) return -1; return a1 - b1;
    });
    bewaarOverzicht();
  }
  paneelLijf.addEventListener("pointerup", los); paneelLijf.addEventListener("pointercancel", los);
})();
document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("#ov-wijzig")) { ev.preventDefault(); openBewerk(); } });

// ---------- recente zoekopdrachten in het zoekveld (zoals Safari) ----------
(function () {
  var veld = document.getElementById("ov-zoek"), lijst = document.getElementById("ov-recent");
  if (!veld || !lijst) return;
  function teken() {
    var toon = document.activeElement === veld && !veld.value.trim() && RECENT.length;
    lijst.classList.toggle("verborgen", !toon);
    if (!toon) return;
    lijst.innerHTML = '<div class="recent-kop"><span>Recent gezocht</span><button type="button" class="linkknop" data-recent-wis>Wis</button></div>'
      + RECENT.slice(0, 8).map(function (q) { return '<div class="recent-rij-wrap" data-q="' + esc(q) + '"><button type="button" class="recent-rij" data-recent="' + esc(q) + '"><span class="klokje" aria-hidden="true">🕘</span>' + esc(q) + '</button><button type="button" class="recent-weg" data-recent-weg="' + esc(q) + '">Verwijder</button></div>'; }).join("");
  }
  veld.addEventListener("focus", teken);
  veld.addEventListener("input", teken);
  veld.addEventListener("blur", function () { setTimeout(function () { if (document.activeElement !== veld) lijst.classList.add("verborgen"); }, 200); });
  lijst.addEventListener("pointerdown", function (ev) { ev.preventDefault(); });   // veld blijft actief
  lijst.addEventListener("click", function (ev) {
    var t = ev.target;
    var r = t.closest("[data-recent]");
    if (r) { veld.value = r.dataset.recent; veld.dispatchEvent(new Event("input", { bubbles: true })); lijst.classList.add("verborgen"); return; }
    var w = t.closest("[data-recent-weg]");
    if (w) { RECENT = RECENT.filter(function (x) { return x !== w.dataset.recentWeg; }); bewaar("eu-recent", JSON.stringify(RECENT)); teken(); overzichtTonen(); return; }
    if (t.closest("[data-recent-wis]") && confirm("Recente zoekopdrachten wissen?")) { RECENT = []; bewaar("eu-recent", "[]"); teken(); overzichtTonen(); }
  });
  // veeg een regel naar links om hem weg te halen
  var veeg = null;
  lijst.addEventListener("touchstart", function (ev) { var w = ev.target.closest(".recent-rij-wrap"); if (w) veeg = { w: w, x: ev.touches[0].clientX }; }, { passive: true });
  lijst.addEventListener("touchmove", function (ev) { if (!veeg) return; var dx = Math.min(0, ev.touches[0].clientX - veeg.x); veeg.w.querySelector(".recent-rij").style.transform = "translateX(" + Math.max(dx, -96) + "px)"; veeg.dx = dx; }, { passive: true });
  lijst.addEventListener("touchend", function () {
    if (!veeg) return;
    var r = veeg.w.querySelector(".recent-rij");
    r.style.transform = (veeg.dx || 0) < -50 ? "translateX(-96px)" : "";
    veeg.w.classList.toggle("open", (veeg.dx || 0) < -50);
    veeg = null;
  });
})();

// ---------- zoeken over alles ----------
var zoekOnthoud = null;
function zoekAlles(q) {
  var doel = document.getElementById("ov-resultaten"), blokken = document.getElementById("ov-data");
  q = q.trim();
  if (normaal(q).length < 2) { clearTimeout(zoekOnthoud); overzichtTonen(); bedoelJe("ov-zoek", null); doel.innerHTML = ""; doel.classList.add("verborgen"); blokken.classList.remove("verborgen"); return; }
  blokken.classList.add("verborgen");
  Promise.all([laden("agenda"), laden("dossiers-kort"), laden("stemmen"), laden("debatten"), mensenLaden(), laden("commissie")]).then(function (r) {
    function blok(titel, items, link) {
      return items.length ? '<div class="kop-met-link"><h2>' + titel + ' <small>' + items.length + "</small></h2>" + (link ? '<a href="' + link + '">Alles ›</a>' : "") + '</div><div class="kaart"><ul class="lijst">' + items.slice(0, 5).join("") + "</ul></div>" : "";
    }
    var z = zoeker(q);
    function zoek(lijst, tekst) { return z.ordenen(lijst.filter(function (x) { return z.past(tekst(x), x); })); }
    function nieuws(sel) {
      return zoek(alle(sel + " li.bericht"), function (li) { return li.textContent + " " + (li.dataset.bron || ""); })
        .map(function (li) { return lijstRegel(li.querySelector("a").href, esc(li.querySelector("h3").textContent), "<span>" + esc(li.dataset.bron) + "</span><span>" + esc(li.dataset.tijd || "") + "</span>", true); });
    }
    var ag = zoek(r[0].items, agendaTekst)
      .map(function (i) { return lijstRegel("#agenda?item=" + i.id, esc(i.titel), "<span>" + esc(lang(i.datum)) + (tijdTekst(i) ? " · " + tijdTekst(i) : "") + "</span>" + watLabel(i)); });
    var db = zoek(r[3].debatten, function (x) { return x.titel; })
      .map(function (x) { return lijstRegel(x.verslag, esc(x.titel), "<span>debat " + kort(x.datum) + "</span>", true); });
    var d = zoek(r[1], function (x) { return x.ref + " " + x.titel + " " + x.zoek; })
      .map(function (x) { return lijstRegel("#dossiers?open=" + encodeURIComponent(x.ref), esc(x.titel), "<span>" + esc(x.ref) + "</span><span>" + esc(x.status) + "</span>"); });
    var s = zoek(r[2].stemmen, function (x) { return x.titel + " " + (x.procedure || ""); })
      .map(function (x) { return lijstRegel("#stemmingen?id=" + x.id, esc(x.titel), uitslag(x.uitslag) + "<span>" + kort(x.moment) + "</span>"); });
    var m = zoek(r[4], function (p) { return p.naam + " " + p.partij + " " + landNaam(p.land); })
      .map(function (p) { return lijstRegel("#mensen?id=" + p.id, esc(p.naam), "<span>" + esc(p.partij || "") + "</span><span>" + esc(p.fractie || "") + "</span>"); });
    var cp = zoek(r[5].items, function (x) { return x.titel + " " + x.titel_en + " " + x.dg; })
      .map(function (x) { return lijstRegel(x.url, esc(x.titel), '<span class="label soort-commissie">' + esc(x.soort_naam) + "</span><span>" + KW[x.kwartaal] + " kwartaal " + x.jaar + "</span>", true); });
    var h = blok("Agenda", ag, "#agenda") + blok("Planning van de Commissie", cp, "#agenda") + blok("Debatten", db, "#agenda") + blok("Nieuws uit de media", nieuws("#kanaal-media"), "#nieuws")
      + blok("Persberichten", nieuws("#kanaal-officieel"), "#nieuws") + blok("Dossiers", d, "#dossiers?q=" + encodeURIComponent(q))
      + blok("Stemmingen", s, "#stemmingen") + blok("Mensen", m, "#mensen");
    doel.innerHTML = h || '<p class="leeg">Niets gevonden voor “' + esc(q) + "”. Probeer minder woorden, of een Engels woord: veel titels van dossiers zijn Engels.</p>";
    if (h) { clearTimeout(zoekOnthoud); zoekOnthoud = setTimeout(function () { onthoudZoek(q); }, 1500); }
    bedoelJe("ov-zoek", z);
    doel.classList.remove("verborgen");
  }).catch(function () { laadFout(doel); doel.classList.remove("verborgen"); });
}
(function () {
  var veld = document.getElementById("ov-zoek"), wacht = null;
  if (veld) veld.addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { zoekAlles(ev.target.value); }, 250); });
})();

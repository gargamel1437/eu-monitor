// =====================================================================
//  overzicht.js: de tab Zoek. Bovenaan zoeken in alles; daaronder widgets zoals op het
//  beginscherm van de iPhone: Agenda (met vandaag), Pers, Dossiers, Stemmen, en naar keuze
//  Persberichten en Personen. Elke widget heeft een maat: klein (half breed), middel of groot.
//  Aanpassen: houd een widget even vast (of tik op Wijzig). De widgets wiebelen; sleep om de
//  volgorde te wijzigen, tik op het min-teken om weg te halen, tik op een widget voor de maat,
//  + om er een toe te voegen, Klaar om te stoppen. Geen scherm dat inschuift.
// =====================================================================

function lijstRegel(href, titel, meta, extern) {
  return '<li><a href="' + esc(href) + '"' + (extern ? ' target="_blank" rel="noopener"' : "") + '><div class="regel">' + titel + '</div><div class="meta2">' + meta + "</div></a></li>";
}
var WIDGETS = {
  agenda: { naam: "Agenda", tab: "#agenda", kleur: "ep", ik: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>' },
  pers: { naam: "Pers", tab: "#nieuws", kleur: "int", ik: '<path d="M5 5h11v14H7a2 2 0 0 1-2-2z"/><path d="M16 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/>' },
  persberichten: { naam: "Persberichten", tab: "#nieuws", kleur: "com", ik: '<path d="M4 9h3l7-4v14l-7-4H4z"/><path d="M18 9a4 4 0 0 1 0 6"/>' },
  dossiers: { naam: "Dossiers", tab: "#dossiers", kleur: "ep", ik: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>' },
  stemmen: { naam: "Stemmen", tab: "#stemmingen", kleur: "ep", ik: '<path d="M5 20V10M12 20V5M19 20v-7"/><path d="M3 20h18"/>' },
  personen: { naam: "Personen", tab: "#mensen", kleur: "ep", ik: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>' }
};
var MAAT_REGELS = { k: 1, m: 3, g: 7 };
var OV_DATA = null;
function nieuwsItems(sel) {
  return alle(sel + " li.bericht").filter(function (li) { return INST.bronnenUit.indexOf(li.dataset.bron) < 0 && (INST.engels || li.dataset.taal !== "en"); });
}
function nieuwsRegel(li, klein) {
  var titel = esc(li.querySelector("h3").textContent), bronnen = (li.dataset.bronnen || li.dataset.bron).split("|");
  var meta = "<span>" + esc(bronnen.length > 1 ? bronnen.length + " bronnen" : li.dataset.bron) + "</span><span>" + esc(li.dataset.tijd || "") + "</span>";
  var a = li.querySelector("a");
  if (bronnen.length > 1 || !a) return '<li><a href="#nieuws" data-verhaal-van="' + alle("li.bericht").indexOf(li) + '"><div class="regel">' + titel + '</div><div class="meta2">' + meta + "</div></a></li>";
  return lijstRegel(a.href, titel, meta, true);
}
function widgetInhoud(b) {
  var d = OV_DATA, n = MAAT_REGELS[b.maat] || 3, klein = b.maat === "k";
  if (b.id === "agenda") {
    var dag = vandaag(), nu = d.agenda.items.filter(function (i) { return loopt(i, dag) && (i.vast !== "briefing" || INST.vastePunten); });
    var later = d.agenda.items.filter(function (i) { return i.datum > dag && i.vast !== "briefing"; });
    if (klein) {
      var eerst = nu.filter(function (i) { return !i.vast; })[0] || later[0];
      return '<div class="wgroot">' + nu.length + '</div><div class="wklein">vandaag</div>' + (eerst ? '<div class="wregel k-' + kleurVan(eerst) + '"><i></i>' + esc(eerst.titel) + "</div>" : "");
    }
    var h = '<div class="wsub">Vandaag <span>' + esc(lang(dag)) + "</span></div>";
    h += nu.length ? '<ul class="lijst">' + nu.slice(0, n).map(function (i) { var t = i.vast === "briefing" ? "12:00" : tijdTekst(i); return lijstRegel("#agenda?item=" + i.id, esc(i.titel), (t ? '<span class="tijd">' + t + "</span>" : "") + watLabel(i) + (i.plaats ? "<span>" + esc(i.plaats) + "</span>" : "")); }).join("") + "</ul>" : '<p class="wleeg">Vandaag niets in de agenda.</p>';
    h += '<div class="wsub">Hierna</div><ul class="lijst">' + later.slice(0, n).map(function (i) { return lijstRegel("#agenda?item=" + i.id, esc(i.titel), "<span>" + esc(lang(i.datum)) + "</span>" + watLabel(i) + (i.plaats ? "<span>" + esc(i.plaats) + "</span>" : "")); }).join("") + "</ul>";
    return h;
  }
  if (b.id === "pers" || b.id === "persberichten") {
    var l = nieuwsItems(b.id === "pers" ? "#kanaal-media" : "#kanaal-officieel");
    if (klein) return l[0] ? '<div class="wtitel">' + esc(l[0].querySelector("h3").textContent) + '</div><div class="wklein">' + esc((l[0].dataset.bronnen || l[0].dataset.bron).split("|").length > 1 ? (l[0].dataset.bronnen.split("|").length + " bronnen") : l[0].dataset.bron) + "</div>" : '<p class="wleeg">Niets</p>';
    return '<ul class="lijst">' + l.slice(0, n).map(function (li) { return nieuwsRegel(li); }).join("") + "</ul>";
  }
  if (b.id === "dossiers") {
    var ds = d.dossiers.filter(function (x) { return x.laatst && x.laatst <= vandaag(); });
    if (klein) return ds[0] ? '<div class="wtitel">' + esc(ds[0].titel) + '</div><div class="wklein">' + kort(ds[0].laatst) + ": " + esc(ds[0].stap) + "</div>" : "";
    return '<ul class="lijst">' + ds.slice(0, n).map(function (x) { return lijstRegel("#dossiers?open=" + encodeURIComponent(x.ref), esc(x.titel), "<span>" + esc(x.ref) + "</span><span>" + kort(x.laatst) + ": " + esc(x.stap) + "</span>"); }).join("") + "</ul>";
  }
  if (b.id === "stemmen") {
    var st = d.stemmen.stemmen;
    if (klein) return st[0] ? '<div class="wtitel">' + esc(st[0].titel) + '</div><div class="wklein">' + uitslag(st[0].uitslag) + " " + (st[0].totaal.FOR || 0) + "–" + (st[0].totaal.AGAINST || 0) + "</div>" : "";
    return '<ul class="lijst">' + st.slice(0, n).map(function (s) { return lijstRegel("#stemmingen?id=" + s.id, esc(s.titel), uitslag(s.uitslag) + "<span>" + (s.totaal.FOR || 0) + " voor · " + (s.totaal.AGAINST || 0) + " tegen</span><span>" + kort(s.moment) + "</span>"); }).join("") + "</ul>";
  }
  if (b.id === "personen") {
    var regels = [];
    d.debatten.debatten.slice().sort(function (x, y) { return y.datum.localeCompare(x.datum); }).forEach(function (x) {
      (x.nederlanders || []).forEach(function (p) { regels.push([p, x]); });
    });
    if (klein) return regels[0] ? '<div class="wtitel">' + esc(regels[0][0].naam) + '</div><div class="wklein">sprak ' + kort(regels[0][1].datum) + "</div>" : "";
    return '<div class="wsub">Nederlanders in debatten</div><ul class="lijst">' + regels.slice(0, n).map(function (r) { return lijstRegel("#mensen?id=" + r[0].id, esc(r[0].naam) + " <small>(" + esc(r[0].partij) + ")</small>", "<span>" + kort(r[1].datum) + "</span><span>" + esc(r[1].titel) + "</span>"); }).join("") + "</ul>";
  }
  return "";
}
function widgetHtml(b) {
  var w = WIDGETS[b.id];
  return '<div class="widget maat-' + b.maat + " k-" + w.kleur + '" data-id="' + b.id + '">'
    + '<button type="button" class="wmin" aria-label="Widget weghalen">−</button>'
    + '<a class="wkop" href="' + w.tab + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + w.ik + "</svg><b>" + w.naam + '</b><span class="pijl">›</span></a>'
    + '<div class="winhoud">' + widgetInhoud(b) + "</div></div>";
}
function overzichtTonen() {
  if (!OV_DATA) return;
  var doel = document.getElementById("ov-data");
  var h = INST.widgets.filter(function (b) { return b.aan; }).map(widgetHtml).join("");
  doel.innerHTML = (h || '<p class="leeg">Geen widgets. Tik op Wijzig en dan op + om er een toe te voegen.</p>')
    + '<div class="wiebelbalk"><button type="button" class="wplus" id="w-plus" aria-label="Widget toevoegen">+</button><button type="button" class="knop" id="w-klaar">Klaar</button></div>';
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
// een verhaal uit de Pers-widget: dezelfde keuze van bronnen als in Pers
document.addEventListener("click", function (e) {
  var v = e.target.closest && e.target.closest("[data-verhaal-van]");
  if (!v || document.body.classList.contains("wiebelen")) return;
  e.preventDefault();
  var li = alle("li.bericht")[+v.dataset.verhaalVan];
  if (li && li.dataset.verhaal) openPaneel("Verhaal", verhaalDetail(li));
});

// ---------- aanpassen zoals widgets op de iPhone ----------
(function () {
  var data = document.getElementById("ov-data");
  function aan() { document.body.classList.add("wiebelen"); }
  function uit() { document.body.classList.remove("wiebelen"); sluitWMenu(); }
  function bewaarW() { bewaarInst(); }
  document.getElementById("ov-wijzig").addEventListener("click", function () { if (document.body.classList.contains("wiebelen")) uit(); else aan(); });
  // lang indrukken op een widget = aanpassen
  var houd = null, start = null;
  data.addEventListener("pointerdown", function (e) {
    var w = e.target.closest(".widget");
    if (!w) return;
    start = { x: e.clientX, y: e.clientY, w: w, id: e.pointerId, sleept: false };
    if (!document.body.classList.contains("wiebelen")) {
      clearTimeout(houd);
      houd = setTimeout(function () { aan(); if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) {} start = null; }, 520);
    }
  });
  data.addEventListener("pointermove", function (e) {
    if (!start) return;
    var dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!document.body.classList.contains("wiebelen")) { if (Math.abs(dx) + Math.abs(dy) > 8) { clearTimeout(houd); start = null; } return; }
    // slepen in de aanpasmodus
    if (!start.sleept && Math.abs(dx) + Math.abs(dy) > 8) {
      start.sleept = true; start.w.classList.add("sleept"); sluitWMenu();
      try { start.w.setPointerCapture(start.id); } catch (x) {}
    }
    if (!start.sleept) return;
    e.preventDefault();
    start.w.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.04)";
    start.w.style.pointerEvents = "none";
    var onder = document.elementFromPoint(e.clientX, e.clientY);
    var doel = onder && onder.closest && onder.closest(".widget");
    start.w.style.pointerEvents = "";
    if (doel && doel !== start.w) {
      var r = doel.getBoundingClientRect(), voor = e.clientY < r.top + r.height / 2 || (e.clientX < r.left + r.width / 2 && Math.abs(e.clientY - (r.top + r.height / 2)) < r.height / 3);
      var oud = start.w.getBoundingClientRect();
      data.insertBefore(start.w, voor ? doel : doel.nextSibling);
      var nieuw = start.w.getBoundingClientRect();
      start.x += nieuw.left - oud.left; start.y += nieuw.top - oud.top;
      start.w.style.transform = "translate(" + (e.clientX - start.x) + "px," + (e.clientY - start.y) + "px) scale(1.04)";
    }
  });
  function los() {
    clearTimeout(houd);
    if (start && start.sleept) {
      start.w.classList.remove("sleept"); start.w.style.transform = "";
      var volgorde = alle(".widget", data).map(function (w) { return w.dataset.id; });
      INST.widgets.sort(function (a, b) { var x = volgorde.indexOf(a.id), y = volgorde.indexOf(b.id); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
      bewaarW();
      start.w.dataset.netGesleept = "1";
    }
    start = null;
  }
  data.addEventListener("pointerup", los); data.addEventListener("pointercancel", los);
  // in de aanpasmodus: tikken doet aanpassen, geen links volgen
  data.addEventListener("click", function (e) {
    if (!document.body.classList.contains("wiebelen")) return;
    var w = e.target.closest(".widget");
    if (e.target.closest("#w-klaar")) { uit(); return; }
    if (e.target.closest("#w-plus")) { e.preventDefault(); plusMenu(e.target.closest("#w-plus")); return; }
    if (!w) { if (!e.target.closest(".wmenu")) uit(); return; }
    e.preventDefault(); e.stopPropagation();
    if (w.dataset.netGesleept) { delete w.dataset.netGesleept; return; }
    var b = INST.widgets.filter(function (x) { return x.id === w.dataset.id; })[0];
    if (e.target.closest(".wmin")) { b.aan = false; bewaarW(); w.classList.add("weg"); setTimeout(overzichtTonen, 200); return; }
    maatMenu(w, b);
  }, true);
  function sluitWMenu() { var m = document.querySelector(".wmenu"); if (m) m.remove(); }
  function zetMenu(m, bij) {
    document.body.appendChild(m);
    var r = bij.getBoundingClientRect();
    m.style.left = Math.min(Math.max(10, r.left), window.innerWidth - m.offsetWidth - 10) + "px";
    m.style.top = Math.min(r.bottom + 8, window.innerHeight - m.offsetHeight - 90) + "px";
  }
  function maatMenu(w, b) {
    sluitWMenu();
    var m = document.createElement("div");
    m.className = "tokmenu wmenu";
    m.innerHTML = '<div class="wmaten">' + [["k", "Klein"], ["m", "Middel"], ["g", "Groot"]].map(function (x) {
      return '<button type="button" data-maat="' + x[0] + '" class="' + (b.maat === x[0] ? "actief" : "") + '"><span class="wvoorbeeld v-' + x[0] + '"></span>' + x[1] + "</button>";
    }).join("") + '</div><button type="button" data-weg>Widget weghalen</button>';
    zetMenu(m, w);
    m.onclick = function (e) {
      var k = e.target.closest("[data-maat]");
      if (k) { b.maat = k.dataset.maat; bewaarW(); sluitWMenu(); overzichtTonen(); return; }
      if (e.target.closest("[data-weg]")) { b.aan = false; bewaarW(); sluitWMenu(); overzichtTonen(); }
    };
  }
  function plusMenu(knop) {
    sluitWMenu();
    var uitstaand = INST.widgets.filter(function (b) { return !b.aan; });
    var m = document.createElement("div");
    m.className = "tokmenu wmenu";
    m.innerHTML = uitstaand.length ? uitstaand.map(function (b) { return '<button type="button" data-plus="' + b.id + '">' + WIDGETS[b.id].naam + "</button>"; }).join("") : '<button type="button" disabled>Alle widgets staan er al</button>';
    zetMenu(m, knop);
    m.onclick = function (e) {
      var k = e.target.closest("[data-plus]");
      if (!k) return;
      var b = INST.widgets.filter(function (x) { return x.id === k.dataset.plus; })[0];
      b.aan = true;
      INST.widgets.splice(INST.widgets.indexOf(b), 1); INST.widgets.unshift(b);
      bewaarW(); sluitWMenu(); overzichtTonen();
    };
  }
  document.addEventListener("pointerdown", function (e) { if (!e.target.closest(".wmenu") && !e.target.closest(".widget") && !e.target.closest("#w-plus")) sluitWMenu(); });
  document.addEventListener("eu-tab", function (e) { if (e.detail !== "overzicht") uit(); });
})();

// ---------- zoeken over alles ----------
var zoekOnthoud = null;
function zoekAlles(q) {
  var doel = document.getElementById("ov-resultaten"), blokken = document.getElementById("ov-data");
  q = q.trim();
  if (normaal(q).length < 2) { clearTimeout(zoekOnthoud); overzichtTonen(); bedoelJe("ov-zoek", null); doel.innerHTML = ""; doel.classList.add("verborgen"); blokken.classList.remove("verborgen"); return; }
  blokken.classList.add("verborgen");
  Promise.all([agendaLaden(), laden("dossiers-kort"), laden("stemmen"), laden("debatten"), mensenLaden(), laden("commissie")]).then(function (r) {
    function blok(titel, items, link) {
      return items.length ? '<div class="kop-met-link"><h2>' + titel + ' <small>' + items.length + "</small></h2>" + (link ? '<a href="' + link + '">Alles ›</a>' : "") + '</div><div class="kaart"><ul class="lijst">' + items.slice(0, 5).join("") + "</ul></div>" : "";
    }
    var z = zoeker(q);
    function zoek(lijst, tekst) { return z.ordenen(lijst.filter(function (x) { return z.past(tekst(x), x); })); }
    function nieuws(sel) { return zoek(alle(sel + " li.bericht"), function (li) { return li.textContent + " " + (li.dataset.bronnen || li.dataset.bron || ""); }).map(function (li) { return nieuwsRegel(li); }); }
    var ag = zoek(alleAgenda(), agendaTekst)
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
      .map(function (x) { return lijstRegel(x.url, esc(x.titel), '<span class="label wie k-com">' + esc(x.soort_naam) + "</span><span>" + KW[x.kwartaal] + " kwartaal " + x.jaar + "</span>", true); });
    var h = blok("Agenda", ag, "#agenda") + blok("Pers", nieuws("#kanaal-media"), "#nieuws") + blok("Persberichten", nieuws("#kanaal-officieel"), "#nieuws")
      + blok("Dossiers", d, "#dossiers?q=" + encodeURIComponent(q)) + blok("Stemmingen", s, "#stemmingen") + blok("Personen", m, "#mensen")
      + blok("Debatten", db, "") + blok("Gepland door de Commissie", cp, "");
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

// ---------- recente zoekopdrachten in het zoekveld (zoals Safari) ----------
var KLOK = '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
(function () {
  var veld = document.getElementById("ov-zoek"), lijst = document.getElementById("ov-recent");
  if (!veld || !lijst) return;
  var vraagt = false;
  function teken() {
    var toon = document.activeElement === veld && !veld.value.trim() && RECENT.length;
    lijst.classList.toggle("verborgen", !toon);
    if (!toon) return;
    lijst.innerHTML = '<div class="recent-kop"><span>Recent gezocht</span>'
      + (vraagt ? '<span class="recent-vraag">Alles wissen? <button type="button" class="linkknop rood" data-recent-ja>Wis</button><button type="button" class="linkknop" data-recent-nee>Annuleer</button></span>' : '<button type="button" class="linkknop" data-recent-wis>Wis</button>') + "</div>"
      + RECENT.slice(0, 8).map(function (q) { return '<div class="recent-rij-wrap" data-q="' + esc(q) + '"><button type="button" class="recent-rij" data-recent="' + esc(q) + '">' + KLOK + esc(q) + '</button><button type="button" class="recent-weg" data-recent-weg="' + esc(q) + '">Verwijder</button></div>'; }).join("");
  }
  veld.addEventListener("focus", teken);
  veld.addEventListener("input", teken);
  veld.addEventListener("blur", function () { setTimeout(function () { if (document.activeElement !== veld) { lijst.classList.add("verborgen"); vraagt = false; } }, 200); });
  lijst.addEventListener("pointerdown", function (ev) { ev.preventDefault(); });
  lijst.addEventListener("click", function (ev) {
    var t = ev.target;
    var r = t.closest("[data-recent]");
    if (r) { veld.value = r.dataset.recent; veld.dispatchEvent(new Event("input", { bubbles: true })); lijst.classList.add("verborgen"); return; }
    var w = t.closest("[data-recent-weg]");
    if (w) { RECENT = RECENT.filter(function (x) { return x !== w.dataset.recentWeg; }); bewaar("eu-recent", JSON.stringify(RECENT)); teken(); return; }
    // wissen vraagt eerst om bevestiging, in de lijst zelf
    if (t.closest("[data-recent-wis]")) { vraagt = true; teken(); return; }
    if (t.closest("[data-recent-nee]")) { vraagt = false; teken(); return; }
    if (t.closest("[data-recent-ja]")) { RECENT = []; bewaar("eu-recent", "[]"); vraagt = false; teken(); }
  });
  var veeg = null;
  lijst.addEventListener("touchstart", function (ev) { var w = ev.target.closest(".recent-rij-wrap"); if (w) veeg = { w: w, x: ev.touches[0].clientX }; }, { passive: true });
  lijst.addEventListener("touchmove", function (ev) { if (!veeg) return; var dx = Math.min(0, ev.touches[0].clientX - veeg.x); veeg.w.querySelector(".recent-rij").style.transform = "translateX(" + Math.max(dx, -96) + "px)"; veeg.dx = dx; }, { passive: true });
  lijst.addEventListener("touchend", function () {
    if (!veeg) return;
    var r = veeg.w.querySelector(".recent-rij");
    r.style.transform = (veeg.dx || 0) < -50 ? "translateX(-96px)" : "";
    veeg = null;
  });
})();

// =====================================================================
//  overzicht.js: de tab Zoek. Bovenaan zoeken in alles; daaronder widgets zoals op het
//  beginscherm van de iPhone: Agenda (met vandaag), Pers, Dossiers, Stemmen, en naar keuze
//  Persberichten en Personen. Elke widget heeft een maat: klein (half breed), middel of groot.
//  Aanpassen: tik op Wijzig (rechtsboven) of houd een widget even vast. Dan: kort vasthouden en
//  slepen = verplaatsen (de pagina scrolt pas mee als je de widget tegen de rand van het scherm
//  sleept), min-teken = weghalen, tikken = maat kiezen, + = toevoegen, Klaar = stoppen.
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
    h += nu.length ? '<ul class="lijst">' + nu.slice(0, n).map(function (i) { var t = i.vast === "briefing" ? "12:00" : tijdTekst(i); return lijstRegel("#agenda?item=" + i.id, esc(i.titel), watLabel(i) + (i.plaats ? "<span>" + esc(i.plaats) + "</span>" : "") + (t ? '<span class="tijd">' + t + "</span>" : "")); }).join("") + "</ul>" : '<p class="wleeg">Vandaag niets in de agenda.</p>';
    h += '<div class="wsub">Hierna</div><ul class="lijst">' + later.slice(0, n).map(function (i) { return lijstRegel("#agenda?item=" + i.id, esc(i.titel), watLabel(i) + (i.plaats ? "<span>" + esc(i.plaats) + "</span>" : "") + "<span>" + esc(lang(i.datum)) + "</span>"); }).join("") + "</ul>";
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
  doel.innerHTML = h || '<p class="leeg">Geen widgets. Tik op Wijzig en dan op + om er een toe te voegen.</p>';
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
  if (!v || document.body.classList.contains("bewerken")) return;
  e.preventDefault();
  var li = alle("li.bericht")[+v.dataset.verhaalVan];
  if (li && li.dataset.verhaal) openPaneel("Verhaal", verhaalDetail(li), { vol: true });
});

// ---------- aanpassen zoals widgets op de iPhone ----------
// Slepen werkt met aanraken (touch) en met de muis. Op een telefoon: eerst kort vasthouden, dan
// slepen; zolang je niet vasthoudt, scrolt de pagina gewoon. Tijdens het slepen scrolt de pagina
// alleen als je vinger bij de boven- of onderrand komt, sneller naarmate je dieper in die rand zit.
(function () {
  // Wijzig staat onder de widgets; tijdens het bewerken staan daar Widget toevoegen en Klaar,
  // en Klaar ook rechtsboven (dan hoef je niet eerst naar beneden).
  var data = document.getElementById("ov-data"), knop = document.getElementById("ov-wijzig"), plus = document.getElementById("w-plus");
  var klaar = [document.getElementById("ov-klaar"), document.getElementById("ov-klaar-kop")];
  function bewerkt() { return document.body.classList.contains("bewerken"); }
  function aan() { document.body.classList.add("bewerken"); knop.hidden = true; plus.hidden = false; klaar.forEach(function (k) { k.hidden = false; }); }
  function uit() { document.body.classList.remove("bewerken"); knop.hidden = false; plus.hidden = true; klaar.forEach(function (k) { k.hidden = true; }); sluitWMenu(); }
  knop.addEventListener("click", aan);
  klaar.forEach(function (k) { k.addEventListener("click", uit); });
  plus.addEventListener("click", function (e) { e.stopPropagation(); plusMenu(plus); });

  var s = null, raf = 0, vinger = { x: 0, y: 0 }, rustTot = 0, RAND = 64;
  function tril() { if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) {} }
  function begin(w, x, y, touch) {
    annuleer();
    s = { w: w, x0: x, y0: y, touch: touch, klaar: false, sleept: false };
    vinger.x = x; vinger.y = y;
    if (!touch && bewerkt()) { s.klaar = true; return; }          // muis in de aanpasmodus: meteen
    s.timer = setTimeout(function () {
      if (!s) return;
      if (!bewerkt()) aan();
      s.klaar = true; tril();
      if (touch) optillen();
    }, bewerkt() ? 250 : 450);
  }
  function annuleer() { if (s) clearTimeout(s.timer); s = null; cancelAnimationFrame(raf); }
  function bewogen() { return Math.abs(vinger.x - s.x0) + Math.abs(vinger.y - s.y0); }
  function optillen() {
    sluitWMenu();
    var r = s.w.getBoundingClientRect();
    s.gx = vinger.x - r.left; s.gy = vinger.y - r.top;
    s.sleept = true;
    s.w.classList.add("sleept");
    document.body.classList.add("tilt");
    plaats();
    raf = requestAnimationFrame(randScroll);
  }
  // de widget onder de vinger houden (ook als de pagina scrolt of de volgorde verandert)
  function plaats() {
    var b = data.getBoundingClientRect();
    s.w.style.transform = "translate(" + (vinger.x - s.gx - b.left - s.w.offsetLeft) + "px," + (vinger.y - s.gy - b.top - s.w.offsetTop) + "px) scale(var(--til, 1))";
  }
  // de andere widgets schuiven met een animatie naar hun nieuwe plek
  function verschuif(doe) {
    var andere = alle(".widget", data).filter(function (x) { return x !== s.w; });
    var voor = andere.map(function (x) { return x.getBoundingClientRect(); });
    doe();
    andere.forEach(function (x, i) {
      var na = x.getBoundingClientRect(), dx = voor[i].left - na.left, dy = voor[i].top - na.top;
      if (!dx && !dy) return;
      x.style.transition = "none"; x.style.transform = "translate(" + dx + "px," + dy + "px)";
      x.offsetWidth;
      x.style.transition = "transform .26s cubic-bezier(.2,.9,.3,1)"; x.style.transform = "";
    });
    plaats();
  }
  function herschik() {
    if (performance.now() < rustTot) return;
    var onder = document.elementFromPoint(vinger.x, vinger.y);
    var doel = onder && onder.closest && onder.closest(".widget");
    if (!doel || doel === s.w || doel.parentNode !== data) return;
    var r = doel.getBoundingClientRect(), naW = s.w.compareDocumentPosition(doel) & Node.DOCUMENT_POSITION_FOLLOWING;
    var klein = doel.classList.contains("maat-k") && s.w.classList.contains("maat-k") && Math.abs(r.top - s.w.offsetTop - data.getBoundingClientRect().top) < 10;
    var voorbij = klein ? (naW ? vinger.x > r.left + r.width / 2 : vinger.x < r.left + r.width / 2)
      : (naW ? vinger.y > r.top + r.height / 2 : vinger.y < r.top + r.height / 2);
    if (!voorbij) return;
    verschuif(function () { data.insertBefore(s.w, naW ? doel.nextSibling : doel); });
    rustTot = performance.now() + 200;
  }
  function randScroll() {
    if (!s || !s.sleept) return;
    var boven = 56, onder = window.innerHeight - 96, v = 0;
    if (vinger.y < boven + RAND) v = -Math.min(16, (boven + RAND - vinger.y) / 4);
    else if (vinger.y > onder - RAND) v = Math.min(16, (vinger.y - onder + RAND) / 4);
    if (v) { var y0 = window.scrollY; window.scrollBy(0, v); if (window.scrollY !== y0) { plaats(); herschik(); } }
    raf = requestAnimationFrame(randScroll);
  }
  function eind() {
    if (!s) return;
    clearTimeout(s.timer); cancelAnimationFrame(raf);
    var w = s.w, gesleept = s.sleept, gehouden = s.klaar && s.touch;
    s = null;
    if (gehouden || gesleept) { w.dataset.netGesleept = "1"; setTimeout(function () { delete w.dataset.netGesleept; }, 450); }
    if (!gesleept) return;
    w.classList.remove("sleept");
    document.body.classList.remove("tilt");
    w.style.transition = "transform .26s cubic-bezier(.2,.9,.3,1)"; w.style.transform = "";
    setTimeout(function () { w.style.transition = ""; }, 280);
    var volgorde = alle(".widget", data).map(function (x) { return x.dataset.id; });
    INST.widgets.sort(function (a, b) { var x = volgorde.indexOf(a.id), y = volgorde.indexOf(b.id); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    bewaarInst();
  }
  // aanraken
  data.addEventListener("touchstart", function (e) {
    var w = e.target.closest(".widget");
    if (e.touches.length !== 1 || !w || e.target.closest(".wmin")) { annuleer(); return; }
    begin(w, e.touches[0].clientX, e.touches[0].clientY, true);
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!s || !s.touch) return;
    vinger.x = e.touches[0].clientX; vinger.y = e.touches[0].clientY;
    if (!s.klaar) { if (bewogen() > 10) annuleer(); return; }   // gewoon scrollen
    e.preventDefault();
    plaats(); herschik();
  }, { passive: false });
  document.addEventListener("touchend", function () { if (s && s.touch) eind(); });
  document.addEventListener("touchcancel", function () { if (s && s.touch) eind(); });
  // muis
  data.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "touch" || e.button) return;
    var w = e.target.closest(".widget");
    if (!w || e.target.closest(".wmin")) return;
    begin(w, e.clientX, e.clientY, false);
  });
  document.addEventListener("pointermove", function (e) {
    if (!s || s.touch || e.pointerType === "touch") return;
    vinger.x = e.clientX; vinger.y = e.clientY;
    if (!s.klaar) { if (bewogen() > 6) annuleer(); return; }
    if (!s.sleept) { if (bewogen() > 4) optillen(); else return; }
    e.preventDefault();
    plaats(); herschik();
  });
  document.addEventListener("pointerup", function (e) { if (s && !s.touch && e.pointerType !== "touch") eind(); });

  // in de aanpasmodus: tikken doet aanpassen, geen links volgen
  data.addEventListener("click", function (e) {
    var w = e.target.closest(".widget");
    if (w && w.dataset.netGesleept) { e.preventDefault(); e.stopPropagation(); delete w.dataset.netGesleept; return; }
    if (!bewerkt()) return;
    if (!w) { if (!e.target.closest(".wmenu")) uit(); return; }
    e.preventDefault(); e.stopPropagation();
    var b = INST.widgets.filter(function (x) { return x.id === w.dataset.id; })[0];
    if (e.target.closest(".wmin")) { b.aan = false; bewaarInst(); w.classList.add("weg"); setTimeout(overzichtTonen, 200); return; }
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
      if (k) { b.maat = k.dataset.maat; bewaarInst(); sluitWMenu(); overzichtTonen(); return; }
      if (e.target.closest("[data-weg]")) { b.aan = false; bewaarInst(); sluitWMenu(); overzichtTonen(); }
    };
  }
  function plusMenu(knop) {
    sluitWMenu();
    var uitstaand = INST.widgets.filter(function (b) { return !b.aan; });
    var m = document.createElement("div");
    m.className = "tokmenu wmenu";
    m.innerHTML = uitstaand.length ? uitstaand.map(function (b) { return '<button type="button" data-plus="' + b.id + '">' + WIDGETS[b.id].naam + "</button>"; }).join("") : '<button type="button" disabled>Alle widgets staan er al</button>';
    zetMenu(m, knop);
    m.style.left = Math.max(10, Math.min(knop.getBoundingClientRect().right - m.offsetWidth, window.innerWidth - m.offsetWidth - 10)) + "px";
    m.onclick = function (e) {
      var k = e.target.closest("[data-plus]");
      if (!k) return;
      var b = INST.widgets.filter(function (x) { return x.id === k.dataset.plus; })[0];
      b.aan = true;
      INST.widgets.splice(INST.widgets.indexOf(b), 1); INST.widgets.unshift(b);
      bewaarInst(); sluitWMenu(); overzichtTonen();
    };
  }
  document.addEventListener("pointerdown", function (e) { if (!e.target.closest(".wmenu") && !e.target.closest(".widget") && !e.target.closest("#w-plus")) sluitWMenu(); });
  document.addEventListener("eu-tab", function (e) { if (e.detail !== "overzicht") uit(); });
})();

// ---------- zoeken over alles ----------
function zoekAlles(q) {
  var doel = document.getElementById("ov-resultaten"), blokken = document.getElementById("ov-data");
  q = q.trim();
  if (normaal(q).length < 2) { overzichtTonen(); bedoelJe("ov-zoek", null); doel.innerHTML = ""; doel.classList.add("verborgen"); blokken.classList.remove("verborgen"); return; }
  blokken.classList.add("verborgen");
  Promise.all([agendaLaden(), laden("dossiers-kort"), laden("stemmen"), laden("debatten"), mensenLaden(), laden("commissie"), bestuurLaden().catch(function () { return null; })]).then(function (r) {
    function blok(titel, items, link) {
      return items.length ? '<div class="kop-met-link"><h2>' + titel + ' <small>' + items.length + "</small></h2>" + (link ? '<a href="' + link + '">Alles ›</a>' : "") + '</div><div class="kaart"><ul class="lijst">' + items.slice(0, 5).join("") + "</ul></div>" : "";
    }
    var z = zoeker(q);
    function zoek(lijst, tekst) { return z.ordenen(lijst.filter(function (x) { return z.past(tekst(x), x); })); }
    function nieuws(sel) { return zoek(alle(sel + " li.bericht"), function (li) { return li.textContent + " " + (li.dataset.bronnen || li.dataset.bron || ""); }).map(function (li) { return nieuwsRegel(li); }); }
    var ag = zoek(alleAgenda(), agendaTekst)
      .map(function (i) { return lijstRegel("#agenda?item=" + i.id, esc(i.titel), watLabel(i) + (i.plaats ? "<span>" + esc(i.plaats) + "</span>" : "") + "<span>" + esc(lang(i.datum)) + (tijdTekst(i) ? " · " + tijdTekst(i) : "") + "</span>"); });
    var db = zoek(r[3].debatten, function (x) { return x.titel; })
      .map(function (x) { return lijstRegel(x.verslag, esc(x.titel), "<span>debat " + kort(x.datum) + "</span>", true); });
    var d = zoek(r[1], function (x) { return x.ref + " " + x.titel + " " + x.zoek; })
      .map(function (x) { return lijstRegel("#dossiers?open=" + encodeURIComponent(x.ref), esc(x.titel), "<span>" + esc(x.ref) + "</span><span>" + esc(x.status) + "</span>"); });
    var s = zoek(r[2].stemmen, function (x) { return x.titel + " " + (x.procedure || ""); })
      .map(function (x) { return lijstRegel("#stemmingen?id=" + x.id, esc(x.titel), uitslag(x.uitslag) + "<span>" + kort(x.moment) + "</span>"); });
    // personen: europarlementariërs, de Commissie en de Nederlandse bewindspersonen; wie op naam
    // past eerst, en dan staat het blok Personen ook bovenaan
    var zn = zoeker(q), bestuurders = r[6] ? r[6].commissie.leden.concat(r[6].ministers) : [];
    var pm = zoek(bestuurders, function (p) { return p.naam + " " + p.functie + " " + (p.portefeuille || p.formaties || []).join(" "); })
      .concat(zoek(r[4], function (p) { return p.naam + " " + p.partij + " " + landNaam(p.land); }));
    var opNaam = pm.filter(function (p) { return zn.past(p.naam); });
    pm = opNaam.concat(pm.filter(function (p) { return opNaam.indexOf(p) < 0; }));
    var m = pm.map(function (p) { return p.functie ? lijstRegel("#mensen?id=" + p.id, esc(p.naam), '<span class="label wie k-' + (p.soort === "commissie" ? "com" : "raad") + '">' + esc(p.soort === "commissie" ? "Commissie" : "Kabinet") + "</span><span>" + esc(p.functie) + "</span>")
      : lijstRegel("#mensen?id=" + p.id, esc(p.naam), "<span>" + esc(p.partij || "") + "</span><span>" + esc(p.fractie || "") + "</span>"); });
    var cp = zoek(r[5].items, function (x) { return x.titel + " " + x.titel_en + " " + x.dg; })
      .map(function (x) { return lijstRegel(x.url, esc(x.titel), '<span class="label wie k-com">' + esc(x.soort_naam) + "</span><span>" + KW[x.kwartaal] + " kwartaal " + x.jaar + "</span>", true); });
    var h = (opNaam.length ? blok("Personen", m, "#mensen") : "") + blok("Agenda", ag, "#agenda") + blok("Pers", nieuws("#kanaal-media"), "#nieuws") + blok("Persberichten", nieuws("#kanaal-officieel"), "#nieuws")
      + blok("Dossiers", d, "#dossiers?q=" + encodeURIComponent(q)) + blok("Stemmingen", s, "#stemmingen") + (opNaam.length ? "" : blok("Personen", m, "#mensen"))
      + blok("Debatten", db, "") + blok("Gepland door de Commissie", cp, "");
    doel.innerHTML = h || '<p class="leeg">Niets gevonden voor “' + esc(q) + "”. Probeer minder woorden, of een Engels woord: veel titels van dossiers zijn Engels.</p>";
    bedoelJe("ov-zoek", z);
    doel.classList.remove("verborgen");
  }).catch(function () { laadFout(doel); doel.classList.remove("verborgen"); });
}
(function () {
  var veld = document.getElementById("ov-zoek"), wacht = null;
  if (veld) veld.addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { zoekAlles(ev.target.value); }, 250); });
})();


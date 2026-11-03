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
  return lijstRegel("#agenda?item=" + agenda.items.indexOf(i), esc(i.titel),
    (metTijd ? (t ? '<span class="tijd">' + t + "</span>" : "") : "<span>" + esc(lang(i.datum)) + (i.eind_datum ? " t/m " + esc(kort(i.eind_datum)) : "") + "</span>")
    + soortLabel(i.soort) + (i.plaats ? "<span>" + esc(i.plaats) + "</span>" : ""));
}
function ovBlokHtml(b, d) {
  var agenda = d.agenda, n = b.n || 3;
  if (b.id === "vandaag") {
    var dag = vandaag(), l = agenda.items.filter(function (i) { return loopt(i, dag) && (!i.vast || INST.vastePunten); });
    l.sort(function (x, y) { return (uur(x.begin) || "99").localeCompare(uur(y.begin) || "99"); });
    return ovBlok("Vandaag <small>" + esc(lang(dag)) + "</small>", "#agenda", l.slice(0, n).map(function (i) { return agendaRegel(i, agenda, true); }), "Vandaag niets in de agenda.");
  }
  if (b.id === "agenda") {
    var soorten = b.soorten && b.soorten.length ? b.soorten : null;
    var l2 = agenda.items.filter(function (i) {
      if (i.vast === "briefing") return false;
      if (!soorten) return true;
      return soorten.some(function (k) { return (AGENDA_SOORT[k] || []).indexOf(i.soort) >= 0; });
    });
    return ovBlok("Agenda", "#agenda", l2.slice(0, n).map(function (i) { return agendaRegel(i, agenda, false); }), "Niets gepland in de komende 4 weken.");
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
    return '<h2>Recent gezocht</h2><div class="chips recent">' + RECENT.slice(0, n).map(function (q) { return '<button class="chip" data-voorstel="' + esc(q) + '" data-veld="ov-zoek">' + esc(q) + "</button>"; }).join("") + "</div>";
  }
  return "";
}
function overzichtTonen() {
  if (!OV_DATA) return;
  var h = INST.overzicht.filter(function (b) { return b.aan; }).map(function (b) { return ovBlokHtml(b, OV_DATA); }).join("");
  var doel = document.getElementById("ov-data");
  doel.innerHTML = (h || '<p class="leeg">Alle blokken staan uit. Tik op Wijzig om er een paar aan te zetten.</p>')
    + '<div class="knoprij midden"><button class="mini" id="ov-wijzig" type="button">Wijzig overzicht</button></div>';
  window.euMarkeer(doel);
}
function overzichtTab() {
  var doel = document.getElementById("ov-data");
  bezig(doel);
  Promise.all([laden("dossiers-kort"), laden("agenda"), laden("stemmen"), laden("debatten")]).then(function (r) {
    if (!AGENDA) AGENDA = r[1];
    if (!DEBATTEN) DEBATTEN = r[3];
    OV_DATA = { dossiers: r[0], agenda: r[1], stemmen: r[2], debatten: r[3] };
    overzichtTonen();
  }).catch(function () { laadFout(doel); });
}

// ---------- het overzicht inrichten ----------
function bewerkHtml() {
  return '<p class="klein">Zet blokken aan of uit en sleep ze met <b>≡</b> in de volgorde die je wilt. Het zoekveld blijft bovenaan.</p><ul class="bewerk" id="ov-bewerk">'
    + INST.overzicht.map(function (b) {
      var extra = "";
      if (b.id === "agenda") extra = '<div class="bewerk-extra chips">' + ["parlement", "raad", "top", "commissie", "dossiers"].map(function (k) {
        return '<button type="button" class="chip' + ((b.soorten || []).indexOf(k) >= 0 ? " actief" : "") + '" data-soort="' + k + '">' + { parlement: "Parlement", raad: "Raad", top: "EU-top", commissie: "Commissie", dossiers: "Dossiers" }[k] + "</button>";
      }).join("") + '<span class="klein">niets gekozen = alles</span></div>';
      if (b.id === "nieuws") {
        var bronnen = {}; alle("#kanaal-media li.bericht").forEach(function (li) { bronnen[li.dataset.bron] = 1; });
        extra = '<div class="bewerk-extra"><select class="kies klein-kies" data-bron><option value="">Alle bronnen</option>' + Object.keys(bronnen).sort().map(function (x) { return "<option" + (b.bron === x ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></div>";
      }
      if (b.id === "dossiers") extra = '<div class="bewerk-extra"><label class="optie"><input type="checkbox" data-nl' + (b.nl ? " checked" : "") + "> Alleen met Nederlandse (schaduw)rapporteur</label></div>";
      return '<li data-id="' + b.id + '"' + (b.aan ? "" : ' class="uit"') + '><div class="bewerk-rij"><span class="greep" aria-label="Verslepen">≡</span><span class="bewerk-naam">' + OV_NAAM[b.id] + "</span>"
        + '<select class="kies klein-kies" data-n aria-label="Aantal regels">' + [3, 5, 10].map(function (n) { return "<option" + (b.n === n ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select>"
        + '<label class="schakelaar"><input type="checkbox" data-aan' + (b.aan ? " checked" : "") + '><span></span></label></div>' + extra + "</li>";
    }).join("") + '</ul><div class="knoprij"><button class="knop" type="button" id="ov-klaar">Klaar</button><button class="knop tweede" type="button" id="ov-standaard">Standaard</button></div>';
}
function bewerkOpzetten() {
  var lijst = document.getElementById("ov-bewerk");
  if (!lijst) return;
  function blok(li) { return INST.overzicht.filter(function (b) { return b.id === li.dataset.id; })[0]; }
  function opslaan() {
    var volgorde = alle("li", lijst).map(function (li) { return li.dataset.id; });
    INST.overzicht.sort(function (x, y) { return volgorde.indexOf(x.id) - volgorde.indexOf(y.id); });
    bewaarInst(); overzichtTonen();
  }
  lijst.addEventListener("change", function (ev) {
    var li = ev.target.closest("li"), b = li && blok(li);
    if (!b) return;
    if (ev.target.matches("[data-aan]")) { b.aan = ev.target.checked; li.classList.toggle("uit", !b.aan); }
    if (ev.target.matches("[data-n]")) b.n = +ev.target.value;
    if (ev.target.matches("[data-bron]")) b.bron = ev.target.value;
    if (ev.target.matches("[data-nl]")) b.nl = ev.target.checked;
    opslaan();
  });
  lijst.addEventListener("click", function (ev) {
    var c = ev.target.closest("[data-soort]");
    if (!c) return;
    var b = blok(c.closest("li"));
    b.soorten = b.soorten || [];
    var i = b.soorten.indexOf(c.dataset.soort);
    if (i >= 0) b.soorten.splice(i, 1); else b.soorten.push(c.dataset.soort);
    c.classList.toggle("actief", i < 0);
    opslaan();
  });
  // slepen met de greep (werkt met vinger en muis)
  var sleep = null;
  lijst.addEventListener("pointerdown", function (ev) {
    var g = ev.target.closest(".greep");
    if (!g) return;
    ev.preventDefault();
    var li = g.closest("li");
    sleep = { li: li, id: ev.pointerId, y: ev.clientY };
    li.classList.add("sleept");
    try { g.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  lijst.addEventListener("pointermove", function (ev) {
    if (!sleep || ev.pointerId !== sleep.id) return;
    ev.preventDefault();
    var y = ev.clientY;
    var andere = alle("li", lijst).filter(function (x) { return x !== sleep.li; });
    var voor = andere.filter(function (x) { var r = x.getBoundingClientRect(); return y < r.top + r.height / 2; })[0];
    if (voor) { if (sleep.li.nextElementSibling !== voor) lijst.insertBefore(sleep.li, voor); }
    else if (lijst.lastElementChild !== sleep.li) lijst.appendChild(sleep.li);
  });
  function los(ev) {
    if (!sleep || (ev && ev.pointerId !== sleep.id)) return;
    sleep.li.classList.remove("sleept"); sleep = null; opslaan();
  }
  lijst.addEventListener("pointerup", los); lijst.addEventListener("pointercancel", los);
  document.getElementById("ov-klaar").addEventListener("click", function () { sluitPaneel(false); });
  document.getElementById("ov-standaard").addEventListener("click", function () {
    INST.overzicht = JSON.parse(JSON.stringify(STANDAARD.overzicht)); bewaarInst(); overzichtTonen();
    paneelLijf.innerHTML = bewerkHtml(); bewerkOpzetten();
  });
}
function openBewerk() { openPaneel("Overzicht inrichten", bewerkHtml()); bewerkOpzetten(); }
document.addEventListener("click", function (ev) { if (ev.target.closest && ev.target.closest("#ov-wijzig")) { ev.preventDefault(); openBewerk(); } });

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
      .map(function (i) { return lijstRegel("#agenda?item=" + r[0].items.indexOf(i), esc(i.titel), "<span>" + esc(lang(i.datum)) + (tijdTekst(i) ? " · " + tijdTekst(i) : "") + "</span>" + soortLabel(i.soort)); });
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

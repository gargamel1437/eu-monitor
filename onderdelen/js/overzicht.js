// =====================================================================
//  overzicht.js: volglijst, wat er veranderde sinds je vorige bezoek, de komende week,
//  de laatste stemmingen, en één zoekveld over alles heen.
// =====================================================================

function lijstRegel(href, titel, meta, extern) {
  return '<li><a href="' + esc(href) + '"' + (extern ? ' target="_blank" rel="noopener"' : "") + '><div class="regel">' + titel + '</div><div class="meta2">' + meta + "</div></a></li>";
}

function overzichtTonen(kort_d, agenda, stemmen, mensen) {
  var h = "", index = {};
  kort_d.forEach(function (d) { index[d.ref] = d; });
  var mi = {}; mensen.forEach(function (p) { mi[p.id] = p; });

  // volglijst
  var gevolgd = VOLG.dossiers.map(function (r) { return index[r]; }).filter(Boolean);
  var gevolgdM = VOLG.mensen.map(function (id) { return mi[id]; }).filter(Boolean);
  h += "<h2>Mijn volglijst</h2>";
  if (!gevolgd.length && !gevolgdM.length) h += '<p class="intro">Nog leeg. Tik op ☆ bij een dossier of persoon om die hier te zetten.</p>';
  else {
    h += '<div class="kaart"><ul class="lijst">' + gevolgd.map(function (d) {
      var nieuw = STAND[d.ref] && d.laatst > STAND[d.ref];
      return lijstRegel("#dossiers?open=" + encodeURIComponent(d.ref), (nieuw ? '<span class="label voorstel">Gewijzigd</span> ' : "") + esc(d.titel),
        "<span>" + esc(d.ref) + "</span><span>" + esc(d.status) + "</span>" + (d.laatst ? "<span>" + kort(d.laatst) + ": " + esc(d.stap) + "</span>" : ""));
    }).join("") + gevolgdM.map(function (p) {
      return lijstRegel("#mensen?id=" + p.id, esc(p.naam), "<span>" + esc(p.partij || "") + "</span><span>" + esc(p.fractie || "") + "</span>");
    }).join("") + "</ul></div>";
    gevolgd.forEach(function (d) { STAND[d.ref] = d.laatst; });
    bewaar("eu-volg-stand", JSON.stringify(STAND));
  }

  // gewijzigd sinds vorig bezoek
  var vorig = BEZOEK.vorig;
  h += '<div class="kop-met-link"><h2>Sinds je vorige bezoek</h2><a href="#dossiers">Dossiers</a></div>';
  if (!vorig) h += '<p class="intro">Eerste bezoek op dit apparaat. Vanaf je volgende bezoek staan hier de dossiers die een stap verder zijn gegaan.</p>';
  else {
    var gew = kort_d.filter(function (d) { return d.laatst && d.laatst > vorig; }).sort(function (x, y) { return y.laatst.localeCompare(x.laatst); });
    h += '<p class="intro">Vorig bezoek: ' + kort(vorig) + ". " + gew.length + " dossiers met een nieuwe stap.</p>";
    if (gew.length) h += '<div class="kaart"><ul class="lijst">' + gew.slice(0, 8).map(function (d) {
      return lijstRegel("#dossiers?open=" + encodeURIComponent(d.ref), esc(d.titel), "<span>" + esc(d.ref) + "</span><span>" + kort(d.laatst) + ": " + esc(d.stap) + "</span>");
    }).join("") + "</ul></div>";
  }

  // komende 7 dagen
  var week = agenda.items.filter(function (i) { return i.datum <= plusDagen(7); });
  h += '<div class="kop-met-link"><h2>Komende 7 dagen</h2><a href="#agenda">Agenda</a></div>';
  h += week.length ? '<div class="kaart"><ul class="lijst">' + week.slice(0, 8).map(function (i) {
    return lijstRegel(i.ref ? "#dossiers?open=" + encodeURIComponent(i.ref) : "#agenda", esc(i.titel),
      "<span>" + esc(lang(i.datum)) + '</span><span class="label">' + esc(i.soort) + "</span>" + ((i.punten || []).length ? "<span>" + i.punten.length + " debatten</span>" : ""));
  }).join("") + "</ul></div>"
    : '<p class="intro">Niets in de komende 7 dagen.' + (agenda.items[0] ? " Eerstvolgende: " + esc(lang(agenda.items[0].datum)) + " (" + esc(agenda.items[0].soort.toLowerCase()) + ")." : "") + "</p>";

  // laatste stemmingen
  var S = stemmen.stemmen;
  h += '<div class="kop-met-link"><h2>Laatste stemmingen</h2><a href="#stemmingen">Alle</a></div>';
  h += S.length ? '<div class="kaart"><ul class="lijst">' + S.slice(0, 4).map(function (s) {
    return lijstRegel("#stemmingen?id=" + s.id, esc(s.titel), uitslag(s.uitslag) + "<span>" + (s.totaal.FOR || 0) + "–" + (s.totaal.AGAINST || 0) + "–" + (s.totaal.ABSTENTION || 0) + "</span><span>" + kort(s.moment) + "</span>");
  }).join("") + "</ul></div>" + opgehaald("stemmen", "Stemmingen") : '<p class="intro">Geen stemmingen opgehaald.</p>';

  var doel = document.getElementById("ov-data");
  doel.innerHTML = h;
  window.euMarkeer(doel);
}

function overzichtTab() {
  var doel = document.getElementById("ov-data");
  bezig(doel);
  Promise.all([laden("dossiers-kort"), laden("agenda"), laden("stemmen"), mensenLaden()]).then(function (r) {
    overzichtTonen(r[0], r[1], r[2], r[3]);
  }).catch(function () { laadFout(doel); });
}

// ---------- zoeken over alles ----------
function zoekAlles(q) {
  var doel = document.getElementById("ov-resultaten");
  q = q.trim().toLowerCase();
  if (q.length < 2) { doel.innerHTML = ""; doel.classList.add("verborgen"); return; }
  Promise.all([laden("dossiers-kort"), laden("stemmen"), laden("debatten"), mensenLaden()]).then(function (r) {
    function blok(titel, items, link) {
      return items.length ? "<h4>" + titel + " (" + items.length + ")</h4><ul class='lijst'>" + items.slice(0, 6).join("") + "</ul>"
        + (items.length > 6 && link ? '<p class="klein"><a href="' + link + '">Toon alle ' + items.length + "</a></p>" : "") : "";
    }
    function past(t) { return (t || "").toLowerCase().indexOf(q) >= 0; }
    var d = r[0].filter(function (x) { return past(x.ref + " " + x.titel + " " + x.zoek); })
      .map(function (x) { return lijstRegel("#dossiers?open=" + encodeURIComponent(x.ref), esc(x.titel), "<span>" + esc(x.ref) + "</span><span>" + esc(x.status) + "</span>"); });
    var s = r[1].stemmen.filter(function (x) { return past(x.titel + " " + (x.procedure || "")); })
      .map(function (x) { return lijstRegel("#stemmingen?id=" + x.id, esc(x.titel), "<span>" + kort(x.moment) + "</span>"); });
    var db = r[2].debatten.filter(function (x) { return past(x.titel); })
      .map(function (x) { return lijstRegel(x.verslag, esc(x.titel), "<span>debat " + kort(x.datum) + "</span>", true); });
    var m = r[3].filter(function (p) { return past(p.naam + " " + p.partij); })
      .map(function (p) { return lijstRegel("#mensen?id=" + p.id, esc(p.naam) + (p.land === "NL" ? " 🇳🇱" : ""), "<span>" + esc(p.partij || "") + "</span><span>" + esc(p.fractie || "") + "</span>"); });
    var n = alle("li.bericht").filter(function (li) { return past(li.textContent); })
      .map(function (li) { return lijstRegel(li.querySelector("a").href, esc(li.querySelector("h3").textContent), "<span>" + esc(li.dataset.bron) + "</span>", true); });
    var h = blok("Dossiers", d, "#dossiers?q=" + encodeURIComponent(q)) + blok("Stemmingen", s, "#stemmingen") + blok("Debatten", db, "#agenda") + blok("Mensen", m, "#mensen") + blok("Nieuws", n, "#nieuws");
    doel.innerHTML = '<div class="kaart">' + (h || '<p class="klein">Niets gevonden.</p>') + "</div>";
    doel.classList.remove("verborgen");
  }).catch(function () { laadFout(doel); doel.classList.remove("verborgen"); });
}
(function () {
  var veld = document.getElementById("ov-zoek"), wacht = null;
  if (veld) veld.addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { zoekAlles(ev.target.value); }, 250); });
})();

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

function overzichtTonen(kort_d, agenda, stemmen) {
  var h = "";
  // agenda: de eerstvolgende 3 items
  h += ovBlok("Agenda", "#agenda", agenda.items.slice(0, 3).map(function (i) {
    return lijstRegel(i.ref ? "#dossiers?open=" + encodeURIComponent(i.ref) : "#agenda", esc(i.titel),
      "<span>" + esc(lang(i.datum)) + "</span>" + soortLabel(i.soort) + ((i.punten || []).length ? "<span>" + i.punten.length + (i.soort === "Plenaire vergadering" ? " debatten" : " dossiers") + "</span>" : ""));
  }), "Niets gepland in de komende 4 weken.");
  // nieuws: de 3 nieuwste berichten uit de media (staan al in de pagina)
  h += ovBlok("Nieuws", "#nieuws", alle("#kanaal-media li.bericht").slice(0, 3).map(function (li) {
    return lijstRegel(li.querySelector("a").href, esc(li.querySelector("h3").textContent),
      "<span>" + esc(li.dataset.bron) + "</span><span>" + esc(li.dataset.tijd || "") + "</span>", true);
  }), "Geen berichten opgehaald.");
  // dossiers: de 3 met de meest recente stap
  h += ovBlok("Dossiers", "#dossiers", kort_d.filter(function (d) { return d.laatst && d.laatst <= vandaag(); }).slice(0, 3).map(function (d) {
    return lijstRegel("#dossiers?open=" + encodeURIComponent(d.ref), esc(d.titel), "<span>" + esc(d.ref) + "</span><span>" + kort(d.laatst) + ": " + esc(d.stap) + "</span>");
  }), "Geen dossiers opgehaald.");
  // stemmen: de laatste 3 hoofdstemmingen
  h += ovBlok("Stemmen", "#stemmingen", stemmen.stemmen.slice(0, 3).map(function (s) {
    return lijstRegel("#stemmingen?id=" + s.id, esc(s.titel), uitslag(s.uitslag) + "<span>" + (s.totaal.FOR || 0) + " voor · " + (s.totaal.AGAINST || 0) + " tegen · " + (s.totaal.ABSTENTION || 0) + " onth.</span><span>" + kort(s.moment) + "</span>");
  }), "Geen stemmingen opgehaald.");
  var doel = document.getElementById("ov-data");
  doel.innerHTML = h;
  window.euMarkeer(doel);
}

function overzichtTab() {
  var doel = document.getElementById("ov-data");
  bezig(doel);
  Promise.all([laden("dossiers-kort"), laden("agenda"), laden("stemmen")]).then(function (r) {
    overzichtTonen(r[0], r[1], r[2]);
  }).catch(function () { laadFout(doel); });
}

// ---------- zoeken over alles ----------
function zoekAlles(q) {
  var doel = document.getElementById("ov-resultaten"), blokken = document.getElementById("ov-data");
  q = q.trim().toLowerCase();
  if (q.length < 2) { doel.innerHTML = ""; doel.classList.add("verborgen"); blokken.classList.remove("verborgen"); return; }
  blokken.classList.add("verborgen");
  Promise.all([laden("agenda"), laden("dossiers-kort"), laden("stemmen"), laden("debatten"), mensenLaden(), laden("commissie")]).then(function (r) {
    function blok(titel, items, link) {
      return items.length ? '<div class="kop-met-link"><h2>' + titel + ' <small>' + items.length + "</small></h2>" + (link ? '<a href="' + link + '">Alles ›</a>' : "") + '</div><div class="kaart"><ul class="lijst">' + items.slice(0, 5).join("") + "</ul></div>" : "";
    }
    function past(t) { return (t || "").toLowerCase().indexOf(q) >= 0; }
    function nieuws(sel) {
      return alle(sel + " li.bericht").filter(function (li) { return past(li.textContent); })
        .map(function (li) { return lijstRegel(li.querySelector("a").href, esc(li.querySelector("h3").textContent), "<span>" + esc(li.dataset.bron) + "</span><span>" + esc(li.dataset.tijd || "") + "</span>", true); });
    }
    var ag = r[0].items.filter(function (i) { return past(i.titel + " " + (i.punten || []).join(" ")); })
      .map(function (i) { return lijstRegel(i.ref ? "#dossiers?open=" + encodeURIComponent(i.ref) : "#agenda", esc(i.titel), "<span>" + esc(lang(i.datum)) + "</span>" + soortLabel(i.soort)); });
    var db = r[3].debatten.filter(function (x) { return past(x.titel); })
      .map(function (x) { return lijstRegel(x.verslag, esc(x.titel), "<span>debat " + kort(x.datum) + "</span>", true); });
    var d = r[1].filter(function (x) { return past(x.ref + " " + x.titel + " " + x.zoek); })
      .map(function (x) { return lijstRegel("#dossiers?open=" + encodeURIComponent(x.ref), esc(x.titel), "<span>" + esc(x.ref) + "</span><span>" + esc(x.status) + "</span>"); });
    var s = r[2].stemmen.filter(function (x) { return past(x.titel + " " + (x.procedure || "")); })
      .map(function (x) { return lijstRegel("#stemmingen?id=" + x.id, esc(x.titel), uitslag(x.uitslag) + "<span>" + kort(x.moment) + "</span>"); });
    var m = r[4].filter(function (p) { return past(p.naam + " " + p.partij); })
      .map(function (p) { return lijstRegel("#mensen?id=" + p.id, esc(p.naam) + (p.land === "NL" ? " 🇳🇱" : ""), "<span>" + esc(p.partij || "") + "</span><span>" + esc(p.fractie || "") + "</span>"); });
    var cp = r[5].items.filter(function (x) { return past(x.titel + " " + x.titel_en + " " + x.dg); })
      .map(function (x) { return lijstRegel(x.url, esc(x.titel), '<span class="label soort-commissie">' + esc(x.soort_naam) + "</span><span>" + KW[x.kwartaal] + " kwartaal " + x.jaar + "</span>", true); });
    var h = blok("Agenda", ag, "#agenda") + blok("Planning van de Commissie", cp, "#agenda") + blok("Debatten", db, "#agenda") + blok("Nieuws uit de media", nieuws("#kanaal-media"), "#nieuws")
      + blok("Uit Brussel zelf", nieuws("#kanaal-officieel"), "#nieuws") + blok("Dossiers", d, "#dossiers?q=" + encodeURIComponent(q))
      + blok("Stemmingen", s, "#stemmingen") + blok("Mensen", m, "#mensen");
    doel.innerHTML = h || '<p class="leeg">Niets gevonden voor “' + esc(q) + "”.</p>";
    doel.classList.remove("verborgen");
  }).catch(function () { laadFout(doel); doel.classList.remove("verborgen"); });
}
(function () {
  var veld = document.getElementById("ov-zoek"), wacht = null;
  if (veld) veld.addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { zoekAlles(ev.target.value); }, 250); });
})();

// =====================================================================
//  stemmingen.js: hoofdstemmingen van de laatste twee zittingen (HowTheyVote.eu).
// =====================================================================

var STEMMEN = null, STEM_INDEX = {}, stemmenOpgezet = false;

function meerderheidVan(c) {
  var beste = null, n = 0;
  ["FOR", "AGAINST", "ABSTENTION"].forEach(function (k) { if ((c[k] || 0) > n) { n = c[k]; beste = k; } });
  return beste;
}
function verdeling(t) {
  var v = t.FOR || 0, te = t.AGAINST || 0, o = t.ABSTENTION || 0, som = Math.max(v + te + o, 1);
  return '<div class="balk"><span class="v" style="width:' + (100 * v / som).toFixed(1) + '%"></span><span class="t" style="width:' + (100 * te / som).toFixed(1) + '%"></span><span class="o" style="width:' + (100 * o / som).toFixed(1) + '%"></span></div>';
}
function cijfers(t) {
  return '<div class="cijfers"><span><b>' + (t.FOR || 0) + "</b> voor</span><span><b>" + (t.AGAINST || 0) + "</b> tegen</span><span><b>" + (t.ABSTENTION || 0) + "</b> onth.</span><span>" + (t.DID_NOT_VOTE || 0) + " niet</span></div>";
}
function nlPartijen(np) {
  return '<div class="nl-stem">' + Object.keys(np || {}).sort(function (x, y) {
    function som(p) { var c = np[p]; return (c.FOR || 0) + (c.AGAINST || 0) + (c.ABSTENTION || 0) + (c.DID_NOT_VOTE || 0); }
    return som(y) - som(x);
  }).map(function (p) {
    var c = np[p], m = meerderheidVan(c) || "DID_NOT_VOTE";
    var delen = ["FOR", "AGAINST", "ABSTENTION", "DID_NOT_VOTE"].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + " " + POS[k][1]; });
    var niet_allemaal = Object.keys(c).filter(function (k) { return k !== "DID_NOT_VOTE" && c[k]; }).length > 1;
    return '<span class="' + POS[m][0] + '" title="' + esc(delen.join(", ")) + '">' + esc(p) + " " + POS[m][1] + (niet_allemaal ? " (niet allemaal)" : "") + "</span>";
  }).join("") + "</div>";
}
function feitenStemKort(s) {
  var t = s.totaal || {};
  return ["Stemming " + s.moment.slice(0, 10) + ": " + s.titel,
    "Uitslag: " + (s.uitslag === "ADOPTED" ? "aangenomen" : "verworpen") + " — " + (t.FOR || 0) + " voor, " + (t.AGAINST || 0) + " tegen, " + (t.ABSTENTION || 0) + " onthouden, " + (t.DID_NOT_VOTE || 0) + " niet gestemd",
    "Nederlandse partijen: " + Object.keys(s.nl_partijen || {}).map(function (p) {
      var c = s.nl_partijen[p];
      return p + " (" + ["FOR", "AGAINST", "ABSTENTION", "DID_NOT_VOTE"].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + " " + POS[k][1]; }).join(", ") + ")";
    }).join("; ")].join("\n");
}
function feitenStem(s) {
  return feitenStemKort(s) + (s.procedure ? "\nProcedure: " + s.procedure : "") + "\nBron: " + s.url;
}

function stemKaart(s) {
  return '<div class="kaart compact skaart" data-id="' + esc(s.id) + '" role="button" tabindex="0">'
    + '<div class="klein">' + kort(s.moment) + (s.terreinen || []).slice(0, 2).map(function (t) { return ' · ' + esc(t); }).join("") + "</div>"
    + '<h3 class="twee-regels">' + esc(s.titel) + "</h3>"
    + '<div class="stemregel">' + uitslag(s.uitslag) + '<span class="klein">' + (s.totaal.FOR || 0) + " voor · " + (s.totaal.AGAINST || 0) + " tegen · " + (s.totaal.ABSTENTION || 0) + " onth.</span></div>"
    + verdeling(s.totaal || {})
    + ((s.afwijkers || []).length ? '<div class="klein feitregel">' + s.afwijkers.map(function (x) { return esc(x.partij); }).join(", ") + " anders dan de fractie</div>" : "")
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}
function stemDetail(s) {
  KOPIEER["s:" + s.id] = function () { return feitenStem(s); };
  var afw = (s.afwijkers || []).map(function (x) { return esc(x.partij) + ": " + POS[x.partij_stem][1] + "; fractie " + esc(x.fractie) + " (meerderheid): " + POS[x.fractie_stem][1]; });
  var h = '<div class="klein">' + esc(lang(s.moment)) + ' · <span class="label taal">EN</span>' + (s.terreinen || []).map(function (t) { return ' <span class="label">' + esc(t) + "</span>"; }).join("") + "</div>"
    + "<h2 class='paneel-kop'>" + esc(s.titel) + "</h2>" + uitslag(s.uitslag) + verdeling(s.totaal || {}) + cijfers(s.totaal || {})
    + '<div class="knoprij"><button class="mini" data-kopieer="s:' + esc(s.id) + '">Kopieer feiten</button>' + a(s.url, "HowTheyVote") + (s.document ? a(s.document, "Tekst") : "")
    + (s.procedure ? (s.in_dossiers ? '<a href="#dossiers?q=' + encodeURIComponent(s.procedure) + '">Dossier ' + esc(s.procedure) + "</a>" : a("https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=" + s.procedure, s.procedure)) : "") + "</div>"
    + "<h4>Nederlandse partijen</h4><p class='klein'>Wat de meeste leden van de partij stemden.</p>" + nlPartijen(s.nl_partijen)
    + (afw.length ? "<p class='klein'><b>Partij stemde anders dan de meerderheid van haar fractie:</b><br>" + afw.join("<br>") + "</p>" : "")
    + "<h4>Per fractie</h4><div class='tabel-scroll'><table><tr><th>Fractie</th><th>voor</th><th>tegen</th><th>onth.</th><th>niet</th></tr>"
    + Object.keys(s.per_fractie || {}).map(function (f) { var c = s.per_fractie[f]; return "<tr><td>" + fr(f) + "</td><td>" + (c.FOR || 0) + "</td><td>" + (c.AGAINST || 0) + "</td><td>" + (c.ABSTENTION || 0) + "</td><td>" + (c.DID_NOT_VOTE || 0) + "</td></tr>"; }).join("") + "</table></div>"
    + "<h4>Nederlandse europarlementariërs</h4><ul class='punten'>" + (s.nl_leden || []).slice().sort(function (x, y) { return x.partij.localeCompare(y.partij) || x.naam.localeCompare(y.naam); }).map(function (m) {
      return '<li><a href="#mensen?id=' + esc(m.id) + '">' + esc(m.naam) + "</a> (" + esc(m.partij) + ", " + esc(m.fractie) + "): <b>" + POS[m.positie][1] + "</b>"
        + (m.anders_dan_partij ? ' <span class="label">anders dan partij</span>' : "") + (m.anders_dan_fractie ? ' <span class="label">anders dan fractie</span>' : "") + "</li>";
    }).join("") + "</ul>";
  if ((s.verwant || []).length) h += "<h4>Deelstemmingen en amendementen</h4><ul class='punten'>" + s.verwant.map(function (v) {
    return "<li>" + esc(v.nummer && v.nummer !== "§" ? "Amendement " + v.nummer + " (" + v.onderwerp + ")" : (v.wat || v.onderwerp)) + ": " + (v.uitslag === "ADOPTED" ? "aangenomen" : "verworpen") + " · " + a("https://howtheyvote.eu/votes/" + v.id, "details") + "</li>";
  }).join("") + "</ul>";
  return h + notitie("s:" + s.id);
}
function openStem(id) { var s = STEM_INDEX[id]; if (s) openPaneel("Stemming", stemDetail(s)); }

var sFilter = { q: "", terrein: "", zitting: "", uitslag: "", verdeeld: false, afwijk: false, sort: "datum" };
function stemmenTonen() {
  var q = sFilter.q.toLowerCase();
  var uit = STEMMEN.stemmen.filter(function (s) {
    if (sFilter.terrein && (s.terreinen || []).indexOf(sFilter.terrein) < 0) return false;
    if (sFilter.zitting) { var z = sFilter.zitting.split("|"), d = s.moment.slice(0, 10); if (d < z[0] || d > z[1]) return false; }
    if (sFilter.uitslag && s.uitslag !== sFilter.uitslag) return false;
    if (sFilter.verdeeld && !s.nl_verdeeld) return false;
    if (sFilter.afwijk && !(s.afwijkers || []).length) return false;
    if (q && (s.titel + " " + (s.procedure || "") + " " + (s.procedure_titel || "")).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  uit.sort(function (x, y) {
    function verschil(s) { return Math.abs((s.totaal.FOR || 0) - (s.totaal.AGAINST || 0)); }
    if (sFilter.sort === "verschil") return verschil(x) - verschil(y);
    if (sFilter.sort === "onthouden") return (y.totaal.ABSTENTION || 0) - (x.totaal.ABSTENTION || 0);
    if (sFilter.sort === "oud") return x.moment.localeCompare(y.moment);
    return y.moment.localeCompare(x.moment);
  });
  document.getElementById("s-aantal").textContent = uit.length + " hoofdstemmingen";
  var doel = document.getElementById("s-lijst");
  doel.innerHTML = uit.map(stemKaart).join("") || '<p class="leeg">Geen stemmingen met deze filters.</p>';
  filterTeller("s-filterknop", ["terrein", "zitting", "uitslag", "verdeeld", "afwijk"].filter(function (k) { return sFilter[k]; }).length + (sFilter.sort !== "datum" ? 1 : 0));
  window.euMarkeer(doel);
}
function stemmenOpzetten() {
  var ter = {};
  STEMMEN.stemmen.forEach(function (s) { STEM_INDEX[s.id] = s; (s.terreinen || []).forEach(function (t) { ter[t] = 1; }); });
  document.getElementById("s-terrein").innerHTML = '<option value="">Alle onderwerpen</option>' + Object.keys(ter).sort().map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
  document.getElementById("s-zitting").innerHTML = '<option value="">Beide zittingen</option>' + (STEMMEN.zittingen || []).map(function (z) { return '<option value="' + z.begin + "|" + z.eind + '">Zitting ' + kort(z.begin) + " – " + kort(z.eind) + "</option>"; }).join("");
  [["s-terrein", "terrein"], ["s-zitting", "zitting"], ["s-uitslag", "uitslag"], ["s-sort", "sort"]].forEach(function (x) {
    document.getElementById(x[0]).addEventListener("change", function (ev) { sFilter[x[1]] = ev.target.value; stemmenTonen(); });
  });
  [["s-verdeeld", "verdeeld"], ["s-afwijk", "afwijk"]].forEach(function (x) {
    document.getElementById(x[0]).addEventListener("change", function (ev) { sFilter[x[1]] = ev.target.checked; stemmenTonen(); });
  });
  document.getElementById("s-wis").addEventListener("click", function () {
    ["terrein", "zitting", "uitslag"].forEach(function (k) { sFilter[k] = ""; document.getElementById("s-" + k).value = ""; });
    ["verdeeld", "afwijk"].forEach(function (k) { sFilter[k] = false; document.getElementById("s-" + k).checked = false; });
    sFilter.sort = "datum"; document.getElementById("s-sort").value = "datum";
    stemmenTonen();
  });
  var wacht = null;
  document.getElementById("s-zoek").addEventListener("input", function (ev) { clearTimeout(wacht); wacht = setTimeout(function () { sFilter.q = ev.target.value.trim(); stemmenTonen(); }, 200); });
  bijKaartTik(document.getElementById("s-lijst"), ".skaart", function (k) { openStem(k.dataset.id); });
}
function stemmenTab(q) {
  var doel = document.getElementById("s-lijst");
  bezig(doel);
  laden("stemmen").then(function (d) {
    if (!STEMMEN) STEMMEN = d;
    if (!stemmenOpgezet) { stemmenOpgezet = true; stemmenOpzetten(); }
    stemmenTonen();
    if (q.id) openStem(q.id);
  }).catch(function () { laadFout(doel); });
}

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
  return ["Stemming " + s.moment.slice(0, 10) + " (" + vergaderingTekst(s, true) + "): " + s.titel,
    "Uitslag: " + (s.uitslag === "ADOPTED" ? "aangenomen" : "verworpen") + " — " + (t.FOR || 0) + " voor, " + (t.AGAINST || 0) + " tegen, " + (t.ABSTENTION || 0) + " onthouden, " + (t.DID_NOT_VOTE || 0) + " niet gestemd",
    "Nederlandse partijen: " + Object.keys(s.nl_partijen || {}).map(function (p) {
      var c = s.nl_partijen[p];
      return p + " (" + ["FOR", "AGAINST", "ABSTENTION", "DID_NOT_VOTE"].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + " " + POS[k][1]; }).join(", ") + ")";
    }).join("; ")].join("\n");
}
function feitenStem(s) {
  return feitenStemKort(s) + (s.procedure ? "\nProcedure: " + s.procedure : "") + "\nBron: " + s.url;
}

// Wat er precies in stemming kwam, volgens het Parlement (in de bron in het Frans).
var STEM_WAT = [
  [/^Accord provisoire/, "Voorlopig akkoord met de Raad"],
  [/^Proposition de rejet/, "Voorstel om het voorstel te verwerpen"],
  [/^Proposition de la Commission au Conseil/, "Voorstel van de Commissie aan de Raad"],
  [/^Proposition de la Commission et amendement/, "Voorstel van de Commissie met amendementen"],
  [/^Proposition de la Commission/, "Voorstel van de Commissie (standpunt van het Parlement)"],
  [/^Proposition de résolution \(ensemble du texte\)/, "Resolutie, de hele tekst"],
  [/^Proposition de résolution/, "Resolutie"],
  [/^Projet de règlement du Conseil/, "Ontwerpverordening van de Raad"],
  [/^Projet de décision du Conseil/, "Ontwerpbesluit van de Raad"],
  [/^Projet de décision/, "Ontwerpbesluit"],
  [/^Résolution législative/, "Wetgevingsresolutie"],
  [/^Objection/, "Bezwaar"],
  [/^Décision/, "Besluit"]
];
function stemWat(s) {
  var b = s.beschrijving || ((STEM_INDEX[s.id] || {}).beschrijving) || "";
  if (!b) return "";
  var w = STEM_WAT.filter(function (x) { return x[0].test(b); })[0];
  var am = (b.match(/ - (Am [^]*)$/) || [])[1];
  var nrs = am ? am.replace(/^Am\s*/, "").split(/[=\s]+/).filter(Boolean) : [];
  return w ? w[1] + (nrs.length ? " (amendement" + (nrs.length > 1 ? "en " : " ") + nrs.join(", ") + ")" : "") : b;
}
// Het dossier waar een stemming bij hoort, als kaartje. Volledige gegevens (fase, rapporteur)
// zodra de dossiers geladen zijn; tot die tijd de titel uit de stemming zelf.
function dossierKoppel(s) {
  if (!s.procedure) return "";
  var d = typeof DOSSIER_INDEX !== "undefined" && DOSSIER_INDEX[s.procedure];
  var href = s.in_dossiers ? "#dossiers?open=" + encodeURIComponent(s.procedure) : "https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=" + s.procedure;
  var h = '<a class="dkoppel" data-ref="' + esc(s.procedure) + '" href="' + esc(href) + '"' + (s.in_dossiers ? "" : ' target="_blank" rel="noopener"') + ">"
    + '<span class="dkoppel-kop">Hoort bij dossier</span>'
    + "<b>" + esc(d ? titelVan(d) : (s.procedure_titel || s.procedure)) + "</b>"
    + '<span class="klein">' + esc(s.procedure) + (d ? " · " + esc(d.status) : "") + "</span>";
  if (d) {
    var rap = rapporteursVan(d).filter(function (p) { return /responsible/i.test(p.rol); })[0];
    h += stappenBalk(d, false) + (rap ? '<span class="klein">Rapporteur ' + esc(rap.naam) + (rap.fractie ? " (" + esc(FR_OEIL[rap.fractie] || rap.fractie) + ")" : "") + "</span>" : "");
  }
  return h + '<span class="pijl" aria-hidden="true">›</span></a>';
}
function vergaderingTekst(s, lang_) {
  var v = s.vergadering || {};
  return "Plenaire vergadering" + (v.plaats ? " " + v.plaats : "") + ", " + (lang_ ? lang(s.moment) : kort(s.moment)) + (v.tijd ? " om " + v.tijd : "");
}
function stemKaart(s) {
  return '<div class="kaart compact skaart k-ep" data-id="' + esc(s.id) + '" role="button" tabindex="0">'
    + '<div class="klein"><i class="stip"></i>' + esc(vergaderingTekst(s)) + (s.terreinen || []).slice(0, 2).map(function (t) { return ' · ' + esc(t); }).join("") + "</div>"
    + '<h3 class="twee-regels">' + esc(s.titel) + "</h3>"
    + (stemWat(s) ? '<div class="klein stemwat">' + esc(stemWat(s)) + "</div>" : "")
    + (s.procedure ? '<div class="klein dossierregel"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/></svg>' + esc(s.procedure) + (s.procedure_titel && normaal(s.procedure_titel) !== normaal(s.titel) ? " · " + esc(s.procedure_titel) : "") + "</div>" : "")
    + '<div class="stemregel">' + uitslag(s.uitslag) + '<span class="klein">' + (s.totaal.FOR || 0) + " voor · " + (s.totaal.AGAINST || 0) + " tegen · " + (s.totaal.ABSTENTION || 0) + " onth.</span></div>"
    + verdeling(s.totaal || {})
    + ((s.afwijkers || []).length ? '<div class="klein feitregel">' + s.afwijkers.map(function (x) { return esc(x.partij); }).join(", ") + " anders dan de fractie</div>" : "")
    + '<span class="pijl" aria-hidden="true">›</span></div>';
}
function stemDetail(s) {
  KOPIEER["s:" + s.id] = function () { return feitenStem(s); };
  var afw = (s.afwijkers || []).map(function (x) { return esc(x.partij) + ": " + POS[x.partij_stem][1] + "; fractie " + esc(x.fractie) + " (meerderheid): " + POS[x.fractie_stem][1]; });
  var v = s.vergadering || {};
  var h = '<div class="klein"><span class="label taal">EN</span>' + (s.terreinen || []).map(function (t) { return ' <span class="label">' + esc(t) + "</span>"; }).join("") + "</div>"
    + "<h2 class='paneel-kop'>" + esc(s.titel) + "</h2>"
    + dossierKoppel(s)
    + '<div class="feiten">' + (stemWat(s) ? "<div><span>Wat</span><b>" + esc(stemWat(s)) + "</b></div>" : "") + '<div><span>Vergadering</span><b>' + esc(vergaderingTekst(s, true)) + "</b></div>"
    + (v.notulen ? "<div><span>Stukken</span><b>" + a(v.agenda, "Agenda") + " · " + a(v.notulen, "Notulen") + " · " + a(v.uitslagen, "Hoofdelijke stemmingen") + "</b></div>" : "") + "</div>"
    + uitslag(s.uitslag) + verdeling(s.totaal || {}) + cijfers(s.totaal || {})
    + '<div class="knoprij"><button class="mini" data-kopieer="s:' + esc(s.id) + '">Kopieer feiten</button>' + deelKnop(s.titel, s.url) + a(s.url, "HowTheyVote") + (s.document ? a(s.document, "Tekst") : "")
    + "</div>"
    + "<h3 class='sectiekop'>Nederlandse partijen</h3><p class='klein'>Wat de meeste leden van de partij stemden.</p>" + nlPartijen(s.nl_partijen)
    + (afw.length ? "<p class='klein'><b>Partij stemde anders dan de meerderheid van haar fractie:</b><br>" + afw.join("<br>") + "</p>" : "")
    + "<h3 class='sectiekop'>Per fractie</h3><div class='tabel-scroll'><table><tr><th>Fractie</th><th>voor</th><th>tegen</th><th>onth.</th><th>niet</th></tr>"
    + Object.keys(s.per_fractie || {}).map(function (f) { var c = s.per_fractie[f]; return "<tr><td>" + fr(f) + "</td><td>" + (c.FOR || 0) + "</td><td>" + (c.AGAINST || 0) + "</td><td>" + (c.ABSTENTION || 0) + "</td><td>" + (c.DID_NOT_VOTE || 0) + "</td></tr>"; }).join("") + "</table></div>"
    + "<h3 class='sectiekop'>Nederlandse europarlementariërs</h3><ul class='punten'>" + (s.nl_leden || []).slice().sort(function (x, y) { return x.partij.localeCompare(y.partij) || x.naam.localeCompare(y.naam); }).map(function (m) {
      return '<li><a href="#mensen?id=' + esc(m.id) + '">' + esc(m.naam) + "</a> (" + esc(m.partij) + ", " + esc(m.fractie) + "): <b>" + POS[m.positie][1] + "</b>"
        + (m.anders_dan_partij ? ' <span class="label">anders dan partij</span>' : "") + (m.anders_dan_fractie ? ' <span class="label">anders dan fractie</span>' : "") + "</li>";
    }).join("") + "</ul>";
  if ((s.verwant || []).length) h += "<h3 class='sectiekop'>Deelstemmingen en amendementen</h3><ul class='punten'>" + s.verwant.map(function (v) {
    return "<li>" + esc(v.nummer && v.nummer !== "§" ? "Amendement " + v.nummer + " (" + v.onderwerp + ")" : (v.wat || v.onderwerp)) + ": " + (v.uitslag === "ADOPTED" ? "aangenomen" : "verworpen") + " · " + a("https://howtheyvote.eu/votes/" + v.id, "details") + "</li>";
  }).join("") + "</ul>";
  return h;
}
function openStem(id, dieper) {
  var s = STEM_INDEX[id];
  if (!s) return;
  openPaneel("Stemming", stemDetail(s), { dieper: dieper, vol: true });
  // het kaartje van het dossier aanvullen zodra de dossiers er zijn
  if (s.in_dossiers && !DOSSIER_INDEX[s.procedure]) dossiersLaden().then(function () {
    alle('#paneel-lijf .dkoppel[data-ref="' + s.procedure + '"]').forEach(function (el) { el.outerHTML = dossierKoppel(s); });
  }).catch(function () {});
}
function stemmenLaden() { return laden("stemmen").then(function (d) { if (!STEMMEN) STEMMEN = d; stemIndex(); return STEMMEN; }); }

var SOPT = {};
var SZ = maakZoekbalk({
  naam: "s", balk: "s-balk",
  soorten: {
    onderwerp: { naam: "Onderwerp", opties: function () { return SOPT.terrein || []; } },
    uitslag: { naam: "Uitslag", opties: function () { return [["ADOPTED", "Aangenomen"], ["REJECTED", "Verworpen"]]; } },
    zitting: { naam: "Zitting", opties: function () { return SOPT.zitting || []; } },
    nl: { naam: "Nederland", opties: function () { return [["verdeeld", "NL-partijen stemden verschillend", "nederland verdeeld"], ["afwijk", "NL-partij anders dan haar fractie", "nederland fractie afwijkend"]]; } }
  },
  voorbeelden: { onderwerp: 3, uitslag: 2, zitting: 2, nl: 2 },
  telling: function (tokens, tekst) { return STEMMEN ? STEMMEN.stemmen.filter(function (x) { return stemPast(x, tokens, tekst); }).length : null; },
  opnieuw: function () { sN = LAAD_STAP; if (STEMMEN && stemmenOpgezet) stemmenTonen(); }
});
var SS = maakSorteer("s", [["datum", "Nieuwste eerst", "Nieuwste"], ["oud", "Oudste eerst", "Oudste"], ["verschil", "Kleinste verschil voor/tegen", "Spannendste"], ["onthouden", "Meeste onthoudingen", "Onthoudingen"]], "datum", function () { if (STEMMEN && stemmenOpgezet) stemmenTonen(); });
function stemPast(s, tokens, tekst) {
  if (!SZ.past("onderwerp", s.terreinen || [], tokens) || !SZ.past("uitslag", s.uitslag, tokens)) return false;
  var d = s.moment.slice(0, 10);
  if (!SZ.past("zitting", (STEMMEN.zittingen || []).filter(function (z) { return d >= z.begin && d <= z.eind; }).map(function (z) { return z.begin; }), tokens)) return false;
  var nl = (tokens || []).filter(function (t) { return t.soort === "nl" && !t.uit; }).map(function (t) { return t.waarde; });
  if (nl.indexOf("verdeeld") >= 0 && !s.nl_verdeeld) return false;
  if (nl.indexOf("afwijk") >= 0 && !(s.afwijkers || []).length) return false;
  return !tekst || zoeker(tekst).past(s.titel + " " + (s.procedure || "") + " " + (s.procedure_titel || ""));
}
var sN = LAAD_STAP;
function stemmenTonen() {
  var zk = zoeker(SZ.tekst);
  var uit = STEMMEN.stemmen.filter(function (s) { return stemPast(s, SZ.tokens, "") && zk.past(s.titel + " " + (s.procedure || "") + " " + (s.procedure_titel || ""), s); });
  var srt = SS.waarde;
  uit.sort(function (x, y) {
    function verschil(s) { return Math.abs((s.totaal.FOR || 0) - (s.totaal.AGAINST || 0)); }
    if (srt === "verschil") return verschil(x) - verschil(y);
    if (srt === "onthouden") return (y.totaal.ABSTENTION || 0) - (x.totaal.ABSTENTION || 0);
    if (srt === "oud") return x.moment.localeCompare(y.moment);
    return y.moment.localeCompare(x.moment);
  });
  uit = zk.ordenen(uit);
  document.getElementById("s-aantal").textContent = uit.length + (uit.length === 1 ? " hoofdstemming. " : " hoofdstemmingen. ");
  var doel = document.getElementById("s-lijst");
  doel.innerHTML = uit.slice(0, sN).map(stemKaart).join("") || '<p class="leeg">Niets gevonden. Haal een filter weg of tik op × om alles te wissen.</p>';
  document.getElementById("s-meer").classList.toggle("verborgen", uit.length <= sN);
  window.euMarkeer(doel);
}
function stemIndex() { STEMMEN.stemmen.forEach(function (s) { STEM_INDEX[s.id] = s; }); }
function stemmenOpties() {
  var ter = {};
  stemIndex();
  STEMMEN.stemmen.forEach(function (s) { (s.terreinen || []).forEach(function (t) { ter[t] = 1; }); });
  SOPT.terrein = Object.keys(ter).sort().map(function (t) { return [t, t]; });
  SOPT.zitting = (STEMMEN.zittingen || []).map(function (z) { return [z.begin, "Zitting " + kort(z.begin) + " – " + kort(z.eind)]; });
}
function stemmenOpzetten() {
  stemmenOpties();
  document.getElementById("s-meer").addEventListener("click", function () { sN += LAAD_STAP; stemmenTonen(); });
  bijKaartTik(document.getElementById("s-lijst"), ".skaart", function (k) { openStem(k.dataset.id); });
}
function stemmenTab(q) {
  var doel = document.getElementById("s-lijst");
  // al getoond: niet opnieuw opbouwen (dat gaf een flits bij het vegen tussen de delen)
  if (stemmenOpgezet && STEMMEN && doel.children.length && !(q && q.id)) return;
  bezig(doel);
  laden("stemmen").then(function (d) {
    if (!STEMMEN) STEMMEN = d;
    if (!stemmenOpgezet) { stemmenOpgezet = true; stemmenOpzetten(); }
    stemmenTonen();
    if (q.id) openStem(q.id);
  }).catch(function () { laadFout(doel); });
}

// verversen van het deel Stemmingen (via de ring bovenaan Dossiers)
function stemmenVerversen() {
  return verversBuild(["stemmen"], function () {
    var oud = {};
    (STEMMEN ? STEMMEN.stemmen : []).forEach(function (x) { oud[x.id] = 1; });
    return verversData("stemmen").then(function (d) {
      STEMMEN = d;
      Object.keys(STEM_INDEX).forEach(function (k) { delete STEM_INDEX[k]; });
      stemmenOpties();
      if (stemmenOpgezet) stemmenTonen();
      return d.stemmen.filter(function (x) { return !oud[x.id]; }).length;
    });
  });
}

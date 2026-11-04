// =====================================================================
//  nieuws.js (tab Pers): de berichten staan al in de pagina. Hetzelfde nieuwsfeit van meerdere
//  media is bij het bouwen al één verhaal geworden; tik erop en kies welke bron je opent.
//  Zoeken en filteren met tokens (Bron, Onderwerp, Taal), en de instellingen (bronnen uit,
//  Engelstalig uit). Persberichten hebben de kleur van hun instelling, net als in de agenda.
// =====================================================================

function nieuwsOpties(veld) {
  var tel = {};
  alle("li.bericht").forEach(function (li) {
    (veld === "bron" ? (li.dataset.bronnen || li.dataset.bron).split("|") : li.dataset.terrein.split("|")).forEach(function (x) { if (x) tel[x] = (tel[x] || 0) + 1; });
  });
  return Object.keys(tel).sort(function (x, y) { return x === "Overig" ? 1 : y === "Overig" ? -1 : x.localeCompare(y); })
    .filter(function (x) { return veld !== "bron" || INST.bronnenUit.indexOf(x) < 0; })
    .map(function (x) { return [x, x]; });
}
var PERS_KLEUR = { "Europese Commissie": "com", "Raad van de EU": "raad" };
var NZ = maakZoekbalk({
  naam: "n", balk: "n-balk",
  soorten: {
    bron: { naam: "Bron", opties: function () { return nieuwsOpties("bron"); }, kleur: function (w) { return PERS_KLEUR[w] || ""; } },
    onderwerp: { naam: "Onderwerp", opties: function () { return nieuwsOpties("terrein"); } },
    taal: { naam: "Taal", opties: function () { return [["nl", "Nederlands", "nederlandstalig"], ["en", "Engels", "engelstalig english"]]; } }
  },
  voorbeelden: { bron: 4, onderwerp: 3, taal: 2 },
  telling: function (tokens, tekst) { return alle("li.bericht").filter(function (li) { return nieuwsPast(li, tokens, tekst); }).length; },
  opnieuw: function () { persN = {}; pasToe(); }
});
function nieuwsPast(li, tokens, tekst) {
  var bronnen = (li.dataset.bronnen || li.dataset.bron).split("|");
  if (INST.bronnenUit.indexOf(li.dataset.bron) >= 0 || (!INST.engels && li.dataset.taal === "en")) return false;
  if (!NZ.past("bron", bronnen, tokens) || !NZ.past("onderwerp", li.dataset.terrein.split("|"), tokens) || !NZ.past("taal", li.dataset.taal, tokens)) return false;
  return !tekst || zoeker(tekst).past(li.textContent + " " + bronnen.join(" "));
}
// Niet alles tegelijk: eerst LAAD_STAP (20) berichten per deel, het plusje onderaan laadt er 20 bij.
// Zoeken en filteren kijkt wel naar alle berichten.
var PERS_STAP = LAAD_STAP, persN = {};
function pasToe() {
  var z = zoeker(NZ.tekst);
  alle("#kanaal-media, #kanaal-officieel").forEach(function (d) {
    var n = 0, max = persN[d.id] || PERS_STAP;
    alle("li.bericht", d).forEach(function (li) {
      var ok = nieuwsPast(li, NZ.tokens, "") && z.past(li.textContent + " " + (li.dataset.bronnen || ""), li);
      li.classList.toggle("verborgen", !ok);
      if (ok) n++;
      li.classList.toggle("later", ok && n > max);
    });
    var k = d.querySelector("[data-meer-pers]");
    if (k) k.classList.toggle("verborgen", n <= max);
  });
  var deel = document.querySelector("#kanaal-media:not(.verborgen), #kanaal-officieel:not(.verborgen)");
  var zichtbaar = deel ? alle("li.bericht:not(.verborgen)", deel).length : 0;
  alle(".nieuwslijst ul.berichten").forEach(function (ul) {
    var leeg = !ul.querySelector("li.bericht:not(.verborgen):not(.later)");
    ul.classList.toggle("verborgen", leeg);
    ul.previousElementSibling.classList.toggle("verborgen", leeg);
  });
  document.getElementById("niets").classList.toggle("verborgen", zichtbaar > 0);
}
// bron en onderwerp in de lijst: vasthouden = alleen dit tonen of verbergen
alle("li.bericht").forEach(function (li) {
  var b = li.querySelector(".meta .bron");
  if (b && !li.classList.contains("verhaal")) { b.dataset.tokZoeker = "n"; b.dataset.tokSoort = "bron"; b.dataset.tokWaarde = li.dataset.bron; }
  alle(".labels .label", li).forEach(function (l) {
    if (l.classList.length === 1) { l.dataset.tokZoeker = "n"; l.dataset.tokSoort = "onderwerp"; l.dataset.tokWaarde = l.textContent; }
  });
});
// een verhaal met meerdere bronnen: kies welke je opent
function verhaalDetail(li) {
  var l = JSON.parse(li.dataset.verhaal), terreinen = li.dataset.terrein.split("|").filter(Boolean);
  return '<div class="klein labels-rij">' + terreinen.map(function (t) { return '<span class="label">' + esc(t) + "</span>"; }).join("") + "</div>"
    + "<h2 class='paneel-kop'>" + esc(l[0].titel) + "</h2>"
    + '<p class="klein">' + l.length + " bronnen schreven hierover. Kies welke je opent.</p>"
    + '<div class="bronkeuze">' + l.map(function (x) {
      return '<a class="bronoptie" href="' + esc(x.link) + '" target="_blank" rel="noopener"><div class="bk-kop"><b>' + esc(x.bron) + "</b><span>" + esc(x.tijd) + (x.taal === "en" ? ' · <span class="label taal">EN</span>' : "") + "</span></div>"
        + "<div>" + esc(x.titel) + '</div><svg class="ik" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg></a>';
    }).join("") + "</div>";
}
document.getElementById("nieuws").addEventListener("click", function (ev) {
  var k = ev.target.closest(".verhaal-kaart");
  if (!k || ev.target.closest("[data-tok-zoeker]")) return;
  openPaneel("Verhaal", verhaalDetail(k.closest("li")), { vol: true });
});
document.getElementById("nieuws").addEventListener("keydown", function (ev) {
  var k = ev.target.closest && ev.target.closest(".verhaal-kaart");
  if (k && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); openPaneel("Verhaal", verhaalDetail(k.closest("li")), { vol: true }); }
});
alle("[data-meer-pers]").forEach(function (k) {
  k.addEventListener("click", function () { var d = k.closest("#kanaal-media, #kanaal-officieel"); persN[d.id] = (persN[d.id] || PERS_STAP) + PERS_STAP; pasToe(); });
});
document.addEventListener("eu-segment", function (ev) { if (/^kanaal-/.test(ev.detail)) pasToe(); });
function nieuwsInst() { pasToe(); }
pasToe();
if (INST.nieuwsDeel === "kanaal-officieel") toonSegment("kanaal-officieel");

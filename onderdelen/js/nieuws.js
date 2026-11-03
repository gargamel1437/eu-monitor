// =====================================================================
//  nieuws.js: de berichten staan al in de pagina. Hier: zoeken en de filters (onderwerp en
//  bron, meerdere tegelijk), en de instellingen (bronnen uit, Engelstalig uit).
//  Hetzelfde nieuws van meerdere media is al bij het bouwen samengevoegd ("Ook bij: …").
// =====================================================================

var nieuwsZoek = "", nieuwsWacht = null;
function nieuwsOpties(veld) {
  var tel = {};
  alle("li.bericht").forEach(function (li) {
    (veld === "bron" ? (li.dataset.bronnen || li.dataset.bron).split("|") : li.dataset.terrein.split("|")).forEach(function (x) { if (x) tel[x] = (tel[x] || 0) + 1; });
  });
  return Object.keys(tel).sort(function (x, y) { return x === "Overig" ? 1 : y === "Overig" ? -1 : x.localeCompare(y); })
    .filter(function (x) { return veld !== "bron" || INST.bronnenUit.indexOf(x) < 0; })
    .map(function (x) { return [x, x + " (" + tel[x] + ")"]; });
}
var NF = maakFilter("n", [
  { id: "onderwerp", naam: "Onderwerp", meer: true, standaard: [], opties: function () { return nieuwsOpties("terrein"); } },
  { id: "bron", naam: "Bron", meer: true, standaard: [], opties: function () { return nieuwsOpties("bron"); } }
], function () { pasToe(); });

function pasToe() {
  var zichtbaar = 0, z = zoeker(nieuwsZoek);
  alle("li.bericht").forEach(function (li) {
    var bronnen = (li.dataset.bronnen || li.dataset.bron).split("|");
    var ok = INST.bronnenUit.indexOf(li.dataset.bron) < 0 && (INST.engels || li.dataset.taal !== "en")
      && NF.past("onderwerp", li.dataset.terrein.split("|")) && NF.past("bron", bronnen)
      && z.past(li.textContent + " " + bronnen.join(" "), li);
    li.classList.toggle("verborgen", !ok);
  });
  var paneel = document.querySelector("#nieuws [id^=kanaal-]:not(.verborgen)");
  zichtbaar = paneel ? alle("li.bericht:not(.verborgen)", paneel).length : 0;
  alle(".nieuwslijst ul.berichten").forEach(function (ul) {
    var leeg = !ul.querySelector("li.bericht:not(.verborgen)");
    ul.classList.toggle("verborgen", leeg);
    ul.previousElementSibling.classList.toggle("verborgen", leeg);
  });
  document.getElementById("niets").classList.toggle("verborgen", zichtbaar > 0);
  bedoelJe("zoek", z);
}
document.getElementById("zoek").addEventListener("input", function (ev) {
  clearTimeout(nieuwsWacht);
  nieuwsWacht = setTimeout(function () { nieuwsZoek = ev.target.value.trim(); pasToe(); }, 150);
});
document.addEventListener("eu-segment", function (ev) { if (/^kanaal-/.test(ev.detail)) pasToe(); });
function nieuwsInst() { pasToe(); }
pasToe();
if (INST.nieuwsDeel === "kanaal-officieel") toonSegment("kanaal-officieel");

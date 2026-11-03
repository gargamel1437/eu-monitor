// ---------- Nieuws: filters op onderwerp, bron en zoekterm (de berichten zelf staan al in de pagina) ----------
var filter = { terrein: "", bron: "", zoek: "" }, nieuwsWacht = null;
function pasToe() {
  var zichtbaar = 0, z = zoeker(filter.zoek);
  alle("li.bericht").forEach(function (li) {
    var ok = (!filter.terrein || li.dataset.terrein.split("|").indexOf(filter.terrein) >= 0)
      && (!filter.bron || li.dataset.bron === filter.bron)
      && z.past(li.textContent + " " + (li.dataset.bron || ""), li);
    li.classList.toggle("verborgen", !ok);
    if (ok) zichtbaar++;
  });
  var paneel = document.querySelector("#nieuws [id^=kanaal-]:not(.verborgen)");
  zichtbaar = paneel ? alle("li.bericht:not(.verborgen)", paneel).length : zichtbaar;
  alle(".nieuwslijst ul.berichten").forEach(function (ul) {
    var leeg = !ul.querySelector("li.bericht:not(.verborgen)");
    ul.classList.toggle("verborgen", leeg);
    ul.previousElementSibling.classList.toggle("verborgen", leeg);
  });
  document.getElementById("niets").classList.toggle("verborgen", zichtbaar > 0);
  bedoelJe("zoek", z);
}
function chips(id, doel, sleutel, opnieuw) {
  var rij = document.getElementById(id);
  if (!rij) return;
  rij.addEventListener("click", function (ev) {
    var knop = ev.target.closest(".chip");
    if (!knop) return;
    alle(".chip", rij).forEach(function (c) { c.classList.toggle("actief", c === knop); });
    doel[sleutel] = knop.dataset.waarde;
    opnieuw();
  });
}
chips("terrein-knoppen", filter, "terrein", pasToe);
alle(".bron-knoppen").forEach(function (rij) {
  rij.addEventListener("click", function (ev) {
    var knop = ev.target.closest(".chip");
    if (!knop) return;
    alle(".chip", rij).forEach(function (c) { c.classList.toggle("actief", c === knop); });
    filter.bron = knop.dataset.waarde;
    pasToe();
  });
});
// bij wisselen tussen media en officieel: bronfilter terug op 'Alles'
alle("#kanaal-schakel button").forEach(function (b) {
  b.addEventListener("click", function () {
    filter.bron = "";
    alle(".bron-knoppen .chip").forEach(function (c) { c.classList.toggle("actief", c.dataset.waarde === ""); });
    pasToe();
  });
});
document.getElementById("zoek").addEventListener("input", function (ev) {
  clearTimeout(nieuwsWacht);
  nieuwsWacht = setTimeout(function () { filter.zoek = ev.target.value.trim(); pasToe(); }, 150);
});


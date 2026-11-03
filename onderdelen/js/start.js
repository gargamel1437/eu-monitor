// =====================================================================
//  start.js: bouw een tabblad pas op als je het opent. Links als #dossiers?open=… of
//  #mensen?id=… openen meteen het juiste detail. Stemmingen en Mensen delen één tab
//  (Stemmen), met een schakelaar; #mensen opent die tab op het deel Mensen.
// =====================================================================

function hashVraag() {
  var h = location.hash, i = h.indexOf("?"), q = {};
  if (i < 0) return q;
  h.slice(i + 1).split("&").forEach(function (p) { var kv = p.split("="); q[kv[0]] = decodeURIComponent(kv[1] || ""); });
  return q;
}
function bijTab(naam) {
  var q = hashVraag(), adres = hashNaam();
  try {
    if (naam === "overzicht") overzichtTab();
    else if (naam === "dossiers") dossiersTab(q);
    else if (naam === "stemmingen") {
      if (adres === "mensen") { toonSegment("deel-mensen"); mensenTab(q); }
      else { if (q.id) toonSegment("deel-stemmingen"); stemmenTab(q); }
    }
    else if (naam === "agenda") agendaTab(q);
  } catch (e) { if (window.console) console.error(e); }
}
document.addEventListener("eu-tab", function (ev) { sluitSheet(); bijTab(ev.detail); });
// het deel Mensen laadt zijn gegevens pas als je het opent
document.addEventListener("eu-segment", function (ev) { if (ev.detail === "deel-mensen") mensenTab({}); });
bijTab(huidigeTab());

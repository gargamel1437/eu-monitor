// =====================================================================
//  start.js: bouw een tabblad pas op als je het opent. Links als #dossiers?open=… of
//  #mensen?id=… openen meteen het juiste detail.
// =====================================================================

function hashVraag() {
  var h = location.hash, i = h.indexOf("?"), q = {};
  if (i < 0) return q;
  h.slice(i + 1).split("&").forEach(function (p) { var kv = p.split("="); q[kv[0]] = decodeURIComponent(kv[1] || ""); });
  return q;
}
function bijTab(naam) {
  var q = hashVraag();
  try {
    if (naam === "overzicht") overzichtTab();
    else if (naam === "dossiers") dossiersTab(q);
    else if (naam === "stemmingen") stemmenTab(q);
    else if (naam === "mensen") mensenTab(q);
    else if (naam === "agenda") agendaTab();
  } catch (e) { if (window.console) console.error(e); }
}
document.addEventListener("eu-tab", function (ev) { sluitSheet(); bijTab(ev.detail); });
bijTab(huidigeTab());

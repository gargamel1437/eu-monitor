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
    else if (naam === "dossiers") {
      if (adres === "stemmingen" || adres === "stemmen") { toonSegment("deel-stemmingen"); stemmenTab(q); }
      else { if (q.open || q.q != null) toonSegment("deel-dossiers"); dossiersTab(q); }
    }
    else if (naam === "mensen") mensenTab(q);
    else if (naam === "agenda") agendaTab(q);
  } catch (e) { if (window.console) console.error(e); }
}
// Na het openen van een detail via het adres (#agenda?item=…) het adres weer opschonen, zodat
// het paneel niet opnieuw opent als je later naar deze tab teruggaat.
function adresOpschonen() {
  var h = location.hash, i = h.indexOf("?");
  if (i < 0) return;
  var basis = h.slice(0, i);
  if (/[?&](item|id|open)=/.test(h)) history.replaceState(history.state, "", basis + (/[?&]q=/.test(h) ? "?" + h.slice(i + 1).split("&").filter(function (x) { return /^q=/.test(x); }).join("&") : ""));
}
document.addEventListener("eu-tab", function (ev) { sluitSheet(); verbergSug(); bijTab(ev.detail); setTimeout(adresOpschonen, 1500); });

// Een detail openen als een scherm dieper in het paneel (vanuit een ander detail).
function openDiep(hash) {
  var naam = hash.slice(1).split("?")[0], q = {};
  hash.slice(hash.indexOf("?") + 1).split("&").forEach(function (p) { var kv = p.split("="); q[kv[0]] = decodeURIComponent(kv[1] || ""); });
  function mis() { sluitPaneel(false, "vervang"); gaNaar(hash); }
  if (naam === "stemmingen" && q.id) stemmenLaden().then(function () { STEM_INDEX[q.id] ? openStem(q.id, true) : mis(); }).catch(mis);
  else if (naam === "dossiers" && q.open) dossiersLaden().then(function () { DOSSIER_INDEX[q.open] ? openDossier(q.open, true) : mis(); }).catch(mis);
  else if (naam === "mensen" && q.id) mensenKlaar().then(function () { if (MENSEN_INDEX[q.id] || /^(c-|nl-)/.test(q.id)) openPersoon(q.id, true); else mis(); }).catch(mis);
  else if (naam === "agenda" && q.item) agendaLaden().then(function () { AGENDA_INDEX[q.item] ? openAgenda(q.item, true) : mis(); }).catch(mis);
  else mis();
}
// het deel Stemmingen laadt zijn gegevens pas als je het opent
document.addEventListener("eu-segment", function (ev) { if (ev.detail === "deel-stemmingen") stemmenTab({}); });
bijTab(huidigeTab());
setTimeout(adresOpschonen, 1500);

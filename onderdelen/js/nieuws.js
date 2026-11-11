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
function persKoppel() {
  alle("li.bericht").forEach(function (li) {
    var b = li.querySelector(".meta .bron");
    if (b && !li.classList.contains("verhaal")) { b.dataset.tokZoeker = "n"; b.dataset.tokSoort = "bron"; b.dataset.tokWaarde = li.dataset.bron; }
    alle(".labels .label", li).forEach(function (l) {
      if (l.classList.length === 1) { l.dataset.tokZoeker = "n"; l.dataset.tokSoort = "onderwerp"; l.dataset.tokWaarde = l.textContent; }
    });
  });
}
persKoppel();
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

// ---------- verversen: omlaag trekken bovenaan Pers ----------
// Zonder GitHub-sleutel: de nieuwste build ophalen (data/pers.json). Met sleutel (Instellingen →
// Pers): GitHub laat de snelle nieuwsronde draaien (workflow met alleen_nieuws), die de feeds
// ophaalt en de site opnieuw online zet; de app kijkt elke 10 s of het nieuws er al is. Dat duurt
// een à twee minuten; intussen draait een klein ringetje in de balk bovenaan en lees je gewoon door.
var PERS_STAND = META.nieuws_bijgewerkt || META.bijgewerkt || "";
var GH = { repo: "gargamel1437/eu-monitor", workflow: "europa.yml", tak: "main" };
var PERS_BEZIG = null;
function ghSleutel() { return (lees("eu-gh-sleutel") || "").trim(); }
function persHaal() { return verversData("pers"); }
function persLinks(li) {
  if (li.dataset.verhaal) { try { return JSON.parse(li.dataset.verhaal).map(function (x) { return x.link; }); } catch (e) {} }
  var a = li.querySelector("a[href]");
  return [a ? a.getAttribute("href") : li.textContent];
}
// nieuwe lijsten in de pagina zetten; geeft het aantal nieuwe berichten in het deel dat je ziet
function persToepassen(d) {
  var oud = {};
  alle("li.bericht").forEach(function (li) { persLinks(li).forEach(function (l) { oud[l] = 1; }); });
  document.querySelector("#kanaal-media .nieuwslijst").innerHTML = d.media;
  document.querySelector("#kanaal-officieel .nieuwslijst").innerHTML = d.officieel;
  var tel = { "kanaal-media": d.aantal_media, "kanaal-officieel": d.aantal_officieel };
  alle("#kanaal-schakel button").forEach(function (b) { var s = b.querySelector("small"); if (s && tel[b.dataset.toon] != null) s.textContent = tel[b.dataset.toon]; });
  PERS_STAND = d.bijgewerkt;
  persKoppel();
  pasToe();
  var deel = document.querySelector("#kanaal-media:not(.verborgen), #kanaal-officieel:not(.verborgen)");
  var nieuw = alle("li.bericht", deel).filter(function (li) { return !persLinks(li).some(function (l) { return oud[l]; }); });
  nieuw.forEach(function (li, n) {
    li.style.animationDelay = Math.min(n, 10) * 35 + "ms";
    li.classList.add("nieuw-in", "vers");
    setTimeout(function () { li.classList.remove("nieuw-in"); li.style.animationDelay = ""; }, 900);
    setTimeout(function () { li.classList.remove("vers"); }, 2600);
  });
  try { overzichtTonen(); } catch (e) {}
  return nieuw.filter(function (li) { return !li.classList.contains("verborgen"); }).length;
}
function persUitkomst(n) { return n ? n + " nieuw" : "Niets nieuws"; }

// het kleine ringetje in de balk bovenaan Pers
var PS = document.getElementById("n-status");
function persStatus(stand, tekst) {
  if (!PS) return;
  clearTimeout(persStatus.t);
  PS.hidden = false;
  PS.className = "ververs-status " + stand;
  PS.querySelector(".vs-tekst").textContent = tekst;
  if (stand !== "bezig") persStatus.t = setTimeout(function () { PS.classList.add("weg"); setTimeout(function () { PS.hidden = true; }, 300); }, stand === "klaar" ? 2400 : 4500);
}

function gh(pad, opties) {
  opties = opties || {};
  return fetch("https://api.github.com/repos/" + GH.repo + pad, {
    method: opties.method || "GET", cache: "no-store",
    headers: { "Authorization": "Bearer " + ghSleutel(), "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: opties.body ? JSON.stringify(opties.body) : undefined
  }).then(function (r) {
    if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error("sleutel");
    if (!r.ok) throw new Error("github");
    return r.status === 204 ? null : r.json();
  });
}
// loopt er al een ronde (ook als die op een ander apparaat is gestart)? Dan geen tweede.
function ghLopend() {
  return gh("/actions/runs?event=workflow_dispatch&per_page=5").then(function (d) {
    var grens = Date.now() - 15 * 60000;
    return (d.workflow_runs || []).some(function (r) { return r.status !== "completed" && Date.parse(r.created_at) > grens; });
  });
}
function ghStart() {
  return ghLopend().then(function (loopt) {
    if (!loopt) return gh("/actions/workflows/" + GH.workflow + "/dispatches", { method: "POST", body: { ref: GH.tak, inputs: { alleen_nieuws: true } } });
  });
}
// wachten tot de nieuwe build online staat (elke 10 s kijken, hoogstens 6 minuten)
function persWacht(voor) {
  var begin = Date.now();
  return new Promise(function (goed, fout) {
    (function kijk() {
      persHaal().then(function (d) {
        if (d.bijgewerkt > voor) goed(d);
        else if (Date.now() - begin > 6 * 60000) fout(new Error("duur"));
        else setTimeout(kijk, 10000);
      }, function () {
        if (Date.now() - begin > 6 * 60000) fout(new Error("duur")); else setTimeout(kijk, 10000);
      });
    })();
  });
}
function persOpGitHub() {
  var voor = PERS_STAND;
  persStatus("bezig", "Nieuws wordt opgehaald");
  PERS_BEZIG = ghStart().then(function () { return persWacht(voor); }).then(function (d) {
    var n = persToepassen(d);
    persStatus("klaar", persUitkomst(n));
  }, function (e) {
    var m = e && e.message;
    persStatus("fout", m === "sleutel" ? "GitHub-sleutel werkt niet. Kijk in Instellingen → Pers."
      : m === "duur" ? "Duurt langer dan normaal. Straks staat het er vanzelf als je opnieuw ververst."
      : "Ophalen lukte niet. Controleer je internet.");
  }).then(function () { PERS_BEZIG = null; });
}
function persVerversen() {
  if (PERS_BEZIG) return Promise.resolve("stil");   // er loopt al een ronde; het ringetje staat bovenin
  var voor = PERS_STAND;
  // eerst kijken of er al een nieuwere build is (bijvoorbeeld van 12:15)
  var eerst = persHaal().then(function (d) { return d.bijgewerkt > voor ? persToepassen(d) : -1; });
  if (!ghSleutel()) {
    return eerst.then(function (n) {
      kortBericht(n < 0 ? "Niets nieuws · stand van " + uurVan(PERS_STAND) + " uur" : persUitkomst(n));
      return true;
    }, function (e) { kortBericht("Verversen lukte niet. Controleer je internet."); throw e; });
  }
  // met sleutel: na ongeveer een seconde veert de lijst terug, het ophalen gaat bovenin door
  return Promise.all([eerst.catch(function () { return -1; }), new Promise(function (k) { setTimeout(k, 1000); })]).then(function () {
    persOpGitHub();
    return "stil";
  });
}
verversKnop("n-ververs", persVerversen);

// js/tournante-membre.js — « Ma tontine tournante » (espace Membre)
// Module autonome : n'affecte aucun contrat ni aucun calcul existant.
import { auth, db, onAuthStateChanged, doc, collection, query, where, onSnapshot } from "./firebase-config.js";
import { formatGNF, formatDate, formatDateHeure } from "./utils.js";

const PERIODICITES = {
  jour: "Journalière",
  semaine: "Hebdomadaire",
  mois: "Mensuelle",
  trimestre: "Trimestrielle",
  semestre: "Semestrielle",
  annee: "Annuelle",
};

const etat = {
  unsubMembres: null,
  memberships: [],
  caisses: {},
  operations: {},
  unsubsCaisses: {},
  unsubsOps: {},
  ouverts: new Set(),
};

function esc(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function dateDuTour(caisse, tour) {
  const d = new Date(`${caisse.date_limite_inscription}T00:00:00`);
  const n = tour - 1;
  switch (caisse.periodicite) {
    case "jour": d.setDate(d.getDate() + n); break;
    case "semaine": d.setDate(d.getDate() + 7 * n); break;
    case "mois": d.setMonth(d.getMonth() + n); break;
    case "trimestre": d.setMonth(d.getMonth() + 3 * n); break;
    case "semestre": d.setMonth(d.getMonth() + 6 * n); break;
    default: d.setFullYear(d.getFullYear() + n);
  }
  return d;
}

function zone() {
  let z = document.getElementById("tontineTournanteZone");
  if (!z) {
    const ancre = document.getElementById("mesContratsZone");
    if (!ancre) return null;
    z = document.createElement("div");
    z.id = "tontineTournanteZone";
    ancre.insertAdjacentElement("afterend", z);
  }
  return z;
}

function ligne(label, valeur) {
  return `<div class="cotis-row"><span>${label}</span><span>${valeur}</span></div>`;
}

function carte(m) {
  const c = etat.caisses[m.caisse_id];
  if (!c) {
    return `<div class="contrat-card"><strong>Tontine tournante</strong><p style="color:#999; font-size:13px; margin-top:6px;">Chargement…</p></div>`;
  }

  const ops = (etat.operations[m.id] || [])
    .slice()
    .sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0));
  const solde = ops.reduce((s, o) => s + Number(o.montant || 0), 0);
  const arriere = (m.arrieres || []).reduce((s, a) => s + Number(a.montant || 0), 0);
  const cotisation = Number(c.montant_cotisation || 0);
  const aApporter = cotisation + arriere;
  const enCours = c.statut === "en_cours";
  const cloturee = c.statut === "cloturee";
  const statutTexte = c.statut === "inscriptions" ? "Inscriptions ouvertes" : enCours ? "En cours" : "Clôturée";

  const rangTexte = m.rang
    ? `Tour ${m.rang}${c.nb_tours ? " / " + c.nb_tours : ""}`
    : "En attente du démarrage";
  const dateTour = m.rang && c.date_limite_inscription ? formatDate(dateDuTour(c, m.rang)) : "—";

  const idTitre = `tt-titre-${m.id}`;
  const idListe = `tt-liste-${m.id}`;
  const ouvert = etat.ouverts.has(m.id);

  return `
    <div class="contrat-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong>Ma tontine tournante — ${esc(c.nom)}</strong>
        <span class="badge ${cloturee ? "refuse" : enCours ? "approuve" : "en-attente"}" style="width:auto;">${esc(statutTexte)}</span>
      </div>
      <p style="text-align:center; color:#666; font-size:12px; margin-top:6px;">Solde de sécurité</p>
      <div class="contrat-solde" style="${solde < 0 ? "color:#c0392b;" : ""}">${formatGNF(solde)}</div>
      ${ligne("Périodicité", esc(PERIODICITES[c.periodicite] || ""))}
      ${ligne("Cotisation", formatGNF(cotisation))}
      ${ligne("Mon rang de passage", esc(rangTexte))}
      ${ligne("Date de mon tour", dateTour)}
      ${enCours ? ligne("Tour en cours", `${esc(c.tour_actuel)} / ${esc(c.nb_tours)}`) : ""}
      ${enCours && c.beneficiaire_nom ? ligne("Bénéficiaire du tour en cours", esc(c.beneficiaire_nom)) : ""}
      ${!cloturee ? ligne("À apporter à la prochaine réunion", `<b>${formatGNF(aApporter)}</b>`) : ""}
      ${arriere > 0 ? `<p style="font-size:13px; color:#c0392b; font-weight:bold; margin-top:6px;">Arriéré à rattraper : ${formatGNF(arriere)} (inclus ci-dessus)</p>` : ""}
      ${solde < 0 ? `<p style="font-size:12px; color:#c0392b; margin-top:6px;">Votre solde de sécurité est négatif : contactez votre collecteur pour le réapprovisionner.</p>` : ""}
      <h3 class="collapsible-title ${ouvert ? "ouvert" : ""}" id="${idTitre}" style="margin-top:12px; font-size:14px;">Historique du solde de sécurité</h3>
      <div id="${idListe}" class="${ouvert ? "" : "hidden"}" style="margin-top:6px;">
        ${ops.length === 0
          ? '<p style="color:#999; font-size:13px;">Aucun mouvement.</p>'
          : ops.slice(0, 20).map((o) => `
              <div class="cotis-row"><span>${formatDateHeure(o.date)} — ${esc(o.libelle || "")}</span><span style="${Number(o.montant) < 0 ? "color:#c0392b;" : "color:#198754;"}">${formatGNF(o.montant)}</span></div>
            `).join("")}
      </div>
    </div>`;
}

function render() {
  const z = zone();
  if (!z) return;
  if (etat.memberships.length === 0) {
    z.innerHTML = "";
    return;
  }
  z.innerHTML = etat.memberships.map(carte).join("");
  etat.memberships.forEach((m) => {
    const titre = document.getElementById(`tt-titre-${m.id}`);
    const liste = document.getElementById(`tt-liste-${m.id}`);
    if (!titre || !liste) return;
    titre.addEventListener("click", () => {
      liste.classList.toggle("hidden");
      titre.classList.toggle("ouvert");
      if (liste.classList.contains("hidden")) etat.ouverts.delete(m.id);
      else etat.ouverts.add(m.id);
    });
  });
}

function synchroniserAbonnements() {
  const idsMembres = new Set(etat.memberships.map((m) => m.id));
  const idsCaisses = new Set(etat.memberships.map((m) => m.caisse_id));

  Object.keys(etat.unsubsOps).forEach((id) => {
    if (!idsMembres.has(id)) {
      etat.unsubsOps[id]();
      delete etat.unsubsOps[id];
      delete etat.operations[id];
    }
  });
  Object.keys(etat.unsubsCaisses).forEach((id) => {
    if (!idsCaisses.has(id)) {
      etat.unsubsCaisses[id]();
      delete etat.unsubsCaisses[id];
      delete etat.caisses[id];
    }
  });

  etat.memberships.forEach((m) => {
    if (!etat.unsubsOps[m.id]) {
      etat.unsubsOps[m.id] = onSnapshot(
        query(collection(db, "tournante_operations"), where("membre_id", "==", m.id)),
        (snap) => {
          etat.operations[m.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          render();
        },
        (err) => console.warn("Tontine tournante (opérations) :", err)
      );
    }
    if (!etat.unsubsCaisses[m.caisse_id]) {
      etat.unsubsCaisses[m.caisse_id] = onSnapshot(
        doc(db, "caisses_tournantes", m.caisse_id),
        (snap) => {
          if (snap.exists()) etat.caisses[m.caisse_id] = { id: snap.id, ...snap.data() };
          else delete etat.caisses[m.caisse_id];
          render();
        },
        (err) => console.warn("Tontine tournante (caisse) :", err)
      );
    }
  });
}

function arreter() {
  if (etat.unsubMembres) { etat.unsubMembres(); etat.unsubMembres = null; }
  Object.values(etat.unsubsOps).forEach((u) => u());
  Object.values(etat.unsubsCaisses).forEach((u) => u());
  etat.unsubsOps = {};
  etat.unsubsCaisses = {};
  etat.memberships = [];
  etat.caisses = {};
  etat.operations = {};
  const z = document.getElementById("tontineTournanteZone");
  if (z) z.innerHTML = "";
}

onAuthStateChanged(auth, (user) => {
  arreter();
  if (!user) return;
  etat.unsubMembres = onSnapshot(
    query(collection(db, "tournante_membres"), where("membre_uid", "==", user.uid)),
    (snap) => {
      etat.memberships = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ordre_inscription ?? 0) - (b.ordre_inscription ?? 0));
      synchroniserAbonnements();
      render();
    },
    (err) => console.warn("Tontine tournante (membre) :", err)
  );
});

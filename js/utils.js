// ============================
// CPCT-TINA — Membre
// Fonctions utilitaires
// ============================

function formatMontant(montant) {
  if (montant === null || montant === undefined || isNaN(montant)) return "0 GNF";
  return Number(montant).toLocaleString('fr-FR') + " GNF";
}

function formatDate(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateHeure(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    " à " + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function badgeStatut(statut) {
  const labels = {
    'en_attente': 'En attente',
    'approuve': 'Approuvé',
    'confirme': 'Confirmé',
    'refuse': 'Refusé'
  };
  const classe = statut ? statut.replace('_', '-') : 'en-attente';
  const texte = labels[statut] || 'En attente';
  return `<span class="badge ${classe}">${texte}</span>`;
}

function afficherMessage(elementId, texte, couleur) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = texte;
  el.style.color = couleur || '#333';
}

function calculerStatutContrat(contrat, versementsConfirmes) {
  if (!contrat || contrat.statut !== 'actif') return contrat ? contrat.statut : null;

  const versementsDuContrat = versementsConfirmes.filter((v) => v.contract_id === contrat.id);
  let dateReference;

  if (versementsDuContrat.length === 0) {
    dateReference = contrat.date_debut ? new Date(contrat.date_debut) : null;
  } else {
    const dernier = versementsDuContrat.reduce((a, b) => {
      const da = a.date && a.date.toDate ? a.date.toDate() : new Date(a.date || 0);
      const db = b.date && b.date.toDate ? b.date.toDate() : new Date(b.date || 0);
      return db > da ? b : a;
    });
    dateReference = dernier.date && dernier.date.toDate ? dernier.date.toDate() : new Date(dernier.date);
  }

  if (!dateReference) return 'actif';
  const diffJours = Math.floor((new Date() - dateReference) / (1000 * 60 * 60 * 24));
  return diffJours >= 7 ? 'inactif' : 'actif';
}

export {
  formatMontant,
  formatDate,
  formatDateHeure,
  badgeStatut,
  afficherMessage,
  calculerStatutContrat,
};

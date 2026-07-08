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

export {
  formatMontant,
  formatDate,
  formatDateHeure,
  badgeStatut,
  afficherMessage,
};

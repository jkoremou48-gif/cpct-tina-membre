 // ============================
// CPCT-TINA — App Membre
// Logique principale
// ============================

import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "./firebase-config.js";

import {
  formatMontant,
  formatDate,
  formatDateHeure,
  badgeStatut,
  afficherMessage,
  calculerStatutContrat,
} from "./utils.js";

let currentUser = null;
let currentMemberData = null;
let totalConfirmeMembre = 0;
let totalCommissionMembre = 0;
let propositionActuelle = null;
let pretActif = null;
let contratActifMembre = null;
let versementsConfirmesMembre = [];

const loginScreen = document.getElementById('loginScreen');
const loading = document.getElementById('loading');
const dashboard = document.getElementById('dashboard');
const loginError = document.getElementById('loginError');

function telephoneVersEmailTechnique(telephone) {
  const chiffres = telephone.replace(/\D/g, "");
  return `${chiffres}@membre.cpct-tina.local`;
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const telephone = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  loginError.textContent = '';

  if (!telephone || !password) {
    loginError.textContent = 'Veuillez remplir tous les champs.';
    return;
  }

  const email = telephoneVersEmailTechnique(telephone);

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "Téléphone ou mot de passe incorrect.";
  }
});

// --- Déconnexion ---
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
});

// --- Surveillance de l'état de connexion ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    loginScreen.classList.add('hidden');
    loading.classList.remove('hidden');
    await chargerDonneesMembre(user.uid);
    loading.classList.add('hidden');
    dashboard.classList.remove('hidden');
  } else {
    currentUser = null;
    dashboard.classList.add('hidden');
    loading.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }
});

// --- Chargement des données du membre ---
async function chargerDonneesMembre(uid) {
  try {
    const memberRef = doc(db, 'users', uid);
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      currentMemberData = memberSnap.data();
      document.getElementById('memberName').textContent = currentMemberData.nom || 'Membre';

      if (currentMemberData.parrain_id) {
        const collecteurSnap = await getDoc(doc(db, 'users', currentMemberData.parrain_id));
        if (collecteurSnap.exists()) {
          const collecteur = collecteurSnap.data();
          document.getElementById('collecteurNom').textContent = collecteur.nom || '';
          document.getElementById('collecteurTelephone').textContent = collecteur.telephone || '';
        }
      }
    } else {
      document.getElementById('memberName').textContent = 'Membre';
    }
 ecouterCotisations(uid);
    ecouterContratsMembre(uid);
    ecouterHistoriqueRetraits(uid);
    ecouterPretActif(uid);
    ecouterPropositionReconduction(uid);

  } catch (err) {
    console.error('Erreur chargement membre :', err);
  }
}

// --- Écoute en temps réel des contrats + calcul du solde ---
function ecouterContratsMembre(uid) {
  const q = query(
    collection(db, 'contracts'),
    where('membre_id', '==', uid)
  );

  onSnapshot(q, (snapshot) => {
    totalCommissionMembre = snapshot.docs.reduce(
      (s, d) => s + Number(d.data().commission || 0), 0
    );
    recalculerSolde();
  });
}

// --- Recalcule et affiche le solde du membre ---
function recalculerSolde() {
  const solde = totalConfirmeMembre;
  document.getElementById('soldeMembre').textContent = formatMontant(solde > 0 ? solde : 0);
}

function mettreAJourBadgeInactif() {
  const badge = document.getElementById('badgeInactif');
  if (!badge) return;
  const statut = calculerStatutContrat(contratActifMembre, versementsConfirmesMembre);
  badge.classList.toggle('hidden', statut !== 'inactif');
}
// --- Écoute en temps réel du prêt actif ---
function ecouterPretActif(uid) {
  const q = query(
    collection(db, 'prets'),
    where('membre_id', '==', uid),
    where('statut', '==', 'actif')
  );
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      list.innerHTML = '<p style="color:#999; font-size:13px;">Aucune cotisation enregistrée.</p>';
      versementsConfirmesMembre = [];
      mettreAJourBadgeInactif();
      return;
    }
    const d = snapshot.docs[0];
    pretActif = { id: d.id, ...d.data() };
    afficherPretActif();
  });
}

function afficherPretActif() {
  const zone = document.getElementById('pretZone');
  if (!zone) return;
  if (!pretActif) {
    zone.innerHTML = '';
    return;
  }
  const dateDebut = pretActif.date_debut && pretActif.date_debut.toDate ? pretActif.date_debut.toDate() : new Date();
  const nbSemaines = Math.floor((new Date() - dateDebut) / (1000 * 60 * 60 * 24 * 7));
  const montantDu = pretActif.montant_initial * (1 + pretActif.taux_hebdo * nbSemaines);
  zone.innerHTML = `
    <div class="pret-card">
      <p><strong>Prêt en cours</strong></p>
      <p>Capital emprunté : ${formatMontant(pretActif.montant_initial)}</p>
      <p>Montant dû actuellement (2%/semaine) : <strong>${formatMontant(montantDu)}</strong></p>
    </div>
  `;
}

// --- Écoute en temps réel de la proposition de reconduction ---
function ecouterPropositionReconduction(uid) {
  const q = query(
    collection(db, 'propositions_reconduction'),
    where('membre_id', '==', uid),
    where('statut', '==', 'en_attente')
  );
  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      propositionActuelle = null;
      afficherPropositionReconduction();
      return;
    }
    const d = snapshot.docs[0];
    propositionActuelle = { id: d.id, ...d.data() };
    afficherPropositionReconduction();
  });
}

function afficherPropositionReconduction() {
  const zone = document.getElementById('propositionZone');
  if (!zone) return;
  if (!propositionActuelle) {
    zone.innerHTML = '';
    return;
  }
  zone.innerHTML = `
    <div class="proposition-card">
      <p><strong>Votre contrat est arrivé à son terme.</strong></p>
      <p>Souhaitez-vous reconduire votre épargne ?</p>
      <button id="btn-reconduire-memes-termes">Reconduire aux mêmes conditions</button>
      <button id="btn-reconduire-modifie">Reconduire avec modification</button>
      <button id="btn-refuser-reconduction">Ne pas reconduire</button>
    </div>
  `;
  document.getElementById('btn-reconduire-memes-termes').addEventListener('click', () => repondreProposition('reconduit_meme_termes'));
  document.getElementById('btn-reconduire-modifie').addEventListener('click', ouvrirModificationMontant);
  document.getElementById('btn-refuser-reconduction').addEventListener('click', () => repondreProposition('refuse'));
}

    // --- Écoute en temps réel des cotisations ---
function ecouterCotisations(uid) {
  const q = query(
    collection(db, 'payments'),
    where('membre_id', '==', uid)
  );

  onSnapshot(q, (snapshot) => {
    const list = document.getElementById('cotisationsList');
    list.innerHTML = '';

    if (snapshot.empty) {
      list.innerHTML = '<p style="color:#999; font-size:13px;">Aucune cotisation enregistrée.</p>';
      versementsConfirmesMembre = [];
      mettreAJourBadgeInactif();
      return;
    }

    const docs = snapshot.docs
        .map((d) => d.data())
        .sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0));
totalConfirmeMembre = docs
      .filter((d) => d.statut === 'confirme' && d.jour_numero !== 1)
      .reduce((s, d) => s + Number(d.montant || 0), 0);
    versementsConfirmesMembre = docs.filter((d) => d.statut === 'confirme');
    recalculerSolde();
    mettreAJourBadgeInactif();
      docs.forEach((data) => {
        const row = document.createElement('div');
        row.className = 'cotis-row';
        row.innerHTML = `
          <span>${formatDate(data.date)}</span>
          <span>${formatMontant(data.montant)}</span>
        `;
        list.appendChild(row);
      });
  });
}

// --- Écoute en temps réel de l'historique des demandes de retrait ---
function ecouterHistoriqueRetraits(uid) {
  const q = query(
      collection(db, 'withdrawalRequests'),
      where('memberId', '==', uid)
    );

  onSnapshot(q, (snapshot) => {
    const list = document.getElementById('withdrawalHistory');
    list.innerHTML = '';

    if (snapshot.empty) {
      list.innerHTML = '<p style="color:#999; font-size:13px;">Aucune demande pour le moment.</p>';
      return;
    }

    const docs = snapshot.docs
      .map((d) => d.data())
      .sort((a, b) => (b.dateCreation?.toMillis?.() || 0) - (a.dateCreation?.toMillis?.() || 0));

    docs.forEach((data) => {
      const row = document.createElement('div');
      row.className = 'cotis-row';
      row.innerHTML = `
        <span>${formatMontant(data.montant)}<br><small style="color:#999;">${formatDateHeure(data.dateCreation)}</small></span>
        ${badgeStatut(data.statut)}
      `;
      list.appendChild(row);
    });
  });
  }
    

// --- Demande de retrait ---
document.getElementById('demandeRetraitBtn').addEventListener('click', async () => {
  const montantInput = document.getElementById('montantRetrait');
  const montant = parseFloat(montantInput.value);
  const retraitMsg = document.getElementById('retraitMsg');
  retraitMsg.textContent = '';

  if (!montant || montant <= 0) {
    afficherMessage('retraitMsg', 'Veuillez entrer un montant valide.', 'red');
    return;
  }

  const soldeActuel = totalConfirmeMembre;
  if (montant > soldeActuel) {
    afficherMessage('retraitMsg', 'Montant supérieur à votre solde disponible.', 'red');
    return;
  }

  try {
    await addDoc(collection(db, 'withdrawalRequests'), {
      memberId: currentUser.uid,
      memberName: currentMemberData ? currentMemberData.nom : '',
      montant: montant,
      statut: 'en_attente',
      dateCreation: serverTimestamp(),
    });
    afficherMessage('retraitMsg', 'Demande envoyée avec succès. En attente de validation.', 'green');
    montantInput.value = '';
  } catch (err) {
    console.error('Erreur demande de retrait :', err);
    afficherMessage('retraitMsg', "Erreur lors de l'envoi de la demande.", 'red');
  }
});
// --- Réponse à une proposition de reconduction ---
async function repondreProposition(choix) {
  if (!propositionActuelle) return;
  try {
    await updateDoc(doc(db, 'propositions_reconduction', propositionActuelle.id), {
      statut: choix,
      date_reponse: serverTimestamp(),
    });
    afficherMessage('retraitMsg', 'Votre réponse a été enregistrée.', 'green');
  } catch (err) {
    console.error('Erreur réponse proposition :', err);
    afficherMessage('retraitMsg', "Erreur lors de l'envoi de votre réponse.", 'red');
  }
}

// --- Demande de reconduction avec modification du montant ---
function ouvrirModificationMontant() {
  const nouveauMontant = prompt('Quel nouveau montant de versement quotidien souhaitez-vous ? (GNF)');
  if (nouveauMontant === null) return;
  const montantNum = parseFloat(nouveauMontant);
  if (isNaN(montantNum) || montantNum <= 0) {
    afficherMessage('retraitMsg', 'Montant invalide.', 'red');
    return;
  }
  enregistrerModificationMontant(montantNum);
}

async function enregistrerModificationMontant(nouveauMontant) {
  if (!propositionActuelle) return;
  try {
    await updateDoc(doc(db, 'propositions_reconduction', propositionActuelle.id), {
      statut: 'reconduit_modifie',
      nouveau_montant_mise: nouveauMontant,
      date_reponse: serverTimestamp(),
    });
    afficherMessage('retraitMsg', 'Votre demande de modification a été envoyée au PDG.', 'green');
  } catch (err) {
    console.error('Erreur modification montant :', err);
    afficherMessage('retraitMsg', "Erreur lors de l'envoi de votre demande.", 'red');
  }
}

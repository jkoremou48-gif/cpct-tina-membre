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
} from "./utils.js";

let currentUser = null;
let currentMemberData = null;
let totalConfirmeMembre = 0;
let totalCommissionMembre = 0;

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
      return;
    }

    const docs = snapshot.docs
        .map((d) => d.data())
        .sort((a, b) => (b.date?.toMillis?.() || 0) - (a.date?.toMillis?.() || 0));
totalConfirmeMembre = docs
      .filter((d) => d.statut === 'confirme' && d.jour_numero !== 1)
      .reduce((s, d) => s + Number(d.montant || 0), 0);
    recalculerSolde();
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

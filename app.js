/* ==================================================================
   CONFIGURATION FIREBASE — À REMPLIR AVANT DE DÉPLOYER
   1. https://console.firebase.google.com → crée un projet (ou réutilise
      celui de Mission Famille).
   2. Authentication → Sign-in method → active "Google".
   3. Firestore Database → crée la base (mode production) et colle les
      règles de sécurité fournies dans le message d'accompagnement.
   4. Paramètres du projet → Tes applications → Ajouter une "Web app",
      copie la config générée et colle-la ci-dessous à la place de
      REMPLACE_MOI.
   5. Authentication → Settings → Authorized domains → ajoute le domaine
      où cette page sera hébergée (ex: tonpseudo.github.io).
   ================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, runTransaction,
  addDoc, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// La clé apiKey Firebase n'est pas un secret à cacher : elle identifie seulement le projet.
// L'accès aux données est protégé par les règles de sécurité Firestore, pas par cette clé.
const firebaseConfig = {
  apiKey: "AIzaSyB6V8THug1qJwzDDyiw7kCbALzHw57BsZc",
  authDomain: "defiscollegues.firebaseapp.com",
  projectId: "defiscollegues",
  storageBucket: "defiscollegues.firebasestorage.app",
  messagingSenderId: "790310786767",
  appId: "1:790310786767:web:832a3a3bca8fccaba349ba"
};
const CONFIG_READY = !Object.values(firebaseConfig).some(v => v.includes('REMPLACE_MOI'));
const APP_NS = 'defisCollegues';

let auth, db;
let firebaseInitError = null;
if(CONFIG_READY){
  try{
    const fbApp = initializeApp(firebaseConfig);
    auth = getAuth(fbApp);
    db = getFirestore(fbApp);
  }catch(e){
    console.error('Échec d\'initialisation Firebase', e);
    firebaseInitError = e;
  }
}

// Filet de sécurité : si rien n'a remplacé l'écran de chargement initial après
// quelques secondes (SDK qui ne charge pas, réseau filtré/instable, erreur
// Firestore non rattrapée...), on affiche une erreur explicite avec un bouton
// pour réessayer plutôt que de laisser l'utilisateur bloqué sans indication.
function showBootError(message){
  const app = document.getElementById('app');
  if(!app) return;
  app.innerHTML = `
    <div class="loading">
      ⚠️ ${message}<br>
      <button class="btn small" style="margin-top:14px;" onclick="location.reload()">Réessayer</button>
    </div>`;
}
setTimeout(() => {
  const app = document.getElementById('app');
  if(app && app.querySelector('.loading')){
    showBootError('La connexion à Firebase prend trop de temps. Vérifie ta connexion internet (Wi-Fi/données mobiles), ou réessaie.');
  }
}, 8000);

/* ---------------- Seed data ---------------- */
const CATEGORIES = {
  verbal:   { label: 'Verbal',      emoji: '🗣️' },
  ecrit:    { label: 'Écrit',       emoji: '✍️' },
  social:   { label: 'Social',      emoji: '🤝' },
  discret:  { label: 'Discrétion',  emoji: '🤫' },
  rituel:   { label: 'Rituel',      emoji: '🔁' },
  attitude: { label: 'Attitude',    emoji: '🎭' }
};

const SUGGESTIONS = {
  colleagues: [
    { text: 'Râler pour un oui ou un non', cat: 'verbal' },
    { text: 'Souffler bruyamment entre deux tâches', cat: 'attitude' },
    { text: "Déplacer discrètement les objets d'un collègue", cat: 'discret' },
    { text: 'Mot interdit', cat: 'verbal' },
    { text: 'Mot obligatoire à glisser dans une phrase', cat: 'verbal' },
    { text: 'Complimenter chaque collègue croisé', cat: 'social' },
    { text: 'Ne jamais dire "OK", trouver une autre formule', cat: 'verbal' },
    { text: 'Répondre à une question par une autre question', cat: 'verbal' },
    { text: 'Dire "excellente remarque" avant de répondre à quelqu\'un', cat: 'verbal' },
    { text: 'Utiliser un surnom pour tout le monde', cat: 'social' },
    { text: 'Applaudir discrètement après chaque appel ou réunion', cat: 'discret' },
    { text: 'Chuchoter une phrase sur trois', cat: 'verbal' },
    { text: 'Changer de stylo à chaque nouvelle note', cat: 'rituel' },
    { text: 'Proposer un café à quelqu\'un sans qu\'on demande', cat: 'social' },
    { text: 'Marcher à petits pas pressés en toute circonstance', cat: 'attitude' },
    { text: 'Terminer chaque échange par "à votre bon cœur"', cat: 'verbal' },
    { text: 'Ranger un objet du bureau d\'un collègue façon feng shui', cat: 'discret' },
    { text: 'Se lever et s\'étirer ostensiblement toutes les heures', cat: 'rituel' },
    { text: 'Dire bonjour à la même personne trois fois dans la journée', cat: 'social' },
    { text: 'Signer chaque e-mail par une citation inventée sur le moment', cat: 'ecrit' },
    { text: 'Ne jamais s\'asseoir deux fois de suite à la même place', cat: 'rituel' },
    { text: 'Parler avec une politesse extrême, façon lettre du XIXe siècle', cat: 'verbal' },
    { text: 'Répondre "avec grand plaisir" à toute demande', cat: 'verbal' },
    { text: 'Prendre ses notes uniquement sous forme de dessins', cat: 'ecrit' },
    { text: 'Parler de soi à la troisième personne une fois par jour', cat: 'verbal' },
    { text: 'Prendre systématiquement les escaliers en chantonnant', cat: 'attitude' },
    { text: 'Remercier l\'imprimante à voix haute après chaque impression', cat: 'attitude' },
    { text: 'Réorganiser discrètement son bureau différemment chaque matin', cat: 'discret' },
    { text: 'Répondre au téléphone avec un nom de code inventé', cat: 'verbal' },
    { text: 'Proposer un "brainstorm" même pour les décisions les plus anodines', cat: 'social' },
    { text: 'Remplacer un mot courant du bureau par un synonyme rare', cat: 'verbal' },
    { text: 'Faire un compliment sincère à un collègue qu\'on connaît peu', cat: 'social' },
    { text: 'Ranger son bureau à la même minute précise chaque jour', cat: 'rituel' },
    { text: 'Ne jamais dire "je ne sais pas", inventer une réponse', cat: 'verbal' },
    { text: 'Saluer la plante verte du bureau en arrivant', cat: 'attitude' },
    { text: 'Toujours dire "roger" au lieu de "d\'accord"', cat: 'verbal' },
    { text: 'Parler uniquement par questions pendant une réunion entière', cat: 'verbal' },
    { text: 'Se présenter à un collègue comme si c\'était la première fois', cat: 'social' },
    { text: 'Écrire une phrase du jour sur un post-it affiché discrètement', cat: 'ecrit' },
    { text: 'Ne jamais refuser un "santé" virtuel en visioconférence', cat: 'social' },
    { text: 'Adopter un léger accent différent chaque jour de la semaine', cat: 'attitude' },
    { text: 'Faire une remarque "gratitude" avant chaque réunion', cat: 'verbal' },
    { text: 'Remplacer le mot "problème" par "opportunité" toute la journée', cat: 'verbal' },
    { text: 'Glisser un jeu de mots dans chaque e-mail envoyé', cat: 'ecrit' },
    { text: 'Applaudir silencieusement une bonne nouvelle, sans bruit', cat: 'discret' },
    { text: 'Se lever pour saluer chaque personne qui entre dans la pièce', cat: 'social' },
    { text: 'Terminer chaque réunion par une phrase motivante inventée sur le moment', cat: 'verbal' },
    { text: 'Boire son café ou son thé dans une tasse différente chaque jour', cat: 'rituel' },
    { text: 'Annoncer les nouvelles importantes d\'une voix de présentateur télé', cat: 'attitude' },
    { text: 'Ajouter un emoji improbable à chaque message professionnel', cat: 'ecrit' },
    { text: 'Ne jamais dire "non", trouver une formule alternative', cat: 'verbal' },
    { text: 'Donner un surnom affectueux à un objet du bureau', cat: 'social' },
    { text: 'Esquisser un pas de danse discret après une réunion productive', cat: 'discret' },
    { text: 'Toujours dire "excellente question" avant de répondre à une question', cat: 'verbal' },
    { text: 'Écrire sa liste de tâches du jour en rimes', cat: 'ecrit' },
    { text: 'Proposer un "mot de la semaine" à toute l\'équipe', cat: 'social' },
    { text: 'Garder le dos droit toute la journée, sans jamais s\'appuyer au dossier', cat: 'attitude' },
    { text: 'Faire un clin d\'œil discret après chaque bonne nouvelle partagée', cat: 'discret' },
    { text: 'Arriver chaque matin avec une anecdote insolite', cat: 'social' },
    { text: 'Parler avec des gestes exagérés façon présentateur', cat: 'attitude' },
    { text: 'N\'utiliser que des post-it d\'une seule couleur inhabituelle', cat: 'rituel' },
    { text: 'Proposer systématiquement de partager son écran, même sans besoin', cat: 'social' },
    { text: 'Appeler la pause déjeuner "la cérémonie de midi"', cat: 'verbal' },
    { text: 'Garder son clavier parfaitement aligné avec son écran toute la journée', cat: 'rituel' },
    { text: 'Ne jamais dire simplement merci, toujours préciser pourquoi', cat: 'verbal' },
    { text: 'Fredonner discrètement en marchant dans les couloirs', cat: 'discret' },
    { text: 'Prendre toutes ses notes à la main, jamais à l\'écran', cat: 'ecrit' },
    { text: 'Complimenter la tenue vestimentaire d\'un collègue une fois par jour', cat: 'social' },
    { text: 'Ne jamais refuser une pause-café improvisée', cat: 'social' },
    { text: 'Garder un objet porte-bonheur bien visible sur son bureau', cat: 'rituel' },
    { text: 'Toujours proposer son aide avant qu\'on la demande', cat: 'social' },
    { text: 'Changer de signature d\'e-mail chaque jour', cat: 'ecrit' },
    { text: 'Appeler le café "la cérémonie du café"', cat: 'verbal' },
    { text: 'Faire une petite révérence discrète en quittant une réunion', cat: 'discret' },
    { text: 'Marquer un silence de cinq secondes avant de répondre à une question difficile', cat: 'attitude' },
    { text: 'Choisir un animal totem pour la journée', cat: 'attitude' },
    { text: 'Ne jamais consulter son téléphone en marchant dans les couloirs', cat: 'rituel' },
    { text: 'Laisser un mot d\'encouragement à quelqu\'un qui semble stressé', cat: 'social' },
    { text: 'Toujours ranger sa chaise en partant, même pour cinq minutes', cat: 'rituel' },
    { text: 'Commenter la météo de façon exagérément dramatique', cat: 'attitude' },
    { text: 'Ne jamais dire "ça va", inventer une réponse originale à chaque fois', cat: 'verbal' },
    { text: 'Offrir une friandise à un collègue au hasard', cat: 'social' },
    { text: 'Se déplacer toute la journée avec un carnet, utilisé ou non', cat: 'rituel' },
    { text: 'Dire au revoir individuellement à chaque personne en partant', cat: 'social' },
    { text: 'Lever la main façon écolier avant de parler en réunion', cat: 'attitude' },
    { text: 'Proposer une pause étirement collective pendant une réunion longue', cat: 'social' },
    { text: 'Écrire un haïku sur sa journée avant de partir', cat: 'ecrit' },
    { text: 'Toujours proposer de partager l\'ascenseur plutôt que d\'y monter seul', cat: 'social' },
    { text: 'Résumer chaque réunion en une phrase drôle à la fin', cat: 'verbal' },
    { text: 'Ranger son bureau façon minimaliste avant de partir', cat: 'rituel' },
    { text: 'Remplacer "je suis débordé" par "je jongle activement"', cat: 'verbal' },
    { text: 'Faire un compliment collectif à toute l\'équipe une fois par semaine', cat: 'social' },
    { text: 'N\'écrire qu\'au stylo à plume, même sur un post-it', cat: 'ecrit' },
    { text: 'Boire son café debout face à la fenêtre plutôt qu\'assis', cat: 'rituel' },
    { text: 'Adopter une posture de super-héros avant une réunion importante', cat: 'attitude' },
    { text: 'Répondre "à vos ordres" avec humour en acceptant une tâche', cat: 'verbal' },
    { text: 'Ne jamais partir sans avoir dit une phrase positive à quelqu\'un', cat: 'social' },
    { text: 'Proposer un quiz éclair improvisé pendant une pause', cat: 'social' },
    { text: 'Noter une réussite du jour avant de partir, même minime', cat: 'ecrit' },
    { text: 'Terminer chaque phrase importante par "et c\'est officiel"', cat: 'verbal' }
  ]
};

const DEFAULT_DEFIS = [
  { id: genId(), name: 'Râler' },
  { id: genId(), name: 'Souffler' },
  { id: genId(), name: 'Déplacer les objets' },
  { id: genId(), name: 'Mot interdit', word: '' },
];
function getDays(){ return ['Lun','Mar','Mer','Jeu','Ven']; }
const CARD_VARIANTS = ['v0','v1','v2','v3','v4','v5','v6','v7'];

/* ---------------- Small pure helpers ---------------- */
function genId(){ return Math.random().toString(36).slice(2,10); }

function escapeAttr(s){
  return (s||'').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}
function normalize(s){ return (s||'').trim().toLowerCase(); }

function hashCode(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (h<<5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}

function currentWeekLabel(){
  const d = new Date();
  const onejan = new Date(d.getFullYear(),0,1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
  return `Semaine ${week} · ${d.getFullYear()}`;
}

/* ---------------- App state (in-memory mirror of Firestore) ---------------- */
let state = { defis: [], people: [], week: null, historyCount: 0, history: [], messages: [] };
let myName = null;
let myUid = null;
let currentPage = 'semaine';
let suggestionFilter = null;
let suggestionSearch = '';
let chatSendInProgress = false;
let skipChatDraftRestore = false;
let unsubList = [];
let defisReady = false, peopleReady = false, weekInitInProgress = false;

/* ---------------- Équipe (isole les données d'un groupe de travail) ----------------
   Sans ça, tout le monde qui a le lien et un compte Google atterrit sur le même
   tableau — n'importe qui pourrait rejoindre la session d'une autre équipe. Le
   code d'équipe scope toutes les collections Firestore sous defisCollegues_teams/{code},
   sur le même principe que le code famille de Mission Famille : la sécurité vient
   de la connaissance du code, pas d'une identité vérifiée. */
const TEAM_CODE_KEY = 'defisColleguesTeamCode';
const TEAM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/l (ambigus)
let teamCode = null;

function getSavedTeamCode(){ return localStorage.getItem(TEAM_CODE_KEY); }
function saveTeamCode(code){ localStorage.setItem(TEAM_CODE_KEY, code); }
function clearSavedTeamCode(){ localStorage.removeItem(TEAM_CODE_KEY); }
function generateTeamCode(){
  let code = '';
  for(let i=0;i<7;i++) code += TEAM_CODE_CHARSET[Math.floor(Math.random()*TEAM_CODE_CHARSET.length)];
  return code;
}
const notifiedIds = new Set();
let prevPendingKeys = new Set();

/* ---------------- Week / day domain logic ---------------- */
function blankDay(){ return { status: 'none', votes: {} }; }
function normalizeDay(raw){
  if(raw && typeof raw === 'object' && 'status' in raw) return { status: raw.status, votes: raw.votes || {}, tieBreak: !!raw.tieBreak };
  return { status: raw ? 'validated' : 'none', votes: {} };
}

function blankWeekFor(people, assignments){
  const checks = {};
  people.forEach(p => checks[p] = new Array(getDays().length).fill(null).map(blankDay));
  return { label: currentWeekLabel(), assignments: assignments || {}, checks };
}

function newWeek(assignments){ return blankWeekFor(state.people, assignments); }

// Normalise la forme d'un objet "week" pour une liste de personnes donnée.
// Prend people en paramètre (plutôt que state.people) car cette fonction est
// aussi appelée sur des documents fraîchement lus dans une transaction.
function ensureWeekShape(week, people){
  if(!week) return;
  const dayCount = getDays().length;
  people.forEach(p => {
    let arr = (week.checks[p] || []).map(normalizeDay);
    if(arr.length > dayCount) arr = arr.slice(0, dayCount);
    else if(arr.length < dayCount) arr = arr.concat(new Array(dayCount - arr.length).fill(null).map(blankDay));
    week.checks[p] = arr;
  });
}

// previousAssignments (personne → id du défi de la semaine précédente) permet
// d'éviter qu'un tirage au sort purement aléatoire retombe deux fois de suite
// sur le même défi pour la même personne.
function assignRandomly(previousAssignments){
  const prev = previousAssignments || {};
  const pool = state.defis.filter(d => !d.isMandatoryWord);
  if(pool.length === 0) return {};
  const assignments = {};
  state.people.forEach(p => {
    const candidates = pool.length > 1 ? pool.filter(d => d.id !== prev[p]) : pool;
    const options = candidates.length ? candidates : pool;
    const defi = options[Math.floor(Math.random()*options.length)];
    assignments[p] = defi.id;
  });
  return assignments;
}

// Archive la semaine en cours (si elle existe) dans l'historique puis en
// démarre une nouvelle, en évitant de réassigner le même défi que la semaine
// qui vient de se terminer. Utilisé à la fois par le bouton "Nouvelle
// semaine" et par le basculement automatique de semaine (initData) pour ne
// pas dupliquer cette logique à deux endroits.
async function advanceToNewWeek(tx, { onlyIfStale } = {}){
  const weekRef = docRef('week');
  const fresh = await tx.get(weekRef);
  const finishedWeek = fresh.exists() ? fresh.data() : null;
  if(onlyIfStale && finishedWeek && finishedWeek.label === currentWeekLabel()) return false;
  if(finishedWeek) tx.set(doc(historyCollection()), { ...finishedWeek, archivedAt: Date.now() });
  tx.set(weekRef, newWeek(assignRandomly(finishedWeek ? finishedWeek.assignments : {})));
  return true;
}

function defiById(id){ return state.defis.find(d => d.id === id); }

function getDayState(person, dayIdx){
  const arr = state.week && state.week.checks[person];
  if(!arr || !arr[dayIdx]) return blankDay();
  return arr[dayIdx];
}

function eligibleVoters(person){ return state.people.filter(p => p !== person).length; }
function majorityThreshold(person){ return Math.floor(eligibleVoters(person)/2) + 1; }

// Règle de départage : en cas d'égalité totale (tous les votants ont voté,
// autant de "oui" que de "non"), un tirage au sort équitable et déterministe
// tranche — basé sur un hash du défi, de la personne et de la semaine, donc
// tout le monde obtient exactement le même résultat sans avoir besoin d'un
// serveur arbitre.
function tieBreakResult(person, dayIdx, weekLabel){
  const seed = `${person}-${dayIdx}-${weekLabel}`;
  return Math.abs(hashCode(seed)) % 2 === 0 ? 'validated' : 'rejected';
}

// weekLabel est passé explicitement (plutôt que lu sur state.week) car cette
// fonction s'exécute aussi à l'intérieur de transactions Firestore, sur un
// document tout juste relu depuis le serveur — pas sur l'état local qui peut
// être légèrement périmé.
function resolveDay(day, person, dayIdx, weekLabel){
  const votes = Object.values(day.votes);
  const yes = votes.filter(v => v === 'yes').length;
  const no = votes.filter(v => v === 'no').length;
  const total = eligibleVoters(person);
  const threshold = majorityThreshold(person);
  if(threshold === 0){ day.status = 'validated'; return; }
  if(yes >= threshold){ day.status = 'validated'; return; }
  if(no >= threshold){ day.status = 'rejected'; return; }
  if(yes + no >= total && yes === no){
    day.status = tieBreakResult(person, dayIdx, weekLabel);
    day.tieBreak = true;
  }
}

function successCount(person){
  const c = (state.week && state.week.checks[person]) || [];
  return c.filter(d => d.status === 'validated').length;
}

// Classement toutes semaines confondues (archivées + semaine en cours), pour
// donner un aspect un peu plus ludique/compétitif à l'appli au-delà de la
// seule semaine affichée.
// Classement en taux de réussite (défis validés / défis tranchés) plutôt
// qu'en valeur absolue : sinon quelqu'un ayant rejoint l'équipe récemment
// ne pourrait jamais rattraper les autres, même en réussissant tout.
function leaderboard(){
  const totals = {};
  const bump = (person, wins, resolved) => {
    if(!totals[person]) totals[person] = { wins: 0, resolved: 0 };
    totals[person].wins += wins;
    totals[person].resolved += resolved;
  };
  const weeks = state.week ? [...state.history, state.week] : state.history;
  weeks.forEach(week => {
    Object.entries(week.checks || {}).forEach(([person, days]) => {
      const arr = days || [];
      const wins = arr.filter(d => d && d.status === 'validated').length;
      const resolved = arr.filter(d => d && (d.status === 'validated' || d.status === 'rejected')).length;
      bump(person, wins, resolved);
    });
  });
  return Object.entries(totals)
    .map(([person, t]) => ({
      person, count: t.wins, resolved: t.resolved,
      rate: t.resolved ? Math.round((t.wins / t.resolved) * 100) : null
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.count - a.count);
}

function pendingItemsNeedingMyVote(){
  if(!myName || !state.week) return [];
  const items = [];
  state.people.forEach(person => {
    if(person === myName) return;
    (state.week.checks[person] || []).forEach((day, di) => {
      if(day.status === 'pending' && !(myName in day.votes)) items.push({ person, dayIdx: di });
    });
  });
  return items;
}

function allPendingItems(){
  const items = [];
  if(!state.week) return items;
  state.people.forEach(person => {
    (state.week.checks[person] || []).forEach((day, di) => {
      if(day.status === 'pending') items.push({ person, dayIdx: di, day });
    });
  });
  return items;
}

function getMandatoryWord(){
  const d = state.defis.find(x => x.isMandatoryWord);
  return d && d.word ? d.word : '';
}

/* ---------------- Firestore refs & transactional mutators ----------------
   Toutes les mutations passent par une transaction Firestore (lecture du
   document le plus frais + écriture atomique) plutôt que par un simple
   `.set(state.xxx)` à partir de l'état local. Ça évite qu'un vote ou une
   édition d'un collègue écrase silencieusement celui d'un autre si les deux
   arrivent à quelques centaines de ms d'écart. */
function teamRoot(){ return doc(db, APP_NS + '_teams', teamCode); }
function docRef(name){ return doc(collection(teamRoot(), 'state'), name); }
function identityRef(uid){ return doc(collection(teamRoot(), 'identities'), uid); }
// Un document par semaine archivée plutôt qu'un unique tableau qui grossirait
// indéfiniment (et finirait par dépasser la limite de 1 Mo par document Firestore).
function historyCollection(){ return collection(teamRoot(), 'history'); }
function chatCollection(){ return collection(teamRoot(), 'chat'); }

async function updateWeek(mutator){
  const ref = docRef('week');
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const week = snap.exists() ? snap.data() : newWeek(assignRandomly());
    ensureWeekShape(week, state.people);
    const result = mutator(week);
    tx.set(ref, week);
    return result;
  });
}

async function updateDefis(mutator){
  const ref = docRef('defis');
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const defis = (snap.exists() && snap.data().list) || [];
    const result = mutator(defis);
    tx.set(ref, { list: defis });
    return result;
  });
}

async function addPersonCore(name){
  let added = true;
  await runTransaction(db, async tx => {
    const peopleRef = docRef('people');
    const weekRef = docRef('week');
    const peopleSnap = await tx.get(peopleRef);
    const weekSnap = await tx.get(weekRef);
    const people = (peopleSnap.exists() && peopleSnap.data().list) || [];
    if(people.includes(name)){ added = false; return; }
    people.push(name);
    const week = weekSnap.exists() ? weekSnap.data() : newWeek({});
    ensureWeekShape(week, people);
    const pool = state.defis.filter(d => !d.isMandatoryWord);
    if(pool.length) week.assignments[name] = pool[Math.floor(Math.random()*pool.length)].id;
    tx.set(peopleRef, { list: people });
    tx.set(weekRef, week);
  });
  return added;
}

async function removePerson(person){
  await runTransaction(db, async tx => {
    const peopleRef = docRef('people');
    const weekRef = docRef('week');
    const peopleSnap = await tx.get(peopleRef);
    const weekSnap = await tx.get(weekRef);
    const people = ((peopleSnap.exists() && peopleSnap.data().list) || []).filter(p => p !== person);
    const week = weekSnap.exists() ? weekSnap.data() : newWeek({});
    delete week.assignments[person];
    delete week.checks[person];
    tx.set(peopleRef, { list: people });
    tx.set(weekRef, week);
  });
}

// Fusionne l'équipe courante dans une équipe cible : chaque collègue qui a
// créé sa propre équipe par erreur (au lieu de rejoindre celle des autres)
// peut ainsi rejoindre le bon groupe sans perdre ses défis/personnes/historique
// — tout est reversé dans l'équipe cible, rien n'est supprimé de l'équipe
// d'origine (au cas où d'autres collègues s'y trouvent encore).
async function mergeIntoTeam(targetCode){
  targetCode = targetCode.trim().toUpperCase();
  if(!targetCode) return;
  if(targetCode === teamCode) throw new Error('Tu es déjà dans cette équipe.');

  const sourceRoot = teamRoot();
  const targetRoot = doc(db, APP_NS + '_teams', targetCode);
  const targetDocRef = name => doc(collection(targetRoot, 'state'), name);

  const [sourcePeopleSnap, sourceDefisSnap, sourceHistorySnap, sourceChatSnap] = await Promise.all([
    getDoc(docRef('people')),
    getDoc(docRef('defis')),
    getDocs(historyCollection()),
    getDocs(chatCollection())
  ]);
  const sourcePeople = (sourcePeopleSnap.exists() && sourcePeopleSnap.data().list) || [];
  const sourceDefis = (sourceDefisSnap.exists() && sourceDefisSnap.data().list) || [];

  await runTransaction(db, async tx => {
    const targetPeopleRef = targetDocRef('people');
    const targetDefisRef = targetDocRef('defis');
    const targetWeekRef = targetDocRef('week');
    const [targetPeopleSnap, targetDefisSnap, targetWeekSnap] = await Promise.all([
      tx.get(targetPeopleRef), tx.get(targetDefisRef), tx.get(targetWeekRef)
    ]);

    const mergedPeople = (targetPeopleSnap.exists() && targetPeopleSnap.data().list) || [];
    sourcePeople.forEach(p => { if(!mergedPeople.includes(p)) mergedPeople.push(p); });

    const mergedDefis = (targetDefisSnap.exists() && targetDefisSnap.data().list) || [];
    sourceDefis.forEach(d => {
      if(!mergedDefis.some(x => normalize(x.name) === normalize(d.name))){
        mergedDefis.push({ ...d, id: genId() });
      }
    });

    const week = targetWeekSnap.exists() ? targetWeekSnap.data() : blankWeekFor(mergedPeople, {});
    ensureWeekShape(week, mergedPeople);
    sourcePeople.forEach(p => {
      if(!week.assignments[p] && mergedDefis.length){
        week.assignments[p] = mergedDefis[Math.floor(Math.random()*mergedDefis.length)].id;
      }
    });

    tx.set(targetPeopleRef, { list: mergedPeople });
    tx.set(targetDefisRef, { list: mergedDefis });
    tx.set(targetWeekRef, week);
  });

  // Historique et discussion : simples copies, pas besoin de transaction
  // (ce sont des collections à documents indépendants, pas des documents
  // uniques partagés qu'une écriture concurrente pourrait corrompre).
  await Promise.all([
    ...sourceHistorySnap.docs.map(d => setDoc(doc(collection(targetRoot, 'history')), d.data())),
    ...sourceChatSnap.docs.map(d => setDoc(doc(collection(targetRoot, 'chat')), d.data()))
  ]);

  detachAll();
  saveTeamCode(targetCode);
  teamCode = targetCode;
  myName = null;
  await bootTeamData();
}

/* ---------------- Toasts & notifications ---------------- */
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.classList.remove('show'), 1800);
}

// Affiche la vraie cause plutôt qu'un "Erreur réseau" générique qui masque
// les problèmes de règles de sécurité Firestore (le cas le plus fréquent :
// une sous-collection comme "chat" pas couverte par les règles, ce qui
// ressemble à un souci réseau alors que la connexion fonctionne très bien).
function showErrorToast(err){
  console.error(err);
  if(err && err.code === 'permission-denied'){
    showToast('Accès refusé par les règles Firestore ⚠️');
  } else if(err && (err.code === 'unavailable' || err.code === 'deadline-exceeded')){
    showToast('Erreur réseau, réessaie ⚠️');
  } else {
    showToast(`Erreur${err && err.code ? ` (${err.code})` : ''}, réessaie ⚠️`);
  }
}

function notificationStatusLabel(){
  if(!('Notification' in window)) return 'Non supportées par ce navigateur.';
  if(Notification.permission === 'granted') return 'Activées ✅';
  if(Notification.permission === 'denied') return 'Bloquées — réactive-les dans les réglages du site de ton navigateur.';
  return 'Pas encore activées.';
}

function tryNotify(title, body){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'granted'){
    try{ new Notification(title, { body }); }catch(e){}
  } else if(Notification.permission !== 'denied'){
    Notification.requestPermission().catch(()=>{});
  }
}

function notifyNewPending(){
  const items = pendingItemsNeedingMyVote();
  const keys = new Set(items.map(it => it.person + '-' + it.dayIdx));
  keys.forEach(k => {
    if(!prevPendingKeys.has(k) && !notifiedIds.has(k)){
      notifiedIds.add(k);
      const [person] = k.split('-');
      tryNotify('Défi à valider 🔔', `${person} a déclaré son défi fait — vote demandé.`);
    }
  });
  prevPendingKeys = keys;
}

/* ---------------- Auth & data bootstrap ---------------- */
function detachAll(){ unsubList.forEach(u => u()); unsubList = []; defisReady = false; peopleReady = false; }

function showSignInScreen(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="hero">
      <div class="pin tl"></div>
      <svg class="cloud" viewBox="0 0 100 60"><ellipse cx="30" cy="38" rx="26" ry="20" fill="#fff"/><ellipse cx="60" cy="30" rx="30" ry="24" fill="#fff"/><ellipse cx="82" cy="42" rx="18" ry="15" fill="#fff"/><circle cx="52" cy="28" r="2.4" fill="#333"/><circle cx="66" cy="28" r="2.4" fill="#333"/><ellipse cx="59" cy="35" rx="6" ry="3" fill="#ffb3c6" opacity="0.7"/></svg>
      <h1>Listing</h1>
      <div class="sub">Défis <span class="note-emoji">🎵</span></div>
      <div class="mode-toggle"><span class="mode-btn active colleagues" style="cursor:default;">👥 Équipe de travail</span></div>
    </div>
    <div style="text-align:center; margin-top:34px;">
      ${CONFIG_READY ? `
        <p style="font-family:'Caveat'; font-size:1.35rem;">Connecte-toi avec ton compte Google pour accéder au tableau de l'équipe.</p>
        <button class="btn" id="googleSignInBtn">🔐 Se connecter avec Google</button>
      ` : `
        <p style="font-family:'Quicksand'; font-size:0.9rem; max-width:420px; margin:0 auto; color:var(--ink-soft);">
          ⚠️ La configuration Firebase n'a pas encore été renseignée dans le fichier
          (constante <code>firebaseConfig</code> en haut de app.js). Complète-la avec les
          identifiants de ton projet Firebase, puis recharge la page.
        </p>
      `}
    </div>
  `;
  if(CONFIG_READY){
    document.getElementById('googleSignInBtn').addEventListener('click', () => {
      const provider = new GoogleAuthProvider();
      signInWithPopup(auth, provider).catch(() => showToast('Connexion annulée ou refusée'));
    });
  }
}

function showTeamScreen(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="hero">
      <div class="pin tl"></div>
      <svg class="cloud" viewBox="0 0 100 60"><ellipse cx="30" cy="38" rx="26" ry="20" fill="#fff"/><ellipse cx="60" cy="30" rx="30" ry="24" fill="#fff"/><ellipse cx="82" cy="42" rx="18" ry="15" fill="#fff"/><circle cx="52" cy="28" r="2.4" fill="#333"/><circle cx="66" cy="28" r="2.4" fill="#333"/><ellipse cx="59" cy="35" rx="6" ry="3" fill="#ffb3c6" opacity="0.7"/></svg>
      <h1>Listing</h1>
      <div class="sub">Défis <span class="note-emoji">🎵</span></div>
      <div class="mode-toggle"><span class="mode-btn active colleagues" style="cursor:default;">👥 Équipe de travail</span></div>
    </div>
    <div style="text-align:center; margin-top:34px; max-width:360px; margin-left:auto; margin-right:auto;">
      <p style="font-family:'Caveat'; font-size:1.3rem;">Crée une équipe, ou rejoins-en une avec le code partagé par un collègue.</p>
      <button class="btn" id="createTeamBtn">✨ Créer une nouvelle équipe</button>
      <div style="font-family:'Quicksand'; color:var(--ink-soft); font-size:0.8rem; margin:14px 0;">— ou —</div>
      <div class="add-person" style="max-width:none;">
        <input id="joinTeamInput" placeholder="Code d'équipe (ex: AB3D9KX)" style="text-transform:uppercase;" />
        <button class="btn small" id="joinTeamBtn">Rejoindre</button>
      </div>
    </div>
  `;
  document.getElementById('createTeamBtn').addEventListener('click', () => {
    const code = generateTeamCode();
    saveTeamCode(code);
    teamCode = code;
    bootTeamData();
    showToast(`Équipe créée — code à partager : ${code} 🔑`);
  });
  const join = () => {
    const val = document.getElementById('joinTeamInput').value.trim().toUpperCase();
    if(!val) return;
    saveTeamCode(val);
    teamCode = val;
    bootTeamData();
  };
  document.getElementById('joinTeamBtn').addEventListener('click', join);
  document.getElementById('joinTeamInput').addEventListener('keydown', e => { if(e.key==='Enter') join(); });
}

async function initData(){
  await new Promise(resolve => {
    let done = 0;
    const check = () => { done++; if(done === 2) resolve(); };
    unsubList.push(onSnapshot(docRef('defis'), async snap => {
      if(snap.exists() && snap.data().list){ state.defis = snap.data().list; }
      else { state.defis = DEFAULT_DEFIS; await setDoc(docRef('defis'), { list: state.defis }); }
      if(!defisReady){ defisReady = true; check(); }
      renderApp();
    }));
    unsubList.push(onSnapshot(docRef('people'), async snap => {
      // Pas de liste de personnes par défaut : une équipe nouvellement créée
      // doit partir de zéro, pas hériter des collègues d'une autre équipe.
      if(snap.exists() && snap.data().list){ state.people = snap.data().list; }
      else { state.people = []; await setDoc(docRef('people'), { list: state.people }); }
      if(!peopleReady){ peopleReady = true; check(); }
      renderApp();
    }));
  });

  unsubList.push(onSnapshot(docRef('week'), async snap => {
    if(snap.exists() && snap.data().label === currentWeekLabel()){
      state.week = snap.data();
      ensureWeekShape(state.week, state.people);
      renderApp();
      notifyNewPending();
    } else if(!weekInitInProgress){
      weekInitInProgress = true;
      try{
        await runTransaction(db, tx => advanceToNewWeek(tx, { onlyIfStale: true }));
      } finally { weekInitInProgress = false; }
    }
  }));
  unsubList.push(onSnapshot(historyCollection(), snap => {
    state.historyCount = snap.size;
    state.history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderApp();
  }));
  unsubList.push(onSnapshot(query(chatCollection(), orderBy('createdAt', 'asc'), limit(100)), snap => {
    state.messages = snap.docs.map(message => ({ id: message.id, ...message.data() }));
    renderApp();
  }, showErrorToast));
}

function startAuth(){
  if(!CONFIG_READY){ showSignInScreen(); return; }
  if(firebaseInitError || !auth){
    showBootError('Firebase n\'a pas pu démarrer. Vérifie ta connexion internet et réessaie.');
    return;
  }
  onAuthStateChanged(auth, async user => {
    detachAll();
    try{
      if(!user){
        myUid = null; myName = null; teamCode = null;
        showSignInScreen();
        return;
      }
      myUid = user.uid;
      const savedTeamCode = getSavedTeamCode();
      if(!savedTeamCode){
        showTeamScreen();
        return;
      }
      teamCode = savedTeamCode;
      await bootTeamData();
    }catch(e){
      // Filet essentiel : sans lui, une erreur ici (ex: règles Firestore qui ne
      // correspondent plus à la structure attendue par ce code) reste une
      // promesse rejetée non gérée et laisse l'écran de chargement figé pour
      // toujours, sans aucune indication pour l'utilisateur.
      console.error('Échec du démarrage après connexion', e);
      showBootError('Impossible de charger tes données. Vérifie ta connexion internet et réessaie.');
    }
  }, err => {
    console.error('onAuthStateChanged error', err);
    showBootError('Impossible de vérifier ta connexion. Vérifie ta connexion internet et réessaie.');
  });
}

async function bootTeamData(){
  const idSnap = await getDoc(identityRef(myUid));
  myName = idSnap.exists() ? idSnap.data().name : null;
  await initData();
  if(!myName) showIdentityModal(false);
}

function changeTeam(){
  detachAll();
  clearSavedTeamCode();
  teamCode = null;
  myName = null;
  state = { defis: [], people: [], week: null, historyCount: 0, history: [], messages: [] };
  currentPage = 'semaine';
  showTeamScreen();
}

/* ---------------- Rendering ----------------
   render() reconstruit tout app.innerHTML à chaque snapshot Firestore, ce qui
   détruirait un champ en cours de frappe si une mise à jour arrive pendant
   que quelqu'un tape (ex: un collègue vote pendant que tu renommes un défi).
   renderApp() enrobe render() pour capturer le champ actif + sa sélection
   avant, et les restaurer après, afin qu'une frappe en cours ne soit jamais
   perdue à cause d'un événement Firestore externe. */
function focusSelector(el){
  if(el.id) return `#${CSS.escape(el.id)}`;
  if(el.dataset && el.dataset.id){
    const cls = (el.className || '').split(' ').filter(Boolean)[0];
    return `${el.tagName.toLowerCase()}${cls ? '.'+CSS.escape(cls) : ''}[data-id="${CSS.escape(el.dataset.id)}"]`;
  }
  return null;
}

function renderApp(){
  const active = document.activeElement;
  let restore = null;
  const appEl = document.getElementById('app');
  if(active && appEl && appEl.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')){
    const selector = focusSelector(active);
    if(selector && !(skipChatDraftRestore && selector === '#chatInput')){
      restore = { selector, value: active.value, selStart: active.selectionStart, selEnd: active.selectionEnd };
    }
  }
  render();
  if(restore){
    const el = document.querySelector(restore.selector);
    if(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')){
      el.value = restore.value;
      try{ el.setSelectionRange(restore.selStart, restore.selEnd); }catch(e){}
      el.focus();
    }
  }
}

function render(){
  if(!state.week){ return; }
  const app = document.getElementById('app');
  const pendingCount = pendingItemsNeedingMyVote().length;
  app.innerHTML = `
    <div class="hero">
      <div class="pin tl"></div>
      <svg class="cloud" viewBox="0 0 100 60"><ellipse cx="30" cy="38" rx="26" ry="20" fill="#fff"/><ellipse cx="60" cy="30" rx="30" ry="24" fill="#fff"/><ellipse cx="82" cy="42" rx="18" ry="15" fill="#fff"/><circle cx="52" cy="28" r="2.4" fill="#333"/><circle cx="66" cy="28" r="2.4" fill="#333"/><ellipse cx="59" cy="35" rx="6" ry="3" fill="#ffb3c6" opacity="0.7"/></svg>
      <h1>Listing</h1>
      <div class="sub">Défis <span class="note-emoji">🎵</span></div>
      <div class="mode-toggle"><span class="mode-btn active colleagues" style="cursor:default;">👥 Équipe de travail</span></div>
    </div>

    <div class="who-line">
      <span class="who-badge">🙋 <b>${myName ? escapeAttr(myName) : '?'}</b> · 🔑 <b>${escapeAttr(teamCode || '?')}</b></span>
    </div>

    <div class="tab-bar">
      <button class="tab-btn ${currentPage==='defis'?'active':''}" data-page="defis">📌 Défis</button>
      <button class="tab-btn ${currentPage==='valider'?'active':''}" data-page="valider">🔔 À valider ${pendingCount ? `<span class="tab-badge">${pendingCount}</span>` : ''}</button>
      <button class="tab-btn ${currentPage==='semaine'?'active':''}" data-page="semaine">🗓️ Semaine</button>
      <button class="tab-btn ${currentPage==='classement'?'active':''}" data-page="classement">🏆 Classement</button>
      <button class="tab-btn ${currentPage==='discussion'?'active':''}" data-page="discussion">💬 Discussion</button>
      <button class="tab-btn ${currentPage==='parametres'?'active':''}" data-page="parametres">⚙️ Paramètres</button>
    </div>

    <section class="page ${currentPage==='defis'?'active':''}" id="page-defis">
      <p class="panel-title">📌 Types de défis</p>
      <div class="pad" id="pad"></div>
      <div class="sticky-word">
        <div class="washi"></div>
        <label>Mot obligatoire actuel</label>
        <textarea id="mandatoryWord" placeholder="écrire le mot ici…">${escapeAttr(getMandatoryWord())}</textarea>
      </div>
      <div class="suggest-panel">
        <div class="sp-head">
          <p class="panel-title" style="margin:0;">💡 Idées de défis bureau</p>
          <button class="btn ghost small" id="addAllBtn">Tout ajouter</button>
        </div>
        <input id="suggestSearchInput" class="suggest-search" placeholder="Rechercher une idée…" value="${escapeAttr(suggestionSearch)}" />
        <div class="cat-filters" id="catFilters"></div>
        <div class="suggest-list" id="suggestList"></div>
      </div>
    </section>

    <section class="page ${currentPage==='valider'?'active':''}" id="page-valider">
      <div class="pending-panel">
        <h3>🔔 Défis à valider ${pendingCount ? `<span style="font-family:'Quicksand'; font-size:0.75rem; background:var(--pink); color:white; border-radius:12px; padding:2px 8px;">${pendingCount}</span>` : ''}</h3>
        <div id="pendingList"></div>
        <p style="font-family:'Quicksand'; font-size:0.72rem; color:var(--ink-soft); margin-top:10px;">
          Règle de départage : si tout le monde a voté et que c'est parfaitement à égalité,
          un tirage au sort équitable 🎲 tranche automatiquement (même résultat pour tout le monde).
        </p>
      </div>
    </section>

    <section class="page ${currentPage==='semaine'?'active':''}" id="page-semaine">
      <div class="weekly-head">
        <div>
          <h2>Weekly Défis</h2>
          <div class="week-label">${state.week.label}</div>
        </div>
        <div class="actions">
          <button class="btn" id="shuffleBtn">🎲 Répartir les défis</button>
          <button class="btn blue" id="newWeekBtn">📅 Nouvelle semaine</button>
        </div>
      </div>
      <div class="people-grid" id="peopleGrid"></div>
      <div class="add-person">
        <input id="newPersonInput" placeholder="Ajouter une personne…" />
        <button class="btn small" id="addPersonBtn">Ajouter</button>
      </div>
    </section>

    <section class="page ${currentPage==='classement'?'active':''}" id="page-classement">
      <p class="panel-title">🏆 Classement</p>
      <p style="font-family:'Quicksand'; font-size:0.8rem; color:var(--ink-soft); margin:0 0 14px;">
        Taux de réussite (défis validés / tranchés par vote), toutes semaines confondues (${state.historyCount} archivée${state.historyCount>1?'s':''} + la semaine en cours).
      </p>
      <div id="leaderboardList"></div>
    </section>

    <section class="page ${currentPage==='discussion'?'active':''}" id="page-discussion">
      <div class="chat-panel">
        <div class="chat-title">
          <h2>💬 Discussion de l'équipe</h2>
          <span class="week-label">${state.people.length} collègue${state.people.length > 1 ? 's' : ''}</span>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <form class="chat-form" id="chatForm">
          <input id="chatInput" maxlength="500" autocomplete="off" placeholder="Écrire un message à l'équipe…" ${chatSendInProgress ? 'disabled' : ''} />
          <button class="btn blue" type="submit" ${chatSendInProgress ? 'disabled' : ''}>Envoyer</button>
        </form>
      </div>
    </section>

    <section class="page ${currentPage==='parametres'?'active':''}" id="page-parametres">
      <p class="panel-title">⚙️ Paramètres</p>

      <div class="suggest-panel">
        <p class="panel-title" style="margin:0 0 10px;">🙋 Ton profil</p>
        <p style="font-family:'Quicksand'; font-size:0.9rem; margin:0 0 12px;">Prénom actuel : <b>${myName ? escapeAttr(myName) : '?'}</b></p>
        <button class="btn small" id="settingsChangeIdBtn">Changer de prénom</button>
      </div>

      <div class="suggest-panel">
        <p class="panel-title" style="margin:0 0 10px;">🔑 Équipe</p>
        <p style="font-family:'Quicksand'; font-size:0.9rem; margin:0 0 12px;">Code actuel : <b>${escapeAttr(teamCode || '?')}</b> — partage-le pour inviter des collègues.</p>
        <button class="btn small" id="settingsCopyTeamCodeBtn">📋 Copier le code</button>
        <button class="btn ghost small" id="settingsChangeTeamBtn">Changer d'équipe</button>
      </div>

      <div class="suggest-panel">
        <p class="panel-title" style="margin:0 0 10px;">🔀 Rejoindre une autre équipe</p>
        <p style="font-family:'Quicksand'; font-size:0.85rem; margin:0 0 12px;">
          Si un collègue a créé sa propre équipe par erreur, entre son code ici :
          vos personnes, défis, semaine, historique et discussion seront fusionnés
          dans cette équipe-là (rien n'est supprimé ici).
        </p>
        <div class="add-person" style="max-width:none;">
          <input id="mergeTeamInput" placeholder="Code de l'équipe à rejoindre" style="text-transform:uppercase;" />
          <button class="btn small" id="mergeTeamBtn">Fusionner</button>
        </div>
      </div>

      <div class="suggest-panel">
        <p class="panel-title" style="margin:0 0 10px;">🔔 Notifications</p>
        <p style="font-family:'Quicksand'; font-size:0.9rem; margin:0 0 12px;">${notificationStatusLabel()}</p>
        <button class="btn small" id="settingsNotifBtn">Activer les notifications</button>
      </div>

      <div class="suggest-panel">
        <p class="panel-title" style="margin:0 0 10px;">🚪 Compte</p>
        <button class="btn blue small" id="settingsSignOutBtn">Se déconnecter</button>
        <button class="btn ghost small" id="settingsDeleteBtn" style="color:#c0392b; border-color:#e6b0aa;">Supprimer mon compte</button>
      </div>

      <div class="suggest-panel" style="border-color:#e6b0aa;">
        <p class="panel-title" style="margin:0 0 10px; color:#c0392b;">🛠️ Administration — zone sensible</p>

        <p style="font-family:'Quicksand'; font-size:0.82rem; font-weight:600; margin:0 0 8px;">Personnes de l'équipe</p>
        <div id="adminPeopleList" style="display:flex; flex-direction:column; gap:6px; margin-bottom:16px;"></div>

        <p style="font-family:'Quicksand'; font-size:0.82rem; font-weight:600; margin:0 0 8px;">Semaine en cours</p>
        <button class="btn ghost small" id="adminResetWeekBtn" style="margin-bottom:16px;">↺ Réinitialiser les votes/statuts</button>

        <p style="font-family:'Quicksand'; font-size:0.82rem; font-weight:600; margin:0 0 8px; color:#c0392b;">Supprimer l'équipe entière</p>
        <p style="font-family:'Quicksand'; font-size:0.78rem; color:var(--ink-soft); margin:0 0 8px;">Efface définitivement défis, personnes, semaine, historique et identités de tous les membres. Irréversible.</p>
        <button class="btn small" id="adminDeleteTeamBtn" style="background:#c0392b; box-shadow:0 3px 0 #922b21;">🗑️ Supprimer définitivement l'équipe</button>
      </div>
    </section>

    <div class="footer-note">${state.historyCount} semaine${state.historyCount>1?'s':''} archivée${state.historyCount>1?'s':''} · fait pour l'équipe 👥</div>
  `;

  renderPad();
  renderPeople();
  document.getElementById('suggestSearchInput').addEventListener('input', e => {
    suggestionSearch = e.target.value;
    renderSuggestions();
  });
  renderCatFilters();
  renderSuggestions();
  renderPending();
  renderLeaderboard();
  renderChat();
  renderAdminPeopleList();
  wireGlobalEvents();
  document.getElementById('settingsChangeIdBtn').addEventListener('click', () => showIdentityModal(true));
  document.getElementById('settingsSignOutBtn').addEventListener('click', () => signOut(auth));
  document.getElementById('settingsCopyTeamCodeBtn').addEventListener('click', async () => {
    try{ await navigator.clipboard.writeText(teamCode); showToast('Code copié 📋'); }
    catch(e){ showToast(`Code : ${teamCode}`); }
  });
  document.getElementById('settingsChangeTeamBtn').addEventListener('click', () => {
    if(confirm('Quitter cette équipe et en choisir/créer une autre ?')) changeTeam();
  });
  document.getElementById('mergeTeamBtn').addEventListener('click', async () => {
    const input = document.getElementById('mergeTeamInput');
    const target = input.value.trim().toUpperCase();
    if(!target) return;
    if(!confirm(`Fusionner cette équipe ("${teamCode}") dans l'équipe "${target}" ? Personnes, défis, semaine, historique et discussion seront copiés dans "${target}". Tu basculeras ensuite sur cette équipe.`)) return;
    try{
      await mergeIntoTeam(target);
      showToast(`Équipes fusionnées — tu es maintenant dans "${target}" 🔀`);
    }catch(err){
      if(err && err.message === 'Tu es déjà dans cette équipe.') showToast(err.message);
      else showErrorToast(err);
    }
  });
  document.getElementById('settingsNotifBtn').addEventListener('click', async () => {
    if(!('Notification' in window)){ showToast('Notifications non supportées sur ce navigateur.'); return; }
    const perm = await Notification.requestPermission();
    showToast(perm === 'granted' ? 'Notifications activées 🔔' : 'Notifications non activées');
    renderApp();
  });
  document.getElementById('settingsDeleteBtn').addEventListener('click', deleteMyAccount);
  document.getElementById('adminResetWeekBtn').addEventListener('click', resetWeekProgress);
  document.getElementById('adminDeleteTeamBtn').addEventListener('click', deleteEntireTeam);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { currentPage = btn.dataset.page; renderApp(); });
  });
  if(!myName) showIdentityModal(false);
}

function renderChat(){
  const el = document.getElementById('chatMessages');
  if(!el) return;
  if(state.messages.length === 0){
    el.innerHTML = `<div class="chat-empty">La discussion est ouverte : lancez le premier message ✨</div>`;
    return;
  }
  el.innerHTML = state.messages.map(message => `
    <div class="chat-message ${message.uid === myUid ? 'mine' : ''}">
      <div class="chat-author">${escapeAttr(message.author || 'Collègue')}</div>
      <div class="chat-body">${escapeAttr(message.text)}</div>
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

function renderCatFilters(){
  const el = document.getElementById('catFilters');
  if(!el) return;
  const pills = [
    `<button class="cat-pill ${suggestionFilter===null?'active':''}" data-cat="">Tous</button>`,
    ...Object.entries(CATEGORIES).map(([id, c]) =>
      `<button class="cat-pill ${suggestionFilter===id?'active':''}" data-cat="${id}">${c.emoji} ${c.label}</button>`)
  ];
  el.innerHTML = pills.join('');
  el.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      suggestionFilter = btn.dataset.cat || null;
      renderCatFilters();
      renderSuggestions();
    });
  });
}

function renderSuggestions(){
  const list = document.getElementById('suggestList');
  let pool = suggestionFilter
    ? SUGGESTIONS.colleagues.filter(s => s.cat === suggestionFilter)
    : SUGGESTIONS.colleagues;
  const query = normalize(suggestionSearch);
  if(query) pool = pool.filter(s => normalize(s.text).includes(query));
  const existingNames = state.defis.map(d => normalize(d.name));
  list.innerHTML = '';
  if(pool.length === 0){
    list.innerHTML = `<div class="pending-empty">Aucune idée ne correspond 🔍</div>`;
    return;
  }
  pool.forEach(({ text, cat }) => {
    const already = existingNames.includes(normalize(text));
    const item = document.createElement('div');
    item.className = 'suggest-item' + (already ? ' added' : '');
    item.innerHTML = `<span>${CATEGORIES[cat].emoji} ${escapeAttr(text)}</span><button ${already?'disabled':''} data-text="${escapeAttr(text)}">${already ? '✓' : '＋'}</button>`;
    list.appendChild(item);
  });
  list.querySelectorAll('button:not([disabled])').forEach(btn => {
    btn.addEventListener('click', async e => {
      try{
        const added = await addDefiFromText(e.target.dataset.text);
        if(added) showToast('Défi ajouté depuis les idées 💡');
      }catch(err){ showErrorToast(err); }
    });
  });
  document.getElementById('addAllBtn').addEventListener('click', async () => {
    try{
      await updateDefis(defis => {
        SUGGESTIONS.colleagues.forEach(({ text }) => {
          if(!defis.some(d => normalize(d.name) === normalize(text))){
            const needsWord = /interdit|obligatoire/i.test(text);
            defis.push({ id: genId(), name: text, ...(needsWord ? { word:'' } : {}) });
          }
        });
      });
      showToast('Toutes les idées ont été ajoutées ✨');
    }catch(err){ showErrorToast(err); }
  });
}

async function addDefiFromText(text){
  return updateDefis(defis => {
    if(defis.some(d => normalize(d.name) === normalize(text))) return false;
    const needsWord = /interdit|obligatoire/i.test(text);
    defis.push({ id: genId(), name: text, ...(needsWord ? { word:'' } : {}) });
    return true;
  });
}

function renderPad(){
  const pad = document.getElementById('pad');
  pad.innerHTML = '';
  state.defis.filter(d => !d.isMandatoryWord).forEach(d => {
    const row = document.createElement('div');
    row.className = 'defi-row';
    const needsWord = /interdit|obligatoire/i.test(d.name);
    row.innerHTML = `
      <input class="name" data-id="${d.id}" value="${escapeAttr(d.name)}" />
      ${needsWord ? `<input class="word" data-id="${d.id}" placeholder="mot…" value="${escapeAttr(d.word||'')}" />` : ''}
      <button class="del" data-id="${d.id}" title="Supprimer">✕</button>
    `;
    pad.appendChild(row);
  });
  const addRow = document.createElement('div');
  addRow.className = 'add-defi';
  addRow.innerHTML = `<input id="newDefiInput" placeholder="Nouveau défi…" /><button class="btn small" id="addDefiBtn">＋</button>`;
  pad.appendChild(addRow);

  pad.querySelectorAll('.name').forEach(inp => {
    inp.addEventListener('change', async e => {
      const val = e.target.value.trim();
      if(!val) return;
      try{
        await updateDefis(defis => {
          const d = defis.find(x => x.id === e.target.dataset.id);
          if(d) d.name = val;
        });
      }catch(err){ showErrorToast(err); }
    });
  });
  pad.querySelectorAll('.word').forEach(inp => {
    inp.addEventListener('change', async e => {
      try{
        await updateDefis(defis => {
          const d = defis.find(x => x.id === e.target.dataset.id);
          if(d) d.word = e.target.value;
        });
      }catch(err){ showErrorToast(err); }
    });
  });
  pad.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async e => {
      try{
        await updateDefis(defis => {
          const i = defis.findIndex(x => x.id === e.target.dataset.id);
          if(i >= 0) defis.splice(i, 1);
        });
      }catch(err){ showErrorToast(err); }
    });
  });
  document.getElementById('addDefiBtn').addEventListener('click', addDefi);
  document.getElementById('newDefiInput').addEventListener('keydown', e => { if(e.key==='Enter') addDefi(); });
}

async function addDefi(){
  const inp = document.getElementById('newDefiInput');
  const val = inp.value.trim();
  if(!val) return;
  try{
    await updateDefis(defis => {
      const needsWord = /interdit|obligatoire/i.test(val);
      defis.push({ id: genId(), name: val, ...(needsWord ? { word:'' } : {}) });
    });
    showToast('Défi ajouté ✏️');
  }catch(err){ showErrorToast(err); }
}

function renderPeople(){
  const grid = document.getElementById('peopleGrid');
  if(!grid) return;
  grid.innerHTML = '';
  if(state.people.length === 0){
    grid.innerHTML = `<div class="empty-note">Personne dans l'équipe pour l'instant — ajoute quelqu'un ci-dessous.</div>`;
  }
  const days = getDays();
  state.people.forEach((person, idx) => {
    const variant = CARD_VARIANTS[idx % CARD_VARIANTS.length];
    const defiId = state.week.assignments[person];
    const defi = defiId ? defiById(defiId) : null;
    const card = document.createElement('div');
    card.className = `p-card ${variant}`;
    const wordBit = defi && defi.word ? ` · « ${escapeAttr(defi.word)} »` : '';
    card.innerHTML = `
      <button class="remove-p" data-person="${escapeAttr(person)}" title="Retirer">✕</button>
      <div class="p-name">${escapeAttr(person)}</div>
      <div class="word-tag">${defi ? escapeAttr(defi.name) + wordBit : 'aucun défi assigné'}</div>
      <div class="checks">
        ${days.map((day, di) => {
          const dayState = getDayState(person, di);
          const isPending = dayState.status === 'pending';
          const votes = Object.values(dayState.votes);
          const yes = votes.filter(v=>v==='yes').length;
          const no = votes.filter(v=>v==='no').length;
          let icon = '🤍';
          if(dayState.status === 'validated') icon = dayState.tieBreak ? '🎲💗' : '💗';
          else if(dayState.status === 'rejected') icon = dayState.tieBreak ? '🎲💔' : '💔';
          else if(isPending) icon = '⏳';
          const canVoteHere = isPending && myName && myName !== person && !(myName in dayState.votes);
          return `
          <label class="${isPending ? 'is-pending' : ''}">
            <span class="heart" data-person="${escapeAttr(person)}" data-day="${di}">${icon}</span>
            ${day}
            ${isPending ? `<span class="day-mini-votes">${yes}👍/${no}👎</span>` : ''}
            ${canVoteHere ? `<button class="mini-vote-btn yes" data-person="${escapeAttr(person)}" data-day="${di}" data-v="yes">👍</button><button class="mini-vote-btn no" data-person="${escapeAttr(person)}" data-day="${di}" data-v="no">👎</button>` : ''}
          </label>
        `;}).join('')}
      </div>
      <div class="stat">${successCount(person)}/${days.length} réussi${successCount(person)>1?'s':''}</div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.heart').forEach(h => {
    h.addEventListener('click', async e => {
      await onHeartClick(e.target.dataset.person, parseInt(e.target.dataset.day, 10));
    });
  });
  grid.querySelectorAll('.mini-vote-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      await castVote(e.target.dataset.person, parseInt(e.target.dataset.day,10), e.target.dataset.v);
    });
  });
  grid.querySelectorAll('.remove-p').forEach(b => {
    b.addEventListener('click', async e => {
      try{ await removePerson(e.target.dataset.person); }
      catch(err){ showErrorToast(err); }
    });
  });
}

function renderAdminPeopleList(){
  const el = document.getElementById('adminPeopleList');
  if(!el) return;
  if(state.people.length === 0){
    el.innerHTML = `<span style="font-family:'Quicksand'; font-size:0.82rem; color:var(--ink-soft);">Personne dans l'équipe.</span>`;
    return;
  }
  el.innerHTML = state.people.map(p => `
    <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.7); border-radius:8px; padding:6px 10px;">
      <span style="font-family:'Quicksand'; font-size:0.85rem;">${escapeAttr(p)}</span>
      <button class="btn ghost small" data-person="${escapeAttr(p)}" style="padding:3px 8px;">Retirer</button>
    </div>
  `).join('');
  el.querySelectorAll('button[data-person]').forEach(btn => {
    btn.addEventListener('click', async e => {
      try{ await removePerson(e.target.dataset.person); }
      catch(err){ showErrorToast(err); }
    });
  });
}

async function onHeartClick(person, dayIdx){
  if(!myName){ showIdentityModal(false); return; }
  const currentStatus = getDayState(person, dayIdx).status;
  if(currentStatus === 'none' && myName !== person){
    showToast(`Seul${person.endsWith('e')?'e':''} ${person} peut déclarer ce défi fait.`);
    return;
  }
  if(currentStatus === 'pending'){
    if(myName === person) showToast('En attente du vote des collègues…');
    else showToast('Utilise 👍 / 👎 pour voter.');
    return;
  }
  if(currentStatus !== 'none' && myName !== person){
    showToast('Ce défi est déjà tranché par le vote.');
    return;
  }
  try{
    const newStatus = await updateWeek(week => {
      const day = week.checks[person][dayIdx];
      if(day.status === 'none'){
        day.status = eligibleVoters(person) === 0 ? 'validated' : 'pending';
        day.votes = {};
        delete day.tieBreak;
      } else if(day.status !== 'none' && person === myName){
        day.status = 'none';
        day.votes = {};
        delete day.tieBreak;
      }
      return day.status;
    });
    if(newStatus === 'validated') showToast('Défi validé 💗');
    else if(newStatus === 'pending') showToast('En attente de validation par les collègues ⏳');
    else showToast('Défi réinitialisé ↺');
  }catch(err){ showErrorToast(err); }
}

async function castVote(person, dayIdx, vote){
  if(!myName){ showIdentityModal(false); return; }
  if(person === myName){ showToast('Tu ne peux pas voter sur ton propre défi.'); return; }
  try{
    const outcome = await updateWeek(week => {
      const day = week.checks[person][dayIdx];
      if(day.status !== 'pending') return 'closed';
      day.votes[myName] = vote;
      resolveDay(day, person, dayIdx, week.label);
      return day.tieBreak ? 'tiebreak' : 'recorded';
    });
    if(outcome === 'closed'){ showToast('Ce défi est déjà tranché.'); return; }
    showToast(outcome === 'tiebreak' ? 'Égalité — tirage au sort 🎲' : 'Vote enregistré 🗳️');
  }catch(err){ showErrorToast(err); }
}

function renderPending(){
  const el = document.getElementById('pendingList');
  if(!el) return;
  const items = allPendingItems().filter(it => it.person !== myName);
  if(items.length === 0){
    el.innerHTML = `<div class="pending-empty">Rien à valider pour l'instant ✨</div>`;
    return;
  }
  const days = getDays();
  el.innerHTML = items.map(it => {
    const defi = defiById(state.week.assignments[it.person]);
    const votes = Object.values(it.day.votes);
    const yes = votes.filter(v=>v==='yes').length;
    const no = votes.filter(v=>v==='no').length;
    const threshold = majorityThreshold(it.person);
    const already = myName && (myName in it.day.votes);
    return `
      <div class="pending-row">
        <div class="pr-text"><b>${escapeAttr(it.person)}</b> · ${days[it.dayIdx]} — ${escapeAttr(defi ? defi.name : 'défi')}
          <span class="pr-votes">${yes}👍 / ${no}👎 (majorité: ${threshold})</span>
        </div>
        <div class="pr-actions">
          ${already
            ? `<span class="pr-votes">déjà voté ✓</span>`
            : `<button class="vote-btn yes" data-person="${escapeAttr(it.person)}" data-day="${it.dayIdx}" data-v="yes">👍 Valider</button>
               <button class="vote-btn no" data-person="${escapeAttr(it.person)}" data-day="${it.dayIdx}" data-v="no">👎 Refuser</button>`}
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      await castVote(e.target.dataset.person, parseInt(e.target.dataset.day,10), e.target.dataset.v);
    });
  });
}

const RANK_MEDALS = ['🥇','🥈','🥉'];
function renderLeaderboard(){
  const el = document.getElementById('leaderboardList');
  if(!el) return;
  const ranking = leaderboard();
  if(ranking.length === 0){
    el.innerHTML = `<div class="pending-empty">Pas encore de défi réussi — ça viendra ✨</div>`;
    return;
  }
  el.innerHTML = ranking.map((row, i) => `
    <div class="pending-row">
      <div class="pr-text">${RANK_MEDALS[i] || `#${i+1}`} <b>${escapeAttr(row.person)}</b></div>
      <div class="pr-votes">${row.rate === null ? 'aucun défi tranché' : `${row.rate}% · ${row.count}/${row.resolved} réussis`}</div>
    </div>
  `).join('');
}

function wireGlobalEvents(){
  const chatForm = document.getElementById('chatForm');
  if(chatForm) chatForm.addEventListener('submit', sendChatMessage);
  document.getElementById('shuffleBtn').addEventListener('click', async () => {
    try{
      await updateWeek(week => { week.assignments = assignRandomly(week.assignments); });
      showToast('Défis répartis 🎲');
    }catch(err){ showErrorToast(err); }
  });
  document.getElementById('newWeekBtn').addEventListener('click', async () => {
    try{
      await runTransaction(db, tx => advanceToNewWeek(tx));
      showToast('Nouvelle semaine lancée 📅');
    }catch(err){ showErrorToast(err); }
  });
  document.getElementById('addPersonBtn').addEventListener('click', addPerson);
  document.getElementById('newPersonInput').addEventListener('keydown', e => { if(e.key==='Enter') addPerson(); });
  document.getElementById('mandatoryWord').addEventListener('change', async e => {
    const value = e.target.value;
    try{
      await updateDefis(defis => {
        let d = defis.find(x => x.isMandatoryWord);
        if(!d){ d = { id: genId(), name: 'Mot obligatoire', word: '', isMandatoryWord: true }; defis.push(d); }
        d.word = value;
      });
    }catch(err){ showErrorToast(err); }
  });
}

async function sendChatMessage(event){
  event.preventDefault();
  if(!myName || !myUid) return showIdentityModal(false);
  if(chatSendInProgress) return;
  const input = document.getElementById('chatInput');
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  const submitBtn = document.querySelector('#chatForm button[type="submit"]');
  chatSendInProgress = true;
  skipChatDraftRestore = true;
  input.value = '';
  input.disabled = true;
  if(submitBtn) submitBtn.disabled = true;
  try{
    await addDoc(chatCollection(), { text, author: myName, uid: myUid, createdAt: serverTimestamp() });
  }catch(err){
    const currentInput = document.getElementById('chatInput');
    if(currentInput) currentInput.value = text;
    showErrorToast(err);
  }
  finally{
    chatSendInProgress = false;
    skipChatDraftRestore = false;
    const currentInput = document.getElementById('chatInput');
    const currentSubmitBtn = document.querySelector('#chatForm button[type="submit"]');
    if(currentInput){
      currentInput.disabled = false;
      currentInput.focus();
    }
    if(currentSubmitBtn) currentSubmitBtn.disabled = false;
  }
}

async function addPerson(){
  const inp = document.getElementById('newPersonInput');
  const val = inp.value.trim();
  if(!val) return;
  try{
    const added = await addPersonCore(val);
    showToast(added ? `${val} ajoutée à l'équipe 💌` : 'Cette personne existe déjà.');
  }catch(err){ showErrorToast(err); }
}

/* ---------------- Identity modal (compte Google → prénom de l'équipe) ---------------- */
function showIdentityModal(dismissable){
  const existing = document.getElementById('idModalOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'idModalOverlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Qui es-tu ?</h3>
      <p>Ton compte Google (${auth.currentUser ? escapeAttr(auth.currentUser.email) : ''}) sera lié à ce prénom, sur tous tes appareils.</p>
      <div class="modal-names">
        ${state.people.map(p => `<button data-person="${escapeAttr(p)}">${escapeAttr(p)}</button>`).join('')}
      </div>
      <div class="add-person">
        <input id="idNewName" placeholder="Ton prénom s'il n'est pas listé…" />
        <button class="btn small" id="idAddBtn">OK</button>
      </div>
      ${dismissable ? `<div style="margin-top:12px;"><button class="btn ghost small" id="idCancelBtn">Annuler</button></div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.modal-names button').forEach(btn => {
    btn.addEventListener('click', () => setIdentity(btn.dataset.person));
  });
  document.getElementById('idAddBtn').addEventListener('click', async () => {
    const val = document.getElementById('idNewName').value.trim();
    if(!val) return;
    if(!state.people.includes(val)){
      try{ await addPersonCore(val); }
      catch(err){ showErrorToast(err); return; }
    }
    setIdentity(val);
  });
  if(dismissable) document.getElementById('idCancelBtn').addEventListener('click', () => overlay.remove());
}

async function setIdentity(name){
  try{
    await setDoc(identityRef(myUid), { name, email: auth.currentUser ? auth.currentUser.email : null });
  }catch(err){ showErrorToast(err); return; }
  myName = name;
  const overlay = document.getElementById('idModalOverlay');
  if(overlay) overlay.remove();
  renderApp();
  showToast(`Bienvenue ${name} 👋`);
}

// Retire ton nom et tes données (défi assigné, votes) de l'équipe courante,
// supprime le lien entre ton compte Google et ce prénom, puis déconnecte —
// ne touche ni au compte Google en lui-même (l'app ne peut pas le supprimer),
// ni aux autres équipes auxquelles tu pourrais appartenir avec un autre code.
async function deleteMyAccount(){
  if(!myUid) return;
  const confirmMsg = myName
    ? `Supprimer ton profil "${myName}" de cette équipe ? Ton nom, ton défi assigné et tes votes seront retirés, et tu seras déconnecté.`
    : 'Supprimer ton compte de cette équipe et te déconnecter ?';
  if(!confirm(confirmMsg)) return;
  try{
    if(myName) await removePerson(myName);
    await deleteDoc(identityRef(myUid));
  }catch(err){ showErrorToast(err); return; }
  clearSavedTeamCode();
  await signOut(auth);
  showToast('Compte supprimé de cette équipe 👋');
}

async function resetWeekProgress(){
  if(!confirm('Réinitialiser tous les votes et statuts de la semaine en cours ? Les personnes, les défis et l\'attribution actuelle sont conservés — seule la progression (💗/💔/⏳) est effacée.')) return;
  try{
    await updateWeek(week => {
      state.people.forEach(p => { week.checks[p] = new Array(getDays().length).fill(null).map(blankDay); });
    });
    showToast('Semaine réinitialisée ↺');
  }catch(err){ showErrorToast(err); }
}

// Efface DÉFINITIVEMENT toutes les données de l'équipe courante (défis,
// personnes, semaine, historique, identités de TOUS les membres — pas
// seulement la tienne), puis déconnecte. Les identités d'autres membres ne
// sont supprimables que si les règles Firestore autorisent la suppression
// par n'importe quel membre authentifié de l'équipe (pas seulement le
// propriétaire du uid) sur ce sous-chemin précis — sinon ces documents-là
// restent orphelins (le reste de l'équipe est bien effacé).
async function deleteEntireTeam(){
  if(!teamCode) return;
  if(!confirm(`Supprimer DÉFINITIVEMENT l'équipe "${teamCode}" et toutes ses données (défis, personnes, semaine, historique, identités) ? Cette action est irréversible et affecte tous les membres.`)) return;
  if(!confirm('Vraiment sûr·e ? Il n\'y a aucun moyen de revenir en arrière après ça.')) return;
  try{
    const [historySnap, identitiesSnap] = await Promise.all([
      getDocs(historyCollection()),
      getDocs(collection(teamRoot(), 'identities'))
    ]);
    await Promise.all([
      deleteDoc(docRef('defis')),
      deleteDoc(docRef('people')),
      deleteDoc(docRef('week')),
      ...historySnap.docs.map(d => deleteDoc(d.ref)),
      ...identitiesSnap.docs.map(d => deleteDoc(d.ref))
    ]);
  }catch(err){ showErrorToast(err); return; }
  clearSavedTeamCode();
  await signOut(auth);
  showToast('Équipe supprimée définitivement 🗑️');
}

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.error('Échec d\'enregistrement du service worker', e));
  });
}

startAuth();

// ============================================================
// @randocours/shared — Types partagés entre API et Web
// ============================================================

// ── Enums ────────────────────────────────────────────────────
export type Role = 'super_admin' | 'admin' | 'enseignant' | 'eleve' | 'jury';
export type Langue = 'fr' | 'ar' | 'darija';
export type TransactionType =
  | 'CREDIT_DH'
  | 'DEBIT_WALLET'
  | 'CREDIT_COLLECTIF'
  | 'DEBIT_COLLECTIF'
  | 'POOL_COMMISSION'
  | 'POOL_DISTRIBUTION'
  | 'PENALITE_PARTAGE'
  | 'PENALITE_QR'
  | 'BONUS_CORRECT'
  | 'COTISATION';

export type SessionStatus =
  | 'draft'
  | 'configured'
  | 'generated'
  | 'active'
  | 'validation'
  | 'completed';

export type NiveauDifficulte = 1 | 2 | 3 | 4 | 5;
export type Matiere =
  | 'Maths'
  | 'Physique-Chimie'
  | 'SVT'
  | 'Sciences-Ingenieur'
  | 'Arabe'
  | 'Francais'
  | 'Histoire-Geo'
  | 'Philosophie'
  | 'Education-Islamique';

export type Niveau =
  | '1AC' | '2AC' | '3AC'
  | 'TC'
  | '1Bac-SE' | '1Bac-SM'
  | '2Bac-SP' | '2Bac-SMA' | '2Bac-SVT';

// ── User & Auth ───────────────────────────────────────────────
export interface UserPublic {
  id: string;
  email: string;
  role: Role;
  langue: Langue;
  isMineur: boolean;
  createdAt: string;
}

export interface WalletInfo {
  soldeRc: number;
  capitalInvestiDh: number;
  updatedAt: string;
}

// ── Groupe ───────────────────────────────────────────────────
export interface Groupe {
  id: string;
  nom: string;
  logoEmoji: string;
  slogan?: string;
  niveauActuel: Niveau;
  membres: UserPublic[];
  scoreQcm: number;
  scoreValidation: number;
  randoCoins: number;
  progressionStations: StationProgression[];
}

export interface StationProgression {
  stationNum: number; // 1-5
  complete: boolean;
  fragmentLettre?: string;
  codeValide?: string;
  tempsMs?: number;
}

// ── Session & Questions ───────────────────────────────────────
export interface SessionConfig {
  id: string;
  niveau: Niveau;
  matiere: Matiere;
  theme: string;
  difficulte: NiveauDifficulte;
  nbGroupes: number;
  nbHallucinations: number;
  status: SessionStatus;
  createdAt: string;
}

export interface QuestionOption {
  num: number; // 1-9
  texte: string;
}

export interface Question {
  id: string;
  sessionId: string;
  stationNum: number; // 1-5
  questionNum: number; // 1-4
  enonce: string;
  options: QuestionOption[];
  bonneReponse: number; // 1-9
  explication: string;
  chapitre: string;
  isHallucination: boolean;
  typeErreurHp?: string;
}

// Version masquée pour les élèves (sans bonneReponse)
export interface QuestionPublique {
  id: string;
  stationNum: number;
  questionNum: number;
  enonce: string;
  options: QuestionOption[];
  chapitre: string;
}

// ── QR Code ──────────────────────────────────────────────────
export interface QRPayload {
  sessionId: string;
  groupeId: string;
  stationNum: number;
  lieuNom: string;
  iat: number;
  exp: number;
}

export interface QRScanResult {
  valid: boolean;
  payload?: QRPayload;
  questions?: QuestionPublique[];
  error?: 'QR_EXPIRED' | 'QR_INVALID' | 'QR_WRONG_GROUPE' | 'QR_ALREADY_USED';
}

// ── Réponses & Scoring ────────────────────────────────────────
export interface ReponseRequest {
  choix: number; // 1-9
  essai: 1 | 2;
  groupeId: string;
  timestampDebut: number; // Unix ms — pour vérifier le délai 20s
}

export interface ReponseResult {
  correct: boolean;
  points: number;
  rcVariation: number;
  explication: string;
  penaliteRepetition: boolean;
  partageDetecte: boolean;
}

// ── Scoring Phase 5 (Validation jury) ────────────────────────
export type TacheType = 'a' | 'b' | 'c' | 'd' | 'e';

export interface TacheResult {
  tache: TacheType;
  correct: boolean;
  points: number;
  rcVariation: number;
}

// ── Wallet & Transactions ─────────────────────────────────────
export interface TransactionRecord {
  id: string;
  type: TransactionType;
  sourceId: string;
  destId: string;
  montantRc: number;
  montantDh?: number;
  createdAt: string;
}

export interface CreditResult {
  montantRc: number;
  soldeApres: number;
  transactionId: string;
}

// ── Coach IA ─────────────────────────────────────────────────
export interface LacuneIA {
  notion: string;
  frequence: number;
  typeErreur: string;
}

export interface ExerciceSocrate {
  titre: string;
  questionSocrate: string;
  objectif: string;
  indiceSiBloque: string;
}

export interface CoachAnalyseIndividuelle {
  lacunes: LacuneIA[];
  exercices: ExerciceSocrate[];
  messageEncouragement: string;
  alerteCoachHumain?: string;
}

// ── Certifications ───────────────────────────────────────────
export interface BadgeData {
  id: string;
  eleveId: string;
  niveau: NiveauDifficulte;
  matiere: Matiere;
  score: number;
  scoreMax: number;
  competencesValidees: string[];
  issuedOn: string;
  verifyUrl: string;
  pdfUrl: string;
}

// ── API Responses ─────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  status?: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── RandoCoins constants ──────────────────────────────────────
export const RC_CONSTANTS = {
  TAUX_DH: 100,           // 1 DH = 100 RC
  CAPITAL_INITIAL: 100,   // RC offerts au départ
  BONUS_BONNE_REPONSE: 20,
  MALUS_MAUVAISE: 5,
  MALUS_CODE_INCORRECT: 10,
  PENALITE_PARTAGE_PCT: 30,
  COMMISSION_POOL_PCT: 20,
  COTISATION_DH: 30,
  COTISATION_RC: 3000,
} as const;

export const SCORING = {
  POINTS_PAR_BONNE_REPONSE: (etoiles: NiveauDifficulte) => 5 * etoiles,
  POINTS_TACHE_ABC: (etoiles: NiveauDifficulte) => 50 + etoiles,
  POINTS_TACHE_DE: (etoiles: NiveauDifficulte) => 150 * etoiles,
  MALUS_2EME_ESSAI_DIFFERENT: 5,
  MALUS_2EME_ESSAI_MEME: 10,
} as const;

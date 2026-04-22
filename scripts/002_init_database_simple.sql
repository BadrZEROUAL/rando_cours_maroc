-- RandoCours Maroc - Database Initialization Script (Simplified)
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE IF NOT EXISTS "Role" AS ENUM ('super_admin', 'admin', 'enseignant', 'eleve', 'jury');
CREATE TYPE IF NOT EXISTS "Langue" AS ENUM ('fr', 'ar', 'darija');
CREATE TYPE IF NOT EXISTS "TransactionType" AS ENUM (
    'CREDIT_DH', 'DEBIT_WALLET', 'CREDIT_COLLECTIF', 'DEBIT_COLLECTIF',
    'POOL_COMMISSION', 'POOL_DISTRIBUTION', 'PENALITE_PARTAGE', 
    'PENALITE_QR', 'BONUS_CORRECT', 'COTISATION'
);
CREATE TYPE IF NOT EXISTS "SessionStatus" AS ENUM ('draft', 'configured', 'generated', 'active', 'validation', 'completed');
CREATE TYPE IF NOT EXISTS "Matiere" AS ENUM (
    'Maths', 'Physique_Chimie', 'SVT', 'Sciences_Ingenieur',
    'Arabe', 'Francais', 'Histoire_Geo', 'Philosophie', 'Education_Islamique'
);
CREATE TYPE IF NOT EXISTS "Niveau" AS ENUM (
    'AC1', 'AC2', 'AC3', 'TC', 
    'BAC1_SE', 'BAC1_SM', 
    'BAC2_SP', 'BAC2_SMA', 'BAC2_SVT'
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    telephone TEXT,
    role "Role" DEFAULT 'eleve',
    langue "Langue" DEFAULT 'fr',
    "isMineur" BOOLEAN DEFAULT false,
    "parentEmail" TEXT,
    "consentementParent" BOOLEAN DEFAULT false,
    "estActif" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID UNIQUE NOT NULL REFERENCES users(id),
    "soldeRc" BIGINT DEFAULT 100,
    "capitalInvestiDh" DECIMAL(10, 2) DEFAULT 0,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Etablissements table
CREATE TABLE IF NOT EXISTS etablissements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    type TEXT NOT NULL,
    ville TEXT NOT NULL,
    region TEXT NOT NULL,
    "licenceActive" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groupes table
CREATE TABLE IF NOT EXISTS groupes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    "logoEmoji" TEXT DEFAULT '🎒',
    slogan TEXT,
    "niveauActuel" "Niveau" NOT NULL,
    "etablissementId" UUID REFERENCES etablissements(id),
    "coachId" UUID REFERENCES users(id),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groupe membres table
CREATE TABLE IF NOT EXISTS groupe_membres (
    "groupeId" UUID NOT NULL REFERENCES groupes(id),
    "userId" UUID NOT NULL REFERENCES users(id),
    "joinedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY ("groupeId", "userId")
);

-- Comptes collectifs table
CREATE TABLE IF NOT EXISTS comptes_collectifs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "groupeId" UUID UNIQUE NOT NULL REFERENCES groupes(id),
    "soldeRc" BIGINT DEFAULT 0,
    bloque BOOLEAN DEFAULT false
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type "TransactionType" NOT NULL,
    "sourceId" UUID NOT NULL,
    "destId" UUID NOT NULL,
    "montantRc" BIGINT NOT NULL,
    "montantDh" DECIMAL(10, 2),
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    niveau "Niveau" NOT NULL,
    matiere "Matiere" NOT NULL,
    theme TEXT NOT NULL,
    difficulte INTEGER DEFAULT 3,
    "nbGroupes" INTEGER DEFAULT 3,
    "nbHallucinations" INTEGER DEFAULT 1,
    status "SessionStatus" DEFAULT 'draft',
    "enseignantId" UUID NOT NULL,
    "rcCommission" BIGINT DEFAULT 0,
    "messageSecret" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "completedAt" TIMESTAMP WITH TIME ZONE
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId" UUID NOT NULL REFERENCES sessions(id),
    "stationNum" INTEGER NOT NULL,
    "questionNum" INTEGER NOT NULL,
    enonce TEXT NOT NULL,
    options JSONB NOT NULL,
    "bonneReponse" INTEGER NOT NULL,
    explication TEXT NOT NULL,
    chapitre TEXT NOT NULL,
    "isHallucination" BOOLEAN DEFAULT false,
    "typeErreurHp" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QR codes table
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId" UUID NOT NULL REFERENCES sessions(id),
    "groupeId" UUID NOT NULL,
    "stationNum" INTEGER NOT NULL,
    "lieuNom" TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    "isUtilise" BOOLEAN DEFAULT false,
    "utiliseAt" TIMESTAMP WITH TIME ZONE,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session groupes table
CREATE TABLE IF NOT EXISTS session_groupes (
    "sessionId" UUID NOT NULL REFERENCES sessions(id),
    "groupeId" UUID NOT NULL REFERENCES groupes(id),
    "scoreQcm" INTEGER DEFAULT 0,
    "scoreValidation" INTEGER DEFAULT 0,
    "randoCoins" INTEGER DEFAULT 100,
    "parcoursOrdre" JSONB,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY ("sessionId", "groupeId")
);

-- Reponses groupes table
CREATE TABLE IF NOT EXISTS reponses_groupes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId" UUID NOT NULL,
    "groupeId" UUID NOT NULL,
    "questionId" UUID NOT NULL REFERENCES questions(id),
    choix INTEGER NOT NULL,
    essai INTEGER DEFAULT 1,
    correct BOOLEAN NOT NULL,
    points INTEGER NOT NULL,
    "rcVariation" INTEGER NOT NULL,
    "partageDetecte" BOOLEAN DEFAULT false,
    "tempsDepuisQs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY ("sessionId", "groupeId") REFERENCES session_groupes("sessionId", "groupeId")
);

-- Cotisations table
CREATE TABLE IF NOT EXISTS cotisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "groupeId" UUID NOT NULL REFERENCES groupes(id),
    "montantDh" DECIMAL(10, 2) DEFAULT 30,
    "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "paidAt" TIMESTAMP WITH TIME ZONE,
    "isPaid" BOOLEAN DEFAULT false,
    "rappelJ7" BOOLEAN DEFAULT false,
    "rappelJ1" BOOLEAN DEFAULT false,
    "bloqueAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "eleveId" UUID NOT NULL REFERENCES users(id),
    "groupeId" UUID NOT NULL REFERENCES groupes(id),
    "sessionId" UUID NOT NULL,
    niveau INTEGER NOT NULL,
    matiere "Matiere" NOT NULL,
    score INTEGER NOT NULL,
    "scoreMax" INTEGER NOT NULL,
    "competencesValidees" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "badgeJsonUrl" TEXT,
    "issuedOn" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoque BOOLEAN DEFAULT false
);

-- Coach IA sessions table
CREATE TABLE IF NOT EXISTS coach_ia_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "groupeId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    lacunes JSONB NOT NULL,
    exercices JSONB NOT NULL,
    "messageEncouragement" TEXT NOT NULL,
    "alerteCoachHumain" TEXT,
    "patternCommun" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "acteurId" UUID NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    "cibleType" TEXT NOT NULL,
    "cibleId" UUID NOT NULL,
    ip TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions("sourceId");
CREATE INDEX IF NOT EXISTS idx_transactions_dest ON transactions("destId");
CREATE INDEX IF NOT EXISTS idx_sessions_enseignant ON sessions("enseignantId");
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_questions_session ON questions("sessionId");
CREATE INDEX IF NOT EXISTS idx_qrcodes_token ON qr_codes(token);
CREATE INDEX IF NOT EXISTS idx_reponses_session ON reponses_groupes("sessionId");
CREATE INDEX IF NOT EXISTS idx_cotisations_groupe ON cotisations("groupeId");
CREATE INDEX IF NOT EXISTS idx_badges_eleve ON badges("eleveId");
CREATE INDEX IF NOT EXISTS idx_coach_ia_user ON coach_ia_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_audit_acteur ON audit_logs("acteurId");

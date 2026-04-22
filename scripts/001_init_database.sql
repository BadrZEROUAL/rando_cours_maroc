-- RandoCours Maroc - Database Initialization Script
-- This script creates all the necessary tables, enums, and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ─────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'enseignant', 'eleve', 'jury');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Langue" AS ENUM ('fr', 'ar', 'darija');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TransactionType" AS ENUM (
        'CREDIT_DH', 'DEBIT_WALLET', 'CREDIT_COLLECTIF', 'DEBIT_COLLECTIF',
        'POOL_COMMISSION', 'POOL_DISTRIBUTION', 'PENALITE_PARTAGE', 
        'PENALITE_QR', 'BONUS_CORRECT', 'COTISATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SessionStatus" AS ENUM ('draft', 'configured', 'generated', 'active', 'validation', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Matiere" AS ENUM (
        'Maths', 'Physique_Chimie', 'SVT', 'Sciences_Ingenieur',
        'Arabe', 'Francais', 'Histoire_Geo', 'Philosophie', 'Education_Islamique'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Niveau" AS ENUM (
        'AC1', 'AC2', 'AC3', 'TC', 
        'BAC1_SE', 'BAC1_SM', 
        'BAC2_SP', 'BAC2_SMA', 'BAC2_SVT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ── TABLE 1 : users ───────────────────────────────────────────
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

-- ── TABLE 2 : wallets ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID UNIQUE NOT NULL REFERENCES users(id),
    "soldeRc" BIGINT DEFAULT 100,
    "capitalInvestiDh" DECIMAL(10, 2) DEFAULT 0,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── TABLE 3 : etablissements ──────────────────────────────────
CREATE TABLE IF NOT EXISTS etablissements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    type TEXT NOT NULL,
    ville TEXT NOT NULL,
    region TEXT NOT NULL,
    "licenceActive" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── TABLE 4 : groupes ─────────────────────────────────────────
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

-- ── TABLE 5 : groupe_membres ──────────────────────────────────
CREATE TABLE IF NOT EXISTS groupe_membres (
    "groupeId" UUID NOT NULL REFERENCES groupes(id),
    "userId" UUID NOT NULL REFERENCES users(id),
    "joinedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY ("groupeId", "userId")
);

-- ── TABLE 6 : comptes_collectifs ──────────────────────────────
CREATE TABLE IF NOT EXISTS comptes_collectifs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "groupeId" UUID UNIQUE NOT NULL REFERENCES groupes(id),
    "soldeRc" BIGINT DEFAULT 0,
    bloque BOOLEAN DEFAULT false
);

-- ── TABLE 7 : transactions ────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions("sourceId");
CREATE INDEX IF NOT EXISTS idx_transactions_dest ON transactions("destId");
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions("createdAt");

-- ── TABLE 8 : sessions ────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_sessions_enseignant ON sessions("enseignantId");
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- ── TABLE 9 : questions ───────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_questions_session_station ON questions("sessionId", "stationNum");

-- ── TABLE 10 : qr_codes ───────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_qrcodes_session_groupe ON qr_codes("sessionId", "groupeId");
CREATE INDEX IF NOT EXISTS idx_qrcodes_token ON qr_codes(token);

-- ── TABLE 11 : session_groupes ────────────────────────────────
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

-- ── TABLE 12 : reponses_groupes ───────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_reponses_session_groupe ON reponses_groupes("sessionId", "groupeId");

-- ── TABLE 13 : cotisations ────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_cotisations_groupe ON cotisations("groupeId");
CREATE INDEX IF NOT EXISTS idx_cotisations_due_paid ON cotisations("dueAt", "isPaid");

-- ── TABLE 14 : badges ─────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_badges_eleve ON badges("eleveId");

-- ── TABLE 15 : coach_ia_sessions ──────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_coach_ia_user ON coach_ia_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_coach_ia_groupe ON coach_ia_sessions("groupeId");

-- ── TABLE 16 : audit_logs ─────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_audit_acteur ON audit_logs("acteurId");
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs("createdAt");

-- ── Transaction protection trigger ────────────────────────────
CREATE OR REPLACE FUNCTION prevent_transaction_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Les transactions sont immuables. Modification interdite.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_transaction_update ON transactions;
CREATE TRIGGER no_transaction_update
    BEFORE UPDATE OR DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_transaction_modification();

-- ── Auto-update updatedAt trigger ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security Policies ───────────────────────────────
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY IF NOT EXISTS "users_select_own" ON users 
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "users_update_own" ON users 
    FOR UPDATE USING (auth.uid() = id);

-- Wallets - users can only see their own
CREATE POLICY IF NOT EXISTS "wallets_select_own" ON wallets 
    FOR SELECT USING (auth.uid() = "userId");

-- Badges - users can see their own badges
CREATE POLICY IF NOT EXISTS "badges_select_own" ON badges 
    FOR SELECT USING (auth.uid() = "eleveId");

-- Service role bypass for API operations
CREATE POLICY IF NOT EXISTS "service_role_all_users" ON users 
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY IF NOT EXISTS "service_role_all_wallets" ON wallets 
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY IF NOT EXISTS "service_role_all_badges" ON badges 
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY IF NOT EXISTS "service_role_all_audit" ON audit_logs 
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Teachers and admins can manage sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "enseignant_manage_sessions" ON sessions 
    FOR ALL USING (auth.uid() = "enseignantId" OR 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

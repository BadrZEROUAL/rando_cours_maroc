# RandoCours Maroc — Documentation API v1.0.0

Base URL : `http://localhost:3001` (dev) · `https://api.randocours.ma` (prod)

Toutes les routes protégées nécessitent : `Authorization: Bearer <supabase_jwt_token>`

---

## Auth

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/auth/me` | Tout | Profil utilisateur + wallet |
| DELETE | `/api/v1/auth/me/data` | Tout | Anonymisation CNDP (Loi 09-08) |

---

## Wallet & RandoCoins

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/wallet/me` | Tout | Solde RC + capital DH |
| POST | `/api/v1/wallet/credit` | admin | Créditer DH → RC (paiement cash) |
| POST | `/api/v1/wallet/transfer` | eleve | Transférer RC vers compte collectif |

### POST /api/v1/wallet/credit
```json
{ "userId": "uuid", "montantDh": 30 }
→ { "montantRc": 3000, "soldeApres": 3100, "transactionId": "uuid" }
```

### POST /api/v1/wallet/transfer
```json
{ "groupeId": "uuid", "montantRc": 500 }
→ { "soldeWalletApres": 600, "soldeCollectifApres": 900, "transactionId": "uuid" }
```
Erreurs : `402 SOLDE_INSUFFISANT` · `403 COMPTE_BLOQUE`

---

## Sessions

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/sessions` | enseignant | Liste mes sessions |
| POST | `/api/v1/sessions` | enseignant | Créer une session |
| GET | `/api/v1/sessions/:id` | Tout | Détail + groupes |
| GET | `/api/v1/sessions/:id/scoreboard` | Tout | Classement temps réel |
| POST | `/api/v1/sessions/:id/generate` | enseignant | Générer 20 questions (Claude Sonnet) |

### POST /api/v1/sessions
```json
{
  "niveau": "BAC2_SMA",
  "matiere": "Maths",
  "theme": "Intelligence Artificielle",
  "difficulte": 3,
  "nbGroupes": 3,
  "nbHallucinations": 1
}
```

---

## Jeu (Escape Game)

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/api/v1/game/qrcode/scan` | eleve | Scanner un QR code JWT |
| POST | `/api/v1/game/questions/:id/reponse` | eleve | Soumettre une réponse |
| POST | `/api/v1/game/questions/:id/var` | eleve | Demander une VAR |
| POST | `/api/v1/game/fragments/:groupeId/verify` | eleve | Vérifier le code à 4 chiffres |
| POST | `/api/v1/game/sessions/:id/generate` | enseignant | (alias génération IA) |

### POST /api/v1/game/questions/:id/reponse
```json
{ "choix": 4, "essai": 1, "groupeId": "uuid", "timestampDebut": 1710000000000 }
→ { "correct": true, "points": 15, "rcVariation": 20, "explication": "..." }
```
Erreur : `429 DELAI_NON_RESPECTE` si < 20s écoulées

### POST /api/v1/game/fragments/:groupeId/verify
```json
{ "code": "4729", "sessionId": "uuid", "stationId": "1" }
→ { "valid": true, "fragment": "P", "indiceSuivant": "Bibliothèque" }
```

---

## Cotisations

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/cotisation/:groupeId` | Tout | Historique cotisations |
| POST | `/api/v1/cotisation/pay` | Tout | Payer une cotisation (30 DH) |

---

## Coach IA

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/coach/me` | eleve | Mes analyses Coach IA |
| GET | `/api/v1/coach/jumeau/:groupeId` | enseignant | Jumeau Numérique du groupe |
| POST | `/api/v1/coach/analyse/individuelle` | enseignant | Déclencher analyse individuelle |
| POST | `/api/v1/coach/analyse/collective` | enseignant | Déclencher analyse collective |

---

## Badges & Certifications

| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/v1/badges/mes-badges` | eleve | Mes badges obtenus |
| GET | `/api/v1/badges/verify/:id` | Public | Vérifier un badge (page QR) |
| POST | `/api/v1/badges/generer/:sessionId` | admin | Générer les badges après session |

### GET /api/v1/badges/verify/:id (Public — pas de token)
```json
{
  "valide": true,
  "niveau": 3,
  "matiere": "Maths",
  "score": 1350,
  "scoreMax": 1680,
  "competences": ["pensee_critique", "debat", "cooperation"],
  "date": "2026-03-15T10:00:00Z",
  "issuer": "RandoCours Maroc — randocours.ma"
}
```

---

## Health Check

```
GET /health
→ { "status": "ok", "version": "1.0.0", "region": "me-south-1" }
```

---

## Codes d'erreur communs

| Code | HTTP | Description |
|------|------|-------------|
| `MISSING_TOKEN` | 401 | Token JWT absent |
| `INVALID_TOKEN` | 401 | Token expiré ou invalide |
| `INSUFFICIENT_ROLE` | 403 | Rôle insuffisant |
| `SOLDE_INSUFFISANT` | 402 | RC insuffisants dans le wallet |
| `COMPTE_BLOQUE` | 403 | Compte collectif bloqué (cotisation) |
| `QR_EXPIRED` | 410 | QR code expiré (30 min) |
| `QR_WRONG_GROUPE` | 403 | QR code appartient à un autre groupe |
| `QR_ALREADY_USED` | 409 | QR code déjà scanné |
| `DELAI_NON_RESPECTE` | 429 | Réponse trop rapide (< 20s) |
| `GENERATION_FAILED` | 500 | Échec génération IA après 3 tentatives |
| `CONSENTEMENT_REQUIRED` | 403 | Mineur sans consentement parental |

---

## Taux de change & Constantes

```
1 DH = 100 RC
Capital initial élève = 100 RC
Bonne réponse = +20 RC (fixe) + (5 × étoiles) points
Mauvaise réponse = -5 RC
Code incorrect = -10 RC
Partage détecté = -30% RC du compte collectif
Commission pool = 20%
Cotisation mensuelle = 30 DH = 3 000 RC
```

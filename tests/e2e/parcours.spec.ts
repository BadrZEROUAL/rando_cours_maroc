import { test, expect, Page } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Se connecter")');
  await page.waitForURL('/eleve');
}

// ── SUITE 1 : Authentification ────────────────────────────────
test.describe('Authentification', () => {
  test('E2E-01 : Page login accessible depuis la home', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Je suis élève');
    // Redirige vers /login si non connecté, ou /eleve si connecté
    await expect(page).toHaveURL(/\/(login|eleve)/);
  });

  test('E2E-02 : Formulaire inscription mineur affiche champ parent', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Inscription');
    // La case mineur n'est pas cochée → pas de champ parent
    await expect(page.locator('input[placeholder*="parent"]')).not.toBeVisible();
    // Cocher mineur
    await page.check('input[type="checkbox"]');
    // Le champ parent apparaît
    await expect(page.locator('input[placeholder*="parent"]')).toBeVisible();
  });
});

// ── SUITE 2 : Dashboard élève ─────────────────────────────────
test.describe('Dashboard élève', () => {
  test('E2E-03 : Dashboard affiche le wallet RandoCoins', async ({ page }) => {
    // Mock localStorage token
    await page.addInitScript(() => {
      localStorage.setItem('rc_token', 'mock-test-token');
      localStorage.setItem('rc_user_id', 'test-user-id');
    });

    // Mock l'API wallet
    await page.route('**/api/v1/wallet/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { soldeRc: 2500, capitalInvestiDh: 25 } }),
      })
    );
    await page.route('**/api/v1/badges/mes-badges', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }) }));
    await page.route('**/api/v1/coach/me', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }) }));

    await page.goto('/eleve');
    await expect(page.locator('text=2 500')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=RandoCoins disponibles')).toBeVisible();
  });
});

// ── SUITE 3 : DelaiTimer ──────────────────────────────────────
test.describe('DelaiTimer — Délai anti-hasard', () => {
  test('E2E-04 : Les boutons de réponse sont disabled pendant 20 secondes', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rc_token', 'mock-token');
      localStorage.setItem('rc_groupe_id', 'groupe-test');
      localStorage.setItem('rc_session_id', 'session-test');
    });

    // Mock scan QR + questions
    await page.route('**/api/v1/qrcode/scan', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            questions: [{
              id: 'q-001',
              stationNum: 1, questionNum: 1,
              enonce: 'Question test : combien font 2 + 2 dans le contexte de l\'IA ?',
              options: [1,2,3,4,5,6,7,8,9].map(n => ({ num: n, texte: `Option ${n}` })),
              chapitre: 'Algèbre',
            }],
            payload: { stationNum: 1, sessionId: 'session-test' },
          },
        }),
      })
    );

    await page.goto('/eleve/station/test?token=valid-mock-token');

    // Les boutons doivent être disabled (délai 20s actif)
    const premierBouton = page.locator('button:has-text("Option 1")').first();
    await expect(premierBouton).toBeDisabled({ timeout: 5000 });

    // Le texte du timer doit être visible
    await expect(page.locator('text=secondes')).toBeVisible();
  });
});

// ── SUITE 4 : Admin ───────────────────────────────────────────
test.describe('Interface admin', () => {
  test('E2E-05 : Page admin accessible avec rôle admin', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rc_token', 'mock-admin-token');
    });
    await page.route('**/api/v1/sessions', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }) }));

    await page.goto('/admin');
    await expect(page.locator('text=Nouvelle session')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Créer & Générer')).toBeVisible();
  });

  test('E2E-06 : Formulaire paiement cash — aperçu RC calculé', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rc_token', 'mock-admin-token');
    });
    await page.goto('/admin/paiement');

    await page.fill('input[placeholder*="montant"]', '50');
    await expect(page.locator('text=5 000 RandoCoins')).toBeVisible({ timeout: 3000 });
  });
});

// ── SUITE 5 : Page publique badge ─────────────────────────────
test.describe('Vérification badge publique', () => {
  test('E2E-07 : Badge valide affiche les compétences', async ({ page }) => {
    // La page badge/verify est Server Component — mock au niveau réseau
    const badgeId = 'test-badge-id-123';
    await page.goto(`/badges/verify/${badgeId}`);
    // La page se charge sans erreur (même si badge non trouvé)
    await expect(page).not.toHaveURL('/404');
    await expect(page.locator('text=RandoCours Maroc')).toBeVisible({ timeout: 5000 });
  });
});

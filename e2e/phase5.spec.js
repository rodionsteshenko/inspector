import { test, expect } from '@playwright/test';

/** Navigate past setup and reveal screens to reach the day view map. */
async function startGame(page, playerCount = 8) {
  await page.goto('/');
  const setupBtn = page.locator('[data-testid="start-game-btn"]');
  await setupBtn.waitFor({ timeout: 10000 });
  // Optionally change player count
  if (playerCount !== 8) {
    await page.click(`[data-testid="player-count-${playerCount}"]`);
  }
  await setupBtn.click();
  const beginBtn = page.locator('[data-testid="begin-day-btn"]');
  await beginBtn.waitFor({ timeout: 5000 });
  await beginBtn.click();
  await page.waitForSelector('[data-testid="map"]', { timeout: 10000 });
}

// ── Setup Screen ──────────────────────────────────────────────────────────────
test.describe('Phase 5: Setup Screen', () => {
  test('setup screen renders on initial load', async ({ page }) => {
    await page.goto('/');
    const setup = page.locator('[data-testid="setup-screen"]');
    await expect(setup).toBeVisible({ timeout: 10000 });
  });

  test('setup screen shows map preview', async ({ page }) => {
    await page.goto('/');
    const preview = page.locator('[data-testid="setup-map-preview"]');
    await expect(preview).toBeVisible({ timeout: 5000 });
  });

  test('setup screen shows player count buttons', async ({ page }) => {
    await page.goto('/');
    for (const n of [6, 8, 10, 12]) {
      await expect(page.locator(`[data-testid="player-count-${n}"]`)).toBeVisible({ timeout: 5000 });
    }
  });

  test('player count 8 is selected by default', async ({ page }) => {
    await page.goto('/');
    const btn8 = page.locator('[data-testid="player-count-8"]');
    await expect(btn8).toBeVisible({ timeout: 5000 });
    // Should have amber styling (selected state)
    const classes = await btn8.getAttribute('class');
    expect(classes).toContain('amber');
  });

  test('clicking player count changes selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="setup-screen"]');
    await page.click('[data-testid="player-count-10"]');
    const btn10 = page.locator('[data-testid="player-count-10"]');
    const classes = await btn10.getAttribute('class');
    expect(classes).toContain('amber');
  });

  test('setup screen shows role cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="setup-screen"]');
    const roleCards = page.locator('[data-testid^="role-card-"]');
    const count = await roleCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('start game button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="start-game-btn"]')).toBeVisible({ timeout: 5000 });
  });

  test('clicking start game transitions to character reveal', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="start-game-btn"]').waitFor({ timeout: 10000 });
    await page.click('[data-testid="start-game-btn"]');
    await expect(page.locator('[data-testid="character-reveal-screen"]')).toBeVisible({ timeout: 5000 });
  });
});

// ── Character Reveal Screen ───────────────────────────────────────────────────
test.describe('Phase 5: Character Reveal Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="start-game-btn"]').waitFor({ timeout: 10000 });
    await page.click('[data-testid="start-game-btn"]');
    await page.locator('[data-testid="character-reveal-screen"]').waitFor({ timeout: 5000 });
  });

  test('shows player role card', async ({ page }) => {
    await expect(page.locator('[data-testid="player-role-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="player-role-card"]')).toContainText('Inspector');
  });

  test('shows character cards for all NPCs', async ({ page }) => {
    const cards = page.locator('[data-testid^="character-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('NPC roles show as "???"', async ({ page }) => {
    const cards = page.locator('[data-testid^="character-card-"]');
    const count = await cards.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await expect(cards.nth(i)).toContainText('???');
    }
  });

  test('begin day button is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="begin-day-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="begin-day-btn"]')).toContainText('Begin Day 1');
  });

  test('clicking begin day shows the map', async ({ page }) => {
    await page.click('[data-testid="begin-day-btn"]');
    await expect(page.locator('[data-testid="map"]')).toBeVisible({ timeout: 5000 });
  });

  test('flavor text mentions killers', async ({ page }) => {
    await expect(page.locator('[data-testid="character-reveal-screen"]')).toContainText('killer');
  });
});

// ── Full Setup → Day → Night → Dawn Cycle ────────────────────────────────────
test.describe('Phase 5: Playable game loop', () => {
  test('setup → day 1 → vote → night → dawn completes', async ({ page }) => {
    await startGame(page);

    // Day phase — should be on map
    await expect(page.locator('[data-testid="map"]')).toBeVisible();

    // Move to advance chunks
    const moveBtns = page.locator('button[data-testid^="move-to-"]');
    if ((await moveBtns.count()) > 0) {
      await moveBtns.first().click();
    }

    // Call for vote
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor({ timeout: 5000 });
    await expect(page.locator('[data-testid="vote-screen"]')).toContainText('The Village Votes');

    // Skip vote
    await page.click('[data-testid="skip-vote-btn"]');
    await page.locator('[data-testid="night-screen"]').waitFor({ timeout: 5000 });
    await expect(page.locator('[data-testid="night-screen"]')).toBeVisible();

    // Skip investigation
    await page.click('[data-testid="skip-investigate-btn"]');
    await page.locator('[data-testid="dawn-screen"]').waitFor({ timeout: 5000 });
    await expect(page.locator('[data-testid="dawn-screen"]')).toBeVisible();

    // Continue to day 2
    await page.click('[data-testid="dawn-continue-btn"]');
    await expect(
      page.locator('[data-testid="map"], [data-testid="game-over-screen"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('vote screen shows day summary and tally after nomination', async ({ page }) => {
    await startGame(page);

    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor({ timeout: 5000 });

    // Nominate someone
    const voteBtns = page.locator('button[data-testid^="vote-"]');
    if ((await voteBtns.count()) > 0) {
      await voteBtns.first().click();

      // Should now show vote tally
      await expect(page.locator('[data-testid="vote-screen"]')).toContainText('The Verdict');
      await expect(page.locator('[data-testid="confirm-vote-btn"]')).toBeVisible();
    }
  });

  test('confirming vote proceeds to night', async ({ page }) => {
    await startGame(page);

    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor({ timeout: 5000 });

    const voteBtns = page.locator('button[data-testid^="vote-"]');
    if ((await voteBtns.count()) === 0) return;

    await voteBtns.first().click();
    await page.locator('[data-testid="confirm-vote-btn"]').waitFor({ timeout: 3000 });
    await page.click('[data-testid="confirm-vote-btn"]');

    // Should go to night or game over
    await expect(
      page.locator('[data-testid="night-screen"], [data-testid="game-over-screen"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('win/lose screen shows full role reveal', async ({ page }) => {
    await startGame(page);

    // Run enough days to trigger game over
    for (let i = 0; i < 8; i++) {
      const isGameOver = await page.locator('[data-testid="game-over-screen"]').isVisible();
      if (isGameOver) break;
      const hasMap = await page.locator('[data-testid="map"]').isVisible();
      if (!hasMap) break;

      await page.click('[data-testid="call-vote-btn"]');
      await page.locator('[data-testid="vote-screen"]').waitFor({ timeout: 5000 });
      await page.click('[data-testid="skip-vote-btn"]');
      await page.locator('[data-testid="night-screen"]').waitFor({ timeout: 5000 });
      await page.click('[data-testid="skip-investigate-btn"]');
      await page.locator('[data-testid="dawn-screen"]').waitFor({ timeout: 5000 });
      await page.click('[data-testid="dawn-continue-btn"]');
      await page.waitForTimeout(100);
    }

    const gameOver = page.locator('[data-testid="game-over-screen"]');
    if (!(await gameOver.isVisible())) return; // Skip if game didn't end

    await expect(gameOver).toContainText('The truth revealed');
    await expect(page.locator('[data-testid="new-game-btn"]')).toBeVisible();
  });

  test('new game button returns to setup screen', async ({ page }) => {
    await startGame(page);

    // Run to game over
    for (let i = 0; i < 8; i++) {
      const isGameOver = await page.locator('[data-testid="game-over-screen"]').isVisible();
      if (isGameOver) break;
      const hasMap = await page.locator('[data-testid="map"]').isVisible();
      if (!hasMap) break;

      await page.click('[data-testid="call-vote-btn"]');
      await page.locator('[data-testid="vote-screen"]').waitFor({ timeout: 5000 });
      await page.click('[data-testid="skip-vote-btn"]');
      await page.locator('[data-testid="night-screen"]').waitFor({ timeout: 5000 });
      await page.click('[data-testid="skip-investigate-btn"]');
      await page.locator('[data-testid="dawn-screen"]').waitFor({ timeout: 5000 });
      await page.click('[data-testid="dawn-continue-btn"]');
      await page.waitForTimeout(100);
    }

    const gameOver = page.locator('[data-testid="game-over-screen"]');
    if (!(await gameOver.isVisible())) return;

    await page.click('[data-testid="new-game-btn"]');
    // Should go back to setup screen
    await expect(page.locator('[data-testid="setup-screen"]')).toBeVisible({ timeout: 5000 });
  });

  test('8-player game has 7 NPCs in character reveal', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="start-game-btn"]').waitFor({ timeout: 10000 });
    await page.click('[data-testid="start-game-btn"]');
    await page.locator('[data-testid="character-reveal-screen"]').waitFor({ timeout: 5000 });

    const cards = page.locator('[data-testid^="character-card-"]');
    const count = await cards.count();
    expect(count).toBe(7); // 8 players - 1 inspector = 7 NPCs
  });

  test('different player counts can start a game', async ({ page }) => {
    for (const n of [6, 10, 12]) {
      await page.goto('/');
      await page.locator('[data-testid="setup-screen"]').waitFor({ timeout: 10000 });
      await page.click(`[data-testid="player-count-${n}"]`);
      await page.click('[data-testid="start-game-btn"]');
      await page.locator('[data-testid="character-reveal-screen"]').waitFor({ timeout: 5000 });
      await page.click('[data-testid="begin-day-btn"]');
      await page.waitForSelector('[data-testid="map"]', { timeout: 5000 });
    }
  });
});

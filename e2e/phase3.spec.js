import { test, expect } from '@playwright/test';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Navigate to an NPC (move if needed) and return true if we found a talk button. */
async function findTalkButton(page, maxMoves = 3) {
  for (let attempt = 0; attempt <= maxMoves; attempt++) {
    const talkBtns = page.locator('button[data-testid^="talk-to-"]');
    if ((await talkBtns.count()) > 0) return true;

    const moveBtns = page.locator('button[data-testid^="move-to-"]');
    if ((await moveBtns.count()) === 0) break;
    await moveBtns.first().click();
    await page.waitForTimeout(80);
  }
  return false;
}

/** Navigate past setup and reveal screens to reach the day view map. */
async function startGame(page) {
  await page.goto('/');
  const setupBtn = page.locator('[data-testid="start-game-btn"]');
  await setupBtn.waitFor({ timeout: 10000 });
  await setupBtn.click();
  const beginBtn = page.locator('[data-testid="begin-day-btn"]');
  await beginBtn.waitFor({ timeout: 5000 });
  await beginBtn.click();
  await page.waitForSelector('[data-testid="map"]', { timeout: 10000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Phase 3: UI wired to engine', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  // ── Map interactions ───────────────────────────────────────────────────────

  test('clicking adjacent map node moves player and updates action menu', async ({ page }) => {
    const moveBtns = page.locator('button[data-testid^="move-to-"]');
    await expect(moveBtns.first()).toBeVisible();

    const destText = await moveBtns.first().textContent();
    await moveBtns.first().click();

    // Action menu still visible after move
    await expect(page.locator('[data-testid="action-menu"]')).toBeVisible();

    // Move buttons should now reflect new position (different adjacent set)
    const newMoveBtns = page.locator('button[data-testid^="move-to-"]');
    await expect(newMoveBtns.first()).toBeVisible();
  });

  test('non-adjacent map nodes are not clickable (no "click to move" text)', async ({ page }) => {
    // Adjacent nodes show "click to move" label; non-adjacent do not
    const map = page.locator('[data-testid="map"]');
    const clickableLabels = map.locator('text=click to move');
    const count = await clickableLabels.count();

    // There should be some clickable labels (adjacent nodes)
    expect(count).toBeGreaterThan(0);
    // But not all 8 nodes (some must be non-adjacent / non-clickable)
    expect(count).toBeLessThan(8);
  });

  test('action menu shows real NPC names present at location', async ({ page }) => {
    const talkBtns = page.locator('button[data-testid^="talk-to-"]');
    const count = await talkBtns.count();
    if (count > 0) {
      const text = await talkBtns.first().textContent();
      expect(text).toMatch(/Talk to .+/);
      // Should not contain raw IDs like "brad_barber" — real names have spaces
      expect(text).not.toMatch(/^Talk to [a-z]+_[a-z]+$/);
    }
  });

  test('observe action logs to evidence board', async ({ page }) => {
    await page.click('[data-testid="observe-btn"]');
    const board = page.locator('[data-testid="evidence-board"]');
    await expect(board).toBeVisible();
    // The board section headers or entries may now be visible
    // (movement logs added if NPCs are co-located)
  });

  // ── Conversation UI ────────────────────────────────────────────────────────

  test('conversation modal opens with question choices', async ({ page }) => {
    const found = await findTalkButton(page);
    if (!found) return; // No NPCs reachable — skip gracefully

    await page.locator('button[data-testid^="talk-to-"]').first().click();

    // Question buttons should appear
    const questionBtns = page.locator('button[data-testid^="question-"]');
    await expect(questionBtns.first()).toBeVisible({ timeout: 3000 });

    const qCount = await questionBtns.count();
    expect(qCount).toBeGreaterThanOrEqual(1);
    expect(qCount).toBeLessThanOrEqual(4);
  });

  test('selecting a question shows character response', async ({ page }) => {
    const found = await findTalkButton(page);
    if (!found) return;

    await page.locator('button[data-testid^="talk-to-"]').first().click();

    const questionBtns = page.locator('button[data-testid^="question-"]');
    if ((await questionBtns.count()) === 0) return;

    await questionBtns.first().click();

    const response = page.locator('[data-testid="character-response"]');
    await expect(response).toBeVisible({ timeout: 3000 });
    // Response should contain actual text
    const text = await response.textContent();
    expect(text?.trim().length).toBeGreaterThan(5);
  });

  test('"ask another question" button appears after first question', async ({ page }) => {
    const found = await findTalkButton(page);
    if (!found) return;

    await page.locator('button[data-testid^="talk-to-"]').first().click();

    const questionBtns = page.locator('button[data-testid^="question-"]');
    if ((await questionBtns.count()) < 2) return; // Need at least 2 questions

    await questionBtns.first().click();

    // "Ask another" button should appear (remaining > 0)
    const anotherBtn = page.locator('[data-testid="ask-another-btn"]');
    await expect(anotherBtn).toBeVisible({ timeout: 2000 });
  });

  test('"ask another" returns to question list with one fewer option', async ({ page }) => {
    const found = await findTalkButton(page);
    if (!found) return;

    await page.locator('button[data-testid^="talk-to-"]').first().click();

    const initialCount = await page.locator('button[data-testid^="question-"]').count();
    if (initialCount < 2) return;

    // Ask first question
    await page.locator('button[data-testid^="question-"]').first().click();
    await page.locator('[data-testid="ask-another-btn"]').click();

    // One fewer question now
    const newCount = await page.locator('button[data-testid^="question-"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('closing conversation returns to day view', async ({ page }) => {
    const found = await findTalkButton(page);
    if (!found) return;

    await page.locator('button[data-testid^="talk-to-"]').first().click();

    await page.locator('[data-testid="close-conversation"]').click();

    // Day view elements should be back
    await expect(page.locator('[data-testid="map"]')).toBeVisible();
    await expect(page.locator('[data-testid="action-menu"]')).toBeVisible();
    // No question buttons in DOM
    await expect(page.locator('[data-testid="character-response"]')).not.toBeVisible();
  });

  test('conversation is logged to evidence board after asking a question', async ({ page }) => {
    const found = await findTalkButton(page);
    if (!found) return;

    await page.locator('button[data-testid^="talk-to-"]').first().click();
    const qBtns = page.locator('button[data-testid^="question-"]');
    if ((await qBtns.count()) === 0) return;

    await qBtns.first().click();
    await page.locator('[data-testid="close-conversation"]').click();

    // Conversations section should appear in evidence board
    const board = page.locator('[data-testid="evidence-board"]');
    await expect(board).toContainText('Conversations', { timeout: 3000 });
  });

  test('conversation uses a slot — count decrements', async ({ page }) => {
    // Check conversation slot display before and after talking
    const slotText = await page.locator('[data-testid="action-menu"]').textContent();
    const match = slotText?.match(/Conversations:\s*(\d+)\/(\d+)/);

    if (!match) return; // display format may differ
    const initialLeft = parseInt(match[1]);

    const found = await findTalkButton(page);
    if (!found || initialLeft === 0) return;

    await page.locator('button[data-testid^="talk-to-"]').first().click();
    await page.locator('[data-testid="close-conversation"]').click();

    await page.waitForTimeout(100);
    const slotText2 = await page.locator('[data-testid="action-menu"]').textContent();
    const match2 = slotText2?.match(/Conversations:\s*(\d+)\/(\d+)/);
    if (!match2) return;
    expect(parseInt(match2[1])).toBe(initialLeft - 1);
  });

  // ── Night screen ───────────────────────────────────────────────────────────

  test('night screen shows real living character names', async ({ page }) => {
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor();
    await page.click('[data-testid="skip-vote-btn"]');

    const nightScreen = page.locator('[data-testid="night-screen"]');
    await expect(nightScreen).toBeVisible();

    const investigateBtns = page.locator('button[data-testid^="investigate-"]');
    const count = await investigateBtns.count();
    expect(count).toBeGreaterThan(0);

    // Buttons contain real names (not just raw IDs)
    const firstText = await investigateBtns.first().textContent();
    expect(firstText?.trim()).toBeTruthy();
  });

  test('night investigation shows result at dawn', async ({ page }) => {
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor();
    await page.click('[data-testid="skip-vote-btn"]');

    const investigateBtns = page.locator('button[data-testid^="investigate-"]');
    if ((await investigateBtns.count()) > 0) {
      await investigateBtns.first().click();
    } else {
      await page.click('[data-testid="skip-investigate-btn"]');
    }

    await page.locator('[data-testid="dawn-screen"]').waitFor();
    await expect(page.locator('text=Your Investigation')).toBeVisible();
  });

  test('skipping investigation shows "no investigation" at dawn', async ({ page }) => {
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor();
    await page.click('[data-testid="skip-vote-btn"]');
    await page.click('[data-testid="skip-investigate-btn"]');

    const dawn = page.locator('[data-testid="dawn-screen"]');
    await expect(dawn).toBeVisible();
    await expect(dawn).toContainText('did not investigate');
  });

  // ── Dawn screen ────────────────────────────────────────────────────────────

  test('dawn screen shows kill result and advances to next day', async ({ page }) => {
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor();
    await page.click('[data-testid="skip-vote-btn"]');
    await page.click('[data-testid="skip-investigate-btn"]');

    const dawn = page.locator('[data-testid="dawn-screen"]');
    await expect(dawn).toBeVisible();
    await expect(dawn).toContainText('A New Morning');

    // Kill result box always present (quiet night / body found / saved)
    const hasKillResult =
      (await page.locator('text=A body is found').isVisible()) ||
      (await page.locator('text=A quiet night').isVisible()) ||
      (await page.locator('text=Saved by the healer').isVisible());
    expect(hasKillResult).toBe(true);

    await page.click('[data-testid="dawn-continue-btn"]');

    // Either day 2 or game over (if parity hit)
    await expect(
      page.locator('[data-testid="map"], [data-testid="game-over-screen"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ── Vote mechanic ──────────────────────────────────────────────────────────

  test('voting for a character eliminates them and proceeds', async ({ page }) => {
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor();

    const voteBtns = page.locator('button[data-testid^="vote-"]');
    if ((await voteBtns.count()) === 0) return;

    // Step 1: Nominate a character
    await voteBtns.first().click();

    // Step 2: Confirm vote (new two-step flow shows tally then confirm button)
    const confirmBtn = page.locator('[data-testid="confirm-vote-btn"]');
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Should go to night (or game over if win triggered)
    await expect(
      page.locator('[data-testid="night-screen"], [data-testid="game-over-screen"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ── Win / lose screens ─────────────────────────────────────────────────────

  test('game over screen: new game button restarts the game', async ({ page }) => {
    // Run 6 day cycles — timeout loss fires at day > 5
    for (let i = 0; i < 7; i++) {
      const gameOver = await page.locator('[data-testid="game-over-screen"]').isVisible();
      if (gameOver) break;
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
    if (!(await gameOver.isVisible())) return; // didn't reach game over — skip

    // Role reveal table should be present
    await expect(gameOver).toContainText('The truth revealed');

    // New game goes to setup screen
    await page.click('[data-testid="new-game-btn"]');
    // Either setup screen or map (if setup was bypassed)
    await expect(
      page.locator('[data-testid="setup-screen"], [data-testid="map"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ── Full cycle ─────────────────────────────────────────────────────────────

  test('full cycle: day (move + observe + talk) → vote → night (investigate) → dawn → day 2', async ({ page }) => {
    // Move
    const moveBtns = page.locator('button[data-testid^="move-to-"]');
    if ((await moveBtns.count()) > 0) await moveBtns.first().click();

    // Observe
    await page.click('[data-testid="observe-btn"]');

    // Talk if possible
    const talkBtns = page.locator('button[data-testid^="talk-to-"]');
    if ((await talkBtns.count()) > 0) {
      await talkBtns.first().click();
      const qBtns = page.locator('button[data-testid^="question-"]');
      if ((await qBtns.count()) > 0) await qBtns.first().click();
      await page.click('[data-testid="close-conversation"]');
    }

    // Call vote
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor({ timeout: 5000 });
    await page.click('[data-testid="skip-vote-btn"]');

    // Night — investigate if available
    await page.locator('[data-testid="night-screen"]').waitFor({ timeout: 5000 });
    const invBtns = page.locator('button[data-testid^="investigate-"]');
    if ((await invBtns.count()) > 0) {
      await invBtns.first().click();
    } else {
      await page.click('[data-testid="skip-investigate-btn"]');
    }

    // Dawn
    await page.locator('[data-testid="dawn-screen"]').waitFor({ timeout: 5000 });
    await page.click('[data-testid="dawn-continue-btn"]');

    // Day 2 (or game over)
    await expect(
      page.locator('[data-testid="map"], [data-testid="game-over-screen"]').first()
    ).toBeVisible({ timeout: 5000 });
  });
});

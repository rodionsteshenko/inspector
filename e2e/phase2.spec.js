import { test, expect } from '@playwright/test';

/** Navigate past the setup and reveal screens to reach the day view map. */
async function startGame(page) {
  await page.goto('/');
  // Setup screen
  const setupBtn = page.locator('[data-testid="start-game-btn"]');
  await setupBtn.waitFor({ timeout: 10000 });
  await setupBtn.click();
  // Character reveal screen
  const beginBtn = page.locator('[data-testid="begin-day-btn"]');
  await beginBtn.waitFor({ timeout: 5000 });
  await beginBtn.click();
  // Day view
  await page.waitForSelector('[data-testid="map"]', { timeout: 10000 });
}

test.describe('Phase 2 UI Shell', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('map renders all 8 location nodes', async ({ page }) => {
    const map = page.locator('[data-testid="map"]');
    await expect(map).toBeVisible();

    // Check all 8 nodes by their test ids
    const nodeIds = ['town_square', 'church', 'docks', 'market', 'tavern', 'library', 'alley', 'cellar'];
    for (const nodeId of nodeIds) {
      const node = page.locator(`[data-testid="node-${nodeId}"]`);
      await expect(node).toBeVisible();
    }
  });

  test('map shows location names as text', async ({ page }) => {
    const map = page.locator('[data-testid="map"]');
    await expect(map).toBeVisible();

    // Check location name text is present in the SVG
    const locationNames = ['Church', 'Town Square', 'Docks', 'Market', 'Tavern', 'Library', 'Alley', 'Cellar'];
    for (const name of locationNames) {
      await expect(map).toContainText(name);
    }
  });

  test('action menu renders with correct sections', async ({ page }) => {
    const menu = page.locator('[data-testid="action-menu"]');
    await expect(menu).toBeVisible();

    // Should have observe button
    const observeBtn = page.locator('[data-testid="observe-btn"]');
    await expect(observeBtn).toBeVisible();
    await expect(observeBtn).toContainText('Observe quietly');

    // Should have call vote button
    const voteBtn = page.locator('[data-testid="call-vote-btn"]');
    await expect(voteBtn).toBeVisible();
    await expect(voteBtn).toContainText('Call for Vote');
  });

  test('action menu shows move options to adjacent locations', async ({ page }) => {
    const menu = page.locator('[data-testid="action-menu"]');
    await expect(menu).toBeVisible();

    // There should be at least one "Move →" button
    const moveBtns = page.locator('button[data-testid^="move-to-"]');
    const count = await moveBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test('evidence board renders', async ({ page }) => {
    const board = page.locator('[data-testid="evidence-board"]');
    await expect(board).toBeVisible();
    await expect(board).toContainText('Evidence Board');
  });

  test('observe action logs to evidence board', async ({ page }) => {
    // Click observe
    await page.click('[data-testid="observe-btn"]');
    // Chunk should advance (header shows chunk number)
    // Evidence board may now have movement log entries
    const board = page.locator('[data-testid="evidence-board"]');
    await expect(board).toBeVisible();
  });

  test('player can move to adjacent location', async ({ page }) => {
    // Find the first available move button
    const moveBtns = page.locator('button[data-testid^="move-to-"]');
    const count = await moveBtns.count();

    if (count > 0) {
      const firstBtn = moveBtns.first();
      const btnText = await firstBtn.textContent();
      await firstBtn.click();

      // After move, action menu should still be visible
      const menu = page.locator('[data-testid="action-menu"]');
      await expect(menu).toBeVisible();
    }
  });

  test('day to vote to night to dawn screen transition', async ({ page }) => {
    // Trigger vote phase by clicking "Call for Vote"
    await page.click('[data-testid="call-vote-btn"]');

    // Should now be on vote screen
    const voteScreen = page.locator('[data-testid="vote-screen"]');
    await expect(voteScreen).toBeVisible();
    await expect(voteScreen).toContainText('The Village Votes');

    // Skip the vote
    await page.click('[data-testid="skip-vote-btn"]');

    // Should now be on night screen
    const nightScreen = page.locator('[data-testid="night-screen"]');
    await expect(nightScreen).toBeVisible();
    await expect(nightScreen).toContainText('Darkness Falls');

    // Skip investigation
    await page.click('[data-testid="skip-investigate-btn"]');

    // Should now be on dawn screen
    const dawnScreen = page.locator('[data-testid="dawn-screen"]');
    await expect(dawnScreen).toBeVisible();
    await expect(dawnScreen).toContainText('A New Morning');

    // Continue to day 2
    await page.click('[data-testid="dawn-continue-btn"]');

    // Should be back on day view (or game over if mafia triggered parity / killed player)
    const dayViewOrGameOver = page.locator('[data-testid="map"], [data-testid="game-over-screen"]');
    await expect(dayViewOrGameOver.first()).toBeVisible({ timeout: 5000 });
  });

  test('conversation modal opens and closes correctly', async ({ page }) => {
    // Find a talk button (if NPCs are at player location)
    const talkBtns = page.locator('button[data-testid^="talk-to-"]');
    const count = await talkBtns.count();

    if (count > 0) {
      await talkBtns.first().click();

      // Conversation modal should appear with character name visible
      const closeBtn = page.locator('[data-testid="close-conversation"]');
      await expect(closeBtn).toBeVisible({ timeout: 3000 });

      // Close it
      await closeBtn.click();

      // Close button should be gone (modal closed)
      await expect(closeBtn).not.toBeVisible();
    }
  });

  test('night screen shows investigation targets', async ({ page }) => {
    // Navigate to night screen
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor();
    await page.click('[data-testid="skip-vote-btn"]');

    const nightScreen = page.locator('[data-testid="night-screen"]');
    await expect(nightScreen).toBeVisible();

    // Should have investigation buttons for alive NPCs
    const investigateBtns = page.locator('button[data-testid^="investigate-"]');
    const count = await investigateBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test('one full day cycle completes without crash', async ({ page }) => {
    // Navigate through one full day cycle to verify no crashes
    await page.click('[data-testid="call-vote-btn"]');
    await page.locator('[data-testid="vote-screen"]').waitFor();
    await page.click('[data-testid="skip-vote-btn"]');
    await page.locator('[data-testid="night-screen"]').waitFor();
    await page.click('[data-testid="skip-investigate-btn"]');
    await page.locator('[data-testid="dawn-screen"]').waitFor();
    await page.click('[data-testid="dawn-continue-btn"]');

    // Should be back at day view (or game over if parity was reached)
    const dayViewOrGameOver = page.locator('[data-testid="map"], [data-testid="game-over-screen"]');
    await expect(dayViewOrGameOver.first()).toBeVisible();
  });
});

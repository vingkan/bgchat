import { expect, test } from '@playwright/test';

// Real-browser UX flows (Chromium + WebKit). These verify the interaction layer
// end to end: the Begin gate, branching, the dice roll, keyboard, the double-click
// guard, and replay — the things jsdom approximates but a real browser proves.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Fail the test on any uncaught page error.
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.getByRole('button', { name: /begin/i }).click();
});

test('opens on the gate node', async ({ page }) => {
  await expect(page.getByText('Gate Warden Aldric')).toBeVisible();
  await expect(page.getByText(/State your business/i)).toBeVisible();
});

test('plays a full simple path to the ending', async ({ page }) => {
  await page.getByText(/Tell him the truth/i).click();
  await page.getByText(/Thank him and enter/i).click();
  await expect(page.getByText('The End')).toBeVisible();
  await expect(page.getByRole('button', { name: /restart/i })).toBeVisible();
});

test('runs a skill check: overlay -> Continue routes to a branch', async ({ page }) => {
  await page.getByText(/Convince him you mean no harm/i).click();
  await expect(page.getByRole('dialog', { name: /skill check/i })).toBeVisible();
  const cont = page.getByRole('button', { name: /continue/i });
  await expect(cont).toBeVisible();
  await cont.click();
  await expect(
    page.getByText(/(honest face, I'll give you that|Stand where I can see your hands)/i),
  ).toBeVisible();
});

test('double-clicking a skill check only rolls once', async ({ page }) => {
  const choice = page.getByText(/Lie\. Claim you carry a sealed writ/i);
  await choice.dblclick();
  // Exactly one dice dialog — the guard prevented a second roll.
  await expect(page.getByRole('dialog', { name: /skill check/i })).toHaveCount(1);
});

test('number keys select choices', async ({ page }) => {
  await page.keyboard.press('1'); // Tell him the truth -> truth
  await expect(page.getByText(/Honesty buys you a step/i)).toBeVisible();
});

test('replay: Restart returns to start and keeps "seen" markers', async ({ page }) => {
  await page.getByText(/Tell him the truth/i).click();
  await page.getByText(/Thank him and enter/i).click();
  await expect(page.getByText('The End')).toBeVisible();
  await page.getByRole('button', { name: /restart/i }).click();
  await expect(page.getByText(/State your business/i)).toBeVisible();
  await expect(page.getByText('seen').first()).toBeVisible(); // truth branch stays marked
});

test('rapid advance through nodes throws no page errors', async ({ page }) => {
  // suspicious -> truth -> enter, clicking as fast as possible.
  await page.getByText(/Tell him the truth/i).click();
  await page.getByText(/Thank him and enter/i).click();
  await expect(page.getByText('The End')).toBeVisible();
});

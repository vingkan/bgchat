import { expect, test } from '@playwright/test';

// Video + autoplay behavior — the failure surface jsdom cannot reach. Uses the
// dev-only ?e2eVideo fixture (real clip on nodes A/B, missing clip on C).
// The WebKit project matters most here: Safari's autoplay licensing is stricter.

test.beforeEach(async ({ page }) => {
  await page.goto('/?e2eVideo');
  await expect(page.getByText('Test A')).toBeVisible();
  await page.getByTestId('unlock').click();
});

test('the Unlock gesture unlocks muted autoplay of the first clip', async ({ page }) => {
  const clip = page.getByTestId('clip');
  await expect(clip).toBeVisible();
  // Playing = advancing currentTime and not paused.
  await expect.poll(async () => clip.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
  await expect
    .poll(async () => clip.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 4000 })
    .toBeGreaterThan(0);
});

test('a subsequent node also autoplays (WebKit gesture licensing holds)', async ({ page }) => {
  await page.getByRole('button', { name: /go to b/i }).click();
  await expect(page.getByText('Test B')).toBeVisible();
  const clip = page.getByTestId('clip');
  await expect(clip).toBeVisible();
  await expect
    .poll(async () => clip.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 4000 })
    .toBeGreaterThan(0);
});

test('a missing clip falls back to the placeholder (no blank frame)', async ({ page }) => {
  await page.getByRole('button', { name: /go to b/i }).click();
  await page.getByRole('button', { name: /go to missing/i }).click();
  await expect(page.getByText(/This clip does not exist/i)).toBeVisible();
  // No <video> element rendered — VideoStage shows the ambient placeholder instead.
  await expect(page.getByTestId('clip')).toHaveCount(0);
  // The ambient placeholder container is shown (no blank/broken frame).
  await expect(page.locator('#video')).toBeVisible();
});

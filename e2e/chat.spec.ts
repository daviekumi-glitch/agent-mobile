import { expect, test } from "@playwright/test";

/**
 * App-shell checks for the guest-only app. No credentials exist anywhere:
 * these assert that the static bundle renders, that the deleted auth pages
 * are really gone, that a fresh device gets a device id, and that the chat
 * route opens without any session.
 */
test.describe("app shell", () => {
  test("the landing page renders its headline", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the landing page has no sign-in UI", async ({ page }) => {
    await page.goto("/");
    // The CTA goes straight to the chat; there is no form and no auth route.
    await expect(page.getByRole("link", { name: /start chatting/i }).first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('a[href*="login"], a[href*="register"]')).toHaveCount(0);
  });

  test("the chat route opens without any login", async ({ page }) => {
    await page.goto("/chat/");
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/chat/);
  });

  test("a fresh visitor gets a persistent device id", async ({ page }) => {
    await page.goto("/chat/");
    // The id is created on the first backend call after hydration; wait for
    // it instead of reading instantly, so slow machines cannot flake this.
    await page.waitForFunction(() => localStorage.getItem("am_device_id") !== null, null, { timeout: 15_000 });
    const id1 = await page.evaluate(() => localStorage.getItem("am_device_id"));
    expect(id1).toBeTruthy();
    await page.reload();
    await page.waitForFunction(() => localStorage.getItem("am_device_id") !== null, null, { timeout: 15_000 });
    const id2 = await page.evaluate(() => localStorage.getItem("am_device_id"));
    expect(id2).toBe(id1);
  });

  test("removed auth routes render the not-found page", async ({ page }) => {
    await page.goto("/login/");
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });

  test("an unknown route renders the not-found page", async ({ page }) => {
    await page.goto("/definitely-not-a-real-route/");
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});

/**
 * Guest conversation flow against the deployed backend. No token needed -
 * every request carries only the device id the page itself created.
 */
test.describe("guest chat", () => {
  test("sends a message, streams a reply and renders the calculator card", async ({ page }) => {
    await page.goto("/chat/");
    const box = page.locator("textarea").first();
    await box.fill("What is (1250*1.18)/3? Use the calculator tool.");
    await box.press("Enter");
    await expect(page.getByText(/491\.6/).first()).toBeVisible({ timeout: 80_000 });
    await expect(page.getByText(/calculator/i).first()).toBeVisible();
  });

  test("the new conversation appears in the sidebar", async ({ page }) => {
    await page.goto("/chat/");
    const box = page.locator("textarea").first();
    await box.fill("What is 9 times 3? Use the calculator tool.");
    await box.press("Enter");
    await expect(page.getByText(/27/).first()).toBeVisible({ timeout: 80_000 });
    await expect(page.getByText(/What is 9 times 3/).first()).toBeVisible();
  });
});

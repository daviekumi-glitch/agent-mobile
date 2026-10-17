import { expect, test } from "@playwright/test";

/**
 * App-shell checks. They need no credentials: they assert that the static
 * bundle renders, that auth errors are surfaced politely and that the chat
 * route is protected when there is no session.
 */
test.describe("app shell", () => {
  test("the landing page renders its headline", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the login page exposes email and password fields", async ({ page }) => {
    await page.goto("/login/");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("the register page is reachable", async ({ page }) => {
    await page.goto("/register/");
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("bad credentials show a friendly error and stay on the page", async ({ page }) => {
    await page.goto("/login/");
    await page.fill('input[type="email"]', "nobody@example.com");
    await page.fill('input[type="password"]', "wrong-password-1");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the chat route redirects to login without a session", async ({ page }) => {
    await page.goto("/chat/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an unknown route renders the not-found page", async ({ page }) => {
    await page.goto("/definitely-not-a-real-route/");
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});

/**
 * Signed-in conversation flow. Needs a real Base44 access token, supplied via
 * E2E_ACCESS_TOKEN; skipped (and reported as skipped) otherwise.
 */
test.describe("signed-in chat", () => {
  test.skip(!process.env.E2E_ACCESS_TOKEN, "E2E_ACCESS_TOKEN not set");

  test.beforeEach(async ({ page }) => {
    const token = process.env.E2E_ACCESS_TOKEN as string;
    await page.addInitScript((tk) => {
      localStorage.setItem("base44_access_token", tk);
      localStorage.setItem("token", tk);
    }, token);
  });

  test("sends a message, streams a reply and renders the calculator card", async ({ page }) => {
    await page.goto("/chat/");
    const box = page.locator("textarea").first();
    await box.fill("What is (1250*1.18)/3? Use the calculator tool.");
    await box.press("Enter");
    await expect(page.getByText(/491\.6/).first()).toBeVisible({ timeout: 80_000 });
    await expect(page.getByText(/calculator/i).first()).toBeVisible();
  });
});

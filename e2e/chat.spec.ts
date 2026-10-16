import { expect, test } from "@playwright/test";

/**
 * App-shell end-to-end checks.
 *
 * These need no credentials: they assert that the production server boots and
 * serves the expected pages, and that the auth guard actually protects the chat
 * route when there is no session.
 */

test.describe("app shell", () => {
  test("the landing page renders its headline", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the login page exposes an email and password field", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("the register page is reachable", async ({ page }) => {
    const res = await page.goto("/register");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("an unknown route renders the not-found page rather than crashing", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-real-route");
    expect(res?.status()).toBe(404);
  });

  test("the chat route is guarded without a session", async ({ page }) => {
    await page.goto("/chat");
    // Middleware redirects unauthenticated visitors to /login.
    await expect(page).toHaveURL(/\/login/);
  });

  test("the protected conversations endpoint rejects anonymous callers", async ({ request }) => {
    const res = await request.get("/api/conversations");
    expect([401, 403]).toContain(res.status());
  });

  test("the chat API rejects a malformed request", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: { message: "" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

/**
 * Full conversation flow.
 *
 * Requires a real Supabase project and an authenticated session, so it is
 * skipped unless E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD are provided. Reported as
 * skipped rather than passed when credentials are absent - the flow is not
 * claimed to have run when it has not.
 */
test.describe("chat send -> stream -> persist", () => {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;

  test.skip(!email || !password, "requires E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD");

  test("a message is sent, streamed back and persisted", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email as string);
    await page.locator('input[type="password"]').fill(password as string);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();

    await expect(page).toHaveURL(/\/chat/, { timeout: 20_000 });

    const composer = page.getByRole("textbox", { name: "Message" });
    await composer.fill("Reply with exactly: pong");
    await composer.press("Enter");

    // The user's message is echoed optimistically...
    await expect(page.getByText("Reply with exactly: pong").first()).toBeVisible();

    // ...and an assistant turn is persisted within the same thread.
    const assistant = page.locator('[data-role="assistant"]').last();
    await expect(assistant).toBeVisible({ timeout: 30_000 });
    await expect(assistant).not.toBeEmpty();

    // Reloading proves the turn was written to Postgres, not just held in memory.
    await page.reload();
    await expect(page.getByText("Reply with exactly: pong").first()).toBeVisible();
  });
});

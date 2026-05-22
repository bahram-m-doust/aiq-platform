import { expect, test } from "@playwright/test";

test("loads the Epic 00 foundation page", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Bextudio Platform" }),
  ).toBeVisible();
  await expect(page.getByText("Epic 00")).toBeVisible();
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("renders the generic not found page", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  const response = await page.goto("/definitely-not-a-real-route");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(
    consoleErrors.filter(
      (message) => !message.includes("the server responded with a status of 404"),
    ),
  ).toEqual([]);
});

test("health endpoint returns a non-sensitive readiness payload", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  const body = await response.json();

  expect([200, 503]).toContain(response.status());
  expect(body).toMatchObject({
    service: "bextudio-platform",
    status: expect.stringMatching(/^(ok|error)$/),
    checks: {
      env: expect.stringMatching(/^(ok|error)$/),
      supabase: expect.stringMatching(/^(ok|error)$/),
    },
  });
  expect(body.timestamp).toEqual(expect.any(String));
  expect(JSON.stringify(body)).not.toMatch(
    /SUPABASE_SERVICE_ROLE_KEY|service-role|anon-key|access_token|refresh_token/i,
  );
  expect(response.headers()["cache-control"]).toContain("no-store");
});

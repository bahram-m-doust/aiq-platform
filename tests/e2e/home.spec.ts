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

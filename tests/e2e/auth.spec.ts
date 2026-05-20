import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("register page renders", async ({ page }) => {
  await page.goto("/register");

  await expect(
    page.getByRole("heading", { name: "Create account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("admin login page renders with Google sign-in", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /create an account/i })).toHaveCount(0);
});

test("admin redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});

test("admin access keys redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/access-keys");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Faccess-keys$/);
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});

test("admin entitlements redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/entitlements");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fentitlements$/);
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});

test("create brand redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/create-brand");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fcreate-brand$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("intake redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard/intake");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fintake$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("dashboard change requests redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/change-requests");

  await expect(page).toHaveURL(
    /\/login\?next=%2Fdashboard%2Fchange-requests$/,
  );
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("dashboard invitations redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/invitations");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Finvitations$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("dashboard files redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/files");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Ffiles$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("dashboard modules redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/modules");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fmodules$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("dashboard brain redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/brain");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fbrain$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("dashboard agents redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/agents");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fagents$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("dashboard agent detail redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/dashboard/agents/story-teller");

  await expect(page).toHaveURL(
    /\/login\?next=%2Fdashboard%2Fagents%2Fstory-teller$/,
  );
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("admin change requests redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/change-requests");

  await expect(page).toHaveURL(
    /\/admin\/login\?next=%2Fadmin%2Fchange-requests$/,
  );
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});

test("admin modules redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/modules");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fmodules$/);
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});

test("admin RAG approval redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/rag");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Frag$/);
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});

test("admin audit logs redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/audit");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Faudit$/);
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
});

test("login page shows Google sign-in option", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});

test("register page shows Google sign-in option", async ({ page }) => {
  await page.goto("/register");

  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});

test("public invitation accept prompt renders when logged out", async ({
  page,
}) => {
  await page.goto("/invite/accept?key=bext_example");

  await expect(page.getByText("Accept invitation")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

async function expectNoConsoleErrorsOn(page: Page, path: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(path);

  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
}

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

test("home redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/home");

  await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
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
  await page.goto("/create-brand");

  await expect(page).toHaveURL(/\/login\?next=%2Fcreate-brand$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("questionnaire redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/brand-integrated-brain/roadmap/questionnaire");

  await expect(page).toHaveURL(
    /\/login\?next=%2Fbrand-integrated-brain%2Froadmap%2Fquestionnaire$/,
  );
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("change requests redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/change-requests");

  await expect(page).toHaveURL(
    /\/login\?next=%2Fchange-requests$/,
  );
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("invitations redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/invitations");

  await expect(page).toHaveURL(/\/login\?next=%2Finvitations$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("documents redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/documents");

  await expect(page).toHaveURL(/\/login\?next=%2Fdocuments$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("modules redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/modules");

  await expect(page).toHaveURL(/\/login\?next=%2Fmodules$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("module detail redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/modules/module-1");

  await expect(page).toHaveURL(
    /\/login\?next=%2Fmodules%2Fmodule-1$/,
  );
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("brain redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/brand-integrated-brain");

  await expect(page).toHaveURL(/\/login\?next=%2Fbrand-integrated-brain$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("agents redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/agents");

  await expect(page).toHaveURL(/\/login\?next=%2Fagents$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("agent detail redirects unauthenticated users to login", async ({
  page,
}) => {
  await page.goto("/agents/story-teller");

  await expect(page).toHaveURL(
    /\/login\?next=%2Fagents%2Fstory-teller$/,
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

test("admin module detail redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/modules/module-1");

  await expect(page).toHaveURL(
    /\/admin\/login\?next=%2Fadmin%2Fmodules%2Fmodule-1$/,
  );
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

test("admin intake builder redirects unauthenticated users to admin login", async ({
  page,
}) => {
  await page.goto("/admin/questionnaire-builder");

  await expect(page).toHaveURL(
    /\/admin\/login\?next=%2Fadmin%2Fintake-builder$/,
  );
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

test("public auth and invitation pages do not emit browser errors", async ({
  page,
}) => {
  await expectNoConsoleErrorsOn(page, "/login");
  await expectNoConsoleErrorsOn(page, "/register");
  await expectNoConsoleErrorsOn(page, "/admin/login");
  await expectNoConsoleErrorsOn(page, "/invite/accept?key=bext_example");
});

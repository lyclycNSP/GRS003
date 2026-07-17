import { expect, test } from "@playwright/test";

test.describe("Production security boundary", () => {
  test("OAuth callback rejects requests without one-time state", async ({ page }) => {
    await page.goto("/api/auth/github/callback");

    await expect(page).toHaveURL(/\/login\?.*error=invalid_oauth_callback/);
    await expect(page.getByTestId("login-error")).toContainText("登录校验已失效或不完整");

    const renderedText = await page.locator("body").innerText();
    expect(renderedText).not.toMatch(/PrismaClient|node_modules|\bat (?:GET|POST)\b|\bError:/);
    if (process.env.GITHUB_CLIENT_SECRET) {
      expect(renderedText).not.toContain(process.env.GITHUB_CLIENT_SECRET);
    }
  });

  test("session cookie is opaque and protected from browser scripts", async ({ page, context }) => {
    await page.goto("/api/debug/login?user=rider");
    const session = (await context.cookies()).find((cookie) => cookie.name === "ary_session");
    expect(session).toBeTruthy();
    expect(session?.value).not.toContain("user_rider_1");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
  });

  test("public APIs expose allowlisted data and security headers", async ({ request }) => {
    const raceResponse = await request.get("/api/public/races/bay-area-happy-trip");
    expect(raceResponse.status()).toBe(200);
    expect(raceResponse.headers()["x-content-type-options"]).toBe("nosniff");
    expect(raceResponse.headers()["x-frame-options"]).toBe("DENY");
    const raceText = JSON.stringify(await raceResponse.json());
    for (const forbidden of ["raceProject", "caConnections", "reviewFlags", "releaseItems", "backups", "incidents", "rolesJson"]) {
      expect(raceText).not.toContain(forbidden);
    }

    const workResponse = await request.get("/api/public/works/work-gba-wander");
    expect(workResponse.status()).toBe(200);
    const workJson = await workResponse.json();
    const workText = JSON.stringify(workJson);
    expect(workJson.submissionVersion).toMatchObject({
      versionNumber: 1,
      repoCommitSha: "1111111111111111111111111111111111111111"
    });
    expect(workJson.submissionVersion.integrityHash).toMatch(/^[a-f0-9]{64}$/);
    for (const forbidden of ["assignments", "judgingRecord", "reviewFlags", "rolesJson", "submissionAuditEvents", "submittedByUserId", "submissionLockReason"]) {
      expect(workText).not.toContain(forbidden);
    }

    const riderResponse = await request.get("/api/public/riders/mira-chen");
    expect(riderResponse.status()).toBe(200);
    const riderText = JSON.stringify(await riderResponse.json());
    for (const forbidden of [
      "email", "verifiedEmailsJson", "timeZone", "locale", "termsVersion", "privacyVersion",
      "roleApplications", "userRoles", "githubUserId", "profileCompleted"
    ]) {
      expect(riderText).not.toContain(forbidden);
    }
  });

  test("Ops data is unavailable without a managing role", async ({ page, request }) => {
    const opsPath = "/ops?raceId=race_bay_2026";
    const anonymous = await request.get(opsPath);
    expect(anonymous.status()).toBe(404);

    await page.goto("/api/debug/login?user=rider");
    await page.goto(opsPath);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByTestId("ops-workspace")).toHaveCount(0);

    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByTestId("ops-workspace")).toHaveCount(0);
    await page.goto(opsPath);
    await expect(page.getByTestId("ops-workspace")).toBeVisible();
    await expect(page.getByRole("heading", { name: /运维与发布检查/ })).toBeVisible();
  });

  test("CA ingestion API rejects unsigned input", async ({ request }) => {
    const response = await request.post("/api/ca/v1/signals", { data: { messageId: "unsigned-message" } });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_signal" });
  });
});

test.describe("Login redirect security", () => {
  test("login exposes debug entry in development and renders controlled errors", async ({ page }) => {
    await page.goto("/login?error=github_identity_failed&next=%2Fconsole%2Frider");
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("debug-login-entry")).toBeVisible();
    await expect(page.getByTestId("login-error")).toContainText("无法读取 GitHub 身份");
    await expect(page.getByTestId("debug-login-entry")).toHaveAttribute("href", /\/debug-login\?next=%2Fconsole%2Frider/);

    await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fsteal");
    await expect(page.getByTestId("debug-login-entry")).toHaveAttribute("href", /\/debug-login\?next=%2Fconsole$/);
  });

  test("unknown debug identity returns to a controlled login error", async ({ page }) => {
    await page.goto("/api/debug/login?user=unknown&next=%2Fconsole%2Frider");
    await expect(page).toHaveURL(/\/login\?.*error=debug_user_invalid/);
    await expect(page).toHaveURL(/next=%2Fconsole%2Frider/);
    await expect(page.getByTestId("login-error")).toBeVisible();
  });

  test("anonymous console login returns to an authenticated role workspace", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/console");
    await expect(page).toHaveURL(/\/login\?next=%2Fconsole$/);
    await page.getByTestId("debug-login-entry").click();
    await expect(page).toHaveURL(/\/debug-login\?next=%2Fconsole$/);
    await page.getByRole("link", { name: /以 Rider 登录/ }).click();
    await expect(page).toHaveURL(/\/console\/rider$/);
    await expect(page.getByTestId("authenticated-app-shell")).toBeVisible();
    await context.close();
  });

  test("debug login preserves the request host for 127.0.0.1 and localhost", async ({ page }) => {
    for (const origin of ["http://127.0.0.1:3100", "http://localhost:3100"]) {
      await page.goto(`${origin}/debug-login?next=%2Fconsole`);
      await page.getByRole("link", { name: /以 Rider 登录/ }).click();
      await expect(page).toHaveURL(`${origin}/console/rider`);
      await expect(page.getByTestId("authenticated-app-shell")).toBeVisible();
    }
  });
});

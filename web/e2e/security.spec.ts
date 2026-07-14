import { expect, test } from "@playwright/test";

test.describe("Production security boundary", () => {
  test("OAuth callback rejects requests without one-time state", async ({ request }) => {
    const response = await request.get("/api/auth/github/callback");
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_oauth_callback" });
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
  });

  test("Ops data is unavailable without a managing role", async ({ page, request }) => {
    const anonymous = await request.get("/ops");
    expect(anonymous.status()).toBe(404);

    await page.goto("/api/debug/login?user=rider");
    const riderResponse = await page.goto("/ops");
    expect(riderResponse?.status()).toBe(404);

    await page.goto("/api/debug/login?user=organizer");
    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: /运维与发布检查/ })).toBeVisible();
  });

  test("CA ingestion API rejects unsigned input", async ({ request }) => {
    const response = await request.post("/api/ca/v1/signals", { data: { messageId: "unsigned-message" } });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_signal" });
  });
});

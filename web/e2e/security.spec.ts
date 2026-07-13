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
    const workText = JSON.stringify(await workResponse.json());
    for (const forbidden of ["assignments", "judgingRecord", "reviewFlags", "rolesJson"]) {
      expect(workText).not.toContain(forbidden);
    }
  });

  test("CA ingestion API rejects unsigned input", async ({ request }) => {
    const response = await request.post("/api/ca/v1/signals", { data: { messageId: "unsigned-message" } });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_signal" });
  });
});

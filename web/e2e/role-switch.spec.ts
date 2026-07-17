import { expect, test } from "@playwright/test";

test("multi-role user switches one active workspace at a time", async ({ page }) => {
  await page.goto("/api/debug/login?user=multi");
  await expect(page).toHaveURL(/\/console\/organizer/);
  await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(1);
  await expect(page.locator('aside[aria-label="Organizer 主导航"]')).toBeVisible();

  const switcher = page.getByTestId("role-switcher");
  await switcher.locator("summary").click();
  await expect(switcher.getByRole("button", { name: "organizer" })).toBeDisabled();
  await expect(switcher.getByRole("button", { name: "admin" })).toHaveCount(0);
  await switcher.getByRole("button", { name: "rider" }).click();
  await expect(page).toHaveURL(/\/console\/rider/);
  await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(1);
  await expect(page.getByTestId("workspace-shell")).toHaveCount(1);
  await expect(page.locator('aside[aria-label="Rider 主导航"]')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/console\/rider/);
  await expect(page.locator('aside[aria-label="Rider 主导航"]')).toBeVisible();
  await expect(page.getByTestId("role-switcher").locator("summary"))
    .toHaveAttribute("aria-label", /当前角色：Rider/);

  await page.goto("/console/organizer");
  await expect(page).toHaveURL(/\/console\/rider/);
  await expect(page.locator('aside[aria-label="Rider 主导航"]')).toBeVisible();
  await expect(page.locator('aside[aria-label="Organizer 主导航"]')).toHaveCount(0);
});

test("debug multi-role login starts in Organizer and never exposes unavailable Admin", async ({ page }) => {
  await page.goto("/debug-login?next=%2Fconsole");
  await page.getByRole("link", { name: /以 Multi-role 登录/ }).click();
  await expect(page).toHaveURL(/\/console\/organizer$/);
  await expect(page.locator('aside[aria-label="Organizer 主导航"]')).toBeVisible();

  const switcher = page.getByTestId("role-switcher");
  await switcher.locator("summary").click();
  await expect(switcher.getByRole("button", { name: "admin" })).toHaveCount(0);
  await expect(switcher.getByRole("button", { name: "organizer" })).toBeDisabled();
});

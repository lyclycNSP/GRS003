import { expect, test } from "@playwright/test";

const roleAccounts = [
  { user: "rider", role: "rider", label: "Rider" },
  { user: "judge", role: "judge", label: "Judge" },
  { user: "organizer", role: "organizer", label: "Organizer" },
  { user: "admin", role: "admin", label: "Admin" }
] as const;

test("四角色工作台均可通过明确入口返回公共主页", async ({ page }) => {
  for (const account of roleAccounts) {
    await page.goto(`/api/debug/login?user=${account.user}`);
    await expect(page).toHaveURL(new RegExp(`/console/${account.role}$`));
    await expect(page.locator(`aside[aria-label="${account.label} 主导航"]`)).toBeVisible();

    const publicHomeLink = page.getByTestId("workspace-public-home-link");
    await expect(publicHomeLink).toHaveAttribute("href", "/");
    await expect(publicHomeLink.getByText("返回公共主页", { exact: true })).toBeVisible();
    await expect(publicHomeLink.getByText("浏览赛事与公开内容", { exact: true })).toBeVisible();

    await publicHomeLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("authenticated-app-shell")).toHaveCount(0);

    const publicHeader = page.locator('header[aria-label="ARY navigation"]');
    await expect(publicHeader).toBeVisible();
    await expect(publicHeader.getByRole("link", { name: "工作台", exact: true })).toBeVisible();
    await expect(publicHeader.getByRole("button", { name: "退出", exact: true })).toBeVisible();
    await expect(publicHeader.getByRole("link", { name: "登录", exact: true })).toHaveCount(0);
  }
});

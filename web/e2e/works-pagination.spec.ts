import { expect, test } from "@playwright/test";

test.describe("Works public directory pagination", () => {
  test("renders only the requested filtered result set and resets page on submit", async ({ page }) => {
    await page.goto("/works?page=99");

    const directory = page.getByTestId("public-works-gallery");
    const list = page.getByTestId("public-works-list");
    await expect(directory).toBeVisible();
    await expect(list).toBeVisible();
    expect(await list.locator(":scope > section").count()).toBeLessThanOrEqual(9);

    const search = directory.getByLabel("搜索作品");
    await search.fill("GBA WanderMate");
    await directory.getByRole("button", { name: "筛选" }).click();

    await expect(page).toHaveURL(/\/works\?q=GBA(?:\+|%20)WanderMate(?:&race=)?$/);
    await expect(directory.getByRole("heading", { name: "GBA WanderMate", exact: true })).toBeVisible();
    await expect(directory.getByRole("heading", { name: "ARY Self Dogfood Agent", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("directory-pagination")).toHaveCount(0);
  });

  test("preserves the race filter and keeps unpublished works out of the directory", async ({ page }) => {
    await page.goto("/works?race=bay-area-happy-trip");

    const directory = page.getByTestId("public-works-gallery");
    await expect(directory.getByLabel("按赛事筛选")).toHaveValue("bay-area-happy-trip");
    await expect(directory.getByRole("heading", { name: "GBA WanderMate", exact: true })).toBeVisible();
    await expect(directory.getByRole("heading", { name: "LocalJoy Agent", exact: true })).toHaveCount(0);
    await expect(directory.getByText("1 个公开作品", { exact: true })).toBeVisible();
  });
});

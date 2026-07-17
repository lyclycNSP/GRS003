import { expect, test } from "@playwright/test";

test.describe("Public home catalog", () => {
  test("Hero 使用横向轨道切换并保持可访问的单一活动赛事", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByTestId("home-hero-carousel");
    const track = page.getByTestId("home-hero-track");
    await expect(carousel).toBeVisible();
    await expect(track).toHaveCSS("display", "flex");

    const firstTitle = await carousel.locator('article[aria-hidden="false"] h1').innerText();
    const initialTransform = await track.evaluate((node) => (node as HTMLElement).style.transform);
    await carousel.getByRole("button", { name: "下一场赛事" }).click();
    await expect(carousel.locator('article[aria-hidden="false"] h1')).not.toHaveText(firstTitle);
    await expect.poll(() => track.evaluate((node) => (node as HTMLElement).style.transform)).not.toBe(initialTransform);

    const hiddenLinks = carousel.locator('article[aria-hidden="true"] a');
    expect(await hiddenLinks.count()).toBeGreaterThan(0);
    await expect(hiddenLinks.first()).toHaveAttribute("tabindex", "-1");

    await carousel.hover();
    await expect(carousel.getByText("自动轮播已暂停", { exact: true })).toBeVisible();
    await carousel.getByRole("button", { name: "上一场赛事" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(carousel.getByText("自动轮播已暂停", { exact: true })).toBeVisible();
  });

  test("赛事搜索筛选不影响精选 Hero，且空结果提供恢复入口", async ({ page }) => {
    await page.goto("/?q=不存在的赛事关键字&status=completed&page=-8#race-gallery");
    await expect(page.getByTestId("home-hero-carousel")).toBeVisible();

    const directory = page.getByTestId("public-race-directory");
    await expect(directory.getByLabel("搜索赛事")).toHaveValue("不存在的赛事关键字");
    await expect(directory.getByLabel("按赛事状态筛选")).toHaveValue("completed");
    await expect(directory.getByRole("heading", { name: "没有匹配的公开赛事" })).toBeVisible();
    await expect(directory.getByRole("link", { name: "清除筛选" }).first()).toHaveAttribute("href", "/#race-gallery");
  });

  test("首页下方使用精选作品、动态赛果与紧凑合作入口", async ({ page }) => {
    await page.goto("/");
    const works = page.getByTestId("homepage-featured-works");
    await expect(works.getByRole("heading", { name: "精选作品" })).toBeVisible();
    await expect(works.getByRole("link", { name: /查看全部 Works/ })).toHaveAttribute("href", "/works");
    expect(await works.locator("article").count()).toBeLessThanOrEqual(3);
    const result = page.getByTestId("homepage-latest-result");
    await expect(result.getByRole("heading", { name: "创世骑行挑战赛" })).toBeVisible();
    await expect(result.getByRole("link", { name: "查看 Results" })).toHaveAttribute("href", "/races/genesis-dogfood-race/results");
    await expect(page.getByRole("link", { name: /了解合作方式/ })).toHaveAttribute("href", "/cooperation");
  });
});

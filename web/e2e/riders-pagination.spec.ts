import { expect, test } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

const fixtureBasePrefix = "e2e_rider_page_";
const fixturePrefix = `${fixtureBasePrefix}${Date.now()}_`;
let prisma: PrismaClient;

async function removePaginationFixtures() {
  await prisma.riderProfile.deleteMany({
    where: { userId: { startsWith: fixtureBasePrefix } }
  });
  await prisma.userRole.deleteMany({
    where: { userId: { startsWith: fixtureBasePrefix } }
  });
  await prisma.user.deleteMany({
    where: { id: { startsWith: fixtureBasePrefix } }
  });
}

test.beforeAll(async () => {
  process.env.DATABASE_URL = "file:./e2e.db";
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client();

  await removePaginationFixtures();
  for (let index = 1; index <= 11; index += 1) {
    const suffix = String(index).padStart(2, "0");
    await prisma.user.create({
      data: {
        id: `${fixturePrefix}${suffix}`,
        slug: `pagination-rider-${suffix}`,
        displayName: `Pagination Rider ${suffix}`,
        profileCompleted: true,
        roles: {
          create: {
            id: `${fixturePrefix}role_${suffix}`,
            role: "rider",
            status: "active",
            source: "e2e"
          }
        },
        riderProfile: {
          create: {
            id: `${fixturePrefix}profile_${suffix}`,
            headline: "Pagination fixture",
            skillsJson: JSON.stringify(["Pagination Skill"]),
            completedAt: new Date()
          }
        }
      }
    });
  }
});

test.afterAll(async () => {
  if (!prisma) return;
  try {
    await removePaginationFixtures();
  } finally {
    await prisma.$disconnect();
  }
});

test("Rider 目录每页展示 9 条并在翻页时保留搜索与技能筛选", async ({ page }) => {
  await page.goto("/riders?q=Pagination%20Rider&skill=Pagination%20Skill");

  const directory = page.getByTestId("public-rider-directory");
  const riderList = directory.getByRole("region", { name: "Rider 列表" });
  await expect(riderList.getByRole("heading", { level: 2 })).toHaveCount(9);
  await expect(directory.getByText("共 11 位 Rider · 第 1 页", { exact: true })).toBeVisible();

  const pagination = directory.getByTestId("directory-pagination");
  await expect(pagination).toBeVisible();
  await pagination.getByRole("link", { name: "前往下一页" }).click();

  await expect(page).toHaveURL(/\/riders\?q=Pagination\+Rider&skill=Pagination\+Skill&page=2#rider-directory-results$/);
  await expect(riderList.getByRole("heading", { level: 2 })).toHaveCount(2);
  await expect(pagination.locator('[aria-current="page"]')).toHaveText("2");
});

test("提交 Rider 搜索会回到第一页", async ({ page }) => {
  await page.goto("/riders?q=Pagination%20Rider&skill=Pagination%20Skill&page=2");
  const directory = page.getByTestId("public-rider-directory");

  await directory.getByLabel("搜索 Rider").fill("Pagination Rider 01");
  await directory.getByRole("button", { name: "筛选" }).click();

  await expect(page).toHaveURL(/\/riders\?q=Pagination(?:\+|%20)Rider(?:\+|%20)01&skill=Pagination(?:\+|%20)Skill$/);
  await expect(directory.getByRole("heading", { name: "Pagination Rider 01", exact: true })).toBeVisible();
  await expect(directory.getByTestId("directory-pagination")).toHaveCount(0);
});

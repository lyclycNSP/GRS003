import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function validPdf() {
  const document = await PDFDocument.create();
  document.addPage();
  return Buffer.from(await document.save());
}

test("Organizer creates a private Race with a scanned PDF and public download is controlled", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  const form = page.getByTestId("organizer-race-create-form");
  await form.getByLabel("赛事名 *").fill(`PDF Race ${Date.now()}`);
  await form.getByLabel("挑战说明 *").fill("完成安全赛题");
  await form.getByLabel("赛题 PDF（可选）").setInputFiles({ name: "problem.pdf", mimeType: "application/pdf", buffer: await validPdf() });
  await form.getByRole("button", { name: "创建 Race" }).click();
  await expect(page).toHaveURL(/\/console\/organizer\/races\/[^?]+\?action=race-created&entityId=/, { timeout: 15_000 });
  await expect(page.locator('[data-action-code="race-created"]')).toBeVisible();

  const manager = page.getByTestId("race-problem-manager");
  await expect(manager.getByRole("heading", { name: "赛题 PDF" })).toBeVisible();
  await expect(manager.getByRole("heading", { name: "上传须知" })).toBeVisible();
  await expect(manager).toContainText("安全检查通过");
  const download = manager.getByRole("link", { name: "下载" });
  const response = await page.request.get(await download.getAttribute("href") ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");

  await page.getByRole("button", { name: "发布当前 Race" }).click();
  await expect(page.getByTestId("console-current-race-status")).toHaveText("running");
  const revisionForm = manager.locator("form");
  await revisionForm.getByLabel("赛题 PDF").setInputFiles({ name: "第二版赛题.pdf", mimeType: "application/pdf", buffer: await validPdf() });
  await expect(page.getByTestId("race-problem-selected-file")).toContainText("第二版赛题.pdf");
  await revisionForm.getByPlaceholder("本次修订说明（必填）").fill("补充第二阶段评分要求");
  await revisionForm.getByRole("button", { name: "上传新修订" }).click();
  await expect(manager).toContainText("补充第二阶段评分要求");
});

test("active PDF content is rejected while the private Race draft remains", async ({ page }) => {
  await page.goto("/api/debug/login?user=organizer");
  const form = page.getByTestId("organizer-race-create-form");
  await form.getByLabel("赛事名 *").fill(`Rejected PDF ${Date.now()}`);
  await form.getByLabel("挑战说明 *").fill("拒绝主动内容");
  await form.getByLabel("赛题 PDF（可选）").setInputFiles({ name: "active.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n1 0 obj<</Type /Page /JavaScript true>>endobj\n%%EOF\n", "latin1") });
  await form.getByRole("button", { name: "创建 Race" }).click();
  const failure = page.getByTestId("race-problem-error");
  await expect(failure).toContainText("包含脚本、附件或主动内容");
  const recovery = failure.getByRole("link", { name: "进入 Race Workspace 重新上传" });
  await expect(recovery).toHaveAttribute("href", /\/console\/organizer\/races\//);
  await expect(page).toHaveURL(/\/console\/organizer$/);
  await recovery.click();
  await expect(page.getByTestId("race-problem-manager")).toBeVisible();
});

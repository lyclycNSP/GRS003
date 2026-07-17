import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { inspectPdf, MAX_RACE_PROBLEM_BYTES, sanitizePdfDisplayName, scanPdf } from "../lib/race-problem-security";

async function pdf() { const document = await PDFDocument.create(); document.addPage(); return Buffer.from(await document.save({ useObjectStreams: true })); }

async function main() {
  const valid = await pdf();
  assert.equal(sanitizePdfDisplayName("../../赛题.pdf"), "赛题.pdf");
  assert.equal(sanitizePdfDisplayName("payload.pdf.exe"), null);
  assert.equal((await inspectPdf(valid)).ok, true);
  assert.deepEqual(await inspectPdf(Buffer.from("not pdf")), { ok: false, reason: "文件内容不是受支持的 PDF" });
  assert.equal((await inspectPdf(Buffer.concat([valid.subarray(0, valid.length - 6), Buffer.from("/JavaScript /Launch /EmbeddedFile\n%%EOF\n")]))).ok, false);
  assert.equal((await inspectPdf(Buffer.alloc(MAX_RACE_PROBLEM_BYTES + 1))).ok, false);
  process.env.ATTACHMENT_SCANNER = "mock-clean";
  assert.equal((await scanPdf(valid)).status, "clean");
  console.log("race problem security tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

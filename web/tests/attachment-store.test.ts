import assert from "node:assert/strict";
import { getAttachmentStore } from "../lib/attachment-store";

async function main() {
  const previousDriver = process.env.ATTACHMENT_STORAGE_DRIVER;
  const previousStores = process.env.ORGANIZER_ATTACHMENT_STORES_JSON;
  process.env.ATTACHMENT_STORAGE_DRIVER = "memory";
  const memory = getAttachmentStore("organizer-a");
  assert.equal(memory.provider, "ephemeral_memory");
  await memory.put("race-problems/race-a/problem-a.pdf", Buffer.from("temporary"));
  assert.equal((await memory.get("race-problems/race-a/problem-a.pdf")).toString(), "temporary");
  assert.equal(await memory.createDownloadUrl("race-problems/race-a/problem-a.pdf", "problem.pdf", 120), null);
  await memory.remove("race-problems/race-a/problem-a.pdf");
  await assert.rejects(() => memory.get("race-problems/race-a/problem-a.pdf"), /ATTACHMENT_NOT_FOUND/);

  process.env.ATTACHMENT_STORAGE_DRIVER = "organizer-s3";
  process.env.ORGANIZER_ATTACHMENT_STORES_JSON = "{}";
  assert.throws(() => getAttachmentStore("missing-organizer"), /ORGANIZER_ATTACHMENT_STORE_NOT_CONFIGURED/);
  if (previousDriver === undefined) delete process.env.ATTACHMENT_STORAGE_DRIVER; else process.env.ATTACHMENT_STORAGE_DRIVER = previousDriver;
  if (previousStores === undefined) delete process.env.ORGANIZER_ATTACHMENT_STORES_JSON; else process.env.ORGANIZER_ATTACHMENT_STORES_JSON = previousStores;
  console.log("attachment store tests passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

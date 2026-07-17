import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { consumeUploadIntent, createUploadIntent } from "../lib/race-problem-security";

const prisma = new PrismaClient();
async function main() {
  const before = await prisma.raceProblemUploadIntent.count({ where: { userId: "user_org_1", usedAt: { not: null } } });
  const token = await createUploadIntent("user_org_1", "race_bay_2026");
  assert.equal(await consumeUploadIntent(token, "user_org_alt", "race_bay_2026"), false);
  assert.equal(await consumeUploadIntent(token, "user_org_1", "race_bay_2026"), true);
  assert.equal(await consumeUploadIntent(token, "user_org_1", "race_bay_2026"), false);
  assert.equal(await prisma.raceProblemUploadIntent.count({ where: { userId: "user_org_1", usedAt: { not: null } } }), before + 1);
}
main().then(() => console.log("race problem upload intent tests passed")).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

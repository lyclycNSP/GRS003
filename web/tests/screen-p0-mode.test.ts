import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../lib/auth";
import { runP0Regression } from "../lib/domain";
import { prepareRaceLive } from "../lib/race-live/management";

const prisma = new PrismaClient();
const organizer: AuthContext = {
  userId: "user_org_1",
  availableRoles: ["organizer"],
  activeRole: "organizer",
  profileCompleted: true,
  managedRaceIds: ["race_bay_2026"],
  approvedRegistrationIds: [],
  assignedWorkIds: []
};

async function main() {
 try {
  const prepared = await prepareRaceLive(organizer, "race_bay_2026", "round_bay_1", false);
  assert.equal(prepared.ok, true, prepared.message);
  const result = await runP0Regression(organizer, "race_bay_2026");
  assert.equal(result.ok, true, result.message);
  const state = await prisma.screenState.findUnique({ where: { raceId: "race_bay_2026" } });
  assert.equal(state?.mode, "live", "P0 彩排结束后必须恢复 Race Live 默认模式");
  const announcement = await prisma.announcement.findFirst({
    where: { raceId: "race_bay_2026", title: "P0 rehearsal" },
    orderBy: { publishedAt: "desc" }
  });
  assert.ok(announcement?.publishedAt, "彩排公告仍应保存并发布");
  console.log("PASS P0 rehearsal preserves announcement and returns ScreenState to live");
 } finally {
  await prisma.$disconnect();
 }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

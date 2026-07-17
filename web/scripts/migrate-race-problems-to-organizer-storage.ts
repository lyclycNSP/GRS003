import { createHash, randomUUID } from "node:crypto";
import { getAttachmentStore, getLegacyLocalAttachmentStore } from "../lib/attachment-store";
import { prisma } from "../lib/prisma";

const execute = process.argv.includes("--execute");

async function main() {
  const versions = await prisma.raceProblemVersion.findMany({
    where: { storageProvider: "platform_legacy", scanStatus: "clean", disabledAt: null },
    orderBy: { uploadedAt: "asc" }
  });
  if (!execute) {
    console.log(JSON.stringify({ mode: "dry-run", count: versions.length, versions: versions.map((item) => ({ id: item.id, raceId: item.raceId, ownerUserId: item.uploadedByUserId, displayName: item.displayName })) }, null, 2));
    console.log("Re-run with --execute only after ORGANIZER_ATTACHMENT_STORES_JSON is configured for every listed owner.");
    return;
  }

  const legacy = getLegacyLocalAttachmentStore();
  for (const version of versions) {
    const target = getAttachmentStore(version.uploadedByUserId);
    if (target.provider !== "organizer_s3") throw new Error(`External organizer storage is required for ${version.uploadedByUserId}`);
    const body = await legacy.get(version.storageKey);
    const sourceHash = createHash("sha256").update(body).digest("hex");
    if (sourceHash !== version.sha256) throw new Error(`Source checksum mismatch for ${version.id}`);
    const targetKey = `race-problems/${version.raceId}/${version.id}.pdf`;
    await target.put(targetKey, body);
    const verifiedBody = await target.get(targetKey);
    const targetHash = createHash("sha256").update(verifiedBody).digest("hex");
    if (targetHash !== version.sha256) {
      await target.remove(targetKey).catch(() => undefined);
      throw new Error(`Target checksum mismatch for ${version.id}`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.raceProblemVersion.update({ where: { id: version.id }, data: { storageKey: targetKey, storageProvider: "organizer_s3", storageOwnerUserId: version.uploadedByUserId } });
      await tx.raceProblemAuditEvent.create({ data: {
        id: `problem_audit_${randomUUID()}`, raceId: version.raceId, problemVersionId: version.id,
        actorUserId: version.uploadedByUserId, action: "migrated_to_organizer_storage",
        detailJson: JSON.stringify({ sha256: version.sha256, previousProvider: "platform_legacy" })
      } });
    });
    await legacy.remove(version.storageKey);
    console.log(`Migrated ${version.id}`);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

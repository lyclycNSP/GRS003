import { notFound, redirect } from "next/navigation";
import { RoleWorkspacePage } from "@/app/console/RoleWorkspace";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RaceProblemManager } from "./RaceProblemManager";

export default async function OrganizerRaceWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ raceId: string }>;
  searchParams?: Promise<{ action?: string; entityId?: string; actionMessage?: string; actionError?: string }>;
}) {
  const { raceId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/console/organizer/races/${raceId}`)}`);
  if (!ctx.profileCompleted) redirect("/profile");
  if (ctx.activeRole !== "organizer") redirect("/console");

  if (!ctx.managedRaceIds.includes(raceId)) notFound();
  const messages = (await searchParams) ?? {};
  const race = await prisma.race.findUnique({ where: { id: raceId }, include: { problemVersions: { orderBy: { revision: "desc" } } } });
  if (!race) notFound();

  return <><RaceProblemManager raceId={raceId} raceStatus={race.status} versions={race.problemVersions.map((version) => ({ id: version.id, revision: version.revision, displayName: version.displayName, sizeBytes: version.sizeBytes, sha256: version.sha256, scanStatus: version.scanStatus, scanDetail: version.scanDetail, changeNote: version.changeNote, storageProvider: version.storageProvider, isCurrent: race.currentProblemVersionId === version.id }))} /><RoleWorkspacePage role="organizer" searchParams={Promise.resolve({ raceId, ...messages })} /></>;
}

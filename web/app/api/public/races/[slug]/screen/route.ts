import { NextResponse } from "next/server";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntrantDisplay, getPublicRaceLiveSnapshot, getPublicWorks, getScreenSnapshot } from "@/lib/queries";
import { getRaceLiveReadiness } from "@/lib/race-live/management";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [race, ctx] = await Promise.all([
    prisma.race.findUnique({ where: { slug }, select: {
      id: true, slug: true, title: true, visibility: true, status: true,
      announcements: { where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, select: { title: true, body: true } }
    } }),
    getAuthContext()
  ]);
  if (!race) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(race.visibility === "public" && race.status !== "draft") && !canManageRace(ctx, race.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [raceLive, screenSnapshot] = await Promise.all([getPublicRaceLiveSnapshot(race.id), getScreenSnapshot(race.id)]);
  if (!screenSnapshot) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const works = (await getPublicWorks(race.id)).map((work) => ({
    id: work.id,
    title: work.title,
    summary: work.summary,
    entrantDisplayName: getEntrantDisplay(work.registration).name
  }));
  const announcement = race.announcements[0];
  if (!raceLive) {
    const readiness = await getRaceLiveReadiness(race.id);
    return NextResponse.json({
    kind: "static",
    race: { id: race.id, slug: race.slug, title: race.title, status: race.status },
    screenState: screenSnapshot.screenState,
    metrics: { riders: screenSnapshot.race._count.registrations, works: works.length },
    announcement: announcement ? { title: announcement.title, body: announcement.body } : null,
    works,
    readiness: { issues: readiness.issues.map(({ code, message }) => ({ code, message })) }
  });
  }
  return NextResponse.json({
    kind: "race_live",
    ...raceLive,
    announcement: announcement ? { title: announcement.title, body: announcement.body } : null,
    works
  });
}

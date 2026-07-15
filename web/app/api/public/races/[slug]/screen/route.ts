import { NextResponse } from "next/server";
import { getEntrantDisplay, getPublicRaceLiveSnapshot, getPublicWorks, getRaceBySlug } from "@/lib/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceBySlug(slug);
  if (!race) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const raceLive = await getPublicRaceLiveSnapshot(race.id);
  if (!raceLive) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const works = (await getPublicWorks(race.id)).map((work) => ({
    id: work.id,
    title: work.title,
    summary: work.summary,
    entrantDisplayName: getEntrantDisplay(work.registration).name
  }));
  const announcement = race.announcements[0];
  return NextResponse.json({
    ...raceLive,
    announcement: announcement ? { title: announcement.title, body: announcement.body } : null,
    works
  });
}

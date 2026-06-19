import { NextResponse } from "next/server";
import { getPublicWorks, getRaceBySlug } from "@/lib/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const race = await getRaceBySlug(slug);
  if (!race || race.visibility !== "public") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(await getPublicWorks(race.id));
}

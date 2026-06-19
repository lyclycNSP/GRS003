import { NextResponse } from "next/server";
import { getWorkBySlug } from "@/lib/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await getWorkBySlug(slug);
  if (!work || work.visibility !== "public") return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(work);
}

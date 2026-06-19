import { NextResponse } from "next/server";
import { getScreenSnapshot } from "@/lib/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getScreenSnapshot(slug);
  if (!snapshot) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(snapshot);
}
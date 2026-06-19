import { NextResponse } from "next/server";
import { getRiderProfile } from "@/lib/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rider = await getRiderProfile(id);
  if (!rider) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(rider);
}

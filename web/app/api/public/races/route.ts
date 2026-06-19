import { NextResponse } from "next/server";
import { getPublicRaces } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getPublicRaces());
}

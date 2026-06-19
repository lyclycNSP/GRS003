import { NextResponse } from "next/server";
import { getPublicWorks } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getPublicWorks());
}

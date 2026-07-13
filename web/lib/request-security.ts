import type { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/runtime-config";

export function hasTrustedMutationOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === getAppUrl();
  } catch {
    return false;
  }
}

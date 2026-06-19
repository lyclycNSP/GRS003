"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const HASH_ROUTES: Record<string, string> = {
  works: "/works",
  results: "/races/genesis-dogfood-race/results",
  review: "/races/genesis-dogfood-race/review",
  rider: "/riders/mira-chen",
  cooperation: "/cooperation",
  auth: "/profile",
  console: "/console"
};

export function HashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;
    const [page, id, child] = raw.split("/");
    if (page === "race" && id) router.replace(`/races/${id}`);
    if ((page === "work" || page === "works") && id && child === "judge") router.replace(`/works/${id}/judge`);
    if ((page === "work" || page === "works") && id) router.replace(`/works/${id}`);
    if (HASH_ROUTES[page]) router.replace(HASH_ROUTES[page]);
  }, [router]);
  return null;
}

import { prisma } from "@/lib/prisma";
import { fromJson } from "@/lib/json";

export async function getPublicRaces() {
  const races = await prisma.race.findMany({
    where: { visibility: "public" },
    orderBy: { createdAt: "desc" },
    include: { registrations: true, awards: true, reports: true }
  });
  return races.map((race) => ({
    ...race,
    schedule: fromJson<Record<string, string>>(race.scheduleJson, {}),
    rules: fromJson<Record<string, unknown>>(race.rulesJson, {}),
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {}),
    organizerIds: fromJson<string[]>(race.organizerJson, [])
  }));
}

export async function getRaceBySlug(slug: string) {
  const race = await prisma.race.findUnique({
    where: { slug },
    include: {
      registrations: { include: { user: true, raceProject: { include: { caConnections: true } }, work: true, reviewFlags: true } },
      awards: { include: { registration: { include: { user: true } }, work: true } },
      reports: true,
      projections: { orderBy: { lastRebuiltAt: "desc" } },
      announcements: true,
      screenState: true,
      releaseItems: true,
      backups: true,
      incidents: true
    }
  });
  if (!race) return null;
  return {
    ...race,
    schedule: fromJson<Record<string, string>>(race.scheduleJson, {}),
    rules: fromJson<Record<string, unknown>>(race.rulesJson, {}),
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {}),
    organizerIds: fromJson<string[]>(race.organizerJson, [])
  };
}

export async function getWorkBySlug(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    include: {
      registration: { include: { race: true, user: true, raceProject: { include: { caConnections: true } } } },
      evidences: true,
      reviewFlags: true,
      assignments: { include: { judge: true, judgingRecord: true } },
      awards: true
    }
  });
}

export async function getPublicWorks(raceId?: string) {
  return prisma.work.findMany({
    where: {
      visibility: "public",
      ...(raceId
        ? {
            registration: {
              raceId
            }
          }
        : {})
    },
    include: { registration: { include: { race: true, user: true } }, awards: true },
    orderBy: { submittedAt: "desc" }
  });
}

export async function getRaceWorks(slug: string) {
  const race = await getRaceBySlug(slug);
  if (!race) return null;
  const works = await getPublicWorks(race.id);
  return { race, works };
}

export async function getRaceResults(slug: string) {
  const race = await prisma.race.findUnique({
    where: { slug },
    include: {
      awards: {
        where: { status: "published" },
        orderBy: { rank: "asc" },
        include: { registration: { include: { user: true } }, work: true }
      },
      reports: { where: { status: "published", visibility: "public" } }
    }
  });
  if (!race) return null;
  return {
    ...race,
    schedule: fromJson<Record<string, string>>(race.scheduleJson, {}),
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {}),
    resultReports: race.reports.filter((report) => report.type === "race_report")
  };
}

export async function getRaceReview(slug: string) {
  const race = await prisma.race.findUnique({
    where: { slug },
    include: {
      reports: { where: { status: "published", visibility: "public", type: "review_summary" } },
      registrations: { include: { user: true, work: { include: { evidences: true, reviewFlags: true } } } }
    }
  });
  if (!race) return null;
  return {
    ...race,
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {}),
    publicEvidence: race.registrations.flatMap((registration) =>
      registration.work?.evidences.filter((evidence) => evidence.visibility === "public").map((evidence) => ({
        ...evidence,
        riderName: registration.user.displayName,
        workTitle: registration.work?.title ?? ""
      })) ?? []
    )
  };
}

export async function getRiderProfile(idOrSlug: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      registrations: {
        include: {
          race: true,
          work: { include: { awards: true, evidences: true } },
          awards: true
        }
      }
    }
  });
  if (!user) return null;
  return {
    ...user,
    roles: fromJson<string[]>(user.rolesJson, []),
    publicWorks: user.registrations.flatMap((registration) =>
      registration.work && registration.work.visibility === "public" ? [{ ...registration.work, race: registration.race }] : []
    ),
    awards: user.registrations.flatMap((registration) => registration.awards),
    races: user.registrations.map((registration) => registration.race)
  };
}

export async function getCurrentUserProfile(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function getConsoleSnapshotForUser(userId?: string | null) {
  const snapshot = await getConsoleSnapshot();
  const currentUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    include: {
      registrations: { include: { race: true, raceProject: { include: { caConnections: true } }, work: true, reviewFlags: true } },
      judgeAssignments: { include: { work: { include: { registration: { include: { user: true, race: true } } } }, judgingRecord: true } }
    }
  }) : null;
  return { ...snapshot, currentUser };
}

export async function getConsoleSnapshot() {
  const race = await prisma.race.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      registrations: { include: { user: true, raceProject: { include: { caConnections: true } }, work: true, reviewFlags: true } },
      releaseItems: true,
      backups: true,
      incidents: true,
      screenState: true,
      announcements: true,
      projections: { orderBy: { lastRebuiltAt: "desc" } },
      awards: true,
      reports: true
    }
  });
  const users = await prisma.user.findMany({ orderBy: { displayName: "asc" } });
  const assignments = await prisma.judgeAssignment.findMany({
    include: { work: { include: { registration: { include: { user: true, race: true } } } }, judge: true, judgingRecord: true }
  });
  return { race, users, assignments };
}

export async function getScreenSnapshot(slug?: string) {
  const race = slug ? await getRaceBySlug(slug) : await getRaceBySlug("bay-area-happy-trip");
  if (!race) return null;
  const works = await getPublicWorks(race.id);
  const stableProjection = race.projections.find((projection) => projection.status === "stable") ?? null;
  const failedProjection = race.projections.find((projection) => projection.status === "failed") ?? null;
  const screenState = race.screenState ?? { mode: "live", fallbackEnabled: false };
  return { race, works, stableProjection, failedProjection, screenState };
}
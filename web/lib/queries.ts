import { prisma } from "@/lib/prisma";
import { fromJson } from "@/lib/json";

export async function getPublicRaces() {
  const races = await prisma.race.findMany({
    where: { visibility: "public" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, status: true, visibility: true, challenge: true, summary: true,
      scheduleJson: true, rulesJson: true, metricsJson: true, createdAt: true
    }
  });
  return races.map((race) => ({
    id: race.id,
    slug: race.slug,
    title: race.title,
    status: race.status,
    visibility: race.visibility,
    challenge: race.challenge,
    summary: race.summary,
    createdAt: race.createdAt,
    schedule: fromJson<Record<string, string>>(race.scheduleJson, {}),
    rules: fromJson<Record<string, unknown>>(race.rulesJson, {}),
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {})
  }));
}

export async function getRaceBySlug(slug: string) {
  const race = await prisma.race.findFirst({
    where: { slug, visibility: "public" },
    select: {
      id: true, slug: true, title: true, status: true, visibility: true, challenge: true, summary: true,
      taskId: true, scheduleJson: true, rulesJson: true, metricsJson: true, createdAt: true,
      registrations: {
        where: { work: { is: { visibility: "public", status: "published" } } },
        select: { work: { select: { id: true } } }
      },
      awards: { where: { status: "published" }, select: { id: true, awardName: true, rank: true } },
      reports: {
        where: { status: "published", visibility: "public" },
        select: { id: true, type: true, status: true, visibility: true, content: true, publishedAt: true }
      },
      projections: {
        where: { status: "stable" },
        orderBy: { lastRebuiltAt: "desc" },
        select: { id: true, type: true, status: true, payloadJson: true, stableVersionId: true, lastRebuiltAt: true }
      },
      announcements: {
        where: { visibility: "public", publishedAt: { not: null } },
        select: { id: true, title: true, body: true, visibility: true, publishedAt: true }
      },
      screenState: true,
    }
  });
  if (!race) return null;
  return {
    id: race.id,
    slug: race.slug,
    title: race.title,
    status: race.status,
    visibility: race.visibility,
    challenge: race.challenge,
    summary: race.summary,
    taskId: race.taskId,
    createdAt: race.createdAt,
    registrations: race.registrations,
    awards: race.awards,
    reports: race.reports,
    projections: race.projections,
    announcements: race.announcements,
    screenState: race.screenState,
    schedule: fromJson<Record<string, string>>(race.scheduleJson, {}),
    rules: fromJson<Record<string, unknown>>(race.rulesJson, {}),
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {})
  };
}

export async function getReviewWorkBySlug(slug: string) {
  return prisma.work.findFirst({
    where: {
      slug
    },
    include: {
      registration: { include: { race: true, user: true, raceProject: { include: { caConnections: true } } } },
      evidences: true,
      reviewFlags: true,
      assignments: { include: { judge: true, judgingRecord: true } },
      awards: true
    }
  });
}

export async function getWorkBySlug(slug: string) {
  const work = await prisma.work.findFirst({
    where: { slug, visibility: "public", status: "published" },
    include: {
      registration: {
        include: {
          race: true,
          user: { select: { slug: true, displayName: true, githubLogin: true, city: true } }
        }
      },
      evidences: { where: { visibility: "public" } },
      awards: { where: { status: "published" } }
    }
  });
  if (!work) return null;
  return {
    id: work.id,
    slug: work.slug,
    title: work.title,
    summary: work.summary,
    status: work.status,
    visibility: work.visibility,
    demoUrl: work.demoUrl,
    repoUrl: work.repoUrl,
    submittedAt: work.submittedAt,
    publishedAt: work.publishedAt,
    registration: {
      race: {
        id: work.registration.race.id,
        slug: work.registration.race.slug,
        title: work.registration.race.title,
        status: work.registration.race.status,
        visibility: work.registration.race.visibility
      },
      user: work.registration.user
    },
    evidences: work.evidences.map((evidence) => ({
      id: evidence.id,
      type: evidence.type,
      title: evidence.title,
      summary: evidence.summary,
      visibility: evidence.visibility,
      createdAt: evidence.createdAt
    })),
    awards: work.awards.map((award) => ({ id: award.id, awardName: award.awardName, rank: award.rank, decisionReason: award.decisionReason }))
  };
}

export async function getPublicWorks(raceId?: string) {
  const works = await prisma.work.findMany({
    where: {
      visibility: "public",
      status: "published",
      ...(raceId
        ? {
            registration: {
              raceId
            }
          }
        : {})
    },
    include: {
      registration: {
        include: {
          race: { select: { id: true, slug: true, title: true, status: true, visibility: true } },
          user: { select: { slug: true, displayName: true, githubLogin: true, city: true } }
        }
      },
      awards: { where: { status: "published" } }
    },
    orderBy: { submittedAt: "desc" }
  });
  return works.map((work) => ({
    id: work.id,
    slug: work.slug,
    title: work.title,
    summary: work.summary,
    status: work.status,
    visibility: work.visibility,
    demoUrl: work.demoUrl,
    repoUrl: work.repoUrl,
    submittedAt: work.submittedAt,
    publishedAt: work.publishedAt,
    registration: { race: work.registration.race, user: work.registration.user },
    awards: work.awards.map((award) => ({ id: award.id, awardName: award.awardName, rank: award.rank, decisionReason: award.decisionReason }))
  }));
}

export async function getRaceWorks(slug: string) {
  const race = await getRaceBySlug(slug);
  if (!race) return null;
  const works = await getPublicWorks(race.id);
  return { race, works };
}

export async function getRaceResults(slug: string) {
  const race = await prisma.race.findFirst({
    where: { slug, visibility: "public" },
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
    awards: race.awards.map((award) => ({
      ...award,
      work: award.work && award.work.visibility === "public" && award.work.status === "published" ? award.work : null
    })),
    schedule: fromJson<Record<string, string>>(race.scheduleJson, {}),
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {}),
    resultReports: race.reports.filter((report) => report.type === "race_report")
  };
}

export async function getRaceReview(slug: string) {
  const race = await prisma.race.findFirst({
    where: { slug, visibility: "public" },
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
          race: { select: { id: true, slug: true, title: true, status: true, visibility: true } },
          work: {
            include: { awards: { where: { status: "published" } }, evidences: { where: { visibility: "public" } } }
          },
          awards: { where: { status: "published" } }
        }
      }
    }
  });
  if (!user) return null;
  return {
    slug: user.slug,
    displayName: user.displayName,
    githubLogin: user.githubLogin,
    city: user.city,
    roles: fromJson<string[]>(user.rolesJson, []).filter((role) => role === "rider"),
    publicWorks: user.registrations.flatMap((registration) =>
      registration.race.visibility === "public" && registration.work && registration.work.visibility === "public" && registration.work.status === "published"
        ? [{
            id: registration.work.id,
            slug: registration.work.slug,
            title: registration.work.title,
            summary: registration.work.summary,
            status: registration.work.status,
            visibility: registration.work.visibility,
            demoUrl: registration.work.demoUrl,
            repoUrl: registration.work.repoUrl,
            race: registration.race
          }]
        : []
    ),
    awards: user.registrations
      .filter((registration) => registration.race.visibility === "public")
      .flatMap((registration) => registration.awards.map((award) => ({
      id: award.id,
      awardName: award.awardName,
      rank: award.rank,
      decisionReason: award.decisionReason,
      publishedAt: award.publishedAt
      }))),
    races: user.registrations
      .filter((registration) => registration.race.visibility === "public")
      .map((registration) => registration.race)
  };
}

export async function getCurrentUserProfile(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function getConsoleSnapshotForUser(userId?: string | null, raceId?: string | null) {
  const snapshot = await getConsoleSnapshot(raceId);
  const currentUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    include: {
      registrations: {
        where: snapshot.race ? { raceId: snapshot.race.id } : undefined,
        include: { race: true, raceProject: { include: { caConnections: true } }, work: true, reviewFlags: true }
      },
      judgeAssignments: {
        where: snapshot.race ? { raceId: snapshot.race.id } : undefined,
        include: { work: { include: { registration: { include: { user: true, race: true } } } }, judgingRecord: true }
      }
    }
  }) : null;
  return { ...snapshot, currentUser };
}

async function findConsoleRace(raceId?: string | null) {
  if (raceId) {
    const selected = await prisma.race.findUnique({ where: { id: raceId } });
    if (selected) return selected;
  }
  const primary = await prisma.race.findUnique({ where: { id: "race_bay_2026" } });
  if (primary) return primary;
  const running = await prisma.race.findFirst({
    where: { visibility: "public", status: "running" },
    orderBy: { createdAt: "desc" }
  });
  if (running) return running;
  return prisma.race.findFirst({ orderBy: { createdAt: "desc" } });
}

export async function getConsoleSnapshot(raceId?: string | null) {
  const selectedRace = await findConsoleRace(raceId);
  const race = selectedRace ? await prisma.race.findUnique({
    where: { id: selectedRace.id },
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
  }) : null;
  const users = await prisma.user.findMany({ orderBy: { displayName: "asc" } });
  const availableRaces = await prisma.race.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, status: true, visibility: true }
  });
  const assignments = await prisma.judgeAssignment.findMany({
    where: race ? { raceId: race.id } : undefined,
    include: { work: { include: { registration: { include: { user: true, race: true } } } }, judge: true, judgingRecord: true }
  });
  return { race, users, assignments, availableRaces };
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

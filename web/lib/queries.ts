import { prisma } from "@/lib/prisma";
import { isRaceOrganizer, type Role } from "@/lib/auth";
import { fromJson } from "@/lib/json";
import { paginateItems, type PageInput, type PaginatedResult } from "@/lib/pagination";
import { AryRaceLiveSnapshotSchema } from "@/lib/race-live/contracts";
import { parseTrackProfile } from "@/lib/track-profile";
import { isPublishedTrackAssetRef } from "@/lib/track-assets/public-ref";

export type EntrantRegistration = {
  participantType: string;
  user: { displayName: string; slug: string };
  team?: {
    name: string;
    slug: string;
    members?: Array<{ user: { displayName: string; slug: string } }>;
  } | null;
};

export function getEntrantDisplay(registration: EntrantRegistration) {
  if (registration.participantType === "team" && registration.team) {
    return {
      type: "team" as const,
      name: registration.team.name,
      slug: registration.team.slug,
      members: registration.team.members?.map((member) => member.user) ?? []
    };
  }
  return {
    type: "individual" as const,
    name: registration.user.displayName,
    slug: registration.user.slug,
    members: [registration.user]
  };
}

export async function getPublicRaces() {
  const races = await prisma.race.findMany({
    where: { visibility: "public" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, status: true, visibility: true, challenge: true, summary: true,
      scheduleJson: true, rulesJson: true, metricsJson: true, createdAt: true,
      registrations: { select: { status: true, userId: true, team: { select: { members: { select: { userId: true } } } }, work: { select: { status: true, visibility: true } } } }
    }
  });
  return races.map((race) => {
    const storedMetrics = fromJson<Record<string, unknown>>(race.metricsJson, {});
    const approvedRiders = new Set(race.registrations.filter((registration) => registration.status === "approved").flatMap((registration) => registration.team?.members.map((member) => member.userId) ?? [registration.userId]));
    const publicWorks = race.registrations.filter((registration) => registration.work?.status === "published" && registration.work.visibility === "public").length;
    const metrics: Record<string, unknown> = {
      ...storedMetrics,
      riders: approvedRiders.size,
      activeRiders: approvedRiders.size,
      submittedWorks: publicWorks
    };
    return {
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
      metrics
    };
  });
}

export type PublicRaceDirectoryFilters = {
  q?: string;
  status?: string;
  page?: PageInput;
};

export async function getPaginatedPublicRaces(filters: PublicRaceDirectoryFilters = {}): Promise<PaginatedResult<Awaited<ReturnType<typeof getPublicRaces>>[number]>> {
  const q = normalizeDirectoryTerm(filters.q);
  const status = normalizeDirectoryTerm(filters.status);
  const races = (await getPublicRaces()).filter((race) => {
    if (race.status === "draft") return false;
    const matchesStatus = !status || status === "all" || normalizeDirectoryTerm(race.status) === status;
    const matchesQuery = !q || [race.title, race.summary, race.challenge]
      .some((value) => normalizeDirectoryTerm(value).includes(q));
    return matchesStatus && matchesQuery;
  });
  return paginateItems(races, filters.page);
}

export async function getHomepageFeaturedRaces(races?: Awaited<ReturnType<typeof getPublicRaces>>) {
  const publicRaces = (races ?? await getPublicRaces()).filter((race) => race.status !== "draft");
  const curations = await prisma.homepageRaceCuration.findMany({ orderBy: [{ position: "asc" }, { updatedAt: "desc" }] });
  const byRace = new Map(curations.map((item) => [item.raceId, item]));
  const eligible = publicRaces.filter((race) => !byRace.get(race.id)?.hidden);
  const pinned = eligible.filter((race) => byRace.get(race.id)?.pinned).sort((left, right) => (byRace.get(left.id)?.position ?? 999) - (byRace.get(right.id)?.position ?? 999));
  const automatic = eligible.filter((race) => !byRace.get(race.id)?.pinned).sort((left, right) => {
    const riderDiff = Number(right.metrics.riders ?? 0) - Number(left.metrics.riders ?? 0);
    const workDiff = Number(right.metrics.submittedWorks ?? 0) - Number(left.metrics.submittedWorks ?? 0);
    return riderDiff || workDiff || right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id);
  });
  return [...pinned, ...automatic].slice(0, 6);
}

export async function getHomepageCurationAdmin() {
  const [races, curations] = await Promise.all([
    getPublicRaces(),
    prisma.homepageRaceCuration.findMany({ orderBy: [{ position: "asc" }, { updatedAt: "desc" }] })
  ]);
  const byRace = new Map(curations.map((item) => [item.raceId, item]));
  return races.filter((race) => race.status !== "draft").map((race) => ({ ...race, curation: byRace.get(race.id) ?? null }));
}

export async function getRaceBySlug(slug: string) {
  const race = await prisma.race.findFirst({
    where: { slug, visibility: "public" },
    select: {
      id: true, slug: true, title: true, status: true, visibility: true, challenge: true, summary: true,
      taskId: true, scheduleJson: true, rulesJson: true, metricsJson: true, createdAt: true,
      _count: { select: { registrations: true } },
      registrations: {
        where: { work: { is: { visibility: "public", status: "published" } } },
        select: { work: { select: { id: true } } }
      },
      awards: {
        where: { status: "published" },
        select: {
          id: true, awardName: true, rank: true,
          workSubmissionVersion: { select: { versionNumber: true, repoCommitSha: true, integrityHash: true, submittedAt: true } }
        }
      },
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
  // A Race can have several stable projection types. Public Live Hall only
  // understands the legacy race_progress presentation payload, so a newer
  // operational projection must not hide the latest compatible public view.
  const publicLiveProjection = race.projections.find((projection) => {
    if (projection.type !== "race_progress") return false;
    const payload = fromJson<Record<string, unknown>>(projection.payloadJson, {});
    return Array.isArray(payload.processLeaderboard)
      || Array.isArray(payload.eventStream)
      || (typeof payload.headlineMetrics === "object" && payload.headlineMetrics !== null);
  });
  const publicProjections = publicLiveProjection
    ? [publicLiveProjection, ...race.projections.filter((projection) => projection.id !== publicLiveProjection.id)]
    : race.projections;
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
    registrationCount: race._count.registrations,
    registrations: race.registrations,
    awards: race.awards.map(({ workSubmissionVersion, ...award }) => ({ ...award, submissionVersion: workSubmissionVersion })),
    reports: race.reports,
    projections: publicProjections,
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
      registration: { include: { race: true, user: true, team: { include: { members: { include: { user: true } } } }, raceProject: { include: { caConnections: true } } } },
      evidences: true,
      reviewFlags: true,
      assignments: { include: { judge: true, judgingRecord: true, workSubmissionVersion: true } },
      currentVersion: true,
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
          user: { select: { slug: true, displayName: true, githubLogin: true, city: true } },
          team: { select: { name: true, slug: true, members: { select: { user: { select: { slug: true, displayName: true } } } } } }
        }
      },
      evidences: { where: { visibility: "public" } },
      awards: { where: { status: "published" } },
      currentVersion: { select: { versionNumber: true, repoCommitSha: true, integrityHash: true, submittedAt: true, repositoryVerificationStatus: true, repositoryVisibility: true, repositoryVerifiedAt: true } }
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
    repoUrl: work.currentVersion?.repositoryVisibility === "private" ? null : work.repoUrl,
    submittedAt: work.submittedAt,
    publishedAt: work.publishedAt,
    submissionVersion: work.currentVersion,
    registration: {
      race: {
        id: work.registration.race.id,
        slug: work.registration.race.slug,
        title: work.registration.race.title,
        status: work.registration.race.status,
        visibility: work.registration.race.visibility
      },
      participantType: work.registration.participantType,
      user: work.registration.user,
      team: work.registration.team
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
          user: { select: { slug: true, displayName: true, githubLogin: true, city: true } },
          team: { select: { name: true, slug: true, members: { select: { user: { select: { slug: true, displayName: true } } } } } }
        }
      },
      awards: { where: { status: "published" } },
      currentVersion: { select: { versionNumber: true, repoCommitSha: true, integrityHash: true, submittedAt: true, repositoryVerificationStatus: true, repositoryVisibility: true, repositoryVerifiedAt: true } }
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
    repoUrl: work.currentVersion?.repositoryVisibility === "private" ? null : work.repoUrl,
    submittedAt: work.submittedAt,
    publishedAt: work.publishedAt,
    submissionVersion: work.currentVersion,
    registration: { participantType: work.registration.participantType, race: work.registration.race, user: work.registration.user, team: work.registration.team },
    awards: work.awards.map((award) => ({ id: award.id, awardName: award.awardName, rank: award.rank, decisionReason: award.decisionReason }))
  }));
}

export type PublicWorkDirectoryFilters = {
  q?: string;
  race?: string;
  page?: PageInput;
};

export async function getPaginatedPublicWorks(filters: PublicWorkDirectoryFilters = {}): Promise<PaginatedResult<Awaited<ReturnType<typeof getPublicWorks>>[number]>> {
  const q = normalizeDirectoryTerm(filters.q);
  const race = normalizeDirectoryTerm(filters.race);
  const works = (await getPublicWorks()).filter((work) => {
    const entrant = getEntrantDisplay(work.registration);
    const belongsToPublicRace = work.registration.race.visibility === "public" && work.registration.race.status !== "draft";
    const matchesRace = !race || normalizeDirectoryTerm(work.registration.race.slug) === race;
    const matchesQuery = !q || [work.title, work.summary, entrant.name, work.registration.race.title]
      .some((value) => normalizeDirectoryTerm(value).includes(q));
    return belongsToPublicRace && matchesRace && matchesQuery;
  });
  return paginateItems(works, filters.page);
}

export async function getHomepageFeaturedWorks(limit = 3) {
  if (!Number.isSafeInteger(limit) || limit <= 0) return [];
  const works = (await getPublicWorks()).filter((work) =>
    work.registration.race.visibility === "public" && work.registration.race.status !== "draft"
  );
  return works
    .slice()
    .sort((left, right) => {
      const awardPriority = Number(right.awards.length > 0) - Number(left.awards.length > 0);
      const rightTime = (right.publishedAt ?? right.submittedAt)?.getTime() ?? 0;
      const leftTime = (left.publishedAt ?? left.submittedAt)?.getTime() ?? 0;
      return awardPriority || rightTime - leftTime || left.id.localeCompare(right.id);
    })
    .slice(0, limit);
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
        include: {
          registration: { include: { user: true, team: { include: { members: { include: { user: true } } } } } },
          work: true,
          workSubmissionVersion: { select: { versionNumber: true, repoCommitSha: true, integrityHash: true, submittedAt: true } }
        }
      },
      reports: { where: { status: "published", visibility: "public" } }
    }
  });
  if (!race) return null;
  return {
    ...race,
    awards: race.awards.map(({ workSubmissionVersionId: _versionId, workSubmissionVersion, ...award }) => ({
      ...award,
      submissionVersion: workSubmissionVersion,
      work: award.work && award.work.visibility === "public" && award.work.status === "published" ? award.work : null
    })),
    schedule: fromJson<Record<string, string>>(race.scheduleJson, {}),
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {}),
    resultReports: race.reports.filter((report) => report.type === "race_report")
  };
}

export async function getLatestPublicRaceResult() {
  const latestPublishedAward = await prisma.award.findFirst({
    where: {
      status: "published",
      race: { visibility: "public", status: "completed" }
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    select: { race: { select: { slug: true } } }
  });
  return latestPublishedAward ? getRaceResults(latestPublishedAward.race.slug) : null;
}

export async function getRaceReview(slug: string) {
  const race = await prisma.race.findFirst({
    where: { slug, visibility: "public" },
    include: {
      reports: { where: { status: "published", visibility: "public", type: "review_summary" } },
      registrations: { include: { user: true, team: { include: { members: { include: { user: true } } } }, work: { include: { evidences: true, reviewFlags: true } } } }
    }
  });
  if (!race) return null;
  return {
    ...race,
    metrics: fromJson<Record<string, unknown>>(race.metricsJson, {}),
    publicEvidence: race.registrations.flatMap((registration) =>
      registration.work?.evidences.filter((evidence) => evidence.visibility === "public").map((evidence) => ({
        ...evidence,
        riderName: getEntrantDisplay(registration).name,
        workTitle: registration.work?.title ?? ""
      })) ?? []
    )
  };
}

export type PublicRiderDirectoryFilters = {
  q?: string;
  skill?: string;
};

export type PaginatedPublicRiderDirectoryFilters = PublicRiderDirectoryFilters & {
  page?: PageInput;
};

export type PublicRiderDirectoryItem = {
  slug: string;
  displayName: string;
  githubLogin: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  countryCode: string | null;
  city: string | null;
  organization: string | null;
  skills: string[];
  websiteUrl: string | null;
  stats: {
    publicRaces: number;
    publicWorks: number;
    publishedAwards: number;
  };
};

type PublicRiderRegistration = {
  id: string;
  race: { visibility: string; status: string };
  work: { status: string; visibility: string } | null;
  awards: Array<{ id: string }>;
};

function normalizeDirectoryTerm(value: string | undefined | null) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function uniquePublicRiderRegistrations(registrations: PublicRiderRegistration[]) {
  return registrations.filter((registration, index, all) =>
    registration.race.visibility === "public"
    && registration.race.status !== "draft"
    && all.findIndex((candidate) => candidate.id === registration.id) === index
  );
}

/**
 * Returns the public Rider directory DTO. This query intentionally exposes only
 * public profile fields and aggregate counts derived from public/published data.
 */
export async function listPublicRiders(filters: PublicRiderDirectoryFilters = {}): Promise<PublicRiderDirectoryItem[]> {
  const users = await prisma.user.findMany({
    where: { roles: { some: { role: "rider", status: "active" } } },
    select: {
      slug: true,
      displayName: true,
      githubLogin: true,
      avatarUrl: true,
      city: true,
      riderProfile: {
        select: {
          headline: true,
          bio: true,
          countryCode: true,
          city: true,
          organization: true,
          skillsJson: true,
          websiteUrl: true
        }
      },
      registrations: {
        select: {
          id: true,
          race: { select: { visibility: true, status: true } },
          work: { select: { status: true, visibility: true } },
          awards: { where: { status: "published" }, select: { id: true } }
        }
      },
      teamMemberships: {
        select: {
          team: {
            select: {
              registration: {
                select: {
                  id: true,
                  race: { select: { visibility: true, status: true } },
                  work: { select: { status: true, visibility: true } },
                  awards: { where: { status: "published" }, select: { id: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  const q = normalizeDirectoryTerm(filters.q);
  const skill = normalizeDirectoryTerm(filters.skill);

  return users
    .map((user): PublicRiderDirectoryItem => {
      const skills = fromJson<string[]>(user.riderProfile?.skillsJson, [])
        .map((item) => item.trim())
        .filter((item, index, all) => item.length > 0 && all.findIndex((candidate) => normalizeDirectoryTerm(candidate) === normalizeDirectoryTerm(item)) === index);
      const registrations = uniquePublicRiderRegistrations([
        ...user.registrations,
        ...user.teamMemberships
          .map((membership) => membership.team.registration)
          .filter((registration): registration is PublicRiderRegistration => registration !== null)
      ]);

      return {
        slug: user.slug,
        displayName: user.displayName,
        githubLogin: user.githubLogin,
        avatarUrl: user.avatarUrl,
        headline: user.riderProfile?.headline ?? null,
        bio: user.riderProfile?.bio ?? null,
        countryCode: user.riderProfile?.countryCode ?? null,
        city: user.riderProfile?.city ?? user.city,
        organization: user.riderProfile?.organization ?? null,
        skills,
        websiteUrl: user.riderProfile?.websiteUrl ?? null,
        stats: {
          publicRaces: registrations.length,
          publicWorks: registrations.filter((registration) => registration.work?.status === "published" && registration.work.visibility === "public").length,
          publishedAwards: registrations.reduce((total, registration) => total + registration.awards.length, 0)
        }
      };
    })
    .filter((rider) => {
      const matchesSkill = !skill || rider.skills.some((item) => normalizeDirectoryTerm(item) === skill);
      if (!matchesSkill) return false;
      if (!q) return true;
      return [
        rider.displayName,
        rider.githubLogin,
        rider.headline,
        rider.bio,
        rider.countryCode,
        rider.city,
        rider.organization,
        ...rider.skills
      ].some((value) => normalizeDirectoryTerm(value).includes(q));
    })
    .sort((left, right) => {
      const byName = normalizeDirectoryTerm(left.displayName).localeCompare(normalizeDirectoryTerm(right.displayName), "zh-CN");
      return byName || left.slug.localeCompare(right.slug, "en");
    });
}

export async function getPaginatedPublicRiders(filters: PaginatedPublicRiderDirectoryFilters = {}): Promise<PaginatedResult<PublicRiderDirectoryItem>> {
  const riders = await listPublicRiders({ q: filters.q, skill: filters.skill });
  return paginateItems(riders, filters.page);
}

export async function getRiderProfile(idOrSlug: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      roles: { some: { role: "rider", status: "active" } }
    },
    include: {
      riderProfile: true,
      registrations: {
        include: {
          race: { select: { id: true, slug: true, title: true, status: true, visibility: true } },
          team: { include: { members: { include: { user: true } } } },
          work: {
            include: { awards: { where: { status: "published" } }, evidences: { where: { visibility: "public" } } }
          },
          awards: { where: { status: "published" } }
        }
      },
      teamMemberships: {
        include: {
          team: {
            include: {
              registration: {
                include: {
                  race: { select: { id: true, slug: true, title: true, status: true, visibility: true } },
                  team: { include: { members: { include: { user: true } } } },
                  work: { include: { awards: { where: { status: "published" } }, evidences: { where: { visibility: "public" } } } },
                  awards: { where: { status: "published" } }
                }
              }
            }
          }
        }
      }
    }
  });
  if (!user) return null;
  const registrations = [
    ...user.registrations,
    ...user.teamMemberships.map((membership) => membership.team.registration).filter((registration) => registration !== null)
  ].filter((registration, index, all) => all.findIndex((candidate) => candidate.id === registration.id) === index);
  return {
    slug: user.slug,
    displayName: user.displayName,
    githubLogin: user.githubLogin,
    avatarUrl: user.avatarUrl,
    city: user.riderProfile?.city ?? user.city,
    headline: user.riderProfile?.headline,
    bio: user.riderProfile?.bio,
    countryCode: user.riderProfile?.countryCode,
    organization: user.riderProfile?.organization,
    skills: fromJson<string[]>(user.riderProfile?.skillsJson, []),
    websiteUrl: user.riderProfile?.websiteUrl,
    socialLinks: fromJson<Record<string, string>>(user.riderProfile?.socialLinksJson, {}),
    publicWorks: registrations.flatMap((registration) =>
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
    awards: registrations
      .filter((registration) => registration.race.visibility === "public")
      .flatMap((registration) => registration.awards.map((award) => ({
      id: award.id,
      awardName: award.awardName,
      rank: award.rank,
      decisionReason: award.decisionReason,
      publishedAt: award.publishedAt
      }))),
    races: registrations
      .filter((registration) => registration.race.visibility === "public")
      .map((registration) => registration.race)
  };
}

export async function getCurrentUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { orderBy: { grantedAt: "asc" } }, roleApplications: { orderBy: { createdAt: "desc" } } }
  });
}

export async function getOnboardingState(userId: string, role?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      riderProfile: true,
      judgeProfile: true,
      organizerProfile: true,
      roleApplications: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!user) return null;
  const currentApplication = user.roleApplications.find((application) =>
    (!role || application.requestedRole === role) && ["draft", "pending", "rejected"].includes(application.status)
  ) ?? null;
  return { ...user, currentApplication };
}

export async function getRiderConsoleSnapshot(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      riderProfile: true,
      registrations: {
        orderBy: { submittedAt: "desc" },
        include: { race: true, team: { include: { members: true } }, raceProject: { include: { caConnections: true } }, work: true }
      },
      teamMemberships: { include: { team: { include: { registration: { include: { race: true, raceProject: { include: { caConnections: true } }, work: true } } } } } }
    }
  });
  const openRaces = await prisma.race.findMany({ where: { visibility: "public", status: { in: ["draft", "running"] } }, orderBy: { createdAt: "desc" } });
  return { user, openRaces };
}

export async function getJudgeConsoleSnapshot(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      judgeProfile: true,
      judgeAssignments: {
        orderBy: { assignedAt: "desc" },
        include: { work: { include: { registration: { include: { race: true, user: true } } } }, judgingRecord: true }
      }
    }
  });
}

export async function getOrganizerConsoleSnapshot(userId: string) {
  const races = (await prisma.race.findMany({
    orderBy: { createdAt: "desc" },
    include: { registrations: { include: { user: true, work: true, raceProject: { include: { caConnections: true } } } } }
  })).filter((race) => isRaceOrganizer(race.organizerJson, userId));
  const judges = await prisma.user.findMany({
    where: { roles: { some: { role: "judge", status: "active" } } },
    include: { judgeProfile: true },
    orderBy: { displayName: "asc" }
  });
  return { races, judges };
}

export type JudgePoolCandidate = {
  userId: string;
  displayName: string;
  githubLogin: string | null;
  selected: boolean;
  eligible: boolean;
  conflictReason: string | null;
  assignmentCount: number;
};

export type WorkReviewAggregate = {
  workId: string;
  title: string;
  completedReviews: number;
  requiredReviews: 3;
  avgResult: number | null;
  avgRiding: number | null;
  overall: number | null;
  rank: number | null;
};

function roundedAverage(values: number[]) {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export async function getJudgeManagementSnapshot(raceId: string, organizerUserId: string) {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: {
      id: true, title: true, createdByUserId: true, organizerJson: true,
      reviewResultsPublishedAt: true,
      judgeMemberships: { include: { judge: { include: { roles: true } } }, orderBy: { selectedAt: "asc" } },
      judgeAllocationBatches: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });
  if (!race || (race.createdByUserId !== organizerUserId && !isRaceOrganizer(race.organizerJson, organizerUserId))) return null;
  const [users, registrations, draftTeams, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { roles: { some: { role: "judge", status: "active" } } },
      select: { id: true, displayName: true, githubLogin: true },
      orderBy: { displayName: "asc" }
    }),
    prisma.registration.findMany({
      where: { raceId, status: { notIn: ["rejected", "withdrawn", "cancelled"] } },
      select: { userId: true, team: { select: { members: { select: { userId: true } } } } }
    }),
    prisma.team.findMany({ where: { raceId, registration: null }, select: { members: { select: { userId: true } } } }),
    prisma.judgeAssignment.findMany({
      where: { raceId },
      include: { judge: true, work: true, judgingRecord: true },
      orderBy: [{ workId: "asc" }, { slot: "asc" }]
    })
  ]);
  const participantIds = new Set([
    ...registrations.flatMap((registration) => registration.team?.members.map((member) => member.userId) ?? [registration.userId]),
    ...draftTeams.flatMap((team) => team.members.map((member) => member.userId))
  ]);
  const selected = new Set(race.judgeMemberships.filter((membership) => membership.status === "active").map((membership) => membership.judgeUserId));
  const candidates: JudgePoolCandidate[] = users.map((user) => ({
    userId: user.id,
    displayName: user.displayName,
    githubLogin: user.githubLogin,
    selected: selected.has(user.id),
    eligible: !participantIds.has(user.id),
    conflictReason: participantIds.has(user.id) ? "该用户正在参与本场赛事" : null,
    assignmentCount: assignments.filter((assignment) => assignment.judgeUserId === user.id).length
  }));
  return { race, candidates, assignments, batches: race.judgeAllocationBatches };
}

export async function getRaceReviewAggregatesForUser(userId: string, role: Role, raceId: string): Promise<WorkReviewAggregate[]> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: { createdByUserId: true, organizerJson: true, reviewResultsPublishedAt: true }
  });
  if (!race) return [];
  const organizer = role === "organizer" && (race.createdByUserId === userId || isRaceOrganizer(race.organizerJson, userId));
  const works = await prisma.work.findMany({
    where: {
      registration: { raceId, status: "approved" }, currentVersionId: { not: null },
      ...(organizer ? {} : role === "judge"
        ? { assignments: { some: { judgeUserId: userId } } }
        : role === "rider"
          ? { registration: { raceId, status: "approved", OR: [{ userId }, { team: { members: { some: { userId } } } }] } }
          : { id: "__not_visible__" })
    },
    select: {
      id: true, title: true,
      assignments: { select: { judgeUserId: true, status: true, judgingRecord: { select: { scoreResult: true, scoreRiding: true, status: true } } } }
    },
    orderBy: { id: "asc" }
  });
  const aggregates: WorkReviewAggregate[] = works.map((work) => {
    const submitted = work.assignments.filter((assignment) => assignment.status === "reviewed" && assignment.judgingRecord?.status === "submitted");
    const complete = work.assignments.length === 3 && submitted.length === 3;
    const judgeCanSee = role !== "judge" || (complete && submitted.some((assignment) => assignment.judgeUserId === userId));
    const riderCanSee = role !== "rider" || Boolean(race.reviewResultsPublishedAt);
    const canSeeScores = complete && (organizer || (judgeCanSee && riderCanSee));
    const avgResult = canSeeScores ? roundedAverage(submitted.map((assignment) => assignment.judgingRecord!.scoreResult)) : null;
    const avgRiding = canSeeScores ? roundedAverage(submitted.map((assignment) => assignment.judgingRecord!.scoreRiding)) : null;
    return {
      workId: work.id, title: work.title, completedReviews: submitted.length, requiredReviews: 3 as const,
      avgResult, avgRiding,
      overall: avgResult === null || avgRiding === null ? null : Math.round(((avgResult + avgRiding) / 2) * 100) / 100,
      rank: null
    };
  });
  const ranked = aggregates.filter((aggregate) => aggregate.overall !== null).sort((left, right) => right.overall! - left.overall! || left.workId.localeCompare(right.workId));
  let previousScore: number | null = null;
  let previousRank = 0;
  ranked.forEach((aggregate, index) => {
    const rank = aggregate.overall === previousScore ? previousRank : index + 1;
    aggregate.rank = rank;
    previousScore = aggregate.overall;
    previousRank = rank;
  });
  return aggregates.sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) || left.workId.localeCompare(right.workId));
}

export async function getOrganizerParticipantLibrary(
  raceId: string,
  organizerUserId: string,
  filters: { q?: string; status?: string; page?: PageInput } = {}
) {
  const race = await prisma.race.findUnique({ where: { id: raceId }, select: { createdByUserId: true, organizerJson: true } });
  if (!race || (race.createdByUserId !== organizerUserId && !isRaceOrganizer(race.organizerJson, organizerUserId))) return null;
  const status = filters.status?.trim() || "approved";
  const registrations = await prisma.registration.findMany({
    where: status === "history" ? { raceId, status: { in: ["rejected", "withdrawn", "cancelled"] } } : { raceId, status: "approved" },
    include: {
      user: true, reviewedBy: true,
      team: { include: { members: { include: { user: true } } } },
      raceProject: { include: { caConnections: true } },
      work: true, reviewFlags: true
    },
    orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }]
  });
  const q = filters.q?.trim().toLocaleLowerCase() ?? "";
  const filtered = registrations.filter((registration) => !q || [
    registration.user.displayName, registration.user.githubLogin,
    registration.team?.name,
    ...(registration.team?.members.map((member) => member.user.displayName) ?? [])
  ].some((value) => value?.toLocaleLowerCase().includes(q)));
  return paginateItems(filtered, filters.page);
}

export async function getOrganizerPortfolio(userId: string) {
  const races = await prisma.race.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      status: true,
      visibility: true,
      createdAt: true,
      createdByUserId: true,
      organizerJson: true
    }
  });

  return races
    .filter((race) => race.createdByUserId === userId || isRaceOrganizer(race.organizerJson, userId))
    .map(({ organizerJson: _organizerJson, ...race }) => ({
      ...race,
      relationship: race.createdByUserId === userId ? "owner" as const : "collaborator" as const
    }));
}

export async function getAdminConsoleSnapshot() {
  const [users, applications] = await Promise.all([
    prisma.user.findMany({
      include: { roles: { orderBy: { role: "asc" } }, roleApplications: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.roleApplication.findMany({
      where: { status: "pending" },
      include: { user: { include: { judgeProfile: true, organizerProfile: true } } },
      orderBy: { submittedAt: "asc" }
    })
  ]);
  return { users, applications };
}

export async function getConsoleSnapshotForUser(userId?: string | null, raceId?: string | null, role?: Role | null) {
  const allowedRaceIds = !userId || !role ? [] : role === "organizer"
    ? (await prisma.race.findMany({ select: { id: true, createdByUserId: true, organizerJson: true } }))
        .filter((race) => race.createdByUserId === userId || isRaceOrganizer(race.organizerJson, userId)).map((race) => race.id)
    : role === "judge"
      ? [...new Set((await prisma.judgeAssignment.findMany({ where: { judgeUserId: userId }, select: { raceId: true } })).map((item) => item.raceId))]
      : role === "rider"
        ? [...new Set([
            ...(await prisma.registration.findMany({
              where: { OR: [{ userId }, { team: { members: { some: { userId } } } }] }, select: { raceId: true }
            })).map((item) => item.raceId),
            ...(await prisma.team.findMany({
              where: { members: { some: { userId } } }, select: { raceId: true }
            })).map((item) => item.raceId)
          ])]
        : [];
  const selectedRaceId = raceId
    ? (allowedRaceIds.includes(raceId) ? raceId : null)
    : allowedRaceIds[0] ?? null;
  const snapshot = selectedRaceId
    ? await getConsoleSnapshot(selectedRaceId)
    : { race: null, users: [], assignments: [], availableRaces: [] };
  const organizerJudges = role === "organizer" && snapshot.race ? await prisma.user.findMany({
    where: {
      roles: { some: { role: "judge", status: "active" } },
      registrations: { none: { raceId: snapshot.race.id, status: { notIn: ["rejected", "withdrawn", "cancelled"] } } },
      teamMemberships: { none: { team: { raceId: snapshot.race.id } } }
    },
    include: { roles: true },
    orderBy: { displayName: "asc" }
  }) : [];
  const currentUser = userId ? await prisma.user.findUnique({
    where: { id: userId },
    include: {
      registrations: {
        where: snapshot.race ? { raceId: snapshot.race.id } : undefined,
        include: { race: true, user: true, team: { include: { members: { include: { user: true } } } }, raceProject: { include: { caConnections: true } }, work: { include: { currentVersion: true } }, reviewFlags: true }
      },
      teamMemberships: {
        where: snapshot.race ? { team: { raceId: snapshot.race.id } } : undefined,
        include: {
          team: {
            include: {
              members: { include: { user: true } },
              registration: { include: { race: true, user: true, team: { include: { members: { include: { user: true } } } }, raceProject: { include: { caConnections: true } }, work: { include: { currentVersion: true } }, reviewFlags: true } }
            }
          }
        }
      },
      judgeAssignments: {
        where: snapshot.race ? { raceId: snapshot.race.id } : undefined,
        include: {
          work: {
            include: {
              registration: { include: { user: true, team: { include: { members: { include: { user: true } } } }, race: true } },
              reviewFlags: true,
              evidences: true
            }
          },
          workSubmissionVersion: true,
          judgingRecord: true
        }
      }
    }
  }) : null;
  if (!currentUser) return { ...snapshot, currentUser: null };
  const registrations = [
    ...currentUser.registrations,
    ...currentUser.teamMemberships.map((membership) => membership.team.registration).filter((registration) => registration !== null)
  ].filter((registration, index, all) => all.findIndex((candidate) => candidate.id === registration.id) === index);
  const assignedWorkIds = new Set(currentUser.judgeAssignments.map((assignment) => assignment.workId));
  const visibleRegistrations = snapshot.race?.registrations.filter((registration) =>
    role === "organizer" ||
    (role === "rider" && (registration.userId === userId || registration.team?.members.some((member) => member.userId === userId))) ||
    (role === "judge" && Boolean(registration.work && assignedWorkIds.has(registration.work.id)))
  ) ?? [];
  const visibleRace = !snapshot.race ? null : role === "organizer" ? snapshot.race : {
    ...snapshot.race,
    registrations: visibleRegistrations,
    releaseItems: [], backups: [], incidents: [], announcements: [], projections: [], awards: [], reports: [], screenState: null
  };
  return {
    ...snapshot,
    race: visibleRace,
    users: role === "organizer" ? organizerJudges : [],
    assignments: role === "organizer"
      ? snapshot.assignments
      : snapshot.assignments.filter((assignment) => role === "judge" && assignment.judgeUserId === userId),
    availableRaces: snapshot.availableRaces.filter((race) => allowedRaceIds.includes(race.id)),
    currentUser: { ...currentUser, registrations }
  };
}

export async function getRaceParticipationForUser(raceId: string, userId: string) {
  const registration = await prisma.registration.findFirst({
    where: {
      raceId,
      OR: [{ userId }, { team: { members: { some: { userId } } } }]
    },
    select: {
      id: true,
      status: true,
      participantType: true,
      team: { select: { id: true, name: true, status: true, createdByUserId: true } }
    }
  });
  if (registration) return { ...registration, participationState: "registered" as const };
  const membership = await prisma.teamMember.findFirst({
    where: { userId, team: { raceId, status: "draft", registration: null } },
    select: { role: true, team: { select: { id: true, name: true, status: true, createdByUserId: true } } }
  });
  return membership ? {
    id: membership.team.id,
    status: membership.team.status,
    participantType: "team",
    team: membership.team,
    teamRole: membership.role,
    participationState: "team_draft" as const
  } : null;
}

export async function getRiderPortfolio(userId: string) {
  const [registrations, draftMemberships] = await Promise.all([
    prisma.registration.findMany({
      where: { OR: [{ userId }, { team: { members: { some: { userId } } } }] },
      include: {
        race: { select: { id: true, slug: true, title: true, summary: true, status: true, visibility: true, createdAt: true } },
        team: { include: { members: { select: { userId: true, role: true } } } },
        raceProject: { select: { aggregateIngestionStatus: true, caConnections: { select: { id: true } } } },
        work: { select: { id: true, title: true, status: true, visibility: true } }
      }, orderBy: { submittedAt: "desc" }
    }),
    prisma.teamMember.findMany({
      where: { userId, team: { status: "draft", registration: null } },
      include: { team: { include: { race: { select: { id: true, slug: true, title: true, summary: true, status: true, visibility: true, createdAt: true } } } } },
      orderBy: { team: { updatedAt: "desc" } }
    })
  ]);
  const entries = [
    ...registrations.map((registration) => ({ race: registration.race, registrationId: registration.id as string | null, participationStatus: registration.status, participantType: registration.participantType, teamName: registration.team?.name ?? null, teamRole: registration.team?.createdByUserId === userId ? "captain" : registration.team?.members.find((member) => member.userId === userId)?.role ?? "member", submittedAt: registration.submittedAt, caStatus: registration.raceProject?.aggregateIngestionStatus ?? "not_configured", connectionCount: registration.raceProject?.caConnections.length ?? 0, work: registration.work })),
    ...draftMemberships.map((membership) => ({ race: membership.team.race, registrationId: null as string | null, participationStatus: "team_draft", participantType: "team", teamName: membership.team.name, teamRole: membership.team.createdByUserId === userId ? "captain" : membership.role, submittedAt: membership.team.updatedAt, caStatus: "not_configured", connectionCount: 0, work: null }))
  ];
  const active = (value: string) => ["approved", "pending", "team_draft"].includes(value) ? 1 : 0;
  return entries.sort((left, right) => active(right.participationStatus) - active(left.participationStatus) || right.submittedAt.getTime() - left.submittedAt.getTime());
}

export async function getRiskCenterSnapshotForUser(userId?: string | null, raceId?: string | null, role?: Role | null) {
  if (!userId || !role) return { race:null, availableRaces:[], allFlags:[], ownFlags:[], judgeFlags:[], securityWarnings:[] };
  const judgeRaceIds = role === "judge"
    ? [...new Set((await prisma.judgeAssignment.findMany({ where:{judgeUserId:userId},select:{raceId:true} })).map((assignment)=>assignment.raceId))]
    : [];
  const candidateRaces = role === "admin" ? await prisma.race.findMany({ select:{id:true,slug:true,title:true,status:true,visibility:true,organizerJson:true,createdByUserId:true} })
    : role === "organizer" ? (await prisma.race.findMany({ select:{id:true,slug:true,title:true,status:true,visibility:true,organizerJson:true,createdByUserId:true} })).filter(item=>item.createdByUserId===userId||isRaceOrganizer(item.organizerJson,userId))
    : role === "rider" ? await prisma.race.findMany({ where:{ OR:[{registrations:{some:{OR:[{userId},{team:{members:{some:{userId}}}}]} }},{teams:{some:{members:{some:{userId}}}}}]},select:{id:true,slug:true,title:true,status:true,visibility:true,organizerJson:true,createdByUserId:true} })
    : await prisma.race.findMany({ where:{id:{in:judgeRaceIds}},select:{id:true,slug:true,title:true,status:true,visibility:true,organizerJson:true,createdByUserId:true} });
  const selectedIds = raceId ? candidateRaces.filter(item=>item.id===raceId).map(item=>item.id) : role==="organizer" ? [] : candidateRaces.map(item=>item.id);
  const selectedRace = raceId ? candidateRaces.find(item=>item.id===raceId)??null : null;
  if (!selectedIds.length) return { race:selectedRace, availableRaces:candidateRaces, allFlags:[], ownFlags:[], judgeFlags:[], securityWarnings:[] };
  const [unsafeProblems, unverifiedVersions] = await Promise.all([
    role === "organizer" || role === "admin" ? prisma.raceProblemVersion.findMany({ where:{raceId:{in:selectedIds},scanStatus:{not:"clean"}},select:{id:true,raceId:true,revision:true,scanStatus:true,scanDetail:true,race:{select:{title:true}}} }) : [],
    prisma.workSubmissionVersion.findMany({ where:{currentForWork:{registration:{raceId:{in:selectedIds}}},repositoryVerificationStatus:{not:"verified"},...(role==="rider"?{submittedByUserId:userId}:role==="judge"?{judgeAssignments:{some:{judgeUserId:userId}}}:{})},select:{id:true,versionNumber:true,repositoryVerificationStatus:true,work:{select:{title:true,registration:{select:{raceId:true,race:{select:{title:true}}}}}}} })
  ]);
  const securityWarnings = [
    ...unsafeProblems.map(item=>({id:item.id,raceId:item.raceId,type:"problem_attachment",status:item.scanStatus,summary:`${item.race.title} 赛题修订 ${item.revision}：${item.scanDetail??item.scanStatus}`})),
    ...unverifiedVersions.map(item=>({id:item.id,raceId:item.work.registration.raceId,type:"repository_verification",status:item.repositoryVerificationStatus,summary:`${item.work.registration.race.title} / ${item.work.title} v${item.versionNumber}：仓库与 Commit 未经 GitHub App 验证`}))
  ];
  const roleScope = role === "rider" ? { registration:{ OR:[{userId},{team:{members:{some:{userId}}}}] } } : role === "judge" ? { work:{ assignments:{some:{judgeUserId:userId}} } } : {};
  const flags = await prisma.reviewFlag.findMany({ where:{raceId:{in:selectedIds},...roleScope},include:{registration:{include:{user:true,team:{include:{members:true}},race:true,raceProject:{include:{caConnections:true}},work:true}},work:{include:{assignments:{where:{judgeUserId:userId}}}}},orderBy:{updatedAt:"desc"} });
  const resolverIds=[...new Set(flags.map(flag=>flag.resolvedByUserId).filter((id):id is string=>Boolean(id)))];
  const resolvers=new Map((await prisma.user.findMany({where:{id:{in:resolverIds}},select:{id:true,displayName:true}})).map(item=>[item.id,item.displayName]));
  const mapped=flags.map(flag=>({
    id:flag.id,raceId:flag.raceId,raceTitle:flag.registration.race.title,type:flag.type,severity:flag.severity,status:flag.status,
    sourceRefJson:role==="organizer"?flag.sourceRefJson:"{}",judgeVisibleSummary:flag.judgeVisibleSummary,resolutionNote:flag.resolutionNote,
    resolvedByName:flag.resolvedByUserId?resolvers.get(flag.resolvedByUserId)??null:null,resolvedAt:flag.resolvedAt,createdAt:flag.createdAt,updatedAt:flag.updatedAt,
    riderName:flag.registration.userId===userId&&role==="rider"?"你":flag.registration.user.displayName,riderUserId:flag.registration.userId,
    workTitle:flag.registration.work?.title??null,workSlug:flag.registration.work?.slug??null,workVisibility:flag.registration.work?.visibility??null,
    projectStatus:role==="judge"?"restricted":flag.registration.raceProject?.aggregateIngestionStatus??"not_configured",
    connectionHealth:role==="judge"?"restricted":flag.registration.raceProject?.connectionHealth??"no_signal",
    connectionCount:role==="judge"?0:flag.registration.raceProject?.caConnections.length??0,
    assignmentId:flag.work?.assignments[0]?.id??"",assignmentStatus:flag.work?.assignments[0]?.status??""
  }));
  return { race:selectedRace, availableRaces:candidateRaces, allFlags:role==="organizer"||role==="admin"?mapped:[], ownFlags:role==="rider"?mapped:[], judgeFlags:role==="judge"?mapped:[], securityWarnings };
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
      registrations: { include: { user: true, team: { include: { members: { include: { user: true } } } }, raceProject: { include: { caConnections: true } }, work: { include: { currentVersion: true } }, reviewFlags: true } },
      releaseItems: true,
      backups: true,
      incidents: true,
      screenState: true,
      announcements: true,
      projections: { orderBy: { lastRebuiltAt: "desc" } },
      awards: true,
      reports: true,
      currentProblemVersion: true
    }
  }) : null;
  const users = await prisma.user.findMany({ include: { roles: true }, orderBy: { displayName: "asc" } });
  const availableRaces = await prisma.race.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, status: true, visibility: true }
  });
  const assignments = await prisma.judgeAssignment.findMany({
    where: race ? { raceId: race.id } : undefined,
    include: { work: { include: { registration: { include: { user: true, team: { include: { members: { include: { user: true } } } }, race: true } } } }, workSubmissionVersion: true, judge: true, judgingRecord: true }
  });
  return { race, users, assignments, availableRaces };
}

export async function getScreenSnapshot(raceId: string) {
  if (!raceId) return null;
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: {
      id: true, slug: true, title: true, status: true, visibility: true,
      _count: { select: { registrations: true } },
      announcements: { where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, select: { id: true, title: true, body: true, visibility: true, publishedAt: true } },
      projections: { orderBy: { lastRebuiltAt: "desc" }, select: { id: true, type: true, status: true, payloadJson: true, stableVersionId: true, lastRebuiltAt: true } },
      screenState: { include: { stableProjection: true, currentRound: true } }
    }
  });
  if (!race) return null;
  const works = await getPublicWorks(race.id);
  const stableProjection = race.screenState?.stableProjection?.type === "ary_race_live" && race.screenState.stableProjection.status === "stable"
    ? race.screenState.stableProjection
    : null;
  const failedProjection = race.projections.find((projection) => projection.type === "ary_race_live" && projection.status === "failed") ?? null;
  const screenState = race.screenState ?? {
    mode: "live",
    fallbackEnabled: false,
    activeGroupOrder: 1,
    autoRotateEnabled: true,
    rotationIntervalSeconds: 15
  };
  return { race, works, stableProjection, failedProjection, screenState };
}

export async function getPublicRaceLiveSnapshot(raceId: string) {
  const state = await prisma.screenState.findUnique({
    where: { raceId },
    include: {
      stableProjection: true,
      currentRound: { include: { trackProfileVersion: true } }
    }
  });
  if (!state?.stableProjection || state.stableProjection.status !== "stable" || state.stableProjection.type !== "ary_race_live") return null;
  const parsed = AryRaceLiveSnapshotSchema.safeParse(fromJson<unknown>(state.stableProjection.payloadJson, null));
  const version = state.currentRound?.trackProfileVersion;
  if (!parsed.success || parsed.data.raceId !== raceId || parsed.data.roundId !== state.currentRoundId || !version) return null;
  let trackProfile;
  try {
    trackProfile = parseTrackProfile(version.profileJson);
  } catch {
    return null;
  }
  if (
    version.status !== "published" || trackProfile.status !== "published" ||
    version.trackId !== trackProfile.trackId || version.version !== trackProfile.version ||
    parsed.data.race.trackProfileId !== trackProfile.trackId || parsed.data.race.trackProfileVersion !== trackProfile.version ||
    version.checksum !== trackProfile.background.checksum ||
    !isPublishedTrackAssetRef({ trackId: trackProfile.trackId, version: trackProfile.version, fileName: trackProfile.background.fileName, checksum: version.checksum, backgroundHash: version.backgroundHash, backgroundAssetRef: version.backgroundAssetRef })
  ) return null;
  const screenModes = ["live", "leaderboard", "works", "announcement"] as const;
  const mode = screenModes.find((candidate) => candidate === state.mode);
  if (!mode) return null;
  return {
    snapshot: parsed.data,
    trackProfile,
    backgroundAssetRef: version.backgroundAssetRef,
    screenState: {
      activeGroupOrder: state.activeGroupOrder,
      autoRotateEnabled: state.autoRotateEnabled,
      rotationIntervalSeconds: state.rotationIntervalSeconds,
      rotationEpochAt: state.rotationEpochAt.toISOString(),
      fallbackEnabled: state.fallbackEnabled,
      mode
    }
  };
}

export async function getTrackManagementSnapshot(raceId: string) {
  const [race, tracks, rounds] = await Promise.all([
    prisma.race.findUnique({ where: { id: raceId }, select: { id: true, slug: true, title: true } }),
    prisma.trackProfile.findMany({
      where: { OR: [{ raceId: null }, { raceId }] },
      select: {
        id: true, trackId: true, raceId: true, name: true, scope: true,
        versions: { select: { id: true, version: true, status: true, checksum: true, backgroundAssetRef: true, publishedAt: true }, orderBy: { publishedAt: "desc" } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.raceRound.findMany({ where: { raceId }, select: { id: true, name: true, status: true, trackProfileVersionId: true }, orderBy: { order: "asc" } })
  ]);
  return race ? { race, tracks, rounds } : null;
}

export async function getTrackCalibratorVersions(raceId: string) {
  const tracks = await prisma.trackProfile.findMany({
    where: { OR: [{ raceId: null }, { raceId }] },
    select: {
      trackId: true,
      raceId: true,
      name: true,
      scope: true,
      versions: {
        select: {
          id: true,
          version: true,
          status: true,
          profileHash: true,
          backgroundHash: true,
          publishedAt: true,
          raceRounds: { select: { id: true, name: true, raceId: true } }
        },
        orderBy: { publishedAt: "desc" }
      }
    },
    orderBy: { name: "asc" }
  });
  return tracks.flatMap((track) => track.versions.map((version) => ({
    ...version,
    trackId: track.trackId,
    trackName: track.name,
    scope: track.scope,
    manageable: track.raceId === raceId,
    publishedAt: version.publishedAt?.toISOString() ?? null
  })));
}

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const WORK_SUBMISSION_HASH_SCHEMA = "ary.work-submission.v1";

const workSubmissionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(4000),
  demoUrl: z.string().trim().max(2048).optional(),
  repoUrl: z.string().trim().min(1).max(2048),
  repoCommitSha: z.string().trim().regex(/^[a-fA-F0-9]{40}$/)
}).strict();

export type ValidatedWorkSubmissionInput = {
  title: string;
  summary: string;
  demoUrl?: string;
  repoUrl: string;
  repoCommitSha: string;
};

export type SubmissionWindowState = "not_started" | "open" | "closed_by_deadline" | "closed_manually" | "sealed_for_judging";

type SubmissionWindow = {
  submissionOpensAt: Date | null;
  submissionClosesAt: Date | null;
  submissionLockedAt: Date | null;
};

export type WorkSubmissionHashPayload = ValidatedWorkSubmissionInput & {
  workId: string;
  registrationId: string;
  versionNumber: number;
  submittedByUserId: string;
  submittedAt: Date;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isForbiddenIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

function isForbiddenIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") || normalized.startsWith("::ffff:") ||
    normalized.startsWith("2001:db8:");
}

function normalizeGithubRepoUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.port || url.username || url.password || url.search || url.hash || segments.length !== 2) {
      return null;
    }
    if (segments.some((segment) => !/^[a-zA-Z0-9_.-]+$/.test(segment))) return null;
    return `https://github.com/${segments[0]}/${segments[1]}`;
  } catch {
    return null;
  }
}

function normalizePublicDemoUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || !hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return null;
    const ipVersion = isIP(hostname.replace(/^\[|\]$/g, ""));
    if ((ipVersion === 4 && isForbiddenIpv4(hostname)) || (ipVersion === 6 && isForbiddenIpv6(hostname))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateWorkSubmissionInput(input: unknown):
  | { ok: true; data: ValidatedWorkSubmissionInput }
  | { ok: false; message: string } {
  const parsed = workSubmissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "作品字段不完整或长度超限" };
  const repoUrl = normalizeGithubRepoUrl(parsed.data.repoUrl);
  if (!repoUrl) return { ok: false, message: "Repo URL必须是标准GitHub HTTPS仓库地址" };
  let demoUrl: string | undefined;
  if (parsed.data.demoUrl) {
    const normalizedDemoUrl = normalizePublicDemoUrl(parsed.data.demoUrl);
    if (!normalizedDemoUrl) return { ok: false, message: "Demo URL必须是公共HTTPS地址" };
    demoUrl = normalizedDemoUrl;
  }
  return {
    ok: true,
    data: {
      title: parsed.data.title,
      summary: parsed.data.summary,
      demoUrl,
      repoUrl,
      repoCommitSha: parsed.data.repoCommitSha.toLowerCase()
    }
  };
}

export function getSubmissionWindowState(window: SubmissionWindow, hasJudgeAssignments: boolean, now = new Date()): SubmissionWindowState {
  if (hasJudgeAssignments) return "sealed_for_judging";
  if (window.submissionLockedAt) return "closed_manually";
  if (!window.submissionOpensAt || !window.submissionClosesAt || now < window.submissionOpensAt) return "not_started";
  if (now >= window.submissionClosesAt) return "closed_by_deadline";
  return "open";
}

export function createWorkSubmissionIntegrityHash(payload: WorkSubmissionHashPayload): string {
  const canonical = {
    schemaVersion: WORK_SUBMISSION_HASH_SCHEMA,
    workId: payload.workId,
    registrationId: payload.registrationId,
    versionNumber: payload.versionNumber,
    title: payload.title,
    summary: payload.summary,
    demoUrl: payload.demoUrl,
    repoUrl: payload.repoUrl,
    repoCommitSha: payload.repoCommitSha,
    submittedByUserId: payload.submittedByUserId,
    submittedAt: payload.submittedAt
  };
  return createHash("sha256").update(stableJson(canonical)).digest("hex");
}

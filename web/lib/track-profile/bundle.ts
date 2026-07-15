import { z } from "zod";
import { TrackProfileValidationError, parseTrackProfile } from "./lifecycle";
import type { TrackProfile } from "./schema";

const SUPPORTED_BUNDLE_MAJOR = 1;

export const TrackBundleFileSchema = z
  .object({
    path: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    content: z.string(),
    encoding: z.enum(["utf8", "base64"]).optional(),
  })
  .strict();

export const TrackBundleSchema = z
  .object({
    format: z.literal("dcr-track-bundle"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    trackId: z.string().trim().min(1),
    trackVersion: z.string().trim().min(1),
    exportedAt: z.string().datetime({ offset: true }),
    files: z.array(TrackBundleFileSchema).min(1),
  })
  .strict();

export type TrackBundle = z.infer<typeof TrackBundleSchema>;
export type TrackBundleFile = z.infer<typeof TrackBundleFileSchema>;

export interface ParsedTrackBundle extends TrackBundle {
  profile: TrackProfile;
  background: TrackBundleFile;
  preview?: TrackBundleFile | undefined;
  validationReport?: TrackBundleFile | undefined;
  notes?: TrackBundleFile | undefined;
}

export interface TrackBundleValidationIssue {
  code: string;
  message: string;
  path?: string | undefined;
}

export interface TrackBundleValidationReport {
  valid: boolean;
  issues: TrackBundleValidationIssue[];
}

function parseJsonInput(input: unknown): unknown {
  if (typeof input !== "string") {
    return input;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    return input;
  }
}

function isValidBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) {
    return false;
  }

  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    value,
  );
}

function majorVersion(version: string): number {
  return Number(version.split(".")[0]);
}

export function validateTrackBundle(input: unknown): TrackBundleValidationReport {
  const parsedInput = parseJsonInput(input);
  const result = TrackBundleSchema.safeParse(parsedInput);

  if (!result.success) {
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        code: "BUNDLE_SCHEMA_INVALID",
        message: issue.message,
        path: issue.path.join(".") || undefined,
      })),
    };
  }

  const bundle = result.data;
  const issues: TrackBundleValidationIssue[] = [];
  const profileFile = bundle.files.find(
    (file) => file.path === "track.profile.json",
  );
  const backgroundFiles = bundle.files.filter((file) =>
    file.contentType.startsWith("image/"),
  );

  if (majorVersion(bundle.version) !== SUPPORTED_BUNDLE_MAJOR) {
    issues.push({
      code: "BUNDLE_VERSION_UNSUPPORTED",
      message: `Track bundle version ${bundle.version} is not supported.`,
      path: "version",
    });
  }

  if (profileFile === undefined) {
    issues.push({
      code: "BUNDLE_PROFILE_MISSING",
      message: "track.profile.json is required.",
      path: "files",
    });
  }

  if (backgroundFiles.length === 0) {
    issues.push({
      code: "BUNDLE_BACKGROUND_MISSING",
      message: "A background image is required.",
      path: "files",
    });
  }

  for (const file of bundle.files) {
    if (file.encoding === "base64" && !isValidBase64(file.content)) {
      issues.push({
        code: "BUNDLE_BASE64_INVALID",
        message: `${file.path} contains invalid Base64 data.`,
        path: `files.${bundle.files.indexOf(file)}.content`,
      });
    }
  }

  if (profileFile !== undefined) {
    try {
      const profile = parseTrackProfile(profileFile.content);
      if (profile.status !== "published") {
        issues.push({
          code: "BUNDLE_PROFILE_NOT_PUBLISHED",
          message: "Race Live only accepts published Track Profiles.",
          path: "files.track.profile.json.status",
        });
      }
      if (
        profile.trackId !== bundle.trackId ||
        profile.version !== bundle.trackVersion
      ) {
        issues.push({
          code: "BUNDLE_PROFILE_ID_MISMATCH",
          message: "Bundle identity does not match track.profile.json.",
          path: "trackId",
        });
      }
      if (
        backgroundFiles.length > 0 &&
        !backgroundFiles.some(
          (file) => file.path === profile.background.fileName,
        )
      ) {
        issues.push({
          code: "BUNDLE_BACKGROUND_MISMATCH",
          message: "Profile background file is not present in the bundle.",
          path: "files",
        });
      }
    } catch (error) {
      issues.push({
        code: "BUNDLE_PROFILE_INVALID",
        message:
          error instanceof Error ? error.message : "Track Profile is invalid.",
        path: "files.track.profile.json",
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function parseTrackBundle(input: unknown): ParsedTrackBundle {
  const parsedInput = parseJsonInput(input);
  const schemaResult = TrackBundleSchema.safeParse(parsedInput);
  const report = validateTrackBundle(parsedInput);

  if (!schemaResult.success || !report.valid) {
    throw new TrackProfileValidationError(
      `Invalid Track Bundle: ${report.issues
        .map((issue) => `${issue.path ?? "bundle"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const bundle = schemaResult.data;
  const profileFile = bundle.files.find(
    (file) => file.path === "track.profile.json",
  )!;
  const profile = parseTrackProfile(profileFile.content);
  const background = bundle.files.find(
    (file) =>
      file.path === profile.background.fileName &&
      file.contentType.startsWith("image/"),
  )!;

  return {
    ...bundle,
    profile,
    background,
    preview: bundle.files.find((file) => file.path.startsWith("preview.")),
    validationReport: bundle.files.find(
      (file) => file.path === "validation-report.json",
    ),
    notes: bundle.files.find((file) => file.path === "notes.md"),
  };
}

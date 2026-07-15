import { TrackProfileSchema, type TrackProfile } from "./schema";
import { validateTrackProfile } from "./validation";

export class TrackProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackProfileValidationError";
  }
}

function parseJsonInput(input: unknown): unknown {
  if (typeof input !== "string") {
    return input;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    throw new TrackProfileValidationError(
      "Track Profile JSON could not be parsed.",
    );
  }
}

export function parseTrackProfile(input: unknown): TrackProfile {
  const parsedInput = parseJsonInput(input);
  const result = TrackProfileSchema.safeParse(parsedInput);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "profile";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw new TrackProfileValidationError(`Invalid Track Profile: ${details}`);
  }

  const report = validateTrackProfile(result.data);
  if (!report.valid) {
    throw new TrackProfileValidationError(
      `Invalid Track Profile: ${report.issues
        .map((issue) => `${issue.path ?? "profile"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  return result.data;
}

export function serializeTrackProfile(profile: TrackProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function assertTrackProfileEditable(profile: TrackProfile): void {
  if (profile.status === "published" || profile.status === "archived") {
    throw new TrackProfileValidationError(
      `Track Profile ${profile.trackId}@${profile.version} is immutable while ${profile.status}.`,
    );
  }
}

export function clonePublishedAsDraft(
  profile: TrackProfile,
  version: string,
  timestamp: string,
): TrackProfile {
  if (profile.status !== "published" && profile.status !== "archived") {
    throw new TrackProfileValidationError(
      "Only published or archived profiles can be cloned as a new version.",
    );
  }

  const editableFields = structuredClone(profile);
  delete editableFields.publishedAt;

  return parseTrackProfile({
    ...editableFields,
    version,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

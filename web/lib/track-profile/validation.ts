import type { ZodIssue } from "zod";
import { TrackProfileSchema, type TrackProfile } from "./schema";

export type TrackValidationSeverity = "error" | "warning";

export interface TrackValidationIssue {
  code: string;
  severity: TrackValidationSeverity;
  message: string;
  path?: string | undefined;
}

export interface TrackValidationReport {
  valid: boolean;
  issues: TrackValidationIssue[];
}

function zodIssueCode(issue: ZodIssue): string {
  const path = issue.path.join(".");

  if (path === "lanes" && issue.code === "too_small") {
    return "LANE_COUNT";
  }

  if (path.endsWith(".s") || path === "startFinish.s") {
    return "INVALID_NORMALIZED_POSITION";
  }

  if (path === "centerline.points" && issue.code === "too_small") {
    return "CENTERLINE_POINT_COUNT";
  }

  return "SCHEMA_VALIDATION";
}

function collectDuplicateIssues(
  profile: TrackProfile,
): TrackValidationIssue[] {
  const issues: TrackValidationIssue[] = [];
  const laneOffsets = new Set<number>();
  const laneIds = new Set<string>();
  const displayOrders = new Set<number>();

  profile.lanes.forEach((lane, index) => {
    if (laneOffsets.has(lane.offset)) {
      issues.push({
        code: "DUPLICATE_LANE_OFFSET",
        severity: "error",
        message: `Lane offset ${lane.offset} is duplicated.`,
        path: `lanes.${index}.offset`,
      });
    }
    laneOffsets.add(lane.offset);

    if (laneIds.has(lane.laneId)) {
      issues.push({
        code: "DUPLICATE_LANE_ID",
        severity: "error",
        message: `Lane id ${lane.laneId} is duplicated.`,
        path: `lanes.${index}.laneId`,
      });
    }
    laneIds.add(lane.laneId);

    if (displayOrders.has(lane.displayOrder)) {
      issues.push({
        code: "DUPLICATE_LANE_ORDER",
        severity: "error",
        message: `Lane display order ${lane.displayOrder} is duplicated.`,
        path: `lanes.${index}.displayOrder`,
      });
    }
    displayOrders.add(lane.displayOrder);
  });

  return issues;
}

export function validateTrackProfile(input: unknown): TrackValidationReport {
  const result = TrackProfileSchema.safeParse(input);

  if (!result.success) {
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        code: zodIssueCode(issue),
        severity: "error",
        message: issue.message,
        path: issue.path.join(".") || undefined,
      })),
    };
  }

  const issues = collectDuplicateIssues(result.data);
  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

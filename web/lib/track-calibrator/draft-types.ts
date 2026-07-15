import { z } from "zod";
import { TrackProfileSchema, type TrackProfile } from "../track-profile";

export const CalibratorValidationReportSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  valid: z.boolean(),
  issues: z.array(z.object({ code: z.string(), message: z.string(), path: z.string().optional() }).strict())
}).strict();

export type CalibratorValidationReport = z.infer<typeof CalibratorValidationReportSchema>;

export const CalibratorDraftSchema = z.object({
  draftId: z.string().trim().min(1),
  raceId: z.string().trim().min(1).optional(),
  publishRequestId: z.string().trim().min(8).optional(),
  profile: TrackProfileSchema,
  backgroundAssetId: z.string().trim().min(1),
  validationReport: CalibratorValidationReportSchema.nullable(),
  savedAt: z.string().datetime({ offset: true })
}).strict();

export type CalibratorDraft = Omit<z.infer<typeof CalibratorDraftSchema>, "profile"> & { profile: TrackProfile };

export function serializeCalibratorDraft(draft: CalibratorDraft): string {
  return JSON.stringify(CalibratorDraftSchema.parse(draft));
}

export function parseCalibratorDraft(input: unknown): CalibratorDraft {
  return CalibratorDraftSchema.parse(typeof input === "string" ? JSON.parse(input) : input);
}

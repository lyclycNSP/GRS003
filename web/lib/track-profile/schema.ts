import { z } from "zod";

const nonEmptyId = z.string().trim().min(1);
const isoDateTime = z.string().datetime({ offset: true });
const finiteNumber = z.number().finite();
const normalizedPosition = z.number().min(0).max(1);

export const PointSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict();

export const ViewBoxSchema = z
  .object({
    width: finiteNumber.positive(),
    height: finiteNumber.positive(),
  })
  .strict();

export const BackgroundAssetSchema = z
  .object({
    assetId: nonEmptyId,
    fileName: z.string().trim().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    checksum: z.string().trim().min(1),
  })
  .strict();

export const CenterlineSchema = z
  .object({
    type: z.literal("polyline"),
    closed: z.literal(true),
    points: z.array(PointSchema).min(4),
    smoothing: z.number().min(0).max(1),
  })
  .strict();

export const StartFinishSchema = z
  .object({
    s: normalizedPosition.refine((value) => value < 1, {
      message: "startFinish.s must be less than 1 for a closed track",
    }),
    startDisplayOffset: finiteNumber,
    finishDisplayOffset: finiteNumber,
  })
  .strict();

export const LaneDefinitionSchema = z
  .object({
    laneId: nonEmptyId,
    offset: finiteNumber,
    displayOrder: z.number().int().positive(),
  })
  .strict();

export const CheckpointSchema = z
  .object({
    checkpointId: nonEmptyId,
    label: z.string().trim().min(1),
    s: normalizedPosition,
  })
  .strict();

export const MessageZoneSchema = z
  .object({
    zoneId: nonEmptyId,
    polygon: z.array(PointSchema).min(3),
    priority: z.number().int().nonnegative(),
  })
  .strict();

export const NoBubbleZoneSchema = z
  .object({
    zoneId: nonEmptyId,
    polygon: z.array(PointSchema).min(3),
    reason: z.string().trim().min(1).optional(),
  })
  .strict();

export const TrackProfileStatusSchema = z.enum([
  "draft",
  "validated",
  "published",
  "archived",
]);

export const TrackProfileSchema = z
  .object({
    schemaVersion: z.string().trim().min(1),
    trackId: nonEmptyId,
    version: z.string().trim().min(1),
    name: z.string().trim().min(1),
    status: TrackProfileStatusSchema,
    viewBox: ViewBoxSchema,
    background: BackgroundAssetSchema,
    centerline: CenterlineSchema,
    direction: z.enum(["clockwise", "counterclockwise"]),
    startFinish: StartFinishSchema,
    lanes: z.array(LaneDefinitionSchema).min(8),
    checkpoints: z.array(CheckpointSchema),
    messageZones: z.array(MessageZoneSchema),
    noBubbleZones: z.array(NoBubbleZoneSchema),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    publishedAt: isoDateTime.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.status === "published" || value.status === "archived") &&
      value.publishedAt === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "publishedAt is required for published or archived profiles",
        path: ["publishedAt"],
      });
    }

    if (
      (value.status === "draft" || value.status === "validated") &&
      value.publishedAt !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "publishedAt is only valid for published or archived profiles",
        path: ["publishedAt"],
      });
    }
  });

export type Point = z.infer<typeof PointSchema>;
export type TrackProfile = z.infer<typeof TrackProfileSchema>;
export type TrackProfileStatus = z.infer<typeof TrackProfileStatusSchema>;

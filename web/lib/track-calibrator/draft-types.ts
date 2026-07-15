import { z } from "zod";
import { TrackProfileSchema, type TrackProfile } from "../track-profile";

export const CalibratorValidationReportSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  valid: z.boolean(),
  issues: z.array(z.object({ code: z.string(), message: z.string(), path: z.string().optional() }).strict())
}).strict();

export type CalibratorValidationReport = z.infer<typeof CalibratorValidationReportSchema>;

export const MANUAL_VALIDATION_ITEMS = [
  { id: "single_horse_path", label: "单匹马从 0% 到 100% 始终位于合理赛道区域" },
  { id: "natural_turn_rotation", label: "弯道旋转自然，没有明显跳变" },
  { id: "eight_horse_overlap", label: "8 匹马同时运行时没有不可接受的重叠" },
  { id: "start_finish_spacing", label: "起点和终点展示分离符合大屏视觉预期" },
  { id: "minimap_alignment", label: "小地图位置与主赛道同源且方向一致" },
  { id: "bubble_candidate_visibility", label: "气泡不遮挡 Header、TOP3、KPI 和 Ticker" },
  { id: "asset_alignment", label: "背景、中心线、车道和起终点肉眼对齐" },
  { id: "layout_stability", label: "16:9 大屏缩放后布局稳定" },
] as const;

export type ManualValidationKey = (typeof MANUAL_VALIDATION_ITEMS)[number]["id"];

const ManualConfirmationsSchema = z.object({
  single_horse_path: z.boolean(),
  natural_turn_rotation: z.boolean(),
  eight_horse_overlap: z.boolean(),
  start_finish_spacing: z.boolean(),
  minimap_alignment: z.boolean(),
  bubble_candidate_visibility: z.boolean(),
  asset_alignment: z.boolean(),
  layout_stability: z.boolean(),
}).strict();

export function createManualValidationState() {
  return {
    confirmations: Object.fromEntries(MANUAL_VALIDATION_ITEMS.map((item) => [item.id, false])) as Record<ManualValidationKey, boolean>,
    notes: "",
  };
}

export const ManualValidationSchema = z.object({
  confirmations: ManualConfirmationsSchema,
  notes: z.string().max(4000),
  confirmedAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export type ManualValidationState = z.infer<typeof ManualValidationSchema>;

export const CalibratorDraftSchema = z.object({
  draftId: z.string().trim().min(1),
  raceId: z.string().trim().min(1).optional(),
  publishRequestId: z.string().trim().min(8).optional(),
  profile: TrackProfileSchema,
  backgroundAssetId: z.string().trim().min(1),
  validationReport: CalibratorValidationReportSchema.nullable(),
  manualValidation: ManualValidationSchema.default(createManualValidationState()),
  savedAt: z.string().datetime({ offset: true })
}).strict();

export type CalibratorDraft = Omit<z.infer<typeof CalibratorDraftSchema>, "profile"> & { profile: TrackProfile };

export function serializeCalibratorDraft(draft: CalibratorDraft): string {
  return JSON.stringify(CalibratorDraftSchema.parse(draft));
}

export function parseCalibratorDraft(input: unknown): CalibratorDraft {
  return CalibratorDraftSchema.parse(typeof input === "string" ? JSON.parse(input) : input);
}

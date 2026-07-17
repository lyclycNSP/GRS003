export const CURRENT_TERMS_VERSION = "2026-07-15";
export const CURRENT_PRIVACY_VERSION = "2026-07-15";

export function optionalText(value: string | undefined, maxLength: number, label: string): string | null {
  const normalized = value?.trim() ?? "";
  if (normalized.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return normalized || null;
}

export function requiredText(value: string | undefined, minLength: number, maxLength: number, label: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length < minLength) throw new Error(`${label}至少需要 ${minLength} 个字符`);
  if (normalized.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return normalized;
}

export function optionalHttpUrl(value: string | undefined, label: string): string | null {
  const normalized = optionalText(value, 500, label);
  if (!normalized) return null;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${label}必须是完整网址`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${label}只支持 http 或 https`);
  return parsed.toString();
}

export function parseTags(value: string | undefined, min: number, max: number, label: string): string[] {
  const tags = (value ?? "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
  if (tags.length < min) throw new Error(`${label}至少需要 ${min} 个`);
  if (tags.length > max) throw new Error(`${label}不能超过 ${max} 个`);
  if (tags.some((item) => item.length > 40)) throw new Error(`单个${label}不能超过 40 个字符`);
  return tags;
}

import { optionalHttpUrl, optionalText, parseTags, requiredText } from "@/lib/profile";

export type SelectableRole = "rider" | "judge" | "organizer";
export type RoleProfileInput = Record<string, string | boolean | undefined>;

export function isSelectableRole(value: string): value is SelectableRole {
  return value === "rider" || value === "judge" || value === "organizer";
}

export function validateRoleProfile(role: SelectableRole, input: RoleProfileInput) {
  if (role === "rider") {
    const linkedin = optionalHttpUrl(String(input.linkedinUrl ?? ""), "LinkedIn 链接");
    const x = optionalHttpUrl(String(input.xUrl ?? ""), "X 链接");
    return { role, data: {
      headline: requiredText(String(input.headline ?? ""), 2, 80, "身份简介"),
      skillsJson: JSON.stringify(parseTags(String(input.skills ?? ""), 1, 20, "技能标签")),
      bio: optionalText(String(input.bio ?? ""), 160, "个人简介"),
      countryCode: optionalText(String(input.countryCode ?? ""), 80, "国家/地区"),
      city: optionalText(String(input.city ?? ""), 80, "城市"),
      organization: optionalText(String(input.organization ?? ""), 120, "组织或学校"),
      websiteUrl: optionalHttpUrl(String(input.websiteUrl ?? ""), "作品集网址"),
      socialLinksJson: JSON.stringify({ ...(linkedin ? { linkedin } : {}), ...(x ? { x } : {}) }),
      completedAt: new Date()
    }} as const;
  }
  if (role === "judge") {
    const yearsRaw = String(input.yearsExperience ?? "").trim();
    const yearsExperience = yearsRaw ? Number(yearsRaw) : null;
    if (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60)) {
      throw new Error("从业年限必须是 0–60 的整数");
    }
    if (!input.conflictConfirmed) throw new Error("必须确认利益冲突声明");
    return { role, data: {
      organization: requiredText(String(input.organization ?? ""), 2, 120, "组织"),
      title: requiredText(String(input.title ?? ""), 2, 80, "职务"),
      expertiseJson: JSON.stringify(parseTags(String(input.expertise ?? ""), 1, 20, "专长标签")),
      reviewBio: requiredText(String(input.reviewBio ?? ""), 20, 500, "评审背景"),
      yearsExperience,
      credentialUrl: optionalHttpUrl(String(input.credentialUrl ?? ""), "资质或作品链接"),
      conflictConfirmedAt: new Date(),
      completedAt: new Date()
    }} as const;
  }
  return { role, data: {
    organizationName: requiredText(String(input.organizationName ?? ""), 2, 120, "机构名称"),
    position: requiredText(String(input.position ?? ""), 2, 80, "职位"),
    eventCategoriesJson: JSON.stringify(parseTags(String(input.eventCategories ?? ""), 1, 10, "赛事类别")),
    organizerBio: requiredText(String(input.organizerBio ?? ""), 20, 500, "组织背景"),
    organizationWebsite: optionalHttpUrl(String(input.organizationWebsite ?? ""), "机构网站"),
    completedAt: new Date()
  }} as const;
}

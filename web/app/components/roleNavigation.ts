import type { AppIconName } from "@/app/components/AppIcon";
import type { Role } from "@/lib/auth";

export type RoleNavigationItem = {
  label: string;
  href: string;
  icon: AppIconName;
  match: "exact" | "prefix";
};

export type RoleNavigationGroup = {
  label?: string;
  items: RoleNavigationItem[];
};

export type RaceNavigationContext = {
  raceId: string;
};

const item = (
  label: string,
  href: string,
  icon: AppIconName,
  match: RoleNavigationItem["match"] = "exact"
): RoleNavigationItem => ({ label, href, icon, match });

function organizerRaceGroup(context: RaceNavigationContext | null): RoleNavigationGroup[] {
  if (!context) return [];
  const raceId = encodeURIComponent(context.raceId);
  return [{
    label: "当前 Race",
    items: [
      item("Race Workspace", `/console/organizer/races/${raceId}`, "dashboard", "prefix"),
      item("Risk Center", `/console/risk-center?raceId=${raceId}`, "alert", "prefix"),
      item("Screen Console", `/screen?raceId=${raceId}`, "screen", "prefix"),
      item("Track Management", `/console/tracks?raceId=${raceId}`, "track", "prefix"),
      item("Ops", `/ops?raceId=${raceId}`, "settings", "prefix")
    ]
  }];
}

function judgeContextGroup(pathname: string, context: RaceNavigationContext | null): RoleNavigationGroup[] {
  const groups: RoleNavigationGroup[] = [];
  const judgeWork = pathname.match(/^\/works\/([^/]+)\/judge(?:\/|$)/);
  if (judgeWork) {
    groups.push({
      label: "当前评审",
      items: [item("Judge View", `/works/${judgeWork[1]}/judge`, "shield", "prefix")]
    });
  }
  if (context) {
    groups.push({
      label: "评审上下文",
      items: [item("Risk Center", `/console/risk-center?raceId=${encodeURIComponent(context.raceId)}`, "alert", "prefix")]
    });
  }
  return groups;
}

export function getRoleNavigation(
  role: Role,
  pathname: string,
  raceContext: RaceNavigationContext | null
): RoleNavigationGroup[] {
  if (role === "rider") {
    return [
      { items: [item("工作台", "/console/rider", "dashboard", "prefix"), item("我的风险", "/console/risk-center", "alert", "prefix")] },
      { label: "个人", items: [
        item("Rider 资料", "/onboarding/rider", "user", "prefix"),
        item("账号设置", "/profile", "settings", "prefix")
      ] }
    ];
  }

  if (role === "organizer") {
    return [
      { items: [
        item("我的赛事", "/console/organizer", "dashboard")
      ] },
      ...organizerRaceGroup(raceContext),
      { label: "个人", items: [
        item("Organizer 资料", "/onboarding/organizer", "building", "prefix"),
        item("账号设置", "/profile", "settings", "prefix")
      ] }
    ];
  }

  if (role === "judge") {
    return [
      { items: [item("工作台与评审任务", "/console/judge", "dashboard", "prefix"), item("评审风险", "/console/risk-center", "alert", "prefix")] },
      ...judgeContextGroup(pathname, raceContext),
      { label: "个人", items: [
        item("Judge 资料", "/onboarding/judge", "shield", "prefix"),
        item("账号设置", "/profile", "settings", "prefix")
      ] }
    ];
  }

  return [
    { items: [
      item("管理工作台", "/console/admin", "dashboard"),
      item("风险治理", "/console/risk-center", "alert", "prefix"),
      item("角色申请", "/console/admin#applications", "role"),
      item("用户与资格", "/console/admin#users", "riders")
    ] },
    { label: "个人", items: [item("账号设置", "/profile", "settings", "prefix")] }
  ];
}

export function isNavigationItemActive(
  item: RoleNavigationItem,
  pathname: string,
  currentRaceId: string | null
) {
  const [itemPath, itemQuery = ""] = item.href.split("?");
  const pathMatches = item.match === "prefix"
    ? pathname === itemPath || pathname.startsWith(`${itemPath}/`)
    : pathname === itemPath;
  if (!pathMatches) return false;
  const expectedRaceId = new URLSearchParams(itemQuery).get("raceId");
  return !expectedRaceId || expectedRaceId === currentRaceId;
}

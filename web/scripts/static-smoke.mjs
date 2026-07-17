import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function expectFile(relativePath) {
  read(relativePath);
}

function expectIncludes(relativePath, patterns) {
  const text = read(relativePath);
  for (const pattern of patterns) {
    if (!text.includes(pattern)) {
      failures.push(`missing "${pattern}" in ${relativePath}`);
    }
  }
}

function expectBalancedCss(relativePath) {
  const text = read(relativePath);
  let balance = 0;
  for (const character of text) {
    if (character === "{") balance += 1;
    if (character === "}") balance -= 1;
    if (balance < 0) {
      failures.push(`css closes before opening in ${relativePath}`);
      return;
    }
  }
  if (balance !== 0) failures.push(`css brace imbalance ${balance} in ${relativePath}`);
}

const routeFiles = [
  "app/page.tsx",
  "app/console/page.tsx",
  "app/console/RoleWorkspace.tsx",
  "app/console/rider/page.tsx",
  "app/console/judge/page.tsx",
  "app/console/organizer/page.tsx",
  "app/console/organizer/races/[raceId]/page.tsx",
  "app/console/admin/page.tsx",
  "app/console/risk-center/page.tsx",
  "app/profile/page.tsx",
  "app/role-switch/page.tsx",
  "app/onboarding/role/page.tsx",
  "app/onboarding/[role]/page.tsx",
  "app/onboarding/status/page.tsx",
  "app/ops/page.tsx",
  "app/debug-login/page.tsx",
  "app/screen/page.tsx",
  "app/screen/display/page.tsx",
  "app/cooperation/page.tsx",
  "app/races/[slug]/page.tsx",
  "app/races/[slug]/live/page.tsx",
  "app/races/[slug]/works/page.tsx",
  "app/races/[slug]/results/page.tsx",
  "app/races/[slug]/review/page.tsx",
  "app/works/page.tsx",
  "app/works/[slug]/page.tsx",
  "app/works/[slug]/judge/page.tsx",
  "app/works/[slug]/demo/page.tsx",
  "app/riders/[id]/page.tsx"
];

const apiFiles = [
  "app/api/auth/github/route.ts",
  "app/api/auth/github/callback/route.ts",
  "app/api/debug/login/route.ts",
  "app/api/console/action/route.ts",
  "app/api/ca/v1/signals/route.ts",
  "app/api/public/races/route.ts",
  "app/api/public/races/[slug]/route.ts",
  "app/api/public/races/[slug]/live/route.ts",
  "app/api/public/races/[slug]/works/route.ts",
  "app/api/public/races/[slug]/results/route.ts",
  "app/api/public/races/[slug]/review/route.ts",
  "app/api/public/races/[slug]/screen/route.ts",
  "app/api/public/works/route.ts",
  "app/api/public/works/[slug]/route.ts",
  "app/api/public/riders/[id]/route.ts"
  ,"app/api/console/races/route.ts"
  ,"app/api/console/races/[raceId]/problem-upload-intent/route.ts"
  ,"app/api/console/races/[raceId]/problem-versions/route.ts"
  ,"app/api/console/races/[raceId]/problem-versions/[versionId]/publish/route.ts"
  ,"app/api/race-problems/[versionId]/download/route.ts"
  ,"app/api/github-app/install/route.ts"
  ,"app/api/github-app/callback/route.ts"
  ,"app/api/admin/race-problems/[versionId]/disable/route.ts"
];

for (const file of routeFiles) expectFile(file);
for (const file of apiFiles) expectFile(file);
for (const file of [
  "playwright.config.ts",
  "e2e/judge.spec.ts",
  "e2e/public.spec.ts",
  "e2e/screen.spec.ts",
  "e2e/rider.spec.ts",
  "e2e/organizer.spec.ts",
  "e2e/admin.spec.ts",
  "e2e/security.spec.ts",
  "e2e/role-switch.spec.ts",
  "scripts/e2e-prepare.mjs"
]) expectFile(file);
expectFile("../.github/workflows/web-ci.yml");
expectIncludes("../.github/workflows/web-ci.yml", [
  "actions/checkout@v7",
  "actions/setup-node@v6",
  "actions/setup-python@v6",
  "actions/upload-artifact@v7",
  "npm run test:e2e",
  "npm run typecheck",
  "npm run build"
]);

expectIncludes("package.json", [
  "test:e2e",
  "test:e2e:judge",
  "test:e2e:public",
  "test:e2e:screen",
  "test:e2e:rider",
  "test:e2e:organizer",
  "test:e2e:admin",
  "test:e2e:security",
  "typecheck"
]);

expectIncludes(".env.example", [
  "DATABASE_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "CA_CONNECTOR_KEYS",
  "DEFAULT_CA_CONNECTOR_ID",
  "NEXT_PUBLIC_APP_URL"
]);

expectIncludes("prisma/schema.prisma", [
  "model User",
  "model UserRole",
  "model RoleApplication",
  "model RiderProfile",
  "model JudgeProfile",
  "model OrganizerProfile",
  "model Race",
  "model Registration",
  "model RaceProject",
  "model CAConnection",
  "model Work",
  "model JudgeAssignment",
  "model JudgingRecord",
  "model Award",
  "model Report",
  "model Projection",
  "model ScreenState",
  "@@unique([raceId, userId])",
  "@@unique([raceProjectId, connectorId, externalProjectRef])"
]);

expectIncludes("lib/auth.ts", [
  "ary_session",
  "profileCompleted",
  "availableRoles",
  "activeRole",
  "managedRaceIds",
  "approvedRegistrationIds",
  "assignedWorkIds",
  "requireManagedRace"
]);

expectIncludes("app/api/debug/login/route.ts", [
  "ENABLE_DEBUG_LOGIN",
  "user_org_1",
  "user_rider_1",
  "user_judge_1",
  "setSession",
  "Debug login is disabled"
]);

expectIncludes("app/debug-login/page.tsx", [
  "Debug Login",
  "/api/debug/login?user=organizer",
  "/api/debug/login?user=rider",
  "/api/debug/login?user=judge",
  "/api/debug/login?user=admin"
]);

expectIncludes("app/console/RoleWorkspace.tsx", [
  'role === "organizer"',
  "Rider View",
  "Judge View",
  "Risk Center",
  "Screen Console",
  "LifecycleStepper",
  "StatusSummary",
  "StatRail",
  "Verified by OCR / connector",
  "Approve + RaceProject",
  "connectorId",
  "接入合法 CA Signal",
  "发布 Award",
  "重建 Projection",
  "rider-signal-form",
  "rider-work-form"
]);

expectIncludes("app/console/organizer/page.tsx", [
  "organizer-portfolio",
  "Owner",
  "Collaborator",
  "/console/organizer/races/"
]);
expectIncludes("app/console/organizer/CreateRaceSecureForm.tsx", ["organizer-race-create-form", "race-problem-file"]);

expectIncludes("app/console/organizer/races/[raceId]/page.tsx", [
  "managedRaceIds.includes",
  "notFound()",
  "RoleWorkspacePage"
]);

expectIncludes("app/races/[slug]/page.tsx", [
  "registration-message",
  "registration-state",
  "RaceRegistrationDialog",
  "registrationCount"
]);

expectIncludes("app/races/[slug]/RaceRegistrationDialog.tsx", [
  "registration-dialog",
  "registration-submit",
  "team-create-submit",
  "team-join-submit"
]);

expectIncludes("app/console/admin/page.tsx", [
  "账号与角色资格管理",
  "reviewRoleApplicationAction",
  "setUserRoleStatusAction",
  "admin-user-"
]);

expectIncludes("app/components/SiteChrome.tsx", [
  "publicRoute",
  "工作台",
  "returnPath"
]);

expectIncludes("app/components/RoleSwitcher.tsx", [
  "switchActiveRoleAction",
  "role-switcher",
  "管理或申请角色"
]);

expectIncludes("app/console/risk-center/page.tsx", [
  "风险评审中心",
  "Organizer 处置席",
  "Rider 整改席",
  "Judge 评审上下文",
  "updateReviewFlagStatusAction",
  "StatusSummary",
  "StatRail",
  "risk-quick-filters",
  "sourceLabel",
  "formatTime"
]);

expectIncludes("app/ops/page.tsx", [
  "StatusSummary",
  "StatRail",
  "Release readiness",
  "Next action"
]);

expectIncludes("app/screen/page.tsx", [
  "screen-preview-card",
  "Current output",
  "modeSummary"
]);

expectIncludes("lib/ca-attestation.ts", [
  "createHmac",
  "ocr_desktop_app",
  "registered_ca_connector",
  "timingSafeEqual",
  "CA信号HMAC校验失败"
]);

expectIncludes("app/actions.ts", [
  "createRidingSignalAttestation",
  "浏览器模拟CA信号在生产环境中已禁用"
]);

expectIncludes("app/ops/page.tsx", [
  "Run P0 Regression",
  "Release Checklist",
  "Mark Canary Ready",
  "Mark Production Released",
  "Record Go / No-Go",
  "Create Backup"
]);

expectIncludes("app/screen/page.tsx", [
  "Display Mode",
  "fallback",
  "Projection Health",
  "打开 Screen Display",
  "screen-current-mode",
  "screen-fallback-toggle"
]);

expectIncludes("app/works/[slug]/judge/page.tsx", [
  "getAuthContext",
  "assignedWorkIds.includes",
  "judge-save-confirmation"
]);

expectIncludes("scripts/generate-sqlite-client.mjs", [
  "process.execPath",
  '"node_modules", "prisma", "build", "index.js"'
]);

expectBalancedCss("app/globals.css");

expectIncludes("app/globals.css", [
  ".console-flow-strip",
  ".console-signal-bar",
  ".release-readiness-panel",
  ".status-pill",
  ".ca-attestation-panel",
  ".screen-preview-card",
  ".risk-flag-grid",
  ".risk-center-page",
  ".risk-quick-filters",
  ".risk-card-actions"
]);

if (failures.length > 0) {
  console.error("STATIC SMOKE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("STATIC SMOKE PASSED");
console.log(`Checked ${routeFiles.length} route pages and ${apiFiles.length} API routes.`);

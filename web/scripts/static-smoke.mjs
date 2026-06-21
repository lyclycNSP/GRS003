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
  "app/profile/page.tsx",
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
  "app/riders/[id]/page.tsx"
];

const apiFiles = [
  "app/api/auth/github/route.ts",
  "app/api/auth/github/callback/route.ts",
  "app/api/debug/login/route.ts",
  "app/api/console/action/route.ts",
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
];

for (const file of routeFiles) expectFile(file);
for (const file of apiFiles) expectFile(file);

expectIncludes(".env.example", [
  "DATABASE_URL",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "AUTH_SECRET",
  "NEXT_PUBLIC_APP_URL"
]);

expectIncludes("prisma/schema.prisma", [
  "model User",
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
  "Debug Role Login",
  "/api/debug/login?user=organizer",
  "/api/debug/login?user=rider",
  "/api/debug/login?user=judge",
  "/api/debug/login?user=admin"
]);

expectIncludes("app/console/page.tsx", [
  "Organizer View",
  "Rider View",
  "Judge View",
  "Admin Console",
  "Screen Console",
  "href=\"/screen\"",
  "console-flow-strip",
  "console-signal-bar",
  "ca-attestation-panel",
  "Verified by OCR / connector",
  "Approve + RaceProject",
  "connectorId",
  "接入合法 CA Signal",
  "发布 Award",
  "重建 Projection"
]);

expectIncludes("app/ops/page.tsx", [
  "release-readiness-panel",
  "Release readiness",
  "Next action"
]);

expectIncludes("app/screen/page.tsx", [
  "screen-preview-card",
  "Current output",
  "modeSummary"
]);

expectIncludes("lib/domain.ts", [
  "attestation",
  "ocr_desktop_app",
  "registered_ca_connector",
  "dev-signature",
  "CA信号签名校验失败"
]);

expectIncludes("app/actions.ts", [
  "attestation",
  "dev-signature"
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
  "打开 Screen Display"
]);

expectBalancedCss("app/globals.css");

expectIncludes("app/globals.css", [
  ".console-flow-strip",
  ".console-signal-bar",
  ".release-readiness-panel",
  ".status-pill",
  ".ca-attestation-panel",
  ".screen-preview-card"
]);

if (failures.length > 0) {
  console.error("STATIC SMOKE FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("STATIC SMOKE PASSED");
console.log(`Checked ${routeFiles.length} route pages and ${apiFiles.length} API routes.`);

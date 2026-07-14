import assert from "node:assert/strict";
import {
  createWorkSubmissionIntegrityHash,
  getSubmissionWindowState,
  validateWorkSubmissionInput
} from "../lib/work-submission";

type TestCase = { name: string; run: () => void | Promise<void> };

const cases: TestCase[] = [];

function test(name: string, run: TestCase["run"]) {
  cases.push({ name, run });
}

const validInput = {
  title: "Immutable Route Agent",
  summary: "Pins the reviewed source to one Git commit.",
  demoUrl: "https://demo.example.com/route-agent",
  repoUrl: "https://github.com/example/route-agent",
  repoCommitSha: "A".repeat(40)
};

test("normalizes a valid GitHub submission", () => {
  const result = validateWorkSubmissionInput(validInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.repoCommitSha, "a".repeat(40));
  assert.equal(result.data.repoUrl, "https://github.com/example/route-agent");
});

for (const [name, patch] of [
  ["non GitHub repository", { repoUrl: "https://gitlab.com/example/route-agent" }],
  ["repository query", { repoUrl: "https://github.com/example/route-agent?ref=main" }],
  ["encoded repository separator", { repoUrl: "https://github.com/example/route%2Fagent" }],
  ["short commit SHA", { repoCommitSha: "abc123" }],
  ["HTTP demo", { demoUrl: "http://demo.example.com/app" }],
  ["localhost demo", { demoUrl: "https://localhost/app" }],
  ["private IPv4 demo", { demoUrl: "https://192.168.1.5/app" }],
  ["loopback IPv6 demo", { demoUrl: "https://[::1]/app" }],
  ["IPv4-mapped loopback demo", { demoUrl: "https://[::ffff:127.0.0.1]/app" }],
  ["multicast IPv6 demo", { demoUrl: "https://[ff02::1]/app" }]
] as const) {
  test(`rejects ${name}`, () => {
    const result = validateWorkSubmissionInput({ ...validInput, ...patch });
    assert.equal(result.ok, false);
  });
}

test("computes submission window states in priority order", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");
  const base = {
    submissionOpensAt: new Date("2026-07-14T10:00:00.000Z"),
    submissionClosesAt: new Date("2026-07-14T14:00:00.000Z"),
    submissionLockedAt: null
  };
  assert.equal(getSubmissionWindowState(base, false, now), "open");
  assert.equal(getSubmissionWindowState({ ...base, submissionOpensAt: new Date("2026-07-14T13:00:00.000Z") }, false, now), "not_started");
  assert.equal(getSubmissionWindowState({ ...base, submissionClosesAt: new Date("2026-07-14T11:00:00.000Z") }, false, now), "closed_by_deadline");
  assert.equal(getSubmissionWindowState({ ...base, submissionLockedAt: new Date("2026-07-14T11:30:00.000Z") }, false, now), "closed_manually");
  assert.equal(getSubmissionWindowState(base, true, now), "sealed_for_judging");
});

test("canonical integrity hash is reproducible and content sensitive", () => {
  const payload = {
    workId: "work_1",
    registrationId: "reg_1",
    versionNumber: 1,
    title: validInput.title,
    summary: validInput.summary,
    demoUrl: validInput.demoUrl,
    repoUrl: validInput.repoUrl,
    repoCommitSha: "a".repeat(40),
    submittedByUserId: "user_1",
    submittedAt: new Date("2026-07-14T12:00:00.000Z")
  };
  const first = createWorkSubmissionIntegrityHash(payload);
  const second = createWorkSubmissionIntegrityHash(payload);
  const changed = createWorkSubmissionIntegrityHash({ ...payload, summary: "Changed summary" });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, changed);
});

async function main() {
  let failures = 0;
  for (const item of cases) {
    try {
      await item.run();
      console.log(`PASS ${item.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${item.name}`);
      console.error(error);
    }
  }
  if (failures > 0) process.exit(1);
}

void main();

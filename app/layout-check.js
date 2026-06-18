const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("app/index.html", "utf8");
const css = fs.readFileSync("app/styles.css", "utf8");

const requiredViews = ["overview", "race", "ca", "screen", "reports", "public", "ops", "admin"];
for (const view of requiredViews) {
  assert.ok(html.includes(`id="view-${view}"`), `missing view-${view}`);
}

const requiredScripts = ["./domain.js", "./app.js"];
for (const script of requiredScripts) {
  assert.ok(html.includes(`src="${script}"`), `missing script ${script}`);
}

const requiredActions = [
  'data-action="run-p0"',
  'data-action="reset-state"',
  'data-action="simulate-report-fail"',
  'data-screen-mode="fallback"',
];
for (const action of requiredActions) {
  assert.ok(html.includes(action), `missing ${action}`);
}

const requiredCss = [
  ".span-8",
  "overflow-x: auto",
  "grid-template-columns: repeat(12, minmax(0, 1fr))",
  "@media (max-width: 700px)",
  "overflow-wrap: anywhere",
];
for (const rule of requiredCss) {
  assert.ok(css.includes(rule), `missing css rule ${rule}`);
}

console.log("PASS app layout static check");

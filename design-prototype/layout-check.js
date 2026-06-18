const fs = require("fs");
const assert = require("assert");

const html = fs.readFileSync("design-prototype/index.html", "utf8");
const css = fs.readFileSync("design-prototype/styles.css", "utf8");
const script = fs.readFileSync("design-prototype/script.js", "utf8");

for (const page of ["home", "race", "live", "works", "work", "results", "review", "rider", "cooperation", "auth", "console", "screen"]) {
  assert.ok(html.includes(`data-page-panel="${page}"`), `missing page panel ${page}`);
}

assert.ok(css.includes(".page-works .module-title .module-summary"), "missing works summary layout guard");
assert.ok(css.includes(".works-toolbar"), "missing works toolbar");
assert.ok(css.includes("top: 238px"), "works toolbar should sit below summary");
assert.ok(css.includes(".work-grid") && css.includes("top: 300px"), "works grid should sit below toolbar");
assert.ok(css.includes(".page-works .asset-matrix") && css.includes("top: 300px"), "works side matrix should align with grid");

assert.ok(script.includes("setInitialPageFromHash"), "hash-based page initialization missing");

console.log("PASS design prototype layout static check");

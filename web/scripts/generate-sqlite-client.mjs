import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = path.join(root, "prisma", "schema.prisma");
const generated = path.join(root, "prisma", ".schema.sqlite.generated.prisma");
const schema = fs.readFileSync(source, "utf8").replace('provider = "postgresql"', 'provider = "sqlite"');

try {
  fs.writeFileSync(generated, schema, { mode: 0o600 });
  execFileSync("npx", ["prisma", "generate", "--schema", generated], { stdio: "inherit" });
} finally {
  fs.rmSync(generated, { force: true });
}

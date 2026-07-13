import { execFileSync } from "node:child_process";
import process from "node:process";

const env = {
  ...process.env,
  DATABASE_URL: "file:./e2e.db"
};

execFileSync(process.execPath, ["scripts/generate-sqlite-client.mjs"], { env, stdio: "inherit" });
execFileSync("python", ["scripts/init-sqlite.py"], { env, stdio: "inherit" });
execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env, stdio: "inherit" });

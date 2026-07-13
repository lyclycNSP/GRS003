import { execFileSync } from "node:child_process";
import process from "node:process";

const env = {
  ...process.env,
  DATABASE_URL: "file:./e2e.db"
};

execFileSync("python", ["scripts/init-sqlite.py"], { env, stdio: "inherit" });
execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env, stdio: "inherit" });

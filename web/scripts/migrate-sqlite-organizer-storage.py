import os
import sqlite3
from pathlib import Path

db_url = os.environ.get("DATABASE_URL", "file:./dev.db")
if not db_url.startswith("file:"):
    raise SystemExit("This helper only supports SQLite file URLs")
db_path = (Path(__file__).resolve().parent.parent / "prisma" / db_url[5:].removeprefix("./")).resolve()
connection = sqlite3.connect(db_path)
try:
    columns = {row[1] for row in connection.execute('PRAGMA table_info("RaceProblemVersion")')}
    if "storageProvider" not in columns:
        connection.execute('ALTER TABLE "RaceProblemVersion" ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT \'platform_legacy\'')
    if "storageOwnerUserId" not in columns:
        connection.execute('ALTER TABLE "RaceProblemVersion" ADD COLUMN "storageOwnerUserId" TEXT')
    connection.execute('CREATE INDEX IF NOT EXISTS "RaceProblemVersion_storageProvider_idx" ON "RaceProblemVersion"("storageProvider")')
    connection.commit()
    print(f"Applied organizer storage metadata migration to {db_path}")
finally:
    connection.close()

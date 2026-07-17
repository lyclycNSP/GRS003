import { RoleWorkspacePage } from "@/app/console/RoleWorkspace";
export default async function JudgeConsolePage({ searchParams }: { searchParams?: Promise<{ raceId?: string; action?: string; entityId?: string; actionMessage?: string; actionError?: string }> }) {
  return <RoleWorkspacePage role="judge" searchParams={searchParams} />;
}

export function resolveActiveGroup(input: {
  groupCount: number;
  activeOrder: number;
  autoRotateEnabled: boolean;
  rotationEpochAt: Date;
  intervalSeconds: number;
  now: Date;
}): number {
  if (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < 5 || input.intervalSeconds > 120) {
    throw new Error("Rotation interval must be between 5 and 120 seconds.");
  }
  if (input.groupCount <= 1) return 1;
  const base = ((Math.max(1, input.activeOrder) - 1) % input.groupCount + input.groupCount) % input.groupCount;
  if (!input.autoRotateEnabled) return base + 1;
  const elapsed = Math.max(0, input.now.getTime() - input.rotationEpochAt.getTime());
  return ((base + Math.floor(elapsed / (input.intervalSeconds * 1000))) % input.groupCount) + 1;
}

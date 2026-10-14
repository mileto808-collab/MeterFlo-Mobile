import { assertReadingData, normalizeReading, normalizeReadingData, readingFields, ReadingLimits } from "./reading-precision";

export function correctReadingData(data: Record<string, any>, readings: Record<string, string>, limits: ReadingLimits) {
  const updated = normalizeReadingData(data);
  const allowed = readingFields(data);
  for (const [field, value] of Object.entries(readings)) {
    if (!allowed.includes(field)) throw new Error(`Unknown reading field: ${field}`);
    updated[field] = normalizeReading(value);
  }
  assertReadingData(updated, limits);
  return updated;
}

export function reconcileQueuedActions<T extends { id: string }>(
  actions: T[], successfulIds: string[], conflictedIds: string[],
  rejections: Map<string, Record<string, any>>,
): T[] {
  return actions.filter(action => !successfulIds.includes(action.id) && !conflictedIds.includes(action.id))
    .map(action => rejections.has(action.id) ? { ...action, ...rejections.get(action.id) } : action);
}

/**
 * Lives for the whole wizard, not an individual input mount. Imported current
 * readings may be cleared once; captured drafts and completed readings may not.
 */
export function createFinalReadingEntry(preserveCaptured = false) {
  const entered = new Set<"system" | "module">();
  return {
    shouldClearOnFocus(field: "system" | "module", value: string): boolean {
      if (entered.has(field)) return false;
      entered.add(field);
      return !preserveCaptured && value.length > 0;
    },
    markEntered(field: "system" | "module") {
      entered.add(field);
    },
  };
}

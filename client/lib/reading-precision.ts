export interface ReadingLimits {
  systemReadingDecimalPlaces: number;
  moduleReadingDecimalPlaces: number;
}

export interface ReadingError {
  field: string;
  decimalPlaces: number;
  message: string;
}

export function readingLimits(project: Partial<ReadingLimits>): ReadingLimits {
  const limit = (value: number | null | undefined) => {
    const result = value ?? 3;
    if (!Number.isInteger(result) || result < 0 || result > 6) {
      throw new Error("Project reading precision must be an integer from 0 to 6.");
    }
    return result;
  };
  return {
    systemReadingDecimalPlaces: limit(project.systemReadingDecimalPlaces),
    moduleReadingDecimalPlaces: limit(project.moduleReadingDecimalPlaces),
  };
}

export const normalizeReading = (value: string): string => value.replace(/,/g, ".");

/** Reject the proposed edit, not a shortened/rounded version of the reading. */
export function guardReadingInput(previous: string, proposed: string, decimalPlaces: number): string {
  const next = normalizeReading(proposed);
  const pattern = decimalPlaces === 0
    ? /^\d*$/
    : new RegExp(`^(?:\\d+(?:\\.\\d{0,${decimalPlaces}})?)?$`);
  if (pattern.test(next)) return next;

  // Legacy readings may exceed a newly tightened policy. Allow deletion-only
  // edits until valid, without allowing additions or silently changing the value.
  const before = normalizeReading(previous);
  if (!pattern.test(before) && next.length < before.length) {
    let position = 0;
    for (const character of before) if (character === next[position]) position++;
    if (position === next.length) return next;
  }
  return previous;
}

export function matchingReadingError(errors: ReadingError[], field: string): ReadingError | undefined {
  const key = (name: string) => name.replace(/_/g, "").toLowerCase()
    .replace("meterreading", "systemreading").replace("modulereading", "moduleread");
  return errors.find(error => key(error.field) === key(field));
}

export function readingError(value: string, decimalPlaces: number): string | null {
  if (!value) return "A reading is required.";
  if (!/^\d+(?:\.\d+)?$/.test(normalizeReading(value))) {
    return "Enter a non-negative reading using digits and one decimal separator (no exponent notation).";
  }
  const fraction = normalizeReading(value).split(".")[1]?.length ?? 0;
  return fraction > decimalPlaces
    ? `Use at most ${decimalPlaces} decimal places. The reading has not been changed.`
    : null;
}

export function readingFields(data: Record<string, any>): string[] {
  return Object.keys(data).filter(key =>
    /^(old|new)(SystemReading|MeterReading|ModuleReading|ModuleRead)$/.test(key) ||
    /^(old|new)_(system_reading|meter_reading|module_read|module_reading)$/.test(key));
}

export function validateReadingData(data: Record<string, any>, limits: ReadingLimits): ReadingError[] {
  return readingFields(data).flatMap(field => {
    const value = data[field];
    if (value === null || value === undefined) return [];
    const decimalPlaces = /module/i.test(field) ? limits.moduleReadingDecimalPlaces : limits.systemReadingDecimalPlaces;
    const message = readingError(String(value), decimalPlaces);
    return message ? [{ field, decimalPlaces, message }] : [];
  });
}

/** Migrate legacy numeric queue values at the boundary; never parse new strings. */
export function normalizeReadingData<T extends Record<string, any>>(data: T): T {
  const copy = { ...data };
  for (const field of readingFields(data)) {
    if (data[field] !== undefined && data[field] !== null) {
      (copy as Record<string, any>)[field] = normalizeReading(String(data[field]));
    }
  }
  return copy;
}

/** Scope outgoing capture data only; never change the imported work order. */
export function applyEquipmentScope(data: Record<string, any>, scope: string): void {
  const excluded = scope === "system" ? "module" : scope === "module" ? "(system|meter)" : null;
  if (!excluded) return;
  const pattern = new RegExp(`^(old|new)_?${excluded}`, "i");
  for (const field of Object.keys(data)) if (pattern.test(field)) delete data[field];
}

export class ReadingPrecisionError extends Error {
  constructor(public errors: ReadingError[]) {
    super(errors.map(error => `${error.field}: ${error.message}`).join("\n"));
    this.name = "ReadingPrecisionError";
  }
}

export function assertReadingData(data: Record<string, any>, limits: ReadingLimits): void {
  const errors = validateReadingData(data, limits);
  if (errors.length) throw new ReadingPrecisionError(errors);
}

export function serverReadingErrors(body: any): ReadingError[] {
  if (body?.error && typeof body.error === "object") return serverReadingErrors(body.error);
  if (body?.code !== "READING_PRECISION") return [];
  const errors = body.errors ?? body.fieldErrors ?? body.fields ?? body.details?.errors ?? body.details;
  return Array.isArray(errors) ? errors.filter(error =>
    typeof error.field === "string" && typeof error.message === "string") : [];
}

export function responseError(text: string): Error {
  try {
    const body = JSON.parse(text);
    const errors = serverReadingErrors(body);
    if (errors.length) return new ReadingPrecisionError(errors);
    return new Error(body.message ?? (typeof body.error === "string" ? body.error : text));
  } catch {
    return new Error(text || "The server rejected this submission.");
  }
}

/** A 200 status is not proof that the queued work order was accepted. */
export function assertBatchSuccess(body: any): void {
  if (!Array.isArray(body?.results) || !body.results.length) {
    throw new Error("The server did not confirm the queued work order. It remains saved for retry.");
  }
  const failure = body.results.find((result: any) => result.status === "error");
  if (failure) {
    const errors = serverReadingErrors(failure);
    if (errors.length) throw new ReadingPrecisionError(errors);
    throw responseError(JSON.stringify(failure));
  }
  if (body.summary?.errors > 0 || body.results.some((result: any) => result.status !== "success")) {
    throw new Error("The server did not confirm success. The queued capture remains saved.");
  }
}

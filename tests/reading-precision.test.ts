import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  readingLimits, normalizeReading, readingError, validateReadingData,
  normalizeReadingData, assertReadingData, assertBatchSuccess, ReadingPrecisionError,
  responseError, applyEquipmentScope, guardReadingInput, matchingReadingError,
} from "../client/lib/reading-precision";
import { cacheListedReadingLimits, captureSettings, createSettingsRepository, isCaptureOnline, settingsKey, SettingsUnavailableError } from "../client/lib/project-settings-repository";
import { correctReadingData, reconcileQueuedActions } from "../client/lib/queued-readings";
import { createFinalReadingEntry } from "../client/lib/final-reading-entry";

const independent = { systemReadingDecimalPlaces: 0, moduleReadingDecimalPlaces: 6 };

for (const wizard of ["WorkflowWizardScreen", "NewWorkOrderWizardScreen"]) {
  test(`${wizard} guards every reading field and places hints only on reading-entry steps`, () => {
    const file = `client/screens/${wizard}.tsx`;
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let inputs = 0;
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const value = node.attributes.properties.find(attribute =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "value");
        const reading = value && ts.isJsxAttribute(value) && value.initializer &&
          ts.isJsxExpression(value.initializer) && value.initializer.expression;
        if (reading && /^formData\.(old|new)(SystemReading|ModuleRead(?:ing)?)$/.test(reading.getText(source))) {
          inputs++;
          assert.equal(node.tagName.getText(source), "ReadingInput");
          assert.ok(node.attributes.properties.some(attribute =>
            ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "limits"));
          assert.ok(!node.attributes.properties.some(attribute =>
            ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "selectTextOnFocus"),
          "Deferred automatic selection must not overwrite characters typed immediately after focus");
          let parent: ts.Node | undefined = node.parent;
          while (parent && !ts.isCaseClause(parent)) parent = parent.parent;
          assert.ok(parent && ts.isCaseClause(parent));
          assert.ok(["oldReading", "newReading", "readingCapture"].includes(
            (parent.expression as ts.StringLiteral).text));
          const focus = node.attributes.properties.find(attribute =>
            ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "onFocus");
          if ((parent.expression as ts.StringLiteral).text === "oldReading") {
            assert.ok(focus && ts.isJsxAttribute(focus) && focus.initializer);
            assert.match(focus.initializer.getText(source), /oldFinalReadingEntry\.current\.shouldClearOnFocus/);
            const change = node.attributes.properties.find(attribute =>
              ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "onChangeText");
            assert.ok(change && ts.isJsxAttribute(change) && change.initializer);
            assert.match(change.initializer.getText(source), /oldFinalReadingEntry\.current\.markEntered/);
          } else {
            assert.equal(focus, undefined, "Do not change initial-reading or reading-only focus behavior");
          }
        }
        assert.notEqual(node.tagName.getText(source), "ReadingErrors", "No shared whole-form error banner in the wizard");
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.equal(inputs, 7, "Both old/new equipment fields and all reading-only branches are guarded");
  });
}

test("old final reading focus clears imported values once independently for each equipment field", () => {
  const entry = createFinalReadingEntry();
  assert.equal(entry.shouldClearOnFocus("system", "001.2300"), true);
  assert.equal(entry.shouldClearOnFocus("system", ""), false);
  assert.equal(entry.shouldClearOnFocus("system", "000.3400"), false);
  assert.equal(entry.shouldClearOnFocus("module", "002.230000"), true);
  assert.equal(entry.shouldClearOnFocus("module", "003.450000"), false);
});

test("empty old fields and technician-entered values never become a disposable prefill", () => {
  const entry = createFinalReadingEntry();
  assert.equal(entry.shouldClearOnFocus("system", ""), false);
  assert.equal(entry.shouldClearOnFocus("system", "00123"), false);
  entry.markEntered("module");
  assert.equal(entry.shouldClearOnFocus("module", "002.230000"), false);
});

test("reopened captured drafts and completed old final readings are preserved on first focus", () => {
  for (const reason of ["syncPending", "completed"]) {
    const entry = createFinalReadingEntry(true);
    assert.equal(entry.shouldClearOnFocus("system", "000123"), false, reason);
    assert.equal(entry.shouldClearOnFocus("module", "002.230000"), false, reason);
    entry.markEntered("system");
    assert.equal(entry.shouldClearOnFocus("system", "000124"), false);
  }
  const source = readFileSync("client/screens/WorkflowWizardScreen.tsx", "utf8");
  assert.match(source, /preserveOldFinalReadings = isEditingCompleted \|\| Boolean\(workOrder\.syncPending\)/);
  assert.match(source, /useRef\(createFinalReadingEntry\(preserveOldFinalReadings\)\)/);
  assert.match(readFileSync("client/screens/NewWorkOrderWizardScreen.tsx", "utf8"),
    /useRef\(createFinalReadingEntry\(\)\)/);
});

test("first-focus clearing leaves required input invalid until entered and keeps fast entry exact", () => {
  for (const limit of [0, 1, 2, 3, 4, 5, 6]) {
    const entry = createFinalReadingEntry();
    let value = "12345";
    if (entry.shouldClearOnFocus("system", value)) value = "";
    assert.notEqual(readingError(value, limit), null);
    const final = limit ? `000123.${"0".repeat(limit)}` : "000123";
    for (const character of final) {
      value = guardReadingInput(value, value + character, limit);
      entry.markEntered("system");
    }
    assert.equal(value, final);
    assert.equal(readingError(value, limit), null);
    assert.equal(entry.shouldClearOnFocus("system", value), false, "Back navigation or refocus keeps the entered value");
    assert.equal(guardReadingInput(value, value + ".", limit), value);
  }
});

test("offline final entry uses cached precision and keeps exact saved values on reopening", async () => {
  for (const connected of [false, true]) {
    const store = memoryStore();
    await store.setItem(settingsKey(session), JSON.stringify(independent));
    const repository = createSettingsRepository(store, async () => {
      throw new Error("Offline-session capture must not contact the server");
    });
    const isOfflineSession = true;
    const settings = await captureSettings(repository, session, connected && !isOfflineSession);
    assert.equal(settings.readingSettingsSource, "cache");
    for (const path of ["downloaded", "offline-created"]) {
      const entry = createFinalReadingEntry();
      let system = path === "downloaded" ? "12345" : "";
      let module = path === "downloaded" ? "234.123456" : "";
      if (entry.shouldClearOnFocus("system", system)) system = "";
      if (entry.shouldClearOnFocus("module", module)) module = "";
      system = guardReadingInput(system, "000123", settings.systemReadingDecimalPlaces as number);
      module = guardReadingInput(module, "002,230000", settings.moduleReadingDecimalPlaces as number);
      entry.markEntered("system");
      entry.markEntered("module");
      assert.equal(guardReadingInput(system, system + ".", 0), system);
      assert.equal(guardReadingInput(module, module + "7", 6), module);
      const saved = JSON.parse(JSON.stringify({
        oldSystemReading: system, oldModuleReading: module, syncPending: true, status: "Completed",
      }));
      assertReadingData(saved, settings as any);
      assert.equal(saved.oldSystemReading, "000123");
      assert.equal(saved.oldModuleReading, "002.230000");
      const reopened = createFinalReadingEntry(saved.syncPending || saved.status === "Completed");
      assert.equal(reopened.shouldClearOnFocus("system", saved.oldSystemReading), false);
      assert.equal(reopened.shouldClearOnFocus("module", saved.oldModuleReading), false);
    }
  }
});

for (const limit of [0, 1, 2, 3, 4, 5, 6]) {
  test(`quiet entry honors ${limit} decimals and keeps valid strings unchanged`, () => {
    assert.equal(guardReadingInput("", "000123", limit), "000123");
    assert.equal(guardReadingInput("000123", "", limit), "");
    const value = limit ? `000123.${"0".repeat(limit)}` : "000123";
    assert.equal(guardReadingInput("", value, limit), value);
    const excessive = `000123.${"0".repeat(limit + 1)}`;
    assert.equal(guardReadingInput(value, excessive, limit), value);
    assert.equal(guardReadingInput("", excessive, limit), "");
    assert.equal(guardReadingInput(value, `${value}.`, limit), value);
    assert.equal(guardReadingInput("123", "123,", limit), limit ? "123." : "123");
  });
}

test("quiet entry allows intermediate separators and comma edits, but submission remains strict", () => {
  assert.equal(guardReadingInput("000", "000.", 4), "000.");
  assert.equal(guardReadingInput("000.", "000.0", 4), "000.0");
  assert.equal(guardReadingInput("001", "001,230000", 6), "001.230000");
  assert.equal(guardReadingInput("001.230000", "001.23000", 6), "001.23000");
  assert.notEqual(readingError("000.", 4), null);
  assert.equal(guardReadingInput("123", "123.", 0), "123");
});

test("invalid additions and pastes are rejected whole rather than stripped or shortened", () => {
  for (const proposed of ["-1", "+1", "1e3", "1E-3", "1..2", "1,2,3", "12a", " 1", "1 ", ".2", "1.1234567"]) {
    assert.equal(guardReadingInput("000.12", proposed, 6), "000.12", proposed);
    assert.equal(guardReadingInput("", proposed, 6), "", proposed);
  }
  assert.equal(guardReadingInput("000.0035", "000.00354", 4), "000.0035");
  assert.equal(guardReadingInput("000.0035", "000.0035.", 4), "000.0035");
  assert.equal(guardReadingInput("1.2", ".2", 6), "1.2");
});

test("legacy out-of-policy readings survive unchanged and can be reduced, cleared or replaced", () => {
  let value = "001.234567";
  assert.equal(guardReadingInput(value, value, 3), value);
  assert.equal(guardReadingInput(value, `${value}8`, 3), value);
  for (const reduced of ["001.23456", "001.2345", "001.234"]) {
    value = guardReadingInput(value, reduced, 3);
    assert.equal(value, reduced);
  }
  assert.equal(readingError(value, 3), null);
  assert.equal(guardReadingInput("001.234567", "", 0), "");
  assert.equal(guardReadingInput("001.234567", "00012", 0), "00012");
  assert.equal(guardReadingInput("1..2", "1.2", 3), "1.2");
  assert.equal(guardReadingInput("12.3456", "12.345", 0), "12.345");
  assert.equal(guardReadingInput("12.3456", "12.999", 0), "12.3456");
});

test("quiet input retains large integers and trailing zeros through capture serialization", () => {
  const input = "009007199254740993.120000";
  const data = { newModuleReading: guardReadingInput("", input, 6) };
  assert.equal(JSON.parse(JSON.stringify(data)).newModuleReading, input);
  assertReadingData(data, independent);
});

test("server errors match only their own reading field across server aliases", () => {
  const error = { field: "old_meter_reading", decimalPlaces: 4, message: "Reconfirm the old system reading" };
  const moduleError = { field: "new_module_reading", decimalPlaces: 6, message: "Reconfirm the module reading" };
  assert.equal(matchingReadingError([error, moduleError], "oldSystemReading"), error);
  assert.equal(matchingReadingError([error, moduleError], "newModuleRead"), moduleError);
  assert.equal(matchingReadingError([error, moduleError], "newSystemReading"), undefined);
  assert.equal(matchingReadingError([error, moduleError], "oldModuleRead"), undefined);
});

test("zero is preserved; missing and null values default independently to three", () => {
  assert.deepEqual(readingLimits(independent), independent);
  assert.deepEqual(readingLimits({}), { systemReadingDecimalPlaces: 3, moduleReadingDecimalPlaces: 3 });
  assert.deepEqual(readingLimits({ systemReadingDecimalPlaces: 0, moduleReadingDecimalPlaces: null } as any),
    { systemReadingDecimalPlaces: 0, moduleReadingDecimalPlaces: 3 });
});

test("invalid server limits fail explicitly rather than silently adopting a different limit", () => {
  for (const value of [-1, 7, 2.5, "6", NaN]) {
    assert.throws(() => readingLimits({ systemReadingDecimalPlaces: value } as any));
  }
});

for (const limit of [0, 3, 6]) {
  test(`accepts up to ${limit} fractional digits without padding or truncation`, () => {
    assert.equal(readingError("00123", limit), null);
    if (limit) {
      assert.equal(readingError(`00123.${"0".repeat(limit)}`, limit), null);
      assert.equal(readingError("00123.1", limit), null);
    }
    assert.match(readingError(`00123.${"0".repeat(limit + 1)}`, limit)!, /at most/);
  });
}

test("independent limits apply to old/new readings and all existing field aliases", () => {
  const data = {
    oldSystemReading: "123", newSystemReading: "001.0",
    oldModuleReading: "123.456789", newModuleRead: "001.000000",
    old_system_reading: "12.1", new_module_read: "000.1234567",
    oldMeterReading: "1.2",
  };
  assert.deepEqual(validateReadingData(data, independent).map(error => error.field),
    ["newSystemReading", "old_system_reading", "new_module_read", "oldMeterReading"]);
});

test("comma entry is normalized while leading/trailing zeros are kept through upload serialization", () => {
  assert.equal(normalizeReading("001,230000"), "001.230000");
  const data = normalizeReadingData({ newModuleReading: "001,230000", oldSystemReading: "00012" });
  const storedAndUploaded = JSON.parse(JSON.stringify(data));
  assert.deepEqual(storedAndUploaded, { newModuleReading: "001.230000", oldSystemReading: "00012" });
  assertReadingData(storedAndUploaded, independent);
});

test("negative, exponent, malformed, whitespace and pasted invalid values remain intact and get errors", () => {
  for (const input of ["-1", "+1", "1e3", "1E-3", "1..2", "1,2,3", "12a", " 1", "1 ", ".2", "2.", ""]) {
    assert.notEqual(readingError(input, 6), null, input);
    assert.equal(normalizeReading(input), input.replace(/,/g, "."), input);
  }
});

test("large integer parts are strings and never pass through floating point conversion", () => {
  const value = "009007199254740993.120000";
  const data = normalizeReadingData({ newModuleReading: value });
  assertReadingData(data, independent);
  assert.equal(JSON.parse(JSON.stringify(data)).newModuleReading, value);
});

test("null/omitted optional readings are skipped but a supplied blank gets a field error", () => {
  assert.deepEqual(validateReadingData({ oldSystemReading: null, oldModuleReading: undefined }, independent), []);
  assert.equal(validateReadingData({ newSystemReading: "" }, independent)[0].field, "newSystemReading");
});

test("historical imported values are not rewritten when a stricter limit is applied", () => {
  const imported = Object.freeze({ oldSystemReading: "0001.230000", newModuleRead: "004.560000" });
  const before = JSON.stringify(imported);
  assert.throws(() => assertReadingData(imported, independent), ReadingPrecisionError);
  assert.equal(JSON.stringify(imported), before);
});

test("legacy numeric values are converted at the submission boundary without coercing new strings", () => {
  assert.deepEqual(normalizeReadingData({ oldMeterReading: 123.45, newModuleReading: "000.450000", count: 2 }),
    { oldMeterReading: "123.45", newModuleReading: "000.450000", count: 2 });
});

test("outgoing equipment scope removes only excluded equipment fields and never mutates an import", () => {
  const imported = { oldSystemReading: "001", oldModuleRead: "002.123456", newModuleId: "M", notes: "keep" };
  const system = { ...imported };
  applyEquipmentScope(system, "system");
  assert.deepEqual(system, { oldSystemReading: "001", notes: "keep" });
  const module = { ...imported };
  applyEquipmentScope(module, "module");
  assert.equal("oldSystemReading" in module, false);
  assert.equal(imported.oldSystemReading, "001");
});

test("direct HTTP 400 errors preserve server fields, messages and limits", () => {
  const errors = [{ field: "old_system_reading", decimalPlaces: 0, message: "Whole numbers only" }];
  const error = responseError(JSON.stringify({ code: "READING_PRECISION", errors }));
  assert.ok(error instanceof ReadingPrecisionError);
  assert.deepEqual(error.errors, errors);
  assert.match(error.message, /old_system_reading: Whole numbers only/);
});

test("HTTP 200 batch errors, including nested errors, are not mistaken for success", () => {
  const errors = [{ field: "newModuleReading", decimalPlaces: 3, message: "Too many decimals" }];
  for (const failure of [
    { status: "error", code: "READING_PRECISION", fieldErrors: errors },
    { status: "error", error: { code: "READING_PRECISION", errors } },
  ]) {
    assert.throws(() => assertBatchSuccess({ results: [failure], summary: { errors: 1 } }), ReadingPrecisionError);
  }
  assert.throws(() => assertBatchSuccess({ results: [{ status: "success" }], summary: { errors: 1 } }));
  assert.throws(() => assertBatchSuccess({ summary: { errors: 0 } }));
  assert.doesNotThrow(() => assertBatchSuccess({ results: [{ status: "success" }], summary: { errors: 0 } }));
});

test("mixed queue results remove only successful entries and preserve failures, photos and newly captured actions", () => {
  const photo = { base64: "test-photo", filename: "before.jpg" };
  const failed = { id: "failed", data: { newSystemReading: "12.3456", beforePhotos: [photo] }, matchedWorkOrderId: 42 };
  const queue = [{ id: "accepted" }, failed, { id: "captured-during-sync" }];
  const rejections = new Map([["failed", { readingErrors: [{ field: "newSystemReading", decimalPlaces: 3, message: "Too precise" }] }]]);
  const remaining = reconcileQueuedActions(queue, ["accepted"], [], rejections);
  assert.deepEqual(remaining.map(action => action.id), ["failed", "captured-during-sync"]);
  assert.equal((remaining[0] as any).data.beforePhotos[0], photo);
  assert.equal((remaining[0] as any).matchedWorkOrderId, 42);
  assert.equal((remaining[0] as any).data.newSystemReading, "12.3456");
});

test("correction/reconfirmation edits only readings, keeps the same draft and does not silently round", () => {
  const original = {
    id: "draft-42", newSystemReading: "001.234567", newModuleReading: "002.230000",
    beforePhotos: [{ base64: "test" }], gpsCoordinates: "test-gps", notes: "keep", completedAt: "test-time",
  };
  assert.throws(() => correctReadingData(original, {}, independent), ReadingPrecisionError);
  const corrected = correctReadingData(original, { newSystemReading: "001", newModuleReading: "002,230000" }, independent);
  assert.equal(corrected.newSystemReading, "001");
  assert.equal(corrected.newModuleReading, "002.230000");
  assert.equal(original.newSystemReading, "001.234567");
  assert.equal(corrected.id, original.id);
  assert.equal(corrected.beforePhotos, original.beforePhotos);
  assert.equal(corrected.gpsCoordinates, original.gpsCoordinates);
  assert.throws(() => correctReadingData(original, { notes: "change" }, independent), /Unknown reading field/);
  assertReadingData(JSON.parse(JSON.stringify(corrected)), independent);
});

const session = { serverUrl: "https://example.invalid", userId: "synthetic-user", projectId: 1 };
function memoryStore() {
  const map = new Map<string, string>();
  return { map, getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => { map.set(key, value); } };
}

test("cache keys isolate projects, users and servers, normalizing trailing slashes", () => {
  assert.equal(settingsKey(session), settingsKey({ ...session, serverUrl: `${session.serverUrl}/` }));
  for (const other of [{ ...session, projectId: 2 }, { ...session, userId: "other" }, { ...session, serverUrl: "https://other.invalid" }]) {
    assert.notEqual(settingsKey(session), settingsKey(other));
  }
});

test("offline settings use only the selected identity's cache and preserve zero", async () => {
  const store = memoryStore();
  await store.setItem(settingsKey(session), JSON.stringify(independent));
  const repository = createSettingsRepository(store, async () => { throw new Error("Offline must not fetch"); });
  assert.deepEqual(await repository(session, false), independent);
  assert.deepEqual(await repository({ ...session, projectId: 2 }, false), readingLimits({}));
  assert.deepEqual(await repository({ ...session, userId: "other" }, false), readingLimits({}));
  assert.deepEqual(await repository({ ...session, serverUrl: "https://other.invalid" }, false), readingLimits({}));
});

test("project-list settings seed per-project offline precision without replacing unrelated wizard flags", async () => {
  const store = memoryStore();
  await store.setItem(settingsKey(session), JSON.stringify({ wizardGpsMode: "manual", systemReadingDecimalPlaces: 3 }));
  await cacheListedReadingLimits(store, session, independent);
  const repository = createSettingsRepository(store);
  assert.deepEqual(await repository(session, false), { wizardGpsMode: "manual", ...independent });
  await cacheListedReadingLimits(store, { ...session, projectId: 2 }, { systemReadingDecimalPlaces: null, moduleReadingDecimalPlaces: 0 });
  assert.deepEqual(await repository({ ...session, projectId: 2 }, false), { systemReadingDecimalPlaces: 3, moduleReadingDecimalPlaces: 0 });
});

test("online wizard/upload refresh overrides old cached limits; older queued values remain unchanged", async () => {
  const store = memoryStore();
  let systemLimit = 6;
  let count = 0;
  const repository = createSettingsRepository(store, async (_url, options) => {
    count++;
    assert.equal(options?.credentials, "include");
    return new Response(JSON.stringify({ ...independent, systemReadingDecimalPlaces: systemLimit }));
  });
  await repository(session, true);
  const queued = { oldSystemReading: "001.230000", newModuleRead: "002.230000" };
  assertReadingData(queued, await repository(session, false) as any);
  systemLimit = 0;
  const fresh = await repository(session, true);
  assert.throws(() => assertReadingData(queued, fresh as any), ReadingPrecisionError);
  assert.equal(queued.oldSystemReading, "001.230000");
  assert.equal((await repository(session, false)).systemReadingDecimalPlaces, 0);
  assert.equal(count, 2);
});

test("delayed responses after switching projects cannot overwrite another project's cache", async () => {
  const store = memoryStore();
  let finishFirst!: (response: Response) => void;
  const delayed = new Promise<Response>(resolve => { finishFirst = resolve; });
  const repository = createSettingsRepository(store, async url =>
    String(url).endsWith("/1") ? delayed : new Response(JSON.stringify(independent)));
  const first = repository(session, true);
  const secondSession = { ...session, projectId: 2 };
  assert.equal((await repository(secondSession, true)).systemReadingDecimalPlaces, 0);
  finishFirst(new Response(JSON.stringify({ systemReadingDecimalPlaces: 6, moduleReadingDecimalPlaces: 3 })));
  await first;
  assert.equal((await repository(secondSession, false)).systemReadingDecimalPlaces, 0);
  assert.equal((await repository(session, false)).systemReadingDecimalPlaces, 6);
});

test("failed settings refresh does not erase cached limits or queue data", async () => {
  const store = memoryStore();
  await store.setItem(settingsKey(session), JSON.stringify(independent));
  const repository = createSettingsRepository(store, async () => new Response("Denied", { status: 403 }));
  await assert.rejects(repository(session, true), /Unable to refresh/);
  assert.deepEqual(await repository(session, false), independent);
});

test("offline login with network connectivity uses cached policy without contacting the unreachable server", async () => {
  const store = memoryStore();
  await store.setItem(settingsKey(session), JSON.stringify(independent));
  let requests = 0;
  const repository = createSettingsRepository(store, async () => {
    requests++;
    throw new TypeError("Failed to fetch");
  });
  const connected = true;
  const isOfflineSession = true;
  const settings = await captureSettings(repository, session, connected && !isOfflineSession);
  assert.equal(settings.readingSettingsSource, "cache");
  assert.equal(settings.systemReadingDecimalPlaces, 0);
  assert.equal(settings.moduleReadingDecimalPlaces, 6);
  assert.equal(requests, 0);
  assertReadingData({ newSystemReading: "001", newModuleReading: "002.230000" }, settings as any);
});

test("the work-order capture entry remains available during an offline session on a connected device", () => {
  assert.equal(isCaptureOnline(true, true, "cache"), false);
  assert.equal(isCaptureOnline(true, true, "server"), false);
  assert.equal(isCaptureOnline(true, false, "cache"), false);
  assert.equal(isCaptureOnline(false, false, "server"), false);
  assert.equal(isCaptureOnline(true, false, "server"), true);
});

test("unreachable server falls back for capture only; uploads still require a fresh request", async () => {
  const store = memoryStore();
  await store.setItem(settingsKey(session), JSON.stringify(independent));
  const repository = createSettingsRepository(store, async () => { throw new TypeError("Failed to fetch"); });
  const settings = await captureSettings(repository, session, true);
  assert.equal(settings.readingSettingsSource, "cache");
  assert.equal(settings.moduleReadingDecimalPlaces, 6);
  await assert.rejects(repository(session, true), SettingsUnavailableError);
});

test("authorization and invalid-policy responses cannot be hidden by cached fallback", async () => {
  const store = memoryStore();
  await store.setItem(settingsKey(session), JSON.stringify(independent));
  const forbidden = createSettingsRepository(store, async () => new Response("Denied", { status: 403 }));
  await assert.rejects(captureSettings(forbidden, session, true), /403/);
  const invalid = createSettingsRepository(store, async () => new Response(JSON.stringify({ systemReadingDecimalPlaces: 7 })));
  await assert.rejects(captureSettings(invalid, session, true), /integer from 0 to 6/);
});

test("explicit refresh replaces cached capture mode once server access returns", async () => {
  const store = memoryStore();
  await store.setItem(settingsKey(session), JSON.stringify(independent));
  let reachable = false;
  const repository = createSettingsRepository(store, async () => {
    if (!reachable) throw new TypeError("Connection refused");
    return new Response(JSON.stringify({ systemReadingDecimalPlaces: 6, moduleReadingDecimalPlaces: 0 }));
  });
  assert.equal((await captureSettings(repository, session, true)).readingSettingsSource, "cache");
  reachable = true;
  const fresh = await captureSettings(repository, session, true);
  assert.equal(fresh.readingSettingsSource, "server");
  assert.equal(fresh.systemReadingDecimalPlaces, 6);
  assert.equal(fresh.moduleReadingDecimalPlaces, 0);
});

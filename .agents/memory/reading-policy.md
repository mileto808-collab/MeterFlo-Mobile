---
name: Project reading policy
description: Server-owned precision policy and technician-controlled correction of offline readings.
---
System and module reading precision is an independent server-owned project policy, not a mobile formatting preference. Keep maximum precision separate from display padding, and do not round historical or queued readings to comply.

**Why:** The web-app handoff requires exact entered strings (including leading/trailing zeros). A stricter policy after offline capture must not change measured values or discard their photos.

**How to apply:** Future capture, migration, import/export, or sync work must preserve the original readings and require technician correction/reconfirmation when the current server policy rejects them. Work-order downloads are not the source of truth for project policy; settings need their own refresh.

Network connectivity is not server availability. An authenticated offline session may exist on a connected device when MeterFlo is unreachable. Capture must use the selected session's cached policy in that case, while uploads still require a fresh server check.

**Why:** The app supports offline login during a server outage; gating capture solely on the network connection would disable that supported workflow.

**How to apply:** Honor authentication's offline-session state in wizard and correction settings gates. Only server unavailability permits an online-request fallback; authorization failures and invalid settings must remain explicit.

Wizard reading entry should prevent adding excess decimal places without displaying a typing error. Maximum-decimal hints belong only on relevant reading-entry screens and must show only the applicable equipment limits.

**Why:** The user explicitly corrected the global precision feedback after seeing red errors for future readings on ID capture and physical-changeout screens.

**How to apply:** Scope hints and field feedback to the active reading fields, using the module policy for module-only capture even if an internal form slot is system-named. Prevent invalid additions without rounding or shortening existing captured values.

Invalid pasted edits should be rejected whole, retaining the previous value; do not strip characters or clip fractional digits into a different reading. Allow normal intermediate typing and deletion while correcting an existing out-of-policy value.

**Why:** Clipping a paste can silently record a measurement different from the one the technician supplied.

**How to apply:** Keep input guarding separate from final submission validation, and preserve existing saved data until the technician explicitly corrects it.

Avoid automatic select-all on focus for reading inputs.

**Why:** React Native Web defers select-all with a timer. A fast-typing browser check lost leading characters when that selection ran after entry had begun.

**How to apply:** Avoid deferred selection and verify rapid entry separately from delayed keystrokes if focus behavior changes. This does not prohibit the user-requested tap-to-clear behavior for prefilled old final-reading fields.

Tapping a prefilled old system/module final-reading field in either wizard should clear the current reading for entry of the final reading.

**Why:** The user reported that removing the previous tap-to-clear behavior forced technicians to manually delete the current reading.

**How to apply:** Restore this behavior for prefilled old final readings without clearing technician-entered drafts on subsequent focus. Keep quiet precision enforcement; do not generalize this request to all reading fields.

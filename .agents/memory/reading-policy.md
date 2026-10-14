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

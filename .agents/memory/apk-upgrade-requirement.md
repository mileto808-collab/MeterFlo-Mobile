---
name: APK upgrade requirement
description: User's required scope for Expo SDK upgrades and future APK distribution.
---

SDK upgrades must preserve the ability to build working Android APKs. Expo Go compatibility alone is not sufficient.

**Why:** The user stated, “APK builds must keep working,” and intends to create a new APK and distribute it to devices via the app's GitHub update feature.

**How to apply:** Include standalone APK compatibility in upgrade scope, preserve the existing application's identity and update path, and explicitly distinguish verified Expo Go behavior from unverified native builds.
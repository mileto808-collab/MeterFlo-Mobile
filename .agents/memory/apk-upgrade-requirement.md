---
name: APK upgrade requirement
description: User's required scope for Expo SDK upgrades and future APK distribution.
---

SDK upgrades must preserve the ability to build working Android APKs. Expo Go compatibility alone is not sufficient.

Both local Android Studio/Gradle builds and Expo EAS builds must keep working.

Routine device testing must remain possible through Expo Go; do not substitute a custom development client as the proposed testing workflow.

**Why:** The user stated, “APK builds must keep working,” and intends to create a new APK and distribute it to devices via the app's GitHub update feature. The current APK was built locally with Android Studio/Gradle; previous APKs were built with Expo EAS, and the user said, “Both need to work.” They also stated, “I can only do this through Expo Go.”

**How to apply:** Include standalone APK compatibility in upgrade scope, preserve the existing application's identity and update path, and explicitly distinguish verified Expo Go behavior from unverified native builds.
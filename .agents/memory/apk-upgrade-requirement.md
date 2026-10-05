---
name: APK upgrade requirement
description: User's required scope for Expo SDK upgrades and future APK distribution.
---

SDK upgrades must preserve the Android APK distribution path and application signing identity. Distinguish shared-project verification from standalone build verification.

The user clarified the release process: create the AAB through Expo EAS, then generate the APK locally with bundletool.jar. Do not mistake bundletool conversion for compiling the native Android source with local Gradle.

Routine device testing must remain possible through Expo Go; do not substitute a custom development client as the proposed testing workflow.

**Why:** The user stated, “APK builds must keep working,” and intends to distribute replacement APKs via the app's GitHub update feature. After an earlier description involving Gradle, they clarified, “I create the .aab file via EAS, and then I create the apk using bundletool.jar.” They also stated, “I can only do this through Expo Go.”

**How to apply:** Preserve application identity and the GitHub update path. Do not claim an EAS build or bundletool APK installation was tested unless it actually was; respect SDK-only task scope when the user handles standalone builds.
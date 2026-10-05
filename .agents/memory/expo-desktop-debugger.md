---
name: Expo desktop debugger in Nix
description: Why the optional SDK 57 desktop debugger is disabled in the development workflow.
---

Keep the optional React Native desktop debugger separate from the Expo Go packager and web Preview. In this Nix workspace, the SDK 57 debugger shell cannot start because its binary depends on a missing GUI shared library, even while Metro bundles and serves the app normally.

**Why:** The debugger setup printed a red startup error that appeared to indicate the app failed, but both native manifests and the web Preview still worked. Headless Expo CLI startup bypasses the desktop debugger setup rather than requiring an unrelated GUI library stack in this mobile project's runtime.

**How to apply:** If changing the Expo startup flags or upgrading Expo again, preserve a clean running packager and verify mobile Preview/open ports separately. Re-enable the optional desktop debugger only after its runtime dependencies are supported; do not confuse its absence with failed Expo Go acceptance.

## EAS packaging caveat

Local dotslash debugger caches can contain read-only directories that break EAS's temporary-clone cleanup before any cloud compilation begins. Keep workspace caches and local CLI data outside the build upload.

**Why:** A production build passed account and credential setup but failed with EACCES when EAS removed its copied DevTools cache. Disabling debugger startup did not remove the previously downloaded cache.

**How to apply:** Preserve the cache upload exclusion when changing build-ignore rules. EAS uses `.easignore` instead of `.gitignore` when present, so repository exclusions must be carried over explicitly. Verify actual archive contents rather than treating empty excluded parent directories as a failed exclusion; EAS can leave those directories after removing ignored tracked files.
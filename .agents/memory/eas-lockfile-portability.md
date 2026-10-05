---
name: EAS lockfile portability
description: Replit registry URL portability and independent local package-security checks.
---

Lockfiles sent to external EAS build servers must not depend on Replit-internal tarball addresses. When normalizing registry URLs, verify the public package metadata and retain locked versions and integrity hashes.

**Why:** Managed local package operations can embed private registry locations in a lockfile that is later uploaded to Expo. External builds cannot rely on those locations and can report opaque npm installation failures.

**How to apply:** After any lockfile regeneration, check download-host portability before an EAS submission. Normalize only the matching registry prefix and verify integrity against published metadata; do not disable local registry security settings. Local clean-install validation remains subject to Replit's firewall even when the lockfile lists public npm URLs. A security rejection is a separate blocker requiring an approved dependency fix, not justification to bypass the firewall or claim the installation passed.
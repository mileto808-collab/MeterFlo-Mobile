---
name: Expo session ownership
description: Managed Preview sign-in and EAS project account access are separate concerns.
---

Do not assume the Expo session used for Preview can build the existing EAS project. The managed development sign-in and the user's project-owning Expo account may be different, and Preview restarts can replace the CLI session used for subsequent EAS commands.

**Why:** EAS initially rejected access to the linked project under a managed session; the user later authenticated an account with access and reached cloud build preparation. Subsequent development workflow restarts signed the CLI back into the managed session.

**How to apply:** Before retrying a native build after development startup or restart, tell the user to check `eas whoami` and sign back into an account with access if necessary. Preserve the linked EAS project and signing identity; never create a replacement project or keystore merely to solve an account-permission error.
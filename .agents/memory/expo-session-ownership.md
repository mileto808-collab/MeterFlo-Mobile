---
name: Expo session ownership
description: Managed Preview sign-in and EAS project account access are separate concerns.
---

Do not assume the Expo session used for Preview can build the existing EAS project. The managed development sign-in and the user's project-owning Expo account may be different, and Preview restarts can replace the CLI session used for subsequent EAS commands.

**Why:** EAS initially rejected access to the linked project under a managed session; the user later authenticated an account with access and reached cloud build preparation. Subsequent development workflow restarts signed the CLI back into the managed session.

**How to apply:** Before retrying a native build after development startup or restart, tell the user to check `eas whoami` and sign back into an account with access if necessary. Preserve the linked EAS project and signing identity; never create a replacement project or keystore merely to solve an account-permission error.

Use CLI-based EAS authentication when the CLI is running remotely and the user's browser is on another computer.

**Why:** The browser sign-in redirected to a localhost callback on the user's computer, but its listener was inside the remote workspace. The browser therefore reported connection refused, independently of whether the Expo account credentials were correct.

**How to apply:** Check the installed CLI's login help for the supported non-browser option; the observed CLI supports `eas login --no-browser`. Have the user enter credentials directly into their interactive shell, never into chat. Confirm the account with `eas whoami` and avoid restarting Preview between authentication and the intended EAS command.
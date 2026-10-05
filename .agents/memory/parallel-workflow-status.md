---
name: Parallel workflow status
description: Why a reported workflow command may misrepresent startup order for parallel tasks.
---

For a workflow containing parallel tasks, a status summary can display those tasks joined as a sequential shell command, even when both processes are running concurrently. Do not infer a missing service from that summary alone.

**Why:** A reported startup command appeared to wait for the backend before launching Expo, but the actual workflow definition had parallel tasks and both server processes were running. Treating the summary as the real command led to an unnecessary configuration change.

**How to apply:** When diagnosing preview startup, compare the workflow definition and live process/readiness checks before changing orchestration.
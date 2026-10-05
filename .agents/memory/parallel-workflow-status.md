---
name: Parallel workflow restarts
description: Why separate long-running shell tasks can fail to start together after a workflow restart.
---

After a workflow restart, separate long-running shell tasks may be combined into a sequential `&&` command. The second server then never starts because the first one does not exit. A workflow that was already running under an earlier configuration can appear healthy until restarted.

**Why:** A workflow initially had both services running, yet restarting its two-task configuration launched only the first service and failed while waiting for the second port. Consolidating both startups into one concurrent shell command restored both services. A separate Preview issue occurred when Metro bound only to loopback: the app could load through a proxy while the workflow still reported only the backend's port.

**How to apply:** When a workflow manages two long-running services, verify the *restarted* behavior rather than only reading its definition. Check actual listener addresses and reported open ports: Expo bound to loopback can respond through the proxy yet remain invisible to Preview readiness checks. Its development server must bind to the network interface for port 8081 to be reported as open.
---
id: 4
title: 'Sandbox Reconnection Logic'
status: pending
priority: high
feature: Performance
dependencies:
  - 3
assigned_agent: null
created_at: 2025-07-03T19:03:03Z
started_at: null
completed_at: null
error_log: null
---

## Description
Implement robust reconnection to existing E2B sandboxes using `lib/sandbox/reconnect.ts` to eliminate "sandbox not found" errors.

## Details
- Complete `SandboxReconnectionManager` with retry logic.
- Hook into chat flow: on session load attempt reconnect, else create new.
- Add keep-alive ping every 30 s.

## Test Strategy
- Kill sandbox process manually, verify app recovers by creating new sandbox.
- Measure reconnection success rate in console logs. 
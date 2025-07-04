---
id: 2
title: 'Chat Sidebar UI Integration'
status: pending
priority: high
feature: Chat Sessions
dependencies:
  - 3
  - 7
assigned_agent: null
created_at: 2025-07-03T19:03:03Z
started_at: null
completed_at: null
error_log: null
---

## Description
Embed the ChatGPT-style sidebar (`components/chat/chat-sidebar.tsx`) so the user can save a project, exit it, and open another. Only one sandbox/chat is active at a time – switching sessions should close the previous sandbox before loading the new one.

## Details
- Import sidebar into `app/page.tsx` (or new Home component).
- Connect callbacks to LocalSessionManager (Task 3).
- Style sidebar using shadcn `ScrollArea` and Tailwind.
- Add keyboard shortcut **⌘+Shift+N** to create new chat.

## Test Strategy
- Start dev server, create multiple sessions, switch between them without page reload errors.
- Verify sidebar persists after refresh. 
---
id: 7
title: 'Simplify to Single Chat with App Library'
status: failed
priority: critical
feature: Core Chat Experience
dependencies: []
assigned_agent: null
created_at: "2024-12-27T01:33:00Z"
started_at: "2024-12-27T01:45:00Z"
completed_at: "2024-12-27T02:15:00Z"
error_log: "Multiple chat sessions causing state bleeding between sessions. Need complete redesign."
---

## Description

Remove the multi-chat sidebar functionality entirely and implement a single chat interface with an app library. Each generated app is saved to the user's library where they can revisit and continue editing later. Each app maintains its own isolated chat history and sandbox.

## Details

- Remove ChatSidebar component and all multi-session logic
- Implement single chat interface (like original fragments)
- Create "My Apps" library page showing all saved apps
- Each app saves its complete state:
  - Chat messages history
  - Generated code
  - Sandbox configuration
  - Template used
  - Last modified timestamp
- Opening an app from library:
  - Loads the app's chat history
  - Creates fresh sandbox with saved code
  - User can continue conversation
- Clear separation between apps - no state bleeding
- Add "Save to Library" button in chat interface
- Add "New App" button that clears current chat

## Test Strategy

Create comprehensive unit tests to verify:
- Single chat state management
- App saving to library with complete state
- Loading app from library restores full context
- No state bleeding between different apps
- Sandbox lifecycle properly managed
- Chat history correctly isolated per app

## Agent Notes

The multi-session approach with sidebar was causing state management issues. The simpler approach of one active chat + saved app library provides better isolation and clearer mental model for users. 
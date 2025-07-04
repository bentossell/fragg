---
id: 1
title: 'Improve Chat Prompt & Template Selector'
status: pending
priority: high
feature: Core UX
dependencies: []
assigned_agent: null
created_at: 2025-07-03T19:03:03Z
started_at: null
completed_at: null
error_log: null
---

## Description
Refactor the prompt-building logic so generated apps consistently feature beautiful UI and the correct template is chosen based on the user request.

## Details
- Update `lib/prompt.ts` to inject the **CRITICAL UI REQUIREMENTS** block earlier and trim redundancy.
- Ensure `lib/template-selector.ts` uses the new keyword scoring system and fallback logic.
- Add unit tests for keyword scoring edge-cases.
- Provide example prompts for React vs Streamlit.

## Test Strategy
1. Run `pnpm test` for new selector tests.
2. Manually ask for "beautiful dashboard" → expect `nextjs-developer` template.
3. Ask for "data analysis chart" → expect Streamlit/Gradio. 
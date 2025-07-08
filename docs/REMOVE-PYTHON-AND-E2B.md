# Removing Python Support & E2B Sandboxes  
**File:** `docs/REMOVE-PYTHON-AND-E2B.md`  
_Last updated: 2025-07-08_

---

## 🚦   Executive Summary
We’re migrating Fragg to a **100 % in-browser execution model (WebContainers + Browser Preview)**.  
To reach sub-second previews and eliminate timeout issues we will **drop Python templates** and completely **remove E2B sandboxes**.

---

## 1 · Python Templates to Remove

| Template ID | Directory / File(s) | Reason |
|-------------|---------------------|--------|
| `streamlit-developer` | `sandbox-templates/streamlit-developer/` | Requires Python runtime |
| `gradio-developer`    | `sandbox-templates/gradio-developer/`   | Requires Python runtime |
| `code-interpreter-v1` | Handled in `/app/api/sandbox/route.ts`   | Executes arbitrary Python code |

Delete the template entries from:
- `lib/templates.json`
- `lib/templates.ts` (`templates` map)

---

## 2 · E2B-Related Code & Dependencies to Delete

### 2.1 Package Dependencies
- `@e2b/code-interpreter` (remove from `package.json`)
- Any E2B-specific type packages

### 2.2 Runtime Files / Folders
```
app/api/sandbox/route.ts
sandbox-templates/*               (entire folder)
archive/sandbox/*                 (pool, reconnect, etc.)
lib/__tests__/sandbox-pool.test.ts
lib/sandbox-config.ts
docs/E2B-SANDBOX-IMPLEMENTATION.md
```

### 2.3 Feature Flags & Env Vars
- Remove `E2B_API_KEY` logic from `.env.*`
- Delete `NEXT_PUBLIC_E2B_*` flags (if any)

---

## 3 · Code Updates Required

1. **Router Clean-up**  
   `lib/sandbox-router.ts`
   - Delete `e2b` branch & fallback.
   - Remove `templateRequiresSandbox` helper (no longer needed).

2. **Components**  
   - Delete `components/fragment-web.tsx` (E2B web preview).
   - Remove all references to `FragmentWeb`, `FragmentInterpreter`.

3. **API Layer**  
   - Delete `/app/api/sandbox` routes.  
   - Purge any server actions that call E2B SDK.

4. **AI Injection**  
   - `lib/inject-ai.ts`: strip Python-specific logic (if exists).

5. **Tests & Docs**  
   - Remove E2B test suites.
   - Update README & all diagrams.

6. **CI / Vercel**  
   - Drop `E2B_API_KEY` secret.
   - Ensure build passes without E2B dependency.

---

## 4 · Step-by-Step Removal Plan

| Step | Action | Commit Tag |
|------|-------|-----------|
| 0 | `git checkout -b remove-python-e2b` | – |
| 1 | Delete Python template dirs & JSON entries | `remove-python-templates` |
| 2 | Remove `@e2b/code-interpreter` from `package.json` and run `pnpm install` | `remove-e2b-dep` |
| 3 | Delete E2B runtime files (`app/api/sandbox`, archive, sandbox-config) | `delete-e2b-files` |
| 4 | Refactor `sandbox-router.ts`, components | `router-no-e2b` |
| 5 | Purge env vars & feature flags | `env-cleanup` |
| 6 | Run `pnpm lint && pnpm test` – ensure green | `tests-pass` |
| 7 | Update docs & README | `docs-update` |
| 8 | Open PR, squash-merge, delete branch | – |

Rollback: revert to tag `pre-remove-python-e2b`.

---

## 5 · Templates That Remain Supported

| Category | Template ID | Preview Path |
|----------|-------------|--------------|
| React / Next.js | `nextjs-developer` | ⚡ WebContainer |
| Vue / Nuxt | `vue-developer` | ⚡ WebContainer |
| Static Websites | `static-html` | 🌐 BrowserPreview |
| Any light JS/TS component (React, CDN) | _Instant_ | ⚡ Browser/Instant |

---

## 6 · Benefits of Dropping Python + E2B

| Benefit | Impact |
|---------|--------|
| **Speed** | Removes ~20-60 s E2B startup → consistent < 3 s previews |
| **Reliability** | Eliminates E2B timeouts & network flakiness |
| **Cost** | No per-sandbox VM billing |
| **Bundle Size** | `@e2b/code-interpreter` ≈ 4 MB removed |
| **Simpler Architecture** | One execution engine (WebContainers) → easier maintenance |
| **Security** | No remote code execution servers to harden |

---

## 7 · Future Considerations

1. If Python is needed later, explore:
   - **Pyodide** for in-browser Python (no server)
   - Lightweight micro-VMs on demand (Firecracker)  
2. For heavy back-end needs (user auth, DB), use **Edge Functions** (Phase-2).

---

### ✅ Conclusion
By deleting Python templates and all E2B code we achieve a lean, lightning-fast Fragg MVP that focuses on frontend web apps—delivering the < 3 s “artifact” experience every time.  
Merge this plan in the order above, verify tests, and enjoy the new speed! 🚀

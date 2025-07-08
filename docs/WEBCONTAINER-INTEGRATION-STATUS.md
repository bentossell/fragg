# WebContainer Integration – MVP Status

_Last updated: 2025-07-08_

---

## 1. Implemented

| Area | Details |
|------|---------|
| **Core Service** | `lib/sandbox/webcontainer-service.ts` – boots a singleton WebContainer, mounts files, starts dev server, streams status |
| **Preview UI** | `components/webcontainer-preview.tsx` – loading states, toolbar (refresh / fullscreen / open-in-tab), optional console, error handling |
| **Router** | `lib/sandbox-router.ts` – chooses between WebContainer, BrowserPreview, legacy E2B, etc.; governed by feature flag |
| **Fragment Integration** | `components/fragment-preview.tsx` now calls the router and lazy-loads the correct preview component inside a `Suspense` boundary |
| **Feature Flag** | `.env.local → NEXT_PUBLIC_WEBCONTAINERS_MVP=true` enables the new path; safe rollback by toggling to `false` |
| **Dependencies** | Added `@webcontainer/api`, `xterm`, `xterm-addon-fit` in `package.json` |

---

## 2. How to Test

1. **Install deps**
   ```bash
   pnpm install   # or npm install
   ```

2. **Enable flag**
   ```env
   # .env.local
   NEXT_PUBLIC_WEBCONTAINERS_MVP=true
   ```

3. **Run dev server**
   ```bash
   pnpm dev
   ```

4. **Generate an app**
   - Prompt: “create a simple React timer”
   - Observe preview pane → should say **⚡ WebContainer Preview** and load within 1-3 s.

5. **Fallback check**
   - Prompt: “create a Streamlit dashboard”  
     ‑ Should route to legacy **🖥️ Sandbox Preview** (E2B).

6. **Error scenario**
   - Break the code intentionally; WebContainerPreview should surface an error card with retry.

---

## 3. Expected Behavior

| Scenario | Time-to-Preview | Indicator |
|----------|-----------------|-----------|
| Static HTML / CDN React | < 1 s | 🌐 Browser Preview |
| React / Vue / Next.js | 1-3 s | ⚡ WebContainer Preview |
| Python / Streamlit / Gradio | unchanged (legacy) | 🖥️ Sandbox Preview |
| Feature flag off | previous behavior everywhere | – |

Returning to an already-generated app (same session) re-mounts files instantly (< 0.5 s).

---

## 4. Next Steps

1. **Phase-2** – Default WebContainers, keep E2B only for Python.
2. **Phase-3** – Remove Sandpack / InstantPreview components & helpers.
3. **Phase-4** – Deprecate E2B; explore Pyodide for Python in browser.
4. **Phase-5** – Persist built apps to CDN for < 500 ms “app launch” experience.
5. **QA / Metrics** – Instrument boot time, error rate; gradual flag rollout (0→100 %).

---

## 5. Troubleshooting

| Symptom | Possible Cause | Fix |
|---------|----------------|-----|
| _“WebContainer failed to boot”_ | Missing new deps | `pnpm install`; clear browser cache |
| Preview stuck at **Installing dependencies…** | Large npm install inside WC | optimise template; pre-bundle deps; verify network |
| _`Cross-origin isolation` errors_ | Third-party script within WC | remove / load via CDN |
| White iframe, no error | Port not exposed / server didn’t start | ensure template’s `npm run dev` starts on **port 3000**; update `webcontainer-service` map |
| Need rollback | Set `NEXT_PUBLIC_WEBCONTAINERS_MVP=false` and restart dev server |

---

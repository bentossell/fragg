# MVP Sandbox Migration Plan  
**File:** `docs/MVP-SANDBOX-MIGRATION-PLAN.md`  
**Target release:** ✨ Fast-preview single-user MVP (no auth, no Edge/API, no client DB)

---

## 0 · Executive Summary

| Requirement | Solution in this plan |
|-------------|-----------------------|
| < 2 s preview for simple apps | Run code inside the browser with **WebContainers** |
| Works for React / Vue / Vite / static HTML | Use Node-enabled WebContainers; fall back to BrowserPreview for plain HTML |
| AI inside generated apps | Re-use existing `window.AI` + `/api/ai-proxy` (Claude Artifacts pattern) |
| No auth / DB | Continue using `localStorage` for sessions & saved apps |
| Remove E2B, Sandpack, Instant-Preview sprawl | Phased removal with feature flag, type-safe router, rollback at each milestone |

---

## 1 · Prerequisites (Phase 0)

1. **Dependencies**
   ```bash
   pnpm add @webcontainer/api @codesandbox/sandpack-react@latest xterm xterm-addon-fit
   pnpm remove @e2b/code-interpreter
   ```
2. **Feature Flag**  
   Add `NEXT_PUBLIC_WEBCONTAINERS_MVP=true` to `.env.local` to gate new path.

3. **Branch Strategy**  
   Create `feat/webcontainers-mvp` branch.  Ship each phase behind the flag—safety net for rollback.

---

## 2 · Phase 1 – Boot WebContainers Side-by-Side

### 2.1 Core Service  
`lib/sandbox/webcontainer-service.ts`
```ts
import { WebContainer } from '@webcontainer/api';

export class WCService {
  private static instance: WebContainer;
  static async get(): Promise<WebContainer> {
    if (!this.instance) this.instance = await WebContainer.boot();
    return this.instance;
  }
}
```

### 2.2 New Preview Component  
`components/webcontainer-preview.tsx`
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { WCService } from '@/lib/sandbox/webcontainer-service';

export default function WebContainerPreview({ files }: { files: Record<string,string> }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');

  useEffect(() => {
    (async () => {
      try {
        const wc = await WCService.get();
        await wc.mount(files);
        const server = await wc.spawn('npm', ['run','dev']);
        const url = await wc.open(server);
        if (iframeRef.current) iframeRef.current.src = url;
        setStatus('ready');
      } catch(e){ setStatus('error'); }
    })();
  }, [files]);

  if(status==='loading') return <div>Booting…</div>;
  return <iframe ref={iframeRef} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" />;
}
```

### 2.3 Router Integration  
`lib/sandbox-router.ts`
```ts
import { shouldUseBrowserPreview } from '@/lib/feature-flags';
import WebContainerPreview from '@/components/webcontainer-preview';

export function selectSandbox(fragment){
  if(process.env.NEXT_PUBLIC_WEBCONTAINERS_MVP!=='true') return 'legacy';
  if(shouldUseBrowserPreview(null)) return 'browser';
  return 'webcontainer';
}
export const PreviewComponent = { webcontainer: WebContainerPreview };
```

Modify `FragmentPreview` → switch on `selectSandbox`.

### 2.4 Testing Checkpoint #1
- Boot Next.js “hello-world” in <3 s.
- Unit test: `jest` render WebContainerPreview mocks.
- Manual QA on Safari / Chrome.

**Rollback:** flip env flag to `false`.

---

## 3 · Phase 2 – Default to WebContainers, E2B as Fallback

1. Extend detection (`selectSandbox`) to fall back to E2B only for templates containing `"python"` or `"streamlit"`.
2. Keep E2B code path alive but behind `legacy` flag.

**Checkpoint #2**
- React + Vue OK  
- Python → still works through old `/api/sandbox`.

---

## 4 · Phase 3 – Remove Sandpack & Instant Preview

1. Delete:
   ```
   components/sandpack-preview.tsx
   components/instant-preview-*.tsx
   ```
2. Remove `@codesandbox/sandpack-react` if not needed elsewhere.  
3. Purge detection helpers (`shouldUseSandpack`, etc.) and feature flag code.

**Search-and-destroy script**
```bash
grep -R --line-number "SandpackPreview" .
```

**Checkpoint #3**
- App compiles with `pnpm build`.
- Lighthouse check <2 s TTI for “personal site”.

---

## 5 · Phase 4 – Deprecate & Delete E2B

1. Create shim returning error message if template requires backend.
2. Remove `@e2b/code-interpreter` from `package.json`, delete `sandbox-templates/*`.
3. Drop `/app/api/sandbox/route.ts`; replace with stub returning 410 Gone.

**Checkpoint #4**
- All templates route to WebContainers or BrowserPreview.
- No `@e2b` imports remain (`pnpm lint`).

**Rollback:** tag previous commit `pre-e2b-removal`; revert if critical bug.

---

## 6 · Phase 5 – Clean-up & Polishing

- Rename files: `webcontainer-service` → `sandbox-service`.
- Update docs, READMEs.
- Run Playwright E2E scripts: open Timer app (<2 s), Spotify clone (<5 s).

---

## 7 · Timeline & Milestones

| Phase | Work Items | Owner | Est. | Done ↩︎ |
|-------|------------|-------|------|--------|
| 0 | Setup branch & flag | Ben | 0.5 d | |
| 1 | WebContainers boot & preview | Ben | 1.5 d | |
| 2 | Router default switch | Ben | 1 d | |
| 3 | Remove Sandpack/Instant | Ben | 0.5 d | |
| 4 | E2B purge | Ben | 0.5 d | |
| 5 | QA & polish | Ben | 1 d | |
| **Total** | **~5 dev-days** | | | |

---

## 8 · Testing Matrix

| Scenario | Expected | Tested in Phase |
|----------|----------|-----------------|
| Simple HTML “Hello” | <1 s BrowserPreview | 1 |
| React Timer | <2 s WC | 1 |
| Next.js blog | <3 s WC | 2 |
| Legacy Python | 410 Gone w/ msg | 4 |
| AI inside app (`window.AI`) | Returns Claude response | 1 |

---

## 9 · Rollback Strategies

| Point of failure | Action |
|------------------|--------|
| WebContainers won’t boot | Toggle `NEXT_PUBLIC_WEBCONTAINERS_MVP=false` (Phase 0) |
| Unexpected regressions after Sandpack removal | Revert commit `remove-sandpack` tag |
| E2B removal breaks hidden flow | Checkout `pre-e2b-removal` tag and redeploy |

---

## 10 · Next Steps Post-MVP

1. Multi-user (add Supabase auth)
2. Edge Functions for backend code
3. Real DB layer
4. Template-specific optimizations (Python via Pyodide?)

---

**Let’s execute Phase 0 today.**  Once WebContainers preview loads in <3 seconds we can aggressively strip the legacy sandboxes.  
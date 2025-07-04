# PRD: Fragg Personal App Builder

## 1. Product overview

### 1.1 Document title and version
- PRD: Fragg Personal App Builder
- Version: 1.0

### 1.2 Product summary
Fragg is a local-first personal app builder that lets a single user generate and iterate on AI-powered web apps in seconds.  It combines the Vercel AI SDK (for streaming & tool calling) with OpenRouter's 400+ model gateway, and E2B sandboxes for code execution.  The MVP focuses on an exceptional single-user experience with blazing-fast generation, persistent chat sessions, and a polished UI.  A later "Full" phase adds Supabase auth / database and turnkey Vercel deployment so the same experience works online.

## 2. Goals
### 2.1 Business goals
- Deliver a delightful personal app-generation playground
- Reduce iteration time from minutes to <10 s
- Provide a clear upgrade path to cloud & auth when ready

### 2.2 User goals
- Generate & preview beautiful apps quickly
- Resume previous chats/projects
- Enjoy a smooth, modern UI

### 2.3 Non-goals
- Multi-tenant sharing or team collaboration (post-MVP)
- Advanced billing/usage tracking

## 3. User personas
### 3.1 Key user types
- Solo Maker (primary)
- Power Tweaker (secondary)

### 3.2 Basic persona details
- **Solo Maker**: Technical hobbyist exploring AI-generated apps locally.
- **Power Tweaker**: Wants to peek under the hood & fine-tune prompts.

### 3.3 Role-based access
For MVP, all functionality is available when running locally.  Full phase introduces **Authenticated User** via Supabase.

## 4. Functional requirements
- **Fast generation (<10 s)** (Priority: High)
    - Sandbox pooling, parallel streaming, incremental updates
- **Persistent chat sessions** (Priority: High)
    - localStorage manager & ChatGPT-style sidebar
- **Save & reopen projects (single active chat)** (Priority: High)
- **Improved prompt & template selection** (Priority: High)
    - Context-aware instructions to produce beautiful UI
- **Polished UI/UX** (Priority: Medium)
    - Tailwind + shadcn/ui components, dark-mode, animations
- **One-click "Save App" locally** (Priority: Medium)
- **Local login / signup demo** (Priority: Low – optional)
- **Cloud Auth + DB (Supabase)** (Priority: Future)
- **Vercel deployment pipeline** (Priority: Future)

## 5. User experience
### 5.1 Entry points & first-time user flow
- Landing page displays chat + New Chat button.

### 5.2 Core experience
- **Step 1**: User enters prompt.
    - App chooses optimal template (`lib/template-selector.ts`).
- **Step 2**: Streaming code preview appears while sandbox warms.
- **Step 3**: User iterates; user can save project.
- **Step 4**: Selecting "New Project" closes current sandbox and starts a fresh chat.

### 5.3 Advanced features & edge cases
- Reconnecting to killed sandboxes
- Offline usage except AI calls

### 5.4 UI/UX highlights
- Animated skeleton loaders
- shadcn/ui buttons & dialogs

## 6. Narrative
Ben opens Fragg, asks for a "beautiful todo app". Within 7 s a live preview fades in. He tries again, switching to a dashboard template, and later revisits both from the sidebar.

## 7. Success metrics
### 7.1 User-centric metrics
- P95 generation time <10 s
- Zero "sandbox not found" errors
### 7.2 Business metrics
- N/A (personal project)
### 7.3 Technical metrics
- Build & lint pass on every commit

## 8. Technical considerations
### 8.1 Integration points
- Vercel AI SDK ↔ OpenRouter
- E2B sandboxes for code execution
### 8.2 Data storage & privacy
- MVP: localStorage only
- Full: Supabase (RLS)
### 8.3 Scalability & performance
- Sandbox pool size = 3
### 8.4 Potential challenges
- Syncing streamed code with live preview

## 9. Milestones & sequencing
### 9.1 Project estimate
- Small (≈ 1 week for MVP)
### 9.2 Team size & composition
- Solo developer + AI assistant agents
### 9.3 Suggested phases
- **MVP (Local-First)** – Core fast generation & UI (this week)
- **Full Deploy** – Supabase auth & Vercel (later)

## 10. User stories
### 10.1 Generate app quickly
- **ID**: US-001
- **Description**: As a Solo Maker I want to generate a beautiful app in <10 s so that I stay in flow.
- **Acceptance Criteria**:
    - Request returns preview within 10 s 95% of time.
    - No sandbox errors.

### 10.2 Resume previous session
- **ID**: US-002
- **Description**: As a Solo Maker I want to click a past chat in the sidebar to reopen my project.
- **Acceptance Criteria**:
    - Sidebar lists sessions from localStorage.
    - Clicking loads messages & reconnects sandbox.

### 10.3 Save app locally
- **ID**: US-003
- **Description**: As a Solo Maker I want to click "Save App" and see it later in "My Apps".
- **Acceptance Criteria**:
    - App JSON is stored in localStorage.
    - My Apps page renders saved list.

### 10.4 (Future) Sign in
- **ID**: US-004
- **Description**: As a Power Tweaker I want to sign in with GitHub so my projects sync online.
- **Acceptance Criteria**:
    - Supabase auth flow works; sessions stored under user id. 
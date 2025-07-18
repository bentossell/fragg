
Plan 2: Incremental Development Plan
Stage 1: Basic Local Setup (Days 1-3)
Step 1.1: Initial Setup
bash# Clone and setup
git clone https://github.com/e2b-dev/fragments.git personal-app-store
cd personal-app-store
npm install

# Create .env.local
cat > .env.local << EOF
E2B_API_KEY=your-e2b-key
OPENROUTER_API_KEY=your-openrouter-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF

# Test basic functionality
npm run dev
Step 1.2: Minimal OpenRouter Integration

Replace one provider first (OpenAI) with OpenRouter
Test app generation with different models
Verify streaming works correctly

typescript// Quick test in lib/models.ts
export const testOpenRouter = {
  id: 'test',
  name: 'Test OpenRouter',
  provider: 'openrouter',
  providerId: 'openrouter'
}

// In provider configs
openrouter: () => createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
})
Testing checklist:

 Can generate Python code
 Can generate Next.js apps
 Streaming works
 No errors in console

Stage 2: AI SDK in Apps (Days 4-5)
Step 2.1: Simple AI Injection
Start with a basic version that works without auth:
typescript// Create lib/inject-ai.ts
export const injectAI = (code: string) => {
  const aiScript = `
    <script>
      window.AI = {
        async ask(prompt) {
          // For now, just log
          console.log('AI asked:', prompt);
          return 'This will connect to AI soon';
        }
      };
    </script>
  `;
  
  // For HTML-based apps
  if (code.includes('</head>')) {
    return code.replace('</head>', `${aiScript}</head>`);
  }
  
  // For React apps
  if (code.includes('export default')) {
    return `${aiScript}\n${code}`;
  }
  
  return code;
};
Test by generating an app that uses window.AI.ask().
Stage 3: Local Performance & Chat Sessions (Days 6-8) - REVISED FOR LOCAL-FIRST

**NEW APPROACH**: Skip database setup and focus on exceptional local experience with fast app generation, persistent chat sessions, and smooth editing.

Step 3.1: localStorage Session Management
typescript// lib/storage/local-sessions.ts
export class LocalSessionManager {
  private readonly SESSIONS_KEY = 'fragg_sessions'
  private readonly MESSAGES_KEY = 'fragg_messages'
  
  getSessions(): ChatSession[] {
    const data = localStorage.getItem(this.SESSIONS_KEY)
    return data ? JSON.parse(data) : []
  }
  
  createSession(title: string): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const sessions = this.getSessions()
    sessions.unshift(session)
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
    
    return session
  }
  
  updateSession(id: string, updates: Partial<ChatSession>) {
    const sessions = this.getSessions()
    const index = sessions.findIndex(s => s.id === id)
    
    if (index !== -1) {
      sessions[index] = {
        ...sessions[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
    }
  }
}
Step 3.2: ChatGPT-style Sidebar
Implement session management UI:
typescript// components/chat/chat-sidebar.tsx
export function ChatSidebar({ currentSessionId, onSelectSession, onNewSession }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const sessionManager = new LocalSessionManager()
  
  useEffect(() => {
    setSessions(sessionManager.getSessions())
  }, [currentSessionId])
  
  return (
    <div className="w-64 border-r bg-muted/10 h-full flex flex-col">
      <div className="p-4">
        <Button className="w-full" onClick={onNewSession}>
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md mb-1",
                "hover:bg-muted transition-colors",
                currentSessionId === session.id && "bg-muted"
              )}
            >
              <div className="font-medium truncate">{session.title}</div>
              <div className="text-xs text-muted-foreground">
                {formatRelativeTime(session.updatedAt)}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
Step 3.3: Sandbox Reconnection
Prevent "sandbox not found" errors:

```typescript
// lib/sandbox/reconnect.ts
export class SandboxReconnectionManager {
  async getOrCreateSandbox(
    sessionId: string,
    sandboxId: string | undefined,
    template: string
  ): Promise<{ sandbox: Sandbox, isNew: boolean }> {
    // Try to reconnect to existing sandbox
    if (sandboxId) {
      try {
        const sandbox = await Sandbox.reconnect(sandboxId)
        console.log('Reconnected to existing sandbox:', sandboxId)
        return { sandbox, isNew: false }
      } catch (error) {
        console.log('Failed to reconnect, creating new sandbox')
      }
    }
    
    // Create new sandbox
    const sandbox = await Sandbox.create(template, {
      metadata: { sessionId }
    })
    
    return { sandbox, isNew: true }
  }
}
```

Step 3.4: Local "My Apps" Storage
typescript// app/apps/page.tsx
'use client'

import { useEffect, useState } from 'react'

export default function MyAppsPage() {
  const [apps, setApps] = useState([])
  
  useEffect(() => {
    // Load apps from localStorage
    const savedApps = localStorage.getItem('fragg_apps')
    if (savedApps) {
      setApps(JSON.parse(savedApps))
    }
  }, [])
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My Apps</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  )
}
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My Apps</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map(app => (
          <div key={app.id} className="border p-4 rounded">
            <h3>{app.name}</h3>
            <p>{app.framework}</p>
            <button 
              onClick={() => window.open(`/apps/${app.id}`, '_blank')}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
Testing checklist:

 Can save generated apps
 Can list saved apps
 Can reopen saved apps

Stage 4: Auth & Real Database (Days 9-11)
Step 4.1: Add Supabase Auth
typescript// app/login/page.tsx
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  
  return (
    <div className="max-w-md mx-auto mt-8">
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['github', 'google']}
      />
    </div>
  )
}
Step 4.2: Migrate to Real Database
Run the schema from Phase 4, Task 4.1, then update the save function:
typescript// app/api/apps/save/route.ts
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const { name, code, framework } = await req.json()
  
  const { data, error } = await supabase
    .from('apps')
    .insert({
      user_id: user.id,
      name,
      code,
      framework,
      type: 'ui'
    })
    .select()
    .single()
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  
  return Response.json(data)
}
Stage 5: AI Integration in Apps (Days 12-14)
Step 5.1: Implement AI Proxy
Use the code from Phase 3, Task 3.1, but start simple:
typescript// app/api/ai-proxy/route.ts (simplified)
export async function POST(req: Request) {
  const { prompt, appId } = await req.json()
  
  // For testing, just use OpenRouter directly
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }]
    })
  })
  
  const data = await response.json()
  return Response.json(data)
}
Step 5.2: Update AI Injection
typescript// Update lib/inject-ai.ts
export const injectAI = (code: string, appId: string) => {
  const aiScript = `
    <script>
      window.AI = {
        async ask(prompt) {
          const response = await fetch('/api/ai-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, appId: '${appId}' })
          });
          const data = await response.json();
          return data.choices[0].message.content;
        }
      };
    </script>
  `;
  // ... rest of injection logic
};
Stage 6: App Store Features (Days 15-17)
Step 6.1: App Gallery
Create a simple public gallery:
typescript// app/store/page.tsx
export default async function AppStorePage() {
  const supabase = await createClient()
  
  const { data: apps } = await supabase
    .from('apps')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">App Store</h1>
      <AppGrid apps={apps || []} />
    </div>
  )
}
Step 6.2: PWA Support
Add manifest generation:
typescript// app/apps/[id]/manifest.json/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  
  const { data: app } = await supabase
    .from('apps')
    .select('name, description, manifest')
    .eq('id', params.id)
    .single()
  
  if (!app) {
    return new Response('Not found', { status: 404 })
  }
  
  return Response.json(app.manifest || generateManifest(app))
}
Stage 7: Automations (Days 18-20)
Step 7.1: Simple Scheduler
Start with Vercel Cron for scheduled tasks:
typescript// vercel.json
{
  "crons": [{
    "path": "/api/cron",
    "schedule": "*/5 * * * *"  // Every 5 minutes
  }]
}
Step 7.2: Background Execution
Use Vercel Edge Functions for simple automation:
typescript// app/api/automations/run/route.ts
export const runtime = 'edge'

export async function POST(req: Request) {
  const { appId } = await req.json()
  
  // Get app code
  const supabase = await createClient()
  const { data: app } = await supabase
    .from('apps')
    .select('code, type')
    .eq('id', appId)
    .eq('type', 'automation')
    .single()
  
  if (!app) {
    return new Response('Not found', { status: 404 })
  }
  
  // Execute automation code
  try {
    // For now, use eval in a limited context
    const result = await executeAutomation(app.code)
    
    return Response.json({ success: true, result })
  } catch (error) {
    return Response.json({ success: false, error: error.message })
  }
}
Testing Strategy Throughout
After Each Stage:

Manual Testing

Test all new features manually
Check for console errors
Verify data persistence


Integration Tests
typescript// __tests__/integration/apps.test.ts
import { createApp, getApps } from '@/lib/apps'

describe('App Management', () => {
  it('should create and retrieve apps', async () => {
    const app = await createApp({
      name: 'Test App',
      framework: 'nextjs',
      code: { /* ... */ }
    })
    
    expect(app.id).toBeDefined()
    
    const apps = await getApps()
    expect(apps).toContainEqual(app)
  })
})

E2E Tests
typescript// e2e/app-creation.spec.ts
import { test, expect } from '@playwright/test'

test('create and run app', async ({ page }) => {
  await page.goto('/chat')
  await page.fill('[data-testid="prompt"]', 'Create a simple counter app')
  await page.click('[data-testid="generate"]')
  
  await expect(page.locator('[data-testid="preview"]')).toBeVisible()
  
  await page.click('[data-testid="save-app"]')
  await expect(page).toHaveURL(/\/apps\/[\w-]+/)
})

## Summary of Local-First Approach

The revised Stage 3 focuses on creating an exceptional local experience without requiring any database setup:

1. **Chat Sessions**: Persistent across refreshes using localStorage
2. **Sidebar Navigation**: ChatGPT-style UI for managing multiple projects
3. **Sandbox Persistence**: Reconnect to existing sandboxes, no more "not found" errors
4. **Local App Storage**: Save and manage apps without Supabase
5. **Fast Performance**: All data operations are instant

This approach lets you build and test the core experience locally. When ready for multi-device sync or sharing features, you can easily migrate to Supabase in Stage 4.
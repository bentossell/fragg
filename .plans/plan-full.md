Plan 1: Comprehensive Transformation Plan
Phase 1: Foundation & Dependencies Update
Task 1.1: Clone and Audit
Subtasks:

Clone the fragments repository
Run npm audit to identify security issues
Create a dependency update checklist
Document current architecture and flow

Task 1.2: Update Core Dependencies
Subtasks:

Update to Next.js 15
bashnpm install next@latest react@latest react-dom@latest

Update Vercel AI SDK to 4.2+
bashnpm install ai@latest @ai-sdk/openai@latest @ai-sdk/react@latest

Replace auth-helpers with modern Supabase SSR
bashnpm uninstall @supabase/auth-helpers-nextjs
npm install @supabase/supabase-js@latest @supabase/ssr@latest

Update other dependencies
bashnpm update
npm install @upstash/ratelimit@latest @upstash/redis@latest


Task 1.3: Fix Breaking Changes
Subtasks:

Update AI SDK streaming implementation
typescript// Old: app/api/chat/route.ts
// From: OpenAIStream, StreamingTextResponse
// To: streamText, convertToCoreMessages

Update Supabase client creation
typescript// utils/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

Update middleware for new auth flow
Fix TypeScript errors from updates

Phase 2: OpenRouter Integration
Task 2.1: Replace Multi-Provider System
Subtasks:

Create OpenRouter provider
typescript// lib/providers/openrouter.ts
import { createOpenAI } from '@ai-sdk/openai'

export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'Personal App Store'
  }
})

Simplify model configuration
typescript// lib/models.ts
export const models = [
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'google/gemini-pro', name: 'Gemini Pro' },
  // Add more as needed
]

Update chat API route
typescript// app/api/chat/route.ts
import { streamText } from 'ai'
import { openrouter } from '@/lib/providers/openrouter'

export async function POST(req: Request) {
  const { messages, model = 'anthropic/claude-3-haiku' } = await req.json()
  
  const result = await streamText({
    model: openrouter(model),
    messages,
    // Add system prompts for app generation
  })
  
  return result.toDataStreamResponse()
}


Phase 3: AI API Integration for Generated Apps
Task 3.1: Create AI Proxy System
Subtasks:

Build secure AI proxy endpoint
typescript// app/api/ai-proxy/route.ts
import { createClient } from '@/utils/supabase/server'
import { streamText } from 'ai'
import { openrouter } from '@/lib/providers/openrouter'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const { messages, model, appId, stream = false } = await req.json()
  
  // Validate app ownership
  const { data: app } = await supabase
    .from('apps')
    .select('id')
    .eq('id', appId)
    .eq('user_id', user.id)
    .single()
  
  if (!app) {
    return new Response('App not found', { status: 404 })
  }
  
  // Log usage
  await supabase.from('ai_usage').insert({
    user_id: user.id,
    app_id: appId,
    model,
    timestamp: new Date().toISOString()
  })
  
  if (stream) {
    const result = await streamText({
      model: openrouter(model),
      messages,
    })
    return result.toDataStreamResponse()
  } else {
    const result = await generateText({
      model: openrouter(model),
      messages,
    })
    return Response.json(result)
  }
}

Create client SDK for injection
typescript// lib/app-sdk.ts
export const APP_SDK_CODE = `
window.AI = {
  async chat(messages, options = {}) {
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: options.model || 'anthropic/claude-3-haiku',
        appId: window.__APP_ID__,
        stream: false
      })
    });
    if (!response.ok) throw new Error('AI request failed');
    return response.json();
  },
  
  async streamChat(messages, onChunk, options = {}) {
    const response = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: options.model || 'anthropic/claude-3-haiku',
        appId: window.__APP_ID__,
        stream: true
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      onChunk(chunk);
    }
  }
};`

Modify sandbox execution to inject SDK
typescript// lib/sandbox.ts
import { APP_SDK_CODE } from './app-sdk'

export async function executeInSandbox(code: string, appId: string) {
  // Inject SDK before user code
  const fullCode = `
    ${APP_SDK_CODE}
    window.__APP_ID__ = '${appId}';
    ${code}
  `
  // Continue with existing sandbox execution
}


Phase 4: Database Schema & Auth
Task 4.1: Set Up Supabase Tables
Subtasks:

Create migration file
sql-- supabase/migrations/001_initial_schema.sql

-- Apps table
CREATE TABLE apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  type TEXT CHECK (type IN ('ui', 'service', 'automation')),
  framework TEXT NOT NULL, -- 'nextjs', 'streamlit', 'python', etc
  code JSONB NOT NULL,
  config JSONB DEFAULT '{}',
  manifest JSONB, -- PWA manifest
  is_public BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App versions
CREATE TABLE app_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  code JSONB NOT NULL,
  changelog TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, version)
);

-- App runs/executions
CREATE TABLE app_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'running', 'success', 'failed')),
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Scheduled automations
CREATE TABLE app_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI usage tracking
CREATE TABLE ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  tokens_used INTEGER,
  cost DECIMAL(10, 6),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own apps" ON apps
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public apps" ON apps
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their app versions" ON app_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM apps WHERE apps.id = app_versions.app_id 
      AND apps.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_apps_user_id ON apps(user_id);
CREATE INDEX idx_apps_type ON apps(type);
CREATE INDEX idx_app_runs_status ON app_runs(status);
CREATE INDEX idx_app_schedules_next_run ON app_schedules(next_run) WHERE enabled = true;

Create database types
typescript// types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      apps: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          icon_url: string | null
          type: 'ui' | 'service' | 'automation'
          framework: string
          code: Json
          config: Json
          manifest: Json | null
          is_public: boolean
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['apps']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['apps']['Insert']>
      }
      // Add other tables...
    }
  }
}


Phase 5: App Store Features
Task 5.1: App Management System
Subtasks:

Create app CRUD operations
typescript// lib/apps.ts
import { createClient } from '@/utils/supabase/server'

export async function createApp(data: {
  name: string
  description?: string
  type: 'ui' | 'service' | 'automation'
  framework: string
  code: any
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')
  
  const { data: app, error } = await supabase
    .from('apps')
    .insert({
      ...data,
      user_id: user.id,
      manifest: generateManifest(data)
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Create initial version
  await supabase.from('app_versions').insert({
    app_id: app.id,
    version: 1,
    code: data.code
  })
  
  return app
}

export async function updateApp(id: string, updates: any) {
  const supabase = await createClient()
  
  // Get current version
  const { data: currentVersion } = await supabase
    .from('app_versions')
    .select('version')
    .eq('app_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .single()
  
  // Update app
  const { data: app, error } = await supabase
    .from('apps')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  
  // Create new version if code changed
  if (updates.code) {
    await supabase.from('app_versions').insert({
      app_id: id,
      version: (currentVersion?.version || 0) + 1,
      code: updates.code,
      changelog: updates.changelog
    })
  }
  
  return app
}

Create app store UI components
typescript// components/app-store/AppGrid.tsx
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AppGrid({ apps }: { apps: App[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  )
}

function AppCard({ app }: { app: App }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{app.name}</h3>
          <p className="text-sm text-muted-foreground">{app.description}</p>
          <div className="flex gap-2 mt-2">
            <Badge>{app.type}</Badge>
            <Badge variant="secondary">{app.framework}</Badge>
          </div>
        </div>
        <AppIcon url={app.icon_url} name={app.name} />
      </div>
      <div className="flex gap-2 mt-4">
        <Button size="sm" asChild>
          <Link href={`/apps/${app.id}`}>Open</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => installApp(app)}>
          Install
        </Button>
      </div>
    </Card>
  )
}

Create PWA manifest generator
typescript// lib/pwa.ts
export function generateManifest(app: {
  name: string
  description?: string
  id?: string
}) {
  return {
    name: app.name,
    short_name: app.name.slice(0, 12),
    description: app.description || `${app.name} - Personal App`,
    start_url: `/apps/${app.id}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: `/api/icon?text=${encodeURIComponent(app.name)}`,
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: `/api/icon?text=${encodeURIComponent(app.name)}&size=512`,
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  }
}


Task 5.2: Background Services
Subtasks:

Set up job queue for automations
typescript// lib/queue.ts
import { Queue } from 'bullmq'
import { Redis } from '@upstash/redis'

export const automationQueue = new Queue('automations', {
  connection: Redis.fromEnv()
})

// Worker (in separate process or serverless function)
import { Worker } from 'bullmq'

export const automationWorker = new Worker(
  'automations',
  async (job) => {
    const { appId, userId } = job.data
    
    // Get app code
    const { data: app } = await supabase
      .from('apps')
      .select('code, config')
      .eq('id', appId)
      .single()
    
    // Execute in sandbox
    const result = await executeInSandbox(app.code, appId, {
      config: app.config,
      userId
    })
    
    // Save run result
    await supabase.from('app_runs').insert({
      app_id: appId,
      user_id: userId,
      status: result.success ? 'success' : 'failed',
      result: result.data,
      error: result.error,
      completed_at: new Date().toISOString()
    })
    
    return result
  },
  { connection: Redis.fromEnv() }
)

Create cron scheduler
typescript// app/api/cron/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { automationQueue } from '@/lib/queue'
import { CronJob } from 'cron'

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  const supabase = await createClient()
  
  // Get all enabled schedules that need to run
  const now = new Date()
  const { data: schedules } = await supabase
    .from('app_schedules')
    .select('*, apps(user_id)')
    .lte('next_run', now.toISOString())
    .eq('enabled', true)
  
  // Queue each app for execution
  for (const schedule of schedules || []) {
    await automationQueue.add('run-automation', {
      appId: schedule.app_id,
      userId: schedule.apps.user_id,
      scheduleId: schedule.id
    })
    
    // Calculate next run time
    const cronJob = new CronJob(schedule.cron_expression)
    const nextRun = cronJob.nextDate().toJSDate()
    
    await supabase
      .from('app_schedules')
      .update({
        last_run: now.toISOString(),
        next_run: nextRun.toISOString()
      })
      .eq('id', schedule.id)
  }
  
  return NextResponse.json({ 
    processed: schedules?.length || 0 
  })
}

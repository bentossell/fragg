import { NextRequest, NextResponse } from 'next/server'
import { codeOrchestrator, StreamingUpdate } from '@/lib/ai-orchestrator'
import { sandboxPool } from '@/lib/sandbox-pool'
import { templateCache } from '@/lib/template-cache'
import ratelimit from '@/lib/ratelimit'

export const maxDuration = 60
export const runtime = 'nodejs'

// Rate limiting configuration
const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20')
const ratelimitWindow = '1h' as const

interface GenerateRequest {
  prompt: string
  userID?: string
  teamID?: string
  useCache?: boolean
  priority?: 'ultra-fast' | 'fast' | 'standard'
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body: GenerateRequest = await req.json()
    const { prompt, userID, teamID, useCache = true, priority } = body
    
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }
    
    // Rate limiting
    const limit = await ratelimit(
      req.headers.get('x-forwarded-for'),
      rateLimitMaxRequests,
      ratelimitWindow
    )
    
    if (limit) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: limit.reset 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.amount.toString(),
            'X-RateLimit-Remaining': limit.remaining.toString(),
            'X-RateLimit-Reset': limit.reset.toString(),
          }
        }
      )
    }
    
    console.log(`🚀 Generation request from ${userID || 'anonymous'}: "${prompt.slice(0, 100)}..."`)
    
    // Check for instant template match first (sub-1-second response)
    if (useCache) {
      const suggestion = templateCache.suggestTemplate(prompt)
      
      if (suggestion.confidence > 0.8 && suggestion.quickStart) {
        console.log(`⚡ Using instant template: ${suggestion.quickStart}`)
        
        const instant = templateCache.generateInstant(
          suggestion.quickStart.includes('landing') ? 'landing' :
          suggestion.quickStart.includes('dashboard') ? 'dashboard' :
          suggestion.quickStart.includes('calculator') ? 'tool' : 'tool',
          { title: extractTitle(prompt) }
        )
        
        return NextResponse.json({
          code: instant.code,
          template: instant.template,
          dependencies: [],
          executionTime: instant.executionTime,
          metadata: {
            method: 'instant-template',
            cached: true,
            triageTime: 0,
            generationTime: instant.executionTime,
            totalAgents: 0,
            priority: 'ultra-fast'
          }
        })
      }
    }
    
    // Use full orchestrator for complex requests
    console.log('🎯 Using full AI orchestrator for complex generation')
    
    const result = await codeOrchestrator.generateApp(prompt)
    
    console.log(`✅ Generation complete in ${result.executionTime}ms`)
    console.log(`📊 Stats: ${result.agentResults.length} agents, ${result.metadata.errors.length} errors, ${result.metadata.fallbacks} fallbacks`)
    
    // Prepare response with comprehensive metadata
    const response = {
      code: result.code,
      template: result.template,
      dependencies: result.dependencies,
      executionTime: result.executionTime,
      metadata: {
        method: 'ai-orchestrator',
        cached: false,
        triageTime: result.metadata.triageTime,
        generationTime: result.metadata.generationTime,
        assemblyTime: result.metadata.assemblyTime,
        totalAgents: result.metadata.totalAgents,
        errors: result.metadata.errors,
        fallbacks: result.metadata.fallbacks,
        agentResults: result.agentResults.map(r => ({
          agent: r.agentName,
          executionTime: r.executionTime,
          codeLength: r.code.length,
          success: !r.errors?.length,
          metadata: r.metadata
        })),
        priority: result.agentResults[0]?.metadata?.priority || 'standard'
      },
      // Sandbox information if available
      sandbox: await getSandboxInfo(result.template)
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('❌ Generation failed:', error)
    
    const executionTime = Date.now() - startTime
    
    // Try fallback to instant template
    try {
      const fallback = templateCache.generateInstant('tool', {
        title: 'Generated App',
        description: 'Fallback application due to generation error'
      })
      
      return NextResponse.json({
        code: fallback.code,
        template: fallback.template,
        dependencies: [],
        executionTime: executionTime,
        metadata: {
          method: 'fallback-template',
          cached: true,
          error: error.message,
          priority: 'ultra-fast'
        }
      })
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          error: 'Generation failed and fallback unavailable',
          details: error.message,
          executionTime
        },
        { status: 500 }
      )
    }
  }
}

// Server-Sent Events for real-time updates
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const prompt = url.searchParams.get('prompt')
  
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt parameter required' }, { status: 400 })
  }
  
  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      
      // Function to send updates
      const sendUpdate = (update: StreamingUpdate) => {
        const data = `data: ${JSON.stringify(update)}\n\n`
        controller.enqueue(encoder.encode(data))
      }
      
      // Start generation with real-time updates
      codeOrchestrator.generateApp(prompt, sendUpdate)
        .then(result => {
          // Send final result
          sendUpdate({
            type: 'complete',
            data: result,
            timestamp: Date.now()
          })
          controller.close()
        })
        .catch(error => {
          sendUpdate({
            type: 'complete', 
            data: { error: error.message },
            timestamp: Date.now()
          })
          controller.close()
        })
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

// Utility functions
function extractTitle(prompt: string): string {
  // Try to extract a meaningful title from the prompt
  const titleMatch = prompt.match(/(?:build|create|make|generate)\s+(?:a\s+)?(.{1,50}?)(?:\s+(?:app|application|website|page|tool|game))?/i)
  
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1]
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
  
  // Fallback to first few words
  return prompt
    .split(' ')
    .slice(0, 4)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

async function getSandboxInfo(template: string) {
  try {
    const stats = sandboxPool.getPoolStats()
    const templateStats = stats[template]
    
    return {
      template,
      available: templateStats?.availableSandboxes || 0,
      total: templateStats?.totalSandboxes || 0,
      averageInitTime: templateStats?.averageInitTime || 0,
      hitRate: templateStats?.hitRate || 0
    }
  } catch (error) {
    return {
      template,
      available: 0,
      total: 0,
      averageInitTime: 0,
      hitRate: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    // Quick health checks
    const orchestratorHealthy = !!codeOrchestrator
    const poolStats = sandboxPool.getPoolStats()
    const templateCount = templateCache.getTemplateNames().length
    
    return new Response(null, {
      status: orchestratorHealthy && templateCount > 0 ? 200 : 503,
      headers: {
        'X-Orchestrator-Healthy': orchestratorHealthy.toString(),
        'X-Template-Count': templateCount.toString(),
        'X-Pool-Size': Object.keys(poolStats).length.toString(),
      }
    })
  } catch (error) {
    return new Response(null, { status: 503 })
  }
} 
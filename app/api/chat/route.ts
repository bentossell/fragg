import { Duration } from '@/lib/duration'
import { getModelClient } from '@/lib/models'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import ratelimit from '@/lib/ratelimit'
import { fragmentSchema as schema } from '@/lib/schema'
import templates, { Templates } from '@/lib/templates'
import { selectOptimalTemplate } from '@/lib/template-selector'
import { streamObject, LanguageModel, CoreMessage } from 'ai'
import { codeOrchestrator, StreamingUpdate } from '@/lib/ai-orchestrator'
import { templateCache } from '@/lib/template-cache'
import { sandboxPool } from '@/lib/sandbox-pool'

export const maxDuration = 60

const rateLimitMaxRequests = process.env.RATE_LIMIT_MAX_REQUESTS
  ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
  : 10
const ratelimitWindow = process.env.RATE_LIMIT_WINDOW
  ? (process.env.RATE_LIMIT_WINDOW as Duration)
  : '1d'

export async function POST(req: Request) {
  const {
    messages,
    userID,
    teamID,
    template,
    model,
    config = {},
    useOptimized = true, // Enable optimized generation by default
  }: {
    messages: CoreMessage[]
    userID: string | undefined
    teamID: string | undefined
    template: Templates
    model: LLMModel
    config: LLMModelConfig
    useOptimized?: boolean
  } = await req.json()

  // Add defensive check for template
  if (!template && !templates) {
    return new Response('No template configuration provided', {
      status: 400,
    })
  }

  const limit = !config.apiKey
    ? await ratelimit(
        req.headers.get('x-forwarded-for'),
        rateLimitMaxRequests,
        ratelimitWindow,
      )
    : false

  if (limit) {
    return new Response('You have reached your request limit for the day.', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.amount.toString(),
        'X-RateLimit-Remaining': limit.remaining.toString(),
        'X-RateLimit-Reset': limit.reset.toString(),
      },
    })
  }

  console.log('userID', userID)
  console.log('teamID', teamID)
  // console.log('template', template)
  console.log('model', model)
  console.log('useOptimized', useOptimized)

  // Extract the user's prompt from the last message
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()
  const userPrompt = lastUserMessage?.content || ''

  // If optimized generation is enabled and we have a simple prompt, use the fast path
  if (useOptimized && typeof userPrompt === 'string' && userPrompt.trim()) {
    try {
      const startTime = Date.now()
      
      // Check for instant template match first (sub-1-second response)
      const suggestion = templateCache.suggestTemplate(userPrompt)
      
      if (suggestion.confidence > 0.8 && suggestion.quickStart) {
        console.log(`⚡ Using instant template: ${suggestion.quickStart}`)
        
        const instant = templateCache.generateInstant(
          suggestion.quickStart.includes('landing') ? 'landing' :
          suggestion.quickStart.includes('dashboard') ? 'dashboard' :
          suggestion.quickStart.includes('calculator') ? 'tool' : 'tool',
          { title: extractTitle(userPrompt) }
        )
        
        // Convert instant result to fragment schema format
        const fragment = {
          code: instant.code,
          template: instant.template,
          title: extractTitle(userPrompt),
          commentary: `Generated using instant template in ${instant.executionTime}ms`,
        }
        
        // Stream the response in the expected format
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`0:"${JSON.stringify(fragment).replace(/"/g, '\\"')}"\n`))
            controller.close()
          }
        })
        
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Generation-Method': 'instant-template',
            'X-Execution-Time': instant.executionTime.toString(),
          }
        })
      }
      
      // Use full orchestrator for complex requests with streaming updates
      console.log('🎯 Using AI orchestrator for optimized generation')
      
      // Check if this is an iteration on existing code
      let existingCode = ''
      let existingTemplate = ''
      
      // Look for existing code in the conversation history
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          const assistantMessage = messages[i]
          // Check if the message has code content
          if (assistantMessage.content && typeof assistantMessage.content === 'object') {
            const codeContent = (assistantMessage.content as any).code
            if (codeContent) {
              existingCode = codeContent
              existingTemplate = (assistantMessage.content as any).template || 'nextjs-developer'
              break
            }
          }
        }
      }
      
      // Create a transform stream to convert orchestrator updates to the expected format
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const encoder = new TextEncoder()
      
      // Track generation progress
      let currentFragment: any = {
        title: extractTitle(userPrompt),
        commentary: 'Analyzing your request...',
        code: '',
        template: 'nextjs-developer'
      }
      
      // Function to send fragment updates
      const sendFragmentUpdate = (fragment: any) => {
        writer.write(encoder.encode(`0:"${JSON.stringify(fragment).replace(/"/g, '\\"')}"\n`))
      }
      
      // Start generation with streaming updates
      codeOrchestrator.generateApp(userPrompt, (update: StreamingUpdate) => {
        switch (update.type) {
          case 'triage':
            currentFragment.commentary = `Selected ${update.data.result?.stack} stack (${update.data.executionTime}ms)`
            currentFragment.template = update.data.result?.template || 'nextjs-developer'
            sendFragmentUpdate(currentFragment)
            break
            
          case 'agent_start':
            currentFragment.commentary = `Running ${update.data.agents.length} specialized agents...`
            sendFragmentUpdate(currentFragment)
            break
            
          case 'agent_complete':
            const completedAgents = update.data.completedAgents || 1
            const totalAgents = update.data.totalAgents || update.data.agents?.length || 1
            currentFragment.commentary = `Processing... (${completedAgents}/${totalAgents} agents complete)`
            if (update.data.partialCode) {
              currentFragment.code = update.data.partialCode
            }
            sendFragmentUpdate(currentFragment)
            break
            
          case 'assembly':
            currentFragment.commentary = 'Assembling final application...'
            sendFragmentUpdate(currentFragment)
            break
            
          case 'complete':
            if (update.data.error) {
              currentFragment.commentary = `Error: ${update.data.error}`
            } else {
              currentFragment.code = update.data.code
              currentFragment.template = update.data.template
              currentFragment.commentary = `✨ Generation complete in ${update.data.executionTime}ms!`
            }
            sendFragmentUpdate(currentFragment)
            writer.close()
            break
        }
      }, existingCode).catch(error => {
        currentFragment.commentary = `Error: ${error.message}`
        sendFragmentUpdate(currentFragment)
        writer.close()
      })
      
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Generation-Method': 'ai-orchestrator',
        }
      })
      
    } catch (error) {
      console.error('Optimized generation failed, falling back to standard:', error)
      // Fall through to standard generation
    }
  }

  // Provide default model if undefined
  const defaultModel = {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'OpenRouter',
    providerId: 'openrouter'
  }
  
  const modelToUse = model || defaultModel
  
  // Smart template selection based on user's last message
  let templateToUse = template || templates
  
  // If auto mode (all templates), select optimal template based on user prompt
  if (templateToUse === templates || !templateToUse) {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()
    const userPrompt = lastUserMessage?.content || ''
    const optimalTemplate = selectOptimalTemplate(String(userPrompt)) as keyof typeof templates
    
    // Ensure the selected template exists
    if (!templates[optimalTemplate]) {
      console.error(`Selected template ${optimalTemplate} not found, falling back to nextjs-developer`)
      templateToUse = { 'nextjs-developer': templates['nextjs-developer'] } as Templates
    } else {
      templateToUse = { [optimalTemplate]: templates[optimalTemplate] } as Templates
    }
  }
  
  const { model: modelNameString, apiKey: modelApiKey, ...modelParams } = config
  const modelClient = getModelClient(modelToUse, config)

  try {
    const stream = await streamObject({
      model: modelClient as LanguageModel,
      schema,
      system: toPrompt(templateToUse),
      messages,
      maxRetries: 0, // do not retry on errors
      ...modelParams,
    })

    return stream.toTextStreamResponse()
  } catch (error: any) {
    const isRateLimitError =
      error && (error.statusCode === 429 || error.message.includes('limit'))
    const isOverloadedError =
      error && (error.statusCode === 529 || error.statusCode === 503)
    const isAccessDeniedError =
      error && (error.statusCode === 403 || error.statusCode === 401)

    if (isRateLimitError) {
      return new Response(
        'The provider is currently unavailable due to request limit. Try using your own API key.',
        {
          status: 429,
        },
      )
    }

    if (isOverloadedError) {
      return new Response(
        'The provider is currently unavailable. Please try again later.',
        {
          status: 529,
        },
      )
    }

    if (isAccessDeniedError) {
      return new Response(
        'Access denied. Please make sure your API key is valid.',
        {
          status: 403,
        },
      )
    }

    console.error('Error:', error)

    return new Response(
      'An unexpected error has occurred. Please try again later.',
      {
        status: 500,
      },
    )
  }
}

// Utility function to extract title from prompt
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

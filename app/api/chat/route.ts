import { Duration } from '@/lib/duration'
import { getModelClient } from '@/lib/models'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import ratelimit from '@/lib/ratelimit'
import { fragmentSchema as schema } from '@/lib/schema'
import templates, { Template, TemplateId } from '@/lib/templates'
import { selectOptimalTemplate } from '@/lib/template-selector'
import { streamObject, LanguageModel, CoreMessage } from 'ai'
import { codeOrchestrator, StreamingUpdate } from '@/lib/ai-orchestrator'

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
    template: Record<TemplateId, Template>
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
      console.log('🎯 Using AI orchestrator for optimized generation')

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
      }, '').catch(error => {
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
      templateToUse = { 'nextjs-developer': templates['nextjs-developer'] } as Record<TemplateId, Template>
    } else {
      templateToUse = { [optimalTemplate]: templates[optimalTemplate] } as Record<TemplateId, Template>
    }
  }
  
  // Final safety check for templateToUse
  if (!templateToUse || typeof templateToUse !== 'object' || Object.keys(templateToUse).length === 0) {
    console.error('templateToUse is invalid, using default nextjs-developer template')
    templateToUse = { 'nextjs-developer': templates['nextjs-developer'] } as Record<TemplateId, Template>
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

import { Duration } from '@/lib/duration'
import { getModelClient } from '@/lib/models'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import ratelimit from '@/lib/ratelimit'
import { fragmentSchema as schema } from '@/lib/schema'
import templates, { Template, TemplateId } from '@/lib/templates'
import { selectOptimalTemplate } from '@/lib/template-selector'
import { streamObject, LanguageModel, CoreMessage } from 'ai'

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
    model, 
    template, 
    existingCode,
    config
  } = await req.json()

  // Extract the user's prompt from the last message
  const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()
  const userPrompt = Array.isArray(lastUserMessage?.content) 
    ? lastUserMessage.content.find((c: any) => c.type === 'text')?.text 
    : lastUserMessage?.content

  console.log('🚀 Chat API: Processing request')
  console.log('- Model:', model?.id || 'default')
  console.log('- Template:', template || 'auto')
  console.log('- User prompt:', userPrompt?.substring(0, 100) + '...')

  // Rate limiting
  try {
    const identifier = req.headers.get('x-forwarded-for') ?? 'anonymous'
    const rateLimitResult = await ratelimit(identifier, rateLimitMaxRequests, ratelimitWindow)
    if (rateLimitResult) {
      console.log('❌ Rate limit exceeded for:', identifier)
      return new Response('Rate limit exceeded', { status: 429 })
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
  }

  // Generate unique request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`🎯 Starting generation [${requestId}]`)

  // Use default model if none provided
  const defaultModel = {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'OpenRouter',
    providerId: 'openrouter'
  }
  
  const modelToUse = model || defaultModel
  
  // Smart template selection
  let templateToUse = template || templates
  
  if (!template || template === 'auto') {
    try {
      const optimalTemplate = selectOptimalTemplate(userPrompt || '')
      console.log(`🎯 Auto-selected template: ${optimalTemplate}`)
      
      // Ensure the selected template exists in our templates
      if (optimalTemplate && templates[optimalTemplate as TemplateId]) {
        templateToUse = { [optimalTemplate]: templates[optimalTemplate as TemplateId] }
      } else {
        console.warn(`Selected template "${optimalTemplate}" not found, using all templates`)
        templateToUse = templates
      }
    } catch (error) {
      console.warn('Template selection failed, using default:', error)
      templateToUse = templates
    }
  }

  // Additional validation to ensure templateToUse is valid
  if (!templateToUse || typeof templateToUse !== 'object') {
    console.warn('Invalid templateToUse, falling back to default templates')
    templateToUse = templates
  }

  // Get model configuration
  let modelClient: any
  let modelParams: any = {}

  try {
    modelClient = getModelClient(modelToUse, config || {})
    console.log('✅ Model client configured:', modelToUse.id)
  } catch (error) {
    console.error('❌ Failed to get model client:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: 'Model configuration error', details: errorMessage }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Execute generation with proper AI SDK streaming
  try {
    console.log(`🔄 Generating with model: ${modelToUse.id}`)
    console.log(`📄 Using prompt template:`, typeof templateToUse === 'string' ? templateToUse : 'dynamic')
    
    const stream = await streamObject({
      model: modelClient as LanguageModel,
      schema,
      system: toPrompt(templateToUse),
      messages: messages as CoreMessage[],
      maxRetries: 2,
      ...modelParams,
    })

    console.log(`✅ Stream created successfully [${requestId}]`)

    return stream.toTextStreamResponse({
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Request-ID': requestId,
        'X-Generation-Method': 'ai-sdk-streaming',
        'X-Model': modelToUse.id,
        'X-Template': typeof templateToUse === 'string' ? templateToUse : 'dynamic',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error: any) {
    console.error(`❌ Generation error [${requestId}]:`, error)
    
    const isRateLimitError = error && (error.statusCode === 429 || error.message.includes('limit'))
    const isOverloadedError = error && (error.statusCode === 529 || error.statusCode === 503)
    const isAccessDeniedError = error && (error.statusCode === 403 || error.statusCode === 401)

    if (isRateLimitError) {
      return new Response(
        JSON.stringify({
          error: 'Rate Limit Exceeded',
          details: 'The AI provider is currently rate limited. Please try again in a moment.',
          retryAfter: 60
        }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      )
    }

    if (isOverloadedError) {
      return new Response(
        JSON.stringify({
          error: 'Service Temporarily Unavailable',
          details: 'The AI provider is currently overloaded. Please try again in a moment.',
          retryAfter: 30
        }),
        { 
          status: 503, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': '30'
          } 
        }
      )
    }

    if (isAccessDeniedError) {
      return new Response(
        JSON.stringify({
          error: 'Access Denied',
          details: 'API key invalid or insufficient permissions. Please check your configuration.',
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generic error
    return new Response(
      JSON.stringify({
        error: 'Generation Failed',
        details: error.message || 'An unexpected error occurred during generation.',
        requestId
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
}

function extractTitle(prompt: string): string {
  const words = prompt.toLowerCase().split(' ')
  const appKeywords = ['app', 'application', 'tool', 'calculator', 'generator', 'converter', 'manager', 'dashboard', 'tracker', 'game', 'quiz', 'form']
  const actionKeywords = ['create', 'build', 'make', 'generate', 'design', 'develop']
  
  const filteredWords = words.filter(word => 
    !actionKeywords.includes(word) && 
    !['a', 'an', 'the', 'with', 'that', 'for', 'to', 'of', 'in', 'on', 'at', 'by'].includes(word) &&
    word.length > 2
  )
  
  const appType = words.find(word => appKeywords.includes(word))
  
  if (filteredWords.length > 0) {
    const mainWords = filteredWords.slice(0, 3).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
    
    if (appType && !mainWords.toLowerCase().includes(appType)) {
      return `${mainWords} ${appType.charAt(0).toUpperCase() + appType.slice(1)}`
    }
    return mainWords
  }
  
  return 'Generated App'
}

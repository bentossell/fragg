import { createOpenAI } from '@ai-sdk/openai'

// Single OpenRouter provider for all models
export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'Personal App Store'
  }
})

// Model presets for different use cases
export const models = {
  // Fast, cheap model for simple tasks
  fast: 'anthropic/claude-3-haiku',
  
  // Balanced model for app generation
  balanced: 'anthropic/claude-sonnet-4',
  
  // Powerful model for complex apps
  powerful: 'openai/gpt-4-turbo',
  
  // Cost-optimized (routes to cheapest)
  cheap: 'anthropic/claude-3-haiku:floor',
  
  // Speed-optimized (routes to fastest)
  turbo: 'anthropic/claude-3.5-sonnet:nitro'
}

// Export specific model functions for convenience
export const fastModel = () => openrouter(models.fast)
export const balancedModel = () => openrouter(models.balanced)
export const powerfulModel = () => openrouter(models.powerful)
export const cheapModel = () => openrouter(models.cheap)
export const turboModel = () => openrouter(models.turbo)

// Get model by ID (for compatibility with existing code)
export function getModelById(modelId: string) {
  return openrouter(modelId)
}
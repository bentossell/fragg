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
  fast: 'anthropic/claude-3.5-haiku',
  
  // Balanced model for app generation (default)
  balanced: 'anthropic/claude-sonnet-4',
  
  // Powerful model for complex apps
  powerful: 'anthropic/claude-opus-4',
  
  // Cost-optimized (routes to cheapest)
  cheap: 'deepseek/deepseek-chat:free',
  
  // Speed-optimized (routes to fastest)
  turbo: 'google/gemini-2.5-flash',
  
  // Reasoning models
  reasoning: 'openai/o3',
  reasoningMini: 'openai/o3-mini'
}

// Export specific model functions for convenience
export const fastModel = () => openrouter(models.fast)
export const balancedModel = () => openrouter(models.balanced)
export const powerfulModel = () => openrouter(models.powerful)
export const cheapModel = () => openrouter(models.cheap)
export const turboModel = () => openrouter(models.turbo)
export const reasoningModel = () => openrouter(models.reasoning)
export const reasoningMiniModel = () => openrouter(models.reasoningMini)

// Get model by ID (for compatibility with existing code)
export function getModelById(modelId: string) {
  return openrouter(modelId)
}
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

export type LLMModel = {
  id: string
  name: string
  provider: string
  providerId: string
}

export type LLMModelConfig = {
  model?: string
  apiKey?: string
  baseURL?: string
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
}

export function getModelClient(model: LLMModel, config: LLMModelConfig) {
  const { id: modelNameString, providerId } = model
  const { apiKey, baseURL } = config

  switch (providerId) {
    case 'openrouter':
      return createOpenAI({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
        baseURL: baseURL || 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Personal App Store',
        }
      })(modelNameString)

    case 'openai':
      return createOpenAI({ 
        apiKey: apiKey || process.env.OPENAI_API_KEY, 
        baseURL 
      })(modelNameString)

    case 'anthropic':
      return createAnthropic({ 
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY, 
        baseURL 
      })(modelNameString)

    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}
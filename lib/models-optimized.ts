/**
 * Optimized Model Configurations
 * 
 * This module provides optimized model configurations for different tasks
 * in the code generation pipeline. It focuses on using the right model
 * for each task to optimize for speed, quality, and cost.
 */

import { LLMModelConfig } from './models'

/**
 * Task-specific model optimization types
 */
export type ModelTask = 
  | 'template-detection'  // Detecting which template to use (needs to be FAST)
  | 'code-generation'     // Generating full code (needs to be POWERFUL)
  | 'code-completion'     // Completing partial code (needs to be FAST)
  | 'code-explanation'    // Explaining code (needs to be BALANCED)
  | 'incremental-update'  // Making small changes (needs to be PRECISE)

/**
 * Performance profile for model selection
 */
export type PerformanceProfile = 
  | 'fastest'    // Sub-second response, may sacrifice quality
  | 'fast'       // 1-3 second response, good quality
  | 'balanced'   // 3-5 second response, high quality
  | 'powerful'   // 5+ second response, highest quality
  | 'cost-effective' // Optimized for cost rather than speed

/**
 * Optimized model configurations for different tasks
 */
export const OPTIMIZED_MODELS: Record<ModelTask, Record<PerformanceProfile, string>> = {
  'template-detection': {
    'fastest': 'google/gemini-2.5-flash-lite-preview-06-17', // Ultra fast for classification
    'fast': 'google/gemini-2.5-flash-lite-preview-06-17',
    'balanced': 'google/gemini-2.5-flash-lite-preview-06-17',
    'powerful': 'google/gemini-2.5-flash',
    'cost-effective': 'deepseek/deepseek-chat:free'
  },
  'code-generation': {
    'fastest': 'google/gemini-2.5-flash',
    'fast': 'anthropic/claude-sonnet-4',
    'balanced': 'anthropic/claude-sonnet-4',
    'powerful': 'anthropic/claude-3-5-sonnet',
    'cost-effective': 'google/gemini-2.5-flash'
  },
  'code-completion': {
    'fastest': 'google/gemini-2.5-flash-lite-preview-06-17',
    'fast': 'google/gemini-2.5-flash',
    'balanced': 'anthropic/claude-sonnet-4',
    'powerful': 'anthropic/claude-3-5-sonnet',
    'cost-effective': 'deepseek/deepseek-chat:free'
  },
  'code-explanation': {
    'fastest': 'google/gemini-2.5-flash',
    'fast': 'anthropic/claude-sonnet-4',
    'balanced': 'anthropic/claude-sonnet-4',
    'powerful': 'anthropic/claude-3-5-sonnet',
    'cost-effective': 'google/gemini-2.5-flash'
  },
  'incremental-update': {
    'fastest': 'google/gemini-2.5-flash',
    'fast': 'anthropic/claude-sonnet-4',
    'balanced': 'anthropic/claude-sonnet-4',
    'powerful': 'anthropic/claude-3-5-sonnet',
    'cost-effective': 'google/gemini-2.5-flash'
  }
}

/**
 * Default model configurations with optimized parameters
 */
export const MODEL_CONFIGURATIONS: Record<string, Partial<LLMModelConfig>> = {
  'google/gemini-2.5-flash-lite-preview-06-17': {
    temperature: 0, // Deterministic for consistency in template detection
    max_tokens: 100, // Short responses for classification
    top_p: 1.0,
    streaming: true
  },
  'google/gemini-2.5-flash': {
    temperature: 0.2, // Low temperature for consistent code
    max_tokens: 4000, // Longer for full code generation
    top_p: 0.95,
    streaming: true
  },
  'anthropic/claude-sonnet-4': {
    temperature: 0.3,
    max_tokens: 4000,
    top_p: 0.9,
    streaming: true
  },
  'anthropic/claude-3-5-sonnet': {
    temperature: 0.5, // Higher temperature for more creative solutions
    max_tokens: 8000, // Very long for complex code
    top_p: 0.9,
    streaming: true
  },
  'deepseek/deepseek-chat:free': {
    temperature: 0.1,
    max_tokens: 2000,
    top_p: 1.0,
    streaming: true
  }
}

/**
 * Get the optimal model for a specific task and performance profile
 */
export function getOptimalModel(
  task: ModelTask, 
  profile: PerformanceProfile = 'balanced'
): LLMModelConfig {
  const modelId = OPTIMIZED_MODELS[task][profile]
  const baseConfig = MODEL_CONFIGURATIONS[modelId] || {}
  
  return {
    model: modelId,
    ...baseConfig
  }
}

/**
 * Get a fast model specifically for template detection
 * This is optimized for ultra-fast classification
 */
export function getTemplateDetectionModel(): LLMModelConfig {
  return getOptimalModel('template-detection', 'fastest')
}

/**
 * Get a model for code generation based on complexity
 */
export function getCodeGenerationModel(complexity: 'simple' | 'medium' | 'complex' = 'medium'): LLMModelConfig {
  const profile: PerformanceProfile = 
    complexity === 'simple' ? 'fast' :
    complexity === 'complex' ? 'powerful' : 'balanced'
  
  return getOptimalModel('code-generation', profile)
}

/**
 * Get a model for incremental code updates
 */
export function getIncrementalUpdateModel(): LLMModelConfig {
  return getOptimalModel('incremental-update', 'fast')
}

/**
 * Get a cost-effective model for development/testing
 */
export function getDevTestingModel(): LLMModelConfig {
  return getOptimalModel('code-generation', 'cost-effective')
}

/**
 * Determine code complexity based on prompt
 */
export function determineComplexity(prompt: string): 'simple' | 'medium' | 'complex' {
  const lowerPrompt = prompt.toLowerCase()
  
  // Check for complex indicators
  const complexIndicators = [
    'database', 'authentication', 'authorization', 'oauth',
    'real-time', 'websocket', 'graphql', 'state management',
    'complex', 'advanced', 'enterprise', 'production-ready',
    'scalable', 'high-performance', 'secure', 'full-stack'
  ]
  
  // Check for simple indicators
  const simpleIndicators = [
    'simple', 'basic', 'beginner', 'hello world', 'starter',
    'example', 'demo', 'counter', 'todo', 'calculator'
  ]
  
  // Count indicators
  const complexCount = complexIndicators.filter(i => lowerPrompt.includes(i)).length
  const simpleCount = simpleIndicators.filter(i => lowerPrompt.includes(i)).length
  
  // Determine complexity
  if (complexCount >= 2 || prompt.length > 200) {
    return 'complex'
  } else if (simpleCount >= 1 || prompt.length < 50) {
    return 'simple'
  } else {
    return 'medium'
  }
}

/**
 * Get the optimal model based on user prompt
 * This analyzes the prompt to determine the best model
 */
export function getModelForPrompt(prompt: string): LLMModelConfig {
  const complexity = determineComplexity(prompt)
  return getCodeGenerationModel(complexity)
}

/**
 * Pipeline optimization: Get all models needed for the generation pipeline
 * This allows for preloading/warming up the models
 */
export function getPipelineModels(): Record<string, LLMModelConfig> {
  return {
    templateDetection: getTemplateDetectionModel(),
    simpleGeneration: getCodeGenerationModel('simple'),
    standardGeneration: getCodeGenerationModel('medium'),
    complexGeneration: getCodeGenerationModel('complex'),
    incrementalUpdate: getIncrementalUpdateModel()
  }
}

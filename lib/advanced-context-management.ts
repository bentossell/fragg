import { Message } from './messages'
import { TriageResult } from './ai-triage'
import { ExecutionResult } from './types'

export interface ContextualMemory {
  id: string
  sessionId: string
  timestamp: number
  type: 'app_state' | 'user_preference' | 'conversation_turn' | 'error_resolution' | 'success_pattern'
  content: {
    userPrompt?: string
    triageResult?: TriageResult
    generatedCode?: string
    executionResult?: ExecutionResult
    userFeedback?: 'positive' | 'negative' | 'neutral'
    resolutionStrategy?: string
    metadata?: Record<string, any>
  }
  relevanceScore: number
  tags: string[]
  embeddings?: number[] // For semantic similarity search
}

export interface ContextWindow {
  totalTokens: number
  usedTokens: number
  availableTokens: number
  priorities: ContextPriority[]
  optimizations: ContextOptimization[]
}

export interface ContextPriority {
  type: 'current_request' | 'recent_history' | 'user_preferences' | 'error_context' | 'success_patterns'
  weight: number
  maxTokens: number
}

export interface ContextOptimization {
  action: 'compress' | 'summarize' | 'remove' | 'prioritize'
  target: string
  expectedSavings: number
  qualityImpact: number
}

export interface SmartContextResult {
  optimizedContext: string
  memoryUsed: ContextualMemory[]
  tokensUsed: number
  optimizationsApplied: ContextOptimization[]
  confidenceScore: number
  recommendations: string[]
}

// Advanced context management with memory and optimization
export class AdvancedContextManager {
  private static instance: AdvancedContextManager
  private memories = new Map<string, ContextualMemory[]>()
  private globalMemories: ContextualMemory[] = []
  private maxMemoriesPerSession = 50
  private maxGlobalMemories = 200
  private contextWindowSize = 8000 // tokens

  static getInstance(): AdvancedContextManager {
    if (!AdvancedContextManager.instance) {
      AdvancedContextManager.instance = new AdvancedContextManager()
    }
    return AdvancedContextManager.instance
  }

  /**
   * Store a memory from a conversation turn
   */
  storeMemory(
    sessionId: string,
    type: ContextualMemory['type'],
    content: ContextualMemory['content'],
    tags: string[] = []
  ): ContextualMemory {
    const memory: ContextualMemory = {
      id: crypto.randomUUID(),
      sessionId,
      timestamp: Date.now(),
      type,
      content,
      relevanceScore: this.calculateInitialRelevance(type, content),
      tags,
      embeddings: this.generateEmbeddings(content)
    }

    // Store in session memories
    if (!this.memories.has(sessionId)) {
      this.memories.set(sessionId, [])
    }
    
    const sessionMemories = this.memories.get(sessionId)!
    sessionMemories.push(memory)

    // Keep only recent memories per session
    if (sessionMemories.length > this.maxMemoriesPerSession) {
      sessionMemories.splice(0, sessionMemories.length - this.maxMemoriesPerSession)
    }

    // Store important memories globally
    if (this.isGloballyRelevant(memory)) {
      this.globalMemories.push(memory)
      
      // Keep only most relevant global memories
      if (this.globalMemories.length > this.maxGlobalMemories) {
        this.globalMemories.sort((a, b) => b.relevanceScore - a.relevanceScore)
        this.globalMemories = this.globalMemories.slice(0, this.maxGlobalMemories)
      }
    }

    return memory
  }

  /**
   * Retrieve relevant context for a new request
   */
  getRelevantContext(
    sessionId: string,
    currentPrompt: string,
    triageResult: TriageResult,
    maxTokens: number = this.contextWindowSize
  ): SmartContextResult {
    // Get memories from multiple sources
    const sessionMemories = this.memories.get(sessionId) || []
    const relevantGlobalMemories = this.findRelevantGlobalMemories(currentPrompt, triageResult)
    const allMemories = [...sessionMemories, ...relevantGlobalMemories]

    // Score and rank memories
    const scoredMemories = this.scoreMemoriesForRelevance(allMemories, currentPrompt, triageResult)

    // Optimize context window usage
    const contextWindow = this.analyzeContextWindow(maxTokens)
    const optimizedMemories = this.optimizeContextSelection(scoredMemories, contextWindow, triageResult)

    // Build optimized context
    const optimizedContext = this.buildOptimizedContext(optimizedMemories, currentPrompt, triageResult)

    // Calculate metrics
    const tokensUsed = this.estimateTokens(optimizedContext)
    const confidenceScore = this.calculateContextConfidence(optimizedMemories, triageResult)

    return {
      optimizedContext,
      memoryUsed: optimizedMemories,
      tokensUsed,
      optimizationsApplied: this.getAppliedOptimizations(optimizedMemories, contextWindow),
      confidenceScore,
      recommendations: this.generateContextRecommendations(optimizedMemories, contextWindow)
    }
  }

  /**
   * Update memory relevance based on feedback
   */
  updateMemoryRelevance(
    memoryId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    context?: string
  ): void {
    // Find memory across all sessions
    let foundMemory: ContextualMemory | undefined

    for (const memories of this.memories.values()) {
      foundMemory = memories.find(m => m.id === memoryId)
      if (foundMemory) break
    }

    if (!foundMemory) {
      foundMemory = this.globalMemories.find(m => m.id === memoryId)
    }

    if (foundMemory) {
      // Update relevance score based on feedback
      const adjustment = feedback === 'positive' ? 0.1 : feedback === 'negative' ? -0.2 : 0
      foundMemory.relevanceScore = Math.max(0, Math.min(1, foundMemory.relevanceScore + adjustment))
      
      // Add feedback context
      if (!foundMemory.content.metadata) {
        foundMemory.content.metadata = {}
      }
      foundMemory.content.metadata.lastFeedback = feedback
      foundMemory.content.metadata.feedbackContext = context
    }
  }

  /**
   * Extract user preferences from conversation history
   */
  extractUserPreferences(sessionId: string): Record<string, any> {
    const sessionMemories = this.memories.get(sessionId) || []
    const preferences: Record<string, any> = {}

    // Analyze patterns in user requests and feedback
    const successfulPatterns = sessionMemories.filter(m => 
      m.content.userFeedback === 'positive' && m.type === 'success_pattern'
    )

    // Extract framework preferences
    const frameworks = successfulPatterns
      .map(m => m.content.triageResult?.stack)
      .filter(Boolean)
    
    if (frameworks.length > 0) {
      const frameworkCounts = frameworks.reduce((acc, fw) => {
        acc[fw!] = (acc[fw!] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      preferences.preferredFramework = Object.entries(frameworkCounts)
        .sort(([,a], [,b]) => b - a)[0][0]
    }

    // Extract style preferences
    const styles = successfulPatterns
      .map(m => m.content.triageResult?.context.preferences.stylePreference)
      .filter(Boolean)
    
    if (styles.length > 0) {
      const styleCounts = styles.reduce((acc, style) => {
        acc[style!] = (acc[style!] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      preferences.preferredStyle = Object.entries(styleCounts)
        .sort(([,a], [,b]) => b - a)[0][0]
    }

    // Extract complexity preferences
    const complexities = successfulPatterns
      .map(m => m.content.triageResult?.requirements.complexity)
      .filter(Boolean)
    
    if (complexities.length > 0) {
      const complexityCounts = complexities.reduce((acc, comp) => {
        acc[comp!] = (acc[comp!] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      preferences.preferredComplexity = Object.entries(complexityCounts)
        .sort(([,a], [,b]) => b - a)[0][0]
    }

    // Extract domain expertise
    const domains = sessionMemories
      .map(m => m.content.triageResult?.context.domain)
      .filter(Boolean)
    
    if (domains.length > 0) {
      const domainCounts = domains.reduce((acc, domain) => {
        acc[domain!] = (acc[domain!] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      preferences.frequentDomains = Object.entries(domainCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([domain]) => domain)
    }

    return preferences
  }

  /**
   * Get conversation summary for context preservation
   */
  getConversationSummary(sessionId: string, maxTokens: number = 500): string {
    const sessionMemories = this.memories.get(sessionId) || []
    
    if (sessionMemories.length === 0) {
      return 'No previous conversation history.'
    }

    // Get recent successful interactions
    const recentMemories = sessionMemories
      .filter(m => m.type === 'conversation_turn' || m.type === 'success_pattern')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)

    const summaryParts: string[] = []

    // Add conversation flow
    if (recentMemories.length > 0) {
      const recentRequests = recentMemories
        .map(m => m.content.userPrompt)
        .filter(Boolean)
        .slice(0, 3)
      
      if (recentRequests.length > 0) {
        summaryParts.push(`Recent requests: ${recentRequests.join(' → ')}`)
      }
    }

    // Add user preferences
    const preferences = this.extractUserPreferences(sessionId)
    if (Object.keys(preferences).length > 0) {
      const prefSummary = Object.entries(preferences)
        .filter(([key, value]) => key.startsWith('preferred') && value)
        .map(([key, value]) => `${key.replace('preferred', '').toLowerCase()}: ${value}`)
        .join(', ')
      
      if (prefSummary) {
        summaryParts.push(`User preferences: ${prefSummary}`)
      }
    }

    // Add recent successes/failures
    const successCount = sessionMemories.filter(m => m.content.userFeedback === 'positive').length
    const failureCount = sessionMemories.filter(m => m.content.userFeedback === 'negative').length
    
    if (successCount > 0 || failureCount > 0) {
      summaryParts.push(`Session feedback: ${successCount} positive, ${failureCount} negative`)
    }

    const summary = summaryParts.join('. ')
    
    // Truncate if too long
    if (this.estimateTokens(summary) > maxTokens) {
      const words = summary.split(' ')
      const targetWords = Math.floor(words.length * (maxTokens / this.estimateTokens(summary)))
      return words.slice(0, targetWords).join(' ') + '...'
    }

    return summary
  }

  /**
   * Clean up old memories to manage storage
   */
  cleanupMemories(): void {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago

    // Clean session memories
    for (const [sessionId, memories] of this.memories.entries()) {
      const recentMemories = memories.filter(m => 
        m.timestamp > cutoffTime || m.relevanceScore > 0.7
      )
      
      if (recentMemories.length === 0) {
        this.memories.delete(sessionId)
      } else {
        this.memories.set(sessionId, recentMemories)
      }
    }

    // Clean global memories
    this.globalMemories = this.globalMemories.filter(m => 
      m.timestamp > cutoffTime || m.relevanceScore > 0.8
    )
  }

  /**
   * Generate context for error recovery
   */
  getErrorRecoveryContext(
    sessionId: string,
    error: string,
    failedCode?: string
  ): string {
    const sessionMemories = this.memories.get(sessionId) || []
    
    // Find similar errors and their resolutions
    const errorMemories = sessionMemories.filter(m => 
      m.type === 'error_resolution' && 
      m.content.metadata?.error?.toLowerCase().includes(error.toLowerCase())
    )

    // Find successful patterns that might help
    const successfulPatterns = sessionMemories.filter(m => 
      m.type === 'success_pattern' && 
      m.relevanceScore > 0.6
    )

    const contextParts: string[] = []

    if (errorMemories.length > 0) {
      const recentError = errorMemories[errorMemories.length - 1]
      contextParts.push(`Previous similar error resolution: ${recentError.content.resolutionStrategy}`)
    }

    if (successfulPatterns.length > 0) {
      const patterns = successfulPatterns
        .slice(-2)
        .map(p => p.content.metadata?.pattern || 'successful approach')
        .join(', ')
      contextParts.push(`Successful patterns to consider: ${patterns}`)
    }

    if (failedCode) {
      const codeAnalysis = this.analyzeFailedCode(failedCode)
      contextParts.push(`Failed code analysis: ${codeAnalysis}`)
    }

    return contextParts.join('\n\n')
  }

  // Private helper methods

  private calculateInitialRelevance(type: ContextualMemory['type'], content: ContextualMemory['content']): number {
    let score = 0.5 // base score

    // Boost for successful interactions
    if (content.userFeedback === 'positive') score += 0.3
    if (content.userFeedback === 'negative') score -= 0.1

    // Boost for certain types
    switch (type) {
      case 'success_pattern': score += 0.2; break
      case 'error_resolution': score += 0.1; break
      case 'user_preference': score += 0.15; break
      case 'app_state': score += 0.05; break
    }

    // Boost for complex or useful content
    if (content.triageResult?.requirements.complexity === 'complex') score += 0.1
    if (content.executionResult) score += 0.1 // successful execution

    return Math.max(0, Math.min(1, score))
  }

  private generateEmbeddings(content: ContextualMemory['content']): number[] {
    // Simple embedding generation based on content analysis
    // In a real implementation, this would use a proper embedding model
    const text = [
      content.userPrompt || '',
      content.triageResult?.context.domain || '',
      content.triageResult?.stack || '',
      content.resolutionStrategy || ''
    ].join(' ')

    // Generate simple feature vector based on text characteristics
    const features = new Array(128).fill(0)
    
    // Simple hash-based features (in real implementation, use proper embeddings)
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      features[charCode % 128] += 1
    }

    // Normalize
    const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? features.map(f => f / magnitude) : features
  }

  private isGloballyRelevant(memory: ContextualMemory): boolean {
    return memory.relevanceScore > 0.7 && (
      memory.type === 'success_pattern' ||
      memory.type === 'error_resolution' ||
      (memory.type === 'user_preference' && memory.relevanceScore > 0.8)
    )
  }

  private findRelevantGlobalMemories(prompt: string, triageResult: TriageResult): ContextualMemory[] {
    return this.globalMemories
      .filter(m => 
        m.content.triageResult?.stack === triageResult.stack ||
        m.content.triageResult?.context.domain === triageResult.context.domain
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5)
  }

  private scoreMemoriesForRelevance(
    memories: ContextualMemory[],
    prompt: string,
    triageResult: TriageResult
  ): ContextualMemory[] {
    return memories
      .map(memory => {
        let score = memory.relevanceScore

        // Boost for same framework/domain
        if (memory.content.triageResult?.stack === triageResult.stack) score += 0.2
        if (memory.content.triageResult?.context.domain === triageResult.context.domain) score += 0.1

        // Boost for recency
        const ageInDays = (Date.now() - memory.timestamp) / (24 * 60 * 60 * 1000)
        if (ageInDays < 1) score += 0.1
        else if (ageInDays < 7) score += 0.05

        // Boost for semantic similarity (simplified)
        if (memory.content.userPrompt && this.calculateSimilarity(prompt, memory.content.userPrompt) > 0.7) {
          score += 0.15
        }

        return { ...memory, relevanceScore: score }
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  private analyzeContextWindow(maxTokens: number): ContextWindow {
    return {
      totalTokens: maxTokens,
      usedTokens: 0,
      availableTokens: maxTokens,
      priorities: [
        { type: 'current_request', weight: 0.4, maxTokens: maxTokens * 0.4 },
        { type: 'recent_history', weight: 0.3, maxTokens: maxTokens * 0.3 },
        { type: 'user_preferences', weight: 0.15, maxTokens: maxTokens * 0.15 },
        { type: 'success_patterns', weight: 0.1, maxTokens: maxTokens * 0.1 },
        { type: 'error_context', weight: 0.05, maxTokens: maxTokens * 0.05 }
      ],
      optimizations: []
    }
  }

  private optimizeContextSelection(
    memories: ContextualMemory[],
    contextWindow: ContextWindow,
    triageResult: TriageResult
  ): ContextualMemory[] {
    const selectedMemories: ContextualMemory[] = []
    let usedTokens = 0

    // Prioritize by type and relevance
    const prioritizedMemories = memories.slice(0, 20) // Top 20 most relevant

    for (const memory of prioritizedMemories) {
      const memoryTokens = this.estimateMemoryTokens(memory)
      
      if (usedTokens + memoryTokens <= contextWindow.availableTokens * 0.8) {
        selectedMemories.push(memory)
        usedTokens += memoryTokens
      }
    }

    return selectedMemories
  }

  private buildOptimizedContext(
    memories: ContextualMemory[],
    currentPrompt: string,
    triageResult: TriageResult
  ): string {
    const contextParts: string[] = []

    // Add conversation summary
    const recentTurns = memories
      .filter(m => m.type === 'conversation_turn')
      .slice(-3)
      .map(m => `User: ${m.content.userPrompt}`)
      .join('\n')
    
    if (recentTurns) {
      contextParts.push(`Recent conversation:\n${recentTurns}`)
    }

    // Add relevant patterns
    const successPatterns = memories
      .filter(m => m.type === 'success_pattern')
      .slice(0, 2)
      .map(m => m.content.resolutionStrategy || 'Successful approach')
      .join(', ')
    
    if (successPatterns) {
      contextParts.push(`Successful patterns: ${successPatterns}`)
    }

    // Add user preferences
    const preferences = memories
      .filter(m => m.type === 'user_preference')
      .slice(0, 3)
      .map(m => {
        const pref = m.content.triageResult?.context.preferences
        return pref ? `${pref.stylePreference} style, ${pref.framework} framework preference` : ''
      })
      .filter(Boolean)
      .join(', ')
    
    if (preferences) {
      contextParts.push(`User preferences: ${preferences}`)
    }

    return contextParts.join('\n\n')
  }

  private getAppliedOptimizations(memories: ContextualMemory[], contextWindow: ContextWindow): ContextOptimization[] {
    // Return optimizations that were applied during context selection
    return [
      {
        action: 'prioritize',
        target: 'relevant_memories',
        expectedSavings: contextWindow.totalTokens * 0.2,
        qualityImpact: 0.1
      }
    ]
  }

  private generateContextRecommendations(memories: ContextualMemory[], contextWindow: ContextWindow): string[] {
    const recommendations: string[] = []

    if (memories.length < 3) {
      recommendations.push('Consider providing more context about your requirements')
    }

    if (contextWindow.usedTokens / contextWindow.totalTokens > 0.8) {
      recommendations.push('Context window is nearly full - consider summarizing previous conversation')
    }

    const hasUserPreferences = memories.some(m => m.type === 'user_preference')
    if (!hasUserPreferences) {
      recommendations.push('Share your preferences for better personalized responses')
    }

    return recommendations
  }

  private calculateContextConfidence(memories: ContextualMemory[], triageResult: TriageResult): number {
    let confidence = 0.5

    // Boost for relevant memories
    const relevantMemories = memories.filter(m => m.relevanceScore > 0.6)
    confidence += Math.min(0.3, relevantMemories.length * 0.1)

    // Boost for user preferences
    const preferences = memories.filter(m => m.type === 'user_preference')
    confidence += Math.min(0.1, preferences.length * 0.05)

    // Boost for success patterns
    const successPatterns = memories.filter(m => m.type === 'success_pattern')
    confidence += Math.min(0.1, successPatterns.length * 0.05)

    return Math.min(1, confidence)
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation based on word overlap
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    
    const intersection = new Set([...set1].filter(word => set2.has(word)))
    const union = new Set([...set1, ...set2])
    
    return intersection.size / union.size
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4) // Rough estimation
  }

  private estimateMemoryTokens(memory: ContextualMemory): number {
    const content = [
      memory.content.userPrompt || '',
      memory.content.resolutionStrategy || '',
      JSON.stringify(memory.content.metadata || {})
    ].join(' ')
    
    return this.estimateTokens(content)
  }

  private analyzeFailedCode(code: string): string {
    const issues: string[] = []

    if (code.includes('undefined')) issues.push('undefined values detected')
    if (code.includes('null')) issues.push('null values present')
    if (!code.includes('export')) issues.push('missing export statement')
    if (code.includes('error') || code.includes('Error')) issues.push('error handling needed')

    return issues.length > 0 ? issues.join(', ') : 'no obvious issues detected'
  }
}

// Export the singleton instance
export const advancedContextManager = AdvancedContextManager.getInstance() 
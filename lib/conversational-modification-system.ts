import { advancedContextManager } from './advanced-context-management'
import { naturalLanguageProcessor } from './natural-language-processor'
import { openrouter } from './ai-config'

export interface ConversationContext {
  sessionId: string
  userId?: string
  currentCode: string
  codeHistory: Array<{ version: string; timestamp: number; description: string }>
  conversationHistory: ConversationTurn[]
  activeComponents: string[]
  userIntents: UserIntent[]
  preferences: UserPreferences
  metadata: {
    domain: string
    framework: string
    language: string
    complexity: 'simple' | 'medium' | 'complex'
  }
}

export interface ConversationTurn {
  id: string
  timestamp: number
  userMessage: string
  aiResponse: string
  intent: UserIntent
  context: {
    referenceElements: string[]
    ambiguousTerms: string[]
    clarificationNeeded: boolean
    confidence: number
  }
  actions: ModificationAction[]
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'requires_clarification'
  feedback?: UserFeedback
}

export interface UserIntent {
  primary: 'add' | 'modify' | 'remove' | 'fix' | 'refactor' | 'style' | 'optimize' | 'explain' | 'question'
  secondary?: string[]
  confidence: number
  description: string
  targetElements: string[]
  scope: 'component' | 'function' | 'style' | 'global' | 'feature'
  urgency: 'low' | 'medium' | 'high'
  complexity: 'simple' | 'medium' | 'complex'
}

export interface ModificationAction {
  type: 'code_change' | 'suggestion' | 'question' | 'explanation' | 'confirmation'
  description: string
  targetFile?: string
  targetElement?: string
  changeType?: 'add' | 'modify' | 'remove' | 'replace'
  code?: string
  reason?: string
  alternatives?: string[]
  confidence: number
  requiresApproval: boolean
  dependencies?: string[]
}

export interface UserPreferences {
  verbosity: 'minimal' | 'detailed' | 'comprehensive'
  confirmationLevel: 'never' | 'major' | 'always'
  suggestionFrequency: 'never' | 'occasional' | 'frequent'
  explanationStyle: 'concise' | 'detailed' | 'tutorial'
  codeStyle: {
    formatting: 'auto' | 'preserve' | 'strict'
    naming: 'camelCase' | 'snake_case' | 'kebab-case'
    comments: 'minimal' | 'detailed' | 'comprehensive'
  }
}

export interface UserFeedback {
  type: 'positive' | 'negative' | 'neutral'
  specific?: string
  suggestions?: string[]
  rating?: number
  timestamp: number
}

export interface ConversationResponse {
  message: string
  actions: ModificationAction[]
  clarificationQuestions?: string[]
  suggestions?: string[]
  quickActions?: QuickAction[]
  contextInfo?: {
    currentFocus: string
    availableElements: string[]
    recentChanges: string[]
  }
  nextSteps?: string[]
}

export interface QuickAction {
  id: string
  label: string
  description: string
  icon?: string
  action: ModificationAction
  category: 'common' | 'contextual' | 'smart'
}

export interface INaturalLanguageProcessor {
  extractIntent(message: string, context: ConversationContext): Promise<UserIntent>
  identifyReferences(message: string, context: ConversationContext): Promise<string[]>
  detectAmbiguity(message: string, context: ConversationContext): Promise<string[]>
  generateClarificationQuestions(ambiguities: string[], context: ConversationContext): Promise<string[]>
  analyzeConversationFlow(turns: ConversationTurn[]): Promise<ConversationInsight>
}

export interface ConversationInsight {
  patterns: string[]
  userExpertise: 'beginner' | 'intermediate' | 'advanced'
  preferredStyle: string
  commonIntents: string[]
  learningOpportunities: string[]
}

export class ConversationalModificationSystem {
  private conversations = new Map<string, ConversationContext>()
  private nlpProcessor: INaturalLanguageProcessor
  private intentRecognizer: IntentRecognizer
  private contextManager: ConversationContextManager
  private smartAssistant: SmartAssistant
  private multiTurnManager: MultiTurnManager

  constructor() {
    this.nlpProcessor = new NaturalLanguageProcessor()
    this.intentRecognizer = new IntentRecognizer()
    this.contextManager = new ConversationContextManager()
    this.smartAssistant = new SmartAssistant()
    this.multiTurnManager = new MultiTurnManager()
  }

  /**
   * Process a conversational modification request
   */
  async processConversation(
    sessionId: string,
    userMessage: string,
    currentCode: string,
    options: {
      userId?: string
      preserveContext?: boolean
      enableSuggestions?: boolean
      requireConfirmation?: boolean
    } = {}
  ): Promise<ConversationResponse> {
    // Get or create conversation context
    const context = await this.getOrCreateContext(sessionId, currentCode, options)
    
    // Process natural language to extract intent
    const intent = await this.nlpProcessor.extractIntent(userMessage, context)
    
    // Identify references and ambiguities
    const references = await this.nlpProcessor.identifyReferences(userMessage, context)
    const ambiguities = await this.nlpProcessor.detectAmbiguity(userMessage, context)
    
    // Create conversation turn
    const turn: ConversationTurn = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      userMessage,
      aiResponse: '', // Will be filled later
      intent,
      context: {
        referenceElements: references,
        ambiguousTerms: ambiguities,
        clarificationNeeded: ambiguities.length > 0,
        confidence: intent.confidence
      },
      actions: [],
      status: ambiguities.length > 0 ? 'requires_clarification' : 'processing'
    }

    // Add turn to context
    context.conversationHistory.push(turn)
    context.userIntents.push(intent)

    // Handle clarification if needed
    if (ambiguities.length > 0) {
      const clarificationQuestions = await this.nlpProcessor.generateClarificationQuestions(
        ambiguities,
        context
      )
      
      return {
        message: this.generateClarificationMessage(clarificationQuestions, context),
        actions: [],
        clarificationQuestions,
        contextInfo: {
          currentFocus: intent.targetElements.join(', '),
          availableElements: context.activeComponents,
          recentChanges: context.codeHistory.slice(-3).map(h => h.description)
        }
      }
    }

    // Generate modification actions
    const actions = await this.generateModificationActions(intent, context)
    turn.actions = actions

    // Generate smart suggestions
    const suggestions = options.enableSuggestions 
      ? await this.smartAssistant.generateSuggestions(intent, context)
      : []

    // Generate quick actions
    const quickActions = await this.generateQuickActions(intent, context)

    // Generate response message
    const message = await this.generateResponseMessage(intent, actions, context)
    turn.aiResponse = message

    // Update context
    await this.updateConversationContext(context, turn)

    return {
      message,
      actions,
      suggestions,
      quickActions,
      contextInfo: {
        currentFocus: intent.targetElements.join(', '),
        availableElements: context.activeComponents,
        recentChanges: context.codeHistory.slice(-3).map(h => h.description)
      },
      nextSteps: await this.suggestNextSteps(intent, context)
    }
  }

  /**
   * Apply modifications with conversation context
   */
  async applyModifications(
    sessionId: string,
    actionIds: string[],
    userApproval: boolean = true,
    feedback?: UserFeedback
  ): Promise<{
    success: boolean
    modifiedCode: string
    appliedActions: ModificationAction[]
    errors?: string[]
    nextSuggestions?: string[]
  }> {
    const context = this.conversations.get(sessionId)
    if (!context) {
      throw new Error('Conversation context not found')
    }

    const actionsToApply = this.findActionsByIds(context, actionIds)
    const appliedActions: ModificationAction[] = []
    const errors: string[] = []
    let modifiedCode = context.currentCode

    // Apply each action
    for (const action of actionsToApply) {
      try {
        if (action.requiresApproval && !userApproval) {
          continue
        }

        // Apply the modification
        const result = await this.applyModificationAction(action, modifiedCode, context)
        if (result.success) {
          modifiedCode = result.modifiedCode
          appliedActions.push(action)
        } else {
          errors.push(result.error || 'Unknown error')
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    // Update context with new code
    if (appliedActions.length > 0) {
      context.currentCode = modifiedCode
      context.codeHistory.push({
        version: modifiedCode,
        timestamp: Date.now(),
        description: `Applied ${appliedActions.length} modifications`
      })
    }

    // Store feedback
    if (feedback) {
      const lastTurn = context.conversationHistory[context.conversationHistory.length - 1]
      if (lastTurn) {
        lastTurn.feedback = feedback
      }
    }

    // Generate next suggestions
    const nextSuggestions = await this.smartAssistant.generateFollowUpSuggestions(
      appliedActions,
      context
    )

    return {
      success: errors.length === 0,
      modifiedCode,
      appliedActions,
      errors: errors.length > 0 ? errors : undefined,
      nextSuggestions
    }
  }

  /**
   * Get conversation insights and patterns
   */
  async getConversationInsights(sessionId: string): Promise<ConversationInsight> {
    const context = this.conversations.get(sessionId)
    if (!context) {
      throw new Error('Conversation context not found')
    }

    return this.nlpProcessor.analyzeConversationFlow(context.conversationHistory)
  }

  /**
   * Generate contextual help and suggestions
   */
  async getContextualHelp(sessionId: string, element?: string): Promise<{
    help: string
    examples: string[]
    quickActions: QuickAction[]
    relatedTopics: string[]
  }> {
    const context = this.conversations.get(sessionId)
    if (!context) {
      throw new Error('Conversation context not found')
    }

    return this.smartAssistant.generateContextualHelp(context, element)
  }

  // Private helper methods
  private async getOrCreateContext(
    sessionId: string,
    currentCode: string,
    options: any
  ): Promise<ConversationContext> {
    if (this.conversations.has(sessionId)) {
      const context = this.conversations.get(sessionId)!
      context.currentCode = currentCode
      return context
    }

    const context: ConversationContext = {
      sessionId,
      userId: options.userId,
      currentCode,
      codeHistory: [{
        version: currentCode,
        timestamp: Date.now(),
        description: 'Initial code'
      }],
      conversationHistory: [],
      activeComponents: await this.contextManager.extractComponents(currentCode),
      userIntents: [],
      preferences: this.getDefaultPreferences(),
      metadata: await this.contextManager.analyzeCodeMetadata(currentCode)
    }

    this.conversations.set(sessionId, context)
    return context
  }

  private async generateModificationActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<ModificationAction[]> {
    const actions: ModificationAction[] = []

    // Generate actions based on intent
    switch (intent.primary) {
      case 'add':
        actions.push(...await this.generateAddActions(intent, context))
        break
      case 'modify':
        actions.push(...await this.generateModifyActions(intent, context))
        break
      case 'remove':
        actions.push(...await this.generateRemoveActions(intent, context))
        break
      case 'style':
        actions.push(...await this.generateStyleActions(intent, context))
        break
      case 'fix':
        actions.push(...await this.generateFixActions(intent, context))
        break
      default:
        actions.push(...await this.generateGenericActions(intent, context))
    }

    return actions
  }

  private async generateAddActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<ModificationAction[]> {
    const actions: ModificationAction[] = []
    
    for (const target of intent.targetElements) {
      // Determine what type of element to add
      const elementType = this.determineElementType(target, context)
      const code = await this.generateAddCode(target, elementType, context)
      
      actions.push({
        type: 'code_change',
        description: `Add ${target} to the component`,
        targetElement: target,
        changeType: 'add',
        code,
        reason: `User requested to add ${target}`,
        confidence: intent.confidence,
        requiresApproval: intent.complexity === 'complex',
        dependencies: this.findDependencies(target, context)
      })
    }

    return actions
  }

  private async generateModifyActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<ModificationAction[]> {
    const actions: ModificationAction[] = []
    
    for (const target of intent.targetElements) {
      // Analyze current state of the target
      const currentState = await this.analyzeCurrentState(target, context)
      const modifications = await this.generateModifications(target, intent, currentState, context)
      
      actions.push({
        type: 'code_change',
        description: `Modify ${target} according to request`,
        targetElement: target,
        changeType: 'modify',
        code: modifications.code,
        reason: modifications.reason,
        alternatives: modifications.alternatives,
        confidence: intent.confidence,
        requiresApproval: intent.complexity === 'complex' || modifications.hasRisks,
        dependencies: this.findDependencies(target, context)
      })
    }

    return actions
  }

  private async generateRemoveActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<ModificationAction[]> {
    const actions: ModificationAction[] = []
    
    for (const target of intent.targetElements) {
      // Check if removal is safe
      const safetyCheck = await this.checkRemovalSafety(target, context)
      
      actions.push({
        type: 'code_change',
        description: `Remove ${target} from the component`,
        targetElement: target,
        changeType: 'remove',
        code: safetyCheck.removalCode,
        reason: `User requested to remove ${target}`,
        confidence: intent.confidence * (safetyCheck.isSafe ? 1 : 0.7),
        requiresApproval: !safetyCheck.isSafe || intent.complexity === 'complex',
        dependencies: safetyCheck.affectedDependencies
      })
    }

    return actions
  }

  private async generateStyleActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<ModificationAction[]> {
    const actions: ModificationAction[] = []
    
    // Extract style intentions from the user message
    const styleIntentions = await this.extractStyleIntentions(intent, context)
    
    for (const styleChange of styleIntentions) {
      const code = await this.generateStyleCode(styleChange, context)
      
      actions.push({
        type: 'code_change',
        description: `Update ${styleChange.property} to ${styleChange.value}`,
        targetElement: styleChange.target,
        changeType: 'modify',
        code,
        reason: `User requested style change: ${styleChange.description}`,
        confidence: intent.confidence,
        requiresApproval: false, // Style changes are usually safe
        dependencies: []
      })
    }

    return actions
  }

  private async generateFixActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<ModificationAction[]> {
    const actions: ModificationAction[] = []
    
    // Analyze the code for potential issues
    const issues = await this.analyzeCodeIssues(context.currentCode)
    
    for (const issue of issues) {
      const fix = await this.generateFixCode(issue, context)
      
      actions.push({
        type: 'code_change',
        description: `Fix ${issue.type}: ${issue.description}`,
        targetElement: issue.location,
        changeType: 'modify',
        code: fix.code,
        reason: fix.explanation,
        alternatives: fix.alternatives,
        confidence: fix.confidence,
        requiresApproval: issue.severity === 'high',
        dependencies: []
      })
    }

    return actions
  }

  private async generateGenericActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<ModificationAction[]> {
    // Fallback for unspecified intents
    return [{
      type: 'suggestion',
      description: 'I can help you with various modifications. Could you be more specific about what you\'d like to change?',
      confidence: 0.5,
      requiresApproval: false
    }]
  }

  // Helper methods for action generation
  private determineElementType(target: string, context: ConversationContext): string {
    const elementTypes: Record<string, string> = {
      'button': 'button',
      'input': 'input',
      'form': 'form',
      'text': 'span',
      'heading': 'h2',
      'title': 'h1',
      'image': 'img',
      'link': 'a',
      'list': 'ul',
      'card': 'div',
      'container': 'div',
      'section': 'section'
    }

    return elementTypes[target.toLowerCase()] || 'div'
  }

  private async generateAddCode(target: string, elementType: string, context: ConversationContext): Promise<string> {
    // Use AI to generate appropriate code for adding elements
    try {
      const prompt = `Generate React JSX code to add a ${target} (${elementType}) to this component:

Current code context:
${context.currentCode.substring(0, 500)}...

Generate a single JSX element that would be appropriate to add. Include:
- Proper className for styling
- Appropriate props and attributes
- Basic functionality if applicable

Return only the JSX code.`

      const model = openrouter('anthropic/claude-3.5-sonnet')
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.3,
        maxTokens: 300
      })

      return response.text || `<${elementType} className="new-${target}">${target}</${elementType}>`
    } catch (error) {
      console.error('Failed to generate add code:', error)
      return `<${elementType} className="new-${target}">${target}</${elementType}>`
    }
  }

  private async analyzeCurrentState(target: string, context: ConversationContext): Promise<any> {
    // Analyze the current state of the target element
    const codeLines = context.currentCode.split('\n')
    const targetMatches = codeLines.filter(line => 
      line.toLowerCase().includes(target.toLowerCase())
    )

    return {
      exists: targetMatches.length > 0,
      lines: targetMatches,
      properties: this.extractProperties(targetMatches),
      location: targetMatches.length > 0 ? codeLines.indexOf(targetMatches[0]) : -1
    }
  }

  private extractProperties(lines: string[]): Record<string, string> {
    const properties: Record<string, string> = {}
    
    for (const line of lines) {
      // Extract className
      const classMatch = line.match(/className=['"]([^'"]+)['"]/)
      if (classMatch) properties.className = classMatch[1]
      
      // Extract other common properties
      const styleMatch = line.match(/style=\{([^}]+)\}/)
      if (styleMatch) properties.style = styleMatch[1]
    }

    return properties
  }

  private async generateModifications(
    target: string,
    intent: UserIntent,
    currentState: any,
    context: ConversationContext
  ): Promise<{
    code: string
    reason: string
    alternatives: string[]
    hasRisks: boolean
  }> {
    try {
      const prompt = `Generate code modifications for this request:

Target: ${target}
Intent: ${intent.description}
Current state: ${JSON.stringify(currentState, null, 2)}

User's full request: "${context.conversationHistory[context.conversationHistory.length - 1]?.userMessage || ''}"

Generate the modified JSX code and explain the changes.
Return JSON format:
{
  "code": "modified JSX code",
  "reason": "explanation of changes",
  "alternatives": ["alternative approach 1", "alternative approach 2"],
  "hasRisks": false
}`

      const model = openrouter('anthropic/claude-3.5-sonnet')
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.3,
        maxTokens: 500
      })

      return JSON.parse(response.text || '{}')
    } catch (error) {
      console.error('Failed to generate modifications:', error)
      return {
        code: `// Modified ${target}`,
        reason: 'Generic modification applied',
        alternatives: [],
        hasRisks: false
      }
    }
  }

  private async checkRemovalSafety(target: string, context: ConversationContext): Promise<{
    isSafe: boolean
    removalCode: string
    affectedDependencies: string[]
  }> {
    // Analyze dependencies and safety of removal
    const dependencies = this.findDependencies(target, context)
    const isSafe = dependencies.length === 0

    return {
      isSafe,
      removalCode: `// Remove ${target} element`,
      affectedDependencies: dependencies
    }
  }

  private findDependencies(target: string, context: ConversationContext): string[] {
    const dependencies: string[] = []
    const codeLines = context.currentCode.split('\n')
    
    // Look for references to the target
    for (const line of codeLines) {
      if (line.includes(target) && line.includes('onClick') || line.includes('onSubmit')) {
        dependencies.push('event handlers')
      }
      if (line.includes(target) && line.includes('ref')) {
        dependencies.push('refs')
      }
    }

    return dependencies
  }

  private async extractStyleIntentions(intent: UserIntent, context: ConversationContext): Promise<Array<{
    target: string
    property: string
    value: string
    description: string
  }>> {
    const intentions: Array<{
      target: string
      property: string
      value: string
      description: string
    }> = []

    const lastMessage = context.conversationHistory[context.conversationHistory.length - 1]?.userMessage || ''
    
    // Extract color intentions
    const colorMatch = lastMessage.match(/\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\b/i)
    if (colorMatch) {
      intentions.push({
        target: intent.targetElements[0] || 'component',
        property: 'color',
        value: colorMatch[1].toLowerCase(),
        description: `Change color to ${colorMatch[1]}`
      })
    }

    // Extract size intentions
    const sizeMatch = lastMessage.match(/\b(bigger|smaller|larger|smaller|wide|narrow|tall|short)\b/i)
    if (sizeMatch) {
      const sizeValue = sizeMatch[1] === 'bigger' || sizeMatch[1] === 'larger' ? '120%' : '80%'
      intentions.push({
        target: intent.targetElements[0] || 'component',
        property: 'size',
        value: sizeValue,
        description: `Make ${sizeMatch[1]}`
      })
    }

    return intentions
  }

  private async generateStyleCode(styleChange: any, context: ConversationContext): Promise<string> {
    const { property, value, target } = styleChange
    
    if (property === 'color') {
      return `className="text-${value}-500"`
    }
    
    if (property === 'size') {
      return `style={{ transform: 'scale(${value})' }}`
    }

    return `// Apply ${property}: ${value} to ${target}`
  }

  private async analyzeCodeIssues(code: string): Promise<Array<{
    type: string
    description: string
    location: string
    severity: 'low' | 'medium' | 'high'
  }>> {
    const issues: Array<{
      type: string
      description: string
      location: string
      severity: 'low' | 'medium' | 'high'
    }> = []

    // Check for common React issues
    if (code.includes('useState') && !code.includes('import')) {
      issues.push({
        type: 'missing import',
        description: 'useState is used but not imported',
        location: 'top of file',
        severity: 'high'
      })
    }

    if (code.includes('onClick') && !code.includes('function') && !code.includes('=>')) {
      issues.push({
        type: 'missing handler',
        description: 'onClick handler not defined',
        location: 'onClick attribute',
        severity: 'medium'
      })
    }

    return issues
  }

  private async generateFixCode(issue: any, context: ConversationContext): Promise<{
    code: string
    explanation: string
    alternatives: string[]
    confidence: number
  }> {
    if (issue.type === 'missing import') {
      return {
        code: "import React, { useState } from 'react'",
        explanation: 'Added missing React import',
        alternatives: ["import { useState } from 'react'"],
        confidence: 0.9
      }
    }

    if (issue.type === 'missing handler') {
      return {
        code: 'const handleClick = () => { console.log("clicked") }',
        explanation: 'Added missing click handler',
        alternatives: ['const handleClick = (e) => e.preventDefault()'],
        confidence: 0.8
      }
    }

    return {
      code: '// Fix applied',
      explanation: 'General fix applied',
      alternatives: [],
      confidence: 0.5
    }
  }

  private async generateQuickActions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<QuickAction[]> {
    const actions: QuickAction[] = []
    
    // Generate context-aware quick actions
    if (intent.primary === 'style') {
      actions.push(
        {
          id: 'quick-color-blue',
          label: 'Make Blue',
          description: 'Change element color to blue',
          icon: '🔵',
          action: {
            type: 'code_change',
            description: 'Make element blue',
            targetElement: intent.targetElements[0],
            changeType: 'modify',
            code: 'className="text-blue-500"',
            confidence: 0.9,
            requiresApproval: false
          },
          category: 'contextual'
        },
        {
          id: 'quick-color-red',
          label: 'Make Red',
          description: 'Change element color to red',
          icon: '🔴',
          action: {
            type: 'code_change',
            description: 'Make element red',
            targetElement: intent.targetElements[0],
            changeType: 'modify',
            code: 'className="text-red-500"',
            confidence: 0.9,
            requiresApproval: false
          },
          category: 'contextual'
        }
      )
    }

    if (intent.primary === 'add') {
      actions.push(
        {
          id: 'quick-add-button',
          label: 'Add Button',
          description: 'Add a new button to the component',
          icon: '🔘',
          action: {
            type: 'code_change',
            description: 'Add a button element',
            targetElement: 'button',
            changeType: 'add',
            code: '<button className="px-4 py-2 bg-blue-500 text-white rounded">Button</button>',
            confidence: 0.9,
            requiresApproval: false
          },
          category: 'common'
        }
      )
    }

    return actions
  }

  private generateClarificationMessage(
    questions: string[],
    context: ConversationContext
  ): string {
    const intro = "I'd like to help you with that modification, but I need some clarification:"
    const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    const encouragement = "Please provide more details so I can make the exact changes you're looking for."
    
    return `${intro}\n\n${questionList}\n\n${encouragement}`
  }

  private async generateResponseMessage(
    intent: UserIntent,
    actions: ModificationAction[],
    context: ConversationContext
  ): Promise<string> {
    const templates: Record<string, string> = {
      add: "I'll add the requested elements to your code.",
      modify: "I'll make the requested modifications to your code.",
      remove: "I'll remove the specified elements from your code.",
      style: "I'll update the styling as requested.",
      fix: "I'll fix the issues you've identified.",
      refactor: "I'll refactor the code to improve its structure.",
      optimize: "I'll optimize the code for better performance.",
      explain: "I'll explain how this works.",
      question: "I'll help you understand this better."
    }

    const baseMessage = templates[intent.primary] || "I'll help you with that modification."
    
    if (actions.length === 0) {
      return `${baseMessage} However, I need more specific information about what you'd like to change.`
    }

    const actionSummary = actions.length === 1 
      ? "Here's what I'll do:"
      : `Here are the ${actions.length} changes I'll make:`

    return `${baseMessage} ${actionSummary}`
  }

  private async updateConversationContext(
    context: ConversationContext,
    turn: ConversationTurn
  ): Promise<void> {
    // Update context based on the turn
    context.conversationHistory.push(turn)
    
    // Update active components if they changed
    if (turn.actions.some(a => a.type === 'code_change')) {
      context.activeComponents = await this.contextManager.extractComponents(context.currentCode)
    }
  }

  private async suggestNextSteps(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<string[]> {
    return [
      "Review the proposed changes",
      "Test the modified code",
      "Make additional refinements if needed"
    ]
  }

  private findActionsByIds(context: ConversationContext, actionIds: string[]): ModificationAction[] {
    const actions: ModificationAction[] = []
    
    for (const turn of context.conversationHistory) {
      for (const action of turn.actions) {
        if (actionIds.includes(action.type)) { // Simplified - would need proper ID matching
          actions.push(action)
        }
      }
    }
    
    return actions
  }

  private async applyModificationAction(
    action: ModificationAction,
    code: string,
    context: ConversationContext
  ): Promise<{ success: boolean; modifiedCode: string; error?: string }> {
    // Integration with existing diff system
    try {
      // This would integrate with the existing CodeOrchestrator and diff system
      return {
        success: true,
        modifiedCode: code // Placeholder - would apply actual changes
      }
    } catch (error) {
      return {
        success: false,
        modifiedCode: code,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      verbosity: 'detailed',
      confirmationLevel: 'major',
      suggestionFrequency: 'occasional',
      explanationStyle: 'detailed',
      codeStyle: {
        formatting: 'auto',
        naming: 'camelCase',
        comments: 'minimal'
      }
    }
  }
}

// Supporting classes (implementations would be more detailed)
class IntentRecognizer {
  // Implementation for intent recognition
}

class ConversationContextManager {
  async extractComponents(code: string): Promise<string[]> {
    // Extract component names from code
    return []
  }

  async analyzeCodeMetadata(code: string): Promise<any> {
    // Analyze code to extract metadata
    return {
      domain: 'web',
      framework: 'react',
      language: 'typescript',
      complexity: 'medium'
    }
  }
}

class SmartAssistant {
  async generateSuggestions(intent: UserIntent, context: ConversationContext): Promise<string[]> {
    const suggestions: string[] = []
    
    // Generate suggestions based on intent and context
    switch (intent.primary) {
      case 'add':
        suggestions.push(
          "Would you like to add styling to the new element?",
          "Should this element be interactive?",
          "Do you need any event handlers for this element?"
        )
        break
        
      case 'style':
        suggestions.push(
          "Would you like to make this responsive?",
          "Should we add hover effects?",
          "Do you want to update the theme colors?"
        )
        break
        
      case 'modify':
        suggestions.push(
          "Would you like to add animation to this change?",
          "Should we update related components too?",
          "Do you need accessibility improvements?"
        )
        break
        
      case 'fix':
        suggestions.push(
          "Would you like me to add error handling?",
          "Should we implement input validation?",
          "Do you want to add loading states?"
        )
        break
    }

    // Add context-aware suggestions
    const contextualSuggestions = await this.generateContextualSuggestions(intent, context)
    suggestions.push(...contextualSuggestions)

    return suggestions.slice(0, 5) // Limit to 5 suggestions
  }

  async generateFollowUpSuggestions(
    appliedActions: ModificationAction[],
    context: ConversationContext
  ): Promise<string[]> {
    const suggestions: string[] = []
    
    if (appliedActions.some(a => a.changeType === 'add')) {
      suggestions.push(
        "Test the new functionality",
        "Add styling to the new elements",
        "Consider adding error handling"
      )
    }

    if (appliedActions.some(a => a.targetElement?.includes('button'))) {
      suggestions.push(
        "Add click animations",
        "Test button accessibility",
        "Consider button states (disabled, loading)"
      )
    }

    return suggestions
  }

  private async generateContextualSuggestions(
    intent: UserIntent,
    context: ConversationContext
  ): Promise<string[]> {
    const suggestions: string[] = []
    
    // Analyze code patterns for suggestions
    if (context.currentCode.includes('useState') && !context.currentCode.includes('useEffect')) {
      suggestions.push("Consider adding useEffect for side effects")
    }

    if (context.activeComponents.length > 5) {
      suggestions.push("Your component is getting complex. Consider breaking it down.")
    }

    if (!context.currentCode.includes('className') && context.currentCode.includes('style=')) {
      suggestions.push("Consider using Tailwind classes instead of inline styles")
    }

    return suggestions
  }

  async generateProactiveSuggestions(context: ConversationContext): Promise<Array<{
    type: 'improvement' | 'best-practice' | 'accessibility' | 'performance' | 'security'
    title: string
    description: string
    code?: string
    priority: 'low' | 'medium' | 'high'
  }>> {
    const suggestions: Array<{
      type: 'improvement' | 'best-practice' | 'accessibility' | 'performance' | 'security'
      title: string
      description: string
      code?: string
      priority: 'low' | 'medium' | 'high'
    }> = []

    // Analyze code for improvement opportunities
    const codeAnalysis = await this.analyzeCodeForImprovements(context.currentCode)
    
    // Best practices
    if (!context.currentCode.includes('key=') && context.currentCode.includes('.map(')) {
      suggestions.push({
        type: 'best-practice',
        title: 'Add Keys to List Items',
        description: 'List items should have unique keys for better React performance',
        code: 'key={item.id}',
        priority: 'medium'
      })
    }

    // Accessibility
    if (context.currentCode.includes('<button') && !context.currentCode.includes('aria-label')) {
      suggestions.push({
        type: 'accessibility',
        title: 'Add ARIA Labels',
        description: 'Buttons should have descriptive labels for screen readers',
        code: 'aria-label="descriptive label"',
        priority: 'high'
      })
    }

    // Performance
    if (context.currentCode.includes('useState') && context.conversationHistory.length > 5) {
      suggestions.push({
        type: 'performance',
        title: 'Consider Memoization',
        description: 'Frequent re-renders detected. Consider using React.memo or useMemo',
        priority: 'medium'
      })
    }

    return suggestions
  }

  private async analyzeCodeForImprovements(code: string): Promise<{
    complexity: number
    maintainability: number
    performance: number
    accessibility: number
  }> {
    // Simple heuristic analysis
    const lines = code.split('\n').length
    const complexity = Math.min(lines / 50, 10) // Simple complexity based on lines
    
    const hasKeys = code.includes('key=')
    const hasAriaLabels = code.includes('aria-')
    const hasMemoization = code.includes('useMemo') || code.includes('useCallback')
    
    return {
      complexity,
      maintainability: hasKeys ? 8 : 6,
      performance: hasMemoization ? 8 : 6,
      accessibility: hasAriaLabels ? 8 : 4
    }
  }

  async generateContextualHelp(
    context: ConversationContext,
    element?: string
  ): Promise<{
    help: string
    examples: string[]
    quickActions: QuickAction[]
    relatedTopics: string[]
  }> {
    // Generate contextual help
    return {
      help: '',
      examples: [],
      quickActions: [],
      relatedTopics: []
    }
  }
}

class MultiTurnManager {
  // Implementation for multi-turn conversation management
}

// Enhanced Natural Language Processor implementation
class NaturalLanguageProcessor implements INaturalLanguageProcessor {
  async extractIntent(message: string, context: ConversationContext): Promise<UserIntent> {
    // Implementation for intent extraction
    return {
      primary: 'modify',
      confidence: 0.8,
      description: 'User wants to modify code',
      targetElements: [],
      scope: 'component',
      urgency: 'medium',
      complexity: 'medium'
    }
  }

  async identifyReferences(message: string, context: ConversationContext): Promise<string[]> {
    // Implementation for reference identification
    return []
  }

  async detectAmbiguity(message: string, context: ConversationContext): Promise<string[]> {
    // Implementation for ambiguity detection
    return []
  }

  async generateClarificationQuestions(
    ambiguities: string[],
    context: ConversationContext
  ): Promise<string[]> {
    // Implementation for clarification questions
    return []
  }

  async analyzeConversationFlow(turns: ConversationTurn[]): Promise<ConversationInsight> {
    // Implementation for conversation analysis
    return {
      patterns: [],
      userExpertise: 'intermediate',
      preferredStyle: 'detailed',
      commonIntents: [],
      learningOpportunities: []
    }
  }
}

// Export the main system
export const conversationalModificationSystem = new ConversationalModificationSystem() 
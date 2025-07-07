import { ConversationContext, UserIntent, ConversationTurn, ConversationInsight } from './conversational-modification-system'
import { openrouter } from './ai-config'

export interface IntentPattern {
  pattern: RegExp
  intent: UserIntent['primary']
  confidence: number
  requiresTarget: boolean
  scope: UserIntent['scope']
  complexity: UserIntent['complexity']
}

export interface ContextualReference {
  term: string
  type: 'component' | 'element' | 'style' | 'function' | 'variable' | 'file'
  confidence: number
  alternatives: string[]
  location?: string
}

export interface AmbiguityDetection {
  term: string
  type: 'reference' | 'scope' | 'intent' | 'target'
  possibleMeanings: string[]
  confidence: number
  requiresClarification: boolean
}

export interface SemanticAnalysis {
  entities: Array<{
    text: string
    type: 'component' | 'action' | 'property' | 'value' | 'condition'
    confidence: number
    startIndex: number
    endIndex: number
  }>
  relationships: Array<{
    subject: string
    predicate: string
    object: string
    confidence: number
  }>
  sentiment: {
    polarity: 'positive' | 'negative' | 'neutral'
    confidence: number
  }
  complexity: number
  technicalLevel: number
}

export interface ConversationPattern {
  id: string
  name: string
  description: string
  triggers: string[]
  expectedFlow: string[]
  commonResponses: string[]
  followUpQuestions: string[]
}

export class EnhancedNaturalLanguageProcessor {
  private intentPatterns: IntentPattern[] = [
    // Add patterns - Enhanced with more sophisticated detection
    {
      pattern: /\b(add|create|insert|include|put|implement|build|make|generate)\b.*\b(button|component|element|feature|function|method|class|div|input|form|menu|nav|header|footer|sidebar|modal|dialog|card|list|table|chart|graph|image|icon|link|text|paragraph|title|heading|section|container|wrapper|layout|grid|flex|animation|transition|hover|state|props|hook|api|endpoint|route|page|view|screen)\b/i,
      intent: 'add',
      confidence: 0.9,
      requiresTarget: true,
      scope: 'component',
      complexity: 'medium'
    },
    {
      pattern: /\b(add|create|build|make|generate|implement)\b.*\b(new|another|additional|extra|more)\b/i,
      intent: 'add',
      confidence: 0.85,
      requiresTarget: true,
      scope: 'feature',
      complexity: 'medium'
    },
    {
      pattern: /\b(i want|i need|can you|could you|please)\b.*\b(add|create|make|build)\b/i,
      intent: 'add',
      confidence: 0.8,
      requiresTarget: true,
      scope: 'feature',
      complexity: 'medium'
    },

    // Modify patterns - Enhanced with context awareness
    {
      pattern: /\b(change|modify|update|edit|alter|adjust|tweak|revise|transform|convert|customize|enhance|improve|upgrade)\b/i,
      intent: 'modify',
      confidence: 0.85,
      requiresTarget: true,
      scope: 'component',
      complexity: 'medium'
    },
    {
      pattern: /\b(make.*bigger|make.*smaller|make.*larger|make.*shorter|make.*wider|make.*narrower|increase|decrease|resize|scale|expand|shrink|grow|reduce)\b/i,
      intent: 'modify',
      confidence: 0.9,
      requiresTarget: true,
      scope: 'style',
      complexity: 'simple'
    },
    {
      pattern: /\b(move|relocate|position|place|shift|drag|reorder|rearrange)\b/i,
      intent: 'modify',
      confidence: 0.85,
      requiresTarget: true,
      scope: 'component',
      complexity: 'medium'
    },

    // Remove patterns - Enhanced with synonyms
    {
      pattern: /\b(remove|delete|eliminate|get rid of|take out|take away|clear|hide|disable|turn off|stop|cancel|undo)\b/i,
      intent: 'remove',
      confidence: 0.9,
      requiresTarget: true,
      scope: 'component',
      complexity: 'simple'
    },

    // Style patterns - Enhanced with comprehensive design terms
    {
      pattern: /\b(color|colour|background|theme|style|design|appearance|look|visual|aesthetic|font|typography|text|css|styling|layout|spacing|margin|padding|border|shadow|opacity|transparency|gradient|animation|transition|hover|active|focus|responsive|mobile|desktop|dark|light|modern|minimalist|elegant|bold|subtle)\b/i,
      intent: 'style',
      confidence: 0.85,
      requiresTarget: false,
      scope: 'style',
      complexity: 'simple'
    },
    {
      pattern: /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|brown|cyan|magenta|lime|navy|olive|teal|silver|gold|dark|light|bright|pale|deep|vivid|muted|transparent|opaque)\b/i,
      intent: 'style',
      confidence: 0.9,
      requiresTarget: true,
      scope: 'style',
      complexity: 'simple'
    },

    // Fix patterns - Enhanced with debugging terms
    {
      pattern: /\b(fix|repair|solve|debug|correct|resolve|troubleshoot|patch|address|handle|deal with)\b/i,
      intent: 'fix',
      confidence: 0.9,
      requiresTarget: false,
      scope: 'function',
      complexity: 'complex'
    },
    {
      pattern: /\b(error|bug|issue|problem|broken|not working|doesn't work|won't work|fails|crash|exception|undefined|null|missing|invalid|incorrect|wrong|bad|faulty|glitch|defect)\b/i,
      intent: 'fix',
      confidence: 0.85,
      requiresTarget: true,
      scope: 'function',
      complexity: 'complex'
    },

    // Refactor patterns - Enhanced with code quality terms
    {
      pattern: /\b(refactor|restructure|reorganize|clean up|improve|optimize|simplify|modernize|upgrade|rewrite|rework|redesign|architect|modularize|componentize)\b/i,
      intent: 'refactor',
      confidence: 0.8,
      requiresTarget: false,
      scope: 'function',
      complexity: 'complex'
    },

    // Optimize patterns - New category for performance
    {
      pattern: /\b(optimize|performance|speed|fast|slow|efficient|improve|accelerate|cache|lazy|load|bundle|minify|compress|reduce|streamline)\b/i,
      intent: 'optimize',
      confidence: 0.8,
      requiresTarget: false,
      scope: 'global',
      complexity: 'complex'
    },

    // Question patterns - Enhanced with comprehensive question words
    {
      pattern: /\b(what|how|why|when|where|which|who|whose|can|could|would|should|will|do|does|did|is|are|was|were|have|has|had)\b.*\?/i,
      intent: 'question',
      confidence: 0.9,
      requiresTarget: false,
      scope: 'global',
      complexity: 'simple'
    },
    {
      pattern: /\b(explain|tell me|show me|help me understand|describe|clarify|demonstrate|illustrate|walk me through|guide me)\b/i,
      intent: 'explain',
      confidence: 0.9,
      requiresTarget: false,
      scope: 'global',
      complexity: 'simple'
    }
  ]

  private commonReferences = [
    // UI Components
    'button', 'input', 'form', 'div', 'span', 'text', 'image', 'link', 'menu', 'nav',
    'header', 'footer', 'sidebar', 'modal', 'dialog', 'card', 'list', 'table', 'grid',
    'layout', 'container', 'wrapper', 'section', 'article', 'aside', 'main', 'figure',
    
    // Interactive Elements
    'dropdown', 'select', 'checkbox', 'radio', 'slider', 'toggle', 'switch', 'tab',
    'accordion', 'carousel', 'gallery', 'lightbox', 'tooltip', 'popover', 'notification',
    'alert', 'badge', 'chip', 'tag', 'label', 'icon', 'avatar', 'progress', 'loader',
    
    // Layout & Structure
    'row', 'column', 'flex', 'grid', 'panel', 'pane', 'split', 'stack', 'group',
    'cluster', 'frame', 'border', 'outline', 'shadow', 'overlay', 'backdrop',
    
    // Content Elements
    'title', 'heading', 'subtitle', 'paragraph', 'caption', 'description', 'content',
    'body', 'summary', 'detail', 'excerpt', 'quote', 'code', 'snippet', 'block',
    
    // Technical Terms
    'component', 'function', 'method', 'class', 'variable', 'constant', 'parameter',
    'property', 'attribute', 'value', 'state', 'props', 'hook', 'context', 'provider',
    'reducer', 'action', 'dispatch', 'effect', 'callback', 'handler', 'listener',
    'event', 'trigger', 'condition', 'logic', 'algorithm', 'data', 'api', 'endpoint',
    
    // Style Properties
    'color', 'background', 'font', 'size', 'width', 'height', 'margin', 'padding',
    'border', 'radius', 'shadow', 'opacity', 'transform', 'transition', 'animation',
    'gradient', 'texture', 'pattern', 'theme', 'variant', 'modifier', 'responsive'
  ]

  private pronounReferences = [
    'this', 'that', 'these', 'those', 'it', 'them', 'they', 'here', 'there',
    'above', 'below', 'previous', 'next', 'first', 'last', 'current', 'existing'
  ]

  private ambiguousTerms = [
    'button', 'component', 'element', 'thing', 'item', 'part', 'section', 'piece',
    'area', 'box', 'container', 'wrapper', 'content', 'text', 'image', 'block',
    'widget', 'control', 'field', 'option', 'setting', 'feature', 'functionality',
    'behavior', 'appearance', 'style', 'design', 'layout', 'structure', 'format'
  ]

  private conversationPatterns: ConversationPattern[] = [
    {
      id: 'iterative-styling',
      name: 'Iterative Styling',
      description: 'User is making multiple style adjustments',
      triggers: ['style', 'color', 'size', 'appearance'],
      expectedFlow: ['initial style request', 'feedback', 'refinement', 'approval'],
      commonResponses: ['looks good', 'try different', 'make it bigger', 'change color'],
      followUpQuestions: ['How does that look?', 'Would you like to try a different color?']
    },
    {
      id: 'feature-building',
      name: 'Feature Building',
      description: 'User is adding multiple related features',
      triggers: ['add', 'create', 'build', 'implement'],
      expectedFlow: ['feature request', 'clarification', 'implementation', 'testing', 'refinement'],
      commonResponses: ['add another', 'make it interactive', 'connect to api'],
      followUpQuestions: ['What other features would you like?', 'How should this interact with existing features?']
    },
    {
      id: 'debugging-session',
      name: 'Debugging Session',
      description: 'User is troubleshooting issues',
      triggers: ['fix', 'error', 'bug', 'problem', 'broken'],
      expectedFlow: ['problem description', 'investigation', 'solution', 'verification'],
      commonResponses: ['still not working', 'that fixed it', 'different error now'],
      followUpQuestions: ['Is the issue resolved?', 'Are there any other errors?']
    }
  ]

  private aiCache = new Map<string, any>()

  /**
   * Enhanced intent extraction with AI-powered semantic analysis
   */
  async extractIntent(message: string, context: ConversationContext): Promise<UserIntent> {
    const messageLower = message.toLowerCase()
    
    // First try pattern-based matching
    let bestMatch: IntentPattern | null = null
    let highestConfidence = 0

    for (const pattern of this.intentPatterns) {
      if (pattern.pattern.test(message)) {
        const confidence = this.calculatePatternConfidence(pattern, message, context)
        if (confidence > highestConfidence) {
          highestConfidence = confidence
          bestMatch = pattern
        }
      }
    }

    // If pattern matching is uncertain, use AI for semantic analysis
    if (!bestMatch || highestConfidence < 0.7) {
      const aiIntent = await this.getAIIntent(message, context)
      if (aiIntent && aiIntent.confidence > highestConfidence) {
        bestMatch = aiIntent
        highestConfidence = aiIntent.confidence
      }
    }

    if (!bestMatch) {
      return this.getDefaultIntent(message, context)
    }

    // Enhanced target extraction with semantic analysis
    const targetElements = await this.extractTargetElements(message, context)
    const semanticAnalysis = await this.performSemanticAnalysis(message, context)
    
    // Determine secondary intents
    const secondaryIntents = this.extractSecondaryIntents(message, bestMatch.intent)
    
    // Calculate urgency and complexity with AI assistance
    const urgency = this.determineUrgency(message, semanticAnalysis)
    const complexity = this.refineComplexity(bestMatch.complexity, message, context, semanticAnalysis)
    
    // Generate comprehensive description
    const description = this.generateIntentDescription(bestMatch.intent, targetElements, message, semanticAnalysis)

    return {
      primary: bestMatch.intent,
      secondary: secondaryIntents,
      confidence: highestConfidence,
      description,
      targetElements,
      scope: bestMatch.scope,
      urgency,
      complexity
    }
  }

  /**
   * AI-powered intent recognition for complex or ambiguous requests
   */
  private async getAIIntent(message: string, context: ConversationContext): Promise<IntentPattern | null> {
    const cacheKey = `intent-${message.slice(0, 50)}`
    if (this.aiCache.has(cacheKey)) {
      return this.aiCache.get(cacheKey)
    }

    try {
      const prompt = `Analyze this user request and determine their primary intent:

User Message: "${message}"

Context:
- Active Components: ${context.activeComponents.join(', ')}
- Recent Conversation: ${context.conversationHistory.slice(-2).map(t => t.userMessage).join('; ')}

Available Intents:
- add: Create new elements or features
- modify: Change existing elements
- remove: Delete or hide elements
- style: Change appearance or design
- fix: Resolve errors or issues
- refactor: Improve code structure
- optimize: Enhance performance
- question: Ask for information
- explain: Request explanation

Respond with JSON in this format:
{
  "intent": "primary_intent",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "scope": "component|style|function|global|feature",
  "complexity": "simple|medium|complex"
}`

      const model = openrouter('anthropic/claude-3.5-sonnet')
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.3,
        maxTokens: 500
      })

      const result = JSON.parse(response.text || '{}')
      
      const aiIntent: IntentPattern = {
        pattern: new RegExp('.*'),
        intent: result.intent,
        confidence: result.confidence,
        requiresTarget: ['add', 'modify', 'remove', 'style'].includes(result.intent),
        scope: result.scope,
        complexity: result.complexity
      }

      this.aiCache.set(cacheKey, aiIntent)
      return aiIntent
    } catch (error) {
      console.error('AI intent recognition failed:', error)
      return null
    }
  }

  /**
   * Perform semantic analysis on the user message
   */
  private async performSemanticAnalysis(message: string, context: ConversationContext): Promise<SemanticAnalysis> {
    const cacheKey = `semantic-${message.slice(0, 50)}`
    if (this.aiCache.has(cacheKey)) {
      return this.aiCache.get(cacheKey)
    }

    try {
      const prompt = `Perform semantic analysis on this user message:

Message: "${message}"

Extract:
1. Entities (components, actions, properties, values, conditions)
2. Relationships between entities
3. Sentiment (positive/negative/neutral)
4. Technical complexity level (1-10)
5. Overall complexity score (1-10)

Return JSON format:
{
  "entities": [{"text": "string", "type": "component|action|property|value|condition", "confidence": 0.0-1.0, "startIndex": 0, "endIndex": 0}],
  "relationships": [{"subject": "string", "predicate": "string", "object": "string", "confidence": 0.0-1.0}],
  "sentiment": {"polarity": "positive|negative|neutral", "confidence": 0.0-1.0},
  "complexity": 1-10,
  "technicalLevel": 1-10
}`

      const model = openrouter('anthropic/claude-3.5-sonnet')
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.2,
        maxTokens: 800
      })

      const result = JSON.parse(response.text || '{}')
      this.aiCache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('Semantic analysis failed:', error)
      return {
        entities: [],
        relationships: [],
        sentiment: { polarity: 'neutral', confidence: 0.5 },
        complexity: 5,
        technicalLevel: 5
      }
    }
  }

  /**
   * Enhanced reference identification with semantic understanding
   */
  async identifyReferences(message: string, context: ConversationContext): Promise<string[]> {
    const references: ContextualReference[] = []
    const messageLower = message.toLowerCase()
    const semanticAnalysis = await this.performSemanticAnalysis(message, context)

    // Extract component references from semantic analysis
    const componentEntities = semanticAnalysis.entities.filter(e => e.type === 'component')
    for (const entity of componentEntities) {
      references.push({
        term: entity.text,
        type: 'component',
        confidence: entity.confidence,
        alternatives: [],
        location: `${entity.startIndex}-${entity.endIndex}`
      })
    }

    // Check for direct component references
    for (const component of context.activeComponents) {
      const componentLower = component.toLowerCase()
      if (messageLower.includes(componentLower)) {
        references.push({
          term: component,
          type: 'component',
          confidence: 0.9,
          alternatives: []
        })
      }
    }

    // Check for common element references with fuzzy matching
    for (const reference of this.commonReferences) {
      if (messageLower.includes(reference) || this.fuzzyMatch(reference, messageLower)) {
        const alternatives = this.findSimilarReferences(reference, context)
        references.push({
          term: reference,
          type: this.determineReferenceType(reference),
          confidence: messageLower.includes(reference) ? 0.8 : 0.6,
          alternatives
        })
      }
    }

    // Enhanced pronoun resolution with conversation context
    for (const pronoun of this.pronounReferences) {
      if (messageLower.includes(pronoun)) {
        const contextualReference = this.resolvePronounReference(pronoun, context)
        if (contextualReference) {
          references.push(contextualReference)
        }
      }
    }

    // Check for quoted references with better parsing
    const quotedMatches = message.match(/"([^"]+)"|'([^']+)'|`([^`]+)`/g)
    if (quotedMatches) {
      for (const match of quotedMatches) {
        const term = match.slice(1, -1)
        references.push({
          term,
          type: 'element',
          confidence: 0.95,
          alternatives: []
        })
      }
    }

    // Use AI for complex reference resolution
    const aiReferences = await this.getAIReferences(message, context)
    references.push(...aiReferences)

    // Deduplicate and sort by confidence
    const uniqueReferences = this.deduplicateReferences(references)
    return uniqueReferences
      .sort((a, b) => b.confidence - a.confidence)
      .map(ref => ref.term)
  }

  /**
   * AI-powered reference identification for complex cases
   */
  private async getAIReferences(message: string, context: ConversationContext): Promise<ContextualReference[]> {
    try {
      const prompt = `Identify all references to code elements in this message:

Message: "${message}"
Available Components: ${context.activeComponents.join(', ')}

Look for references to:
- UI components and elements
- Functions and methods
- Variables and properties
- Style attributes
- File names or paths

Return JSON array of references:
[{"term": "string", "type": "component|element|style|function|variable|file", "confidence": 0.0-1.0}]`

      const model = openrouter('anthropic/claude-3.5-sonnet')
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.2,
        maxTokens: 500
      })

      const result = JSON.parse(response.text || '[]')
      return result.map((ref: any) => ({
        ...ref,
        alternatives: []
      }))
    } catch (error) {
      console.error('AI reference identification failed:', error)
      return []
    }
  }

  /**
   * Enhanced ambiguity detection with context awareness
   */
  async detectAmbiguity(message: string, context: ConversationContext): Promise<string[]> {
    const ambiguities: AmbiguityDetection[] = []
    const messageLower = message.toLowerCase()
    const semanticAnalysis = await this.performSemanticAnalysis(message, context)

    // Check for ambiguous terms
    for (const term of this.ambiguousTerms) {
      if (messageLower.includes(term)) {
        const possibleMeanings = this.getPossibleMeanings(term, context)
        if (possibleMeanings.length > 1) {
          ambiguities.push({
            term,
            type: 'reference',
            possibleMeanings,
            confidence: 0.8,
            requiresClarification: true
          })
        }
      }
    }

    // Check for vague scope references
    if (this.hasVagueScope(message)) {
      ambiguities.push({
        term: 'scope',
        type: 'scope',
        possibleMeanings: ['entire component', 'specific element', 'styling only', 'functionality only'],
        confidence: 0.7,
        requiresClarification: true
      })
    }

    // Check for multiple possible targets
    const references = await this.identifyReferences(message, context)
    if (references.length > 3) {
      ambiguities.push({
        term: 'target',
        type: 'target',
        possibleMeanings: references,
        confidence: 0.6,
        requiresClarification: true
      })
    }

    // Use AI for complex ambiguity detection
    const aiAmbiguities = await this.getAIAmbiguities(message, context, semanticAnalysis)
    ambiguities.push(...aiAmbiguities)

    return ambiguities
      .filter(a => a.requiresClarification)
      .sort((a, b) => b.confidence - a.confidence)
      .map(a => a.term)
  }

  /**
   * AI-powered ambiguity detection
   */
  private async getAIAmbiguities(
    message: string,
    context: ConversationContext,
    semanticAnalysis: SemanticAnalysis
  ): Promise<AmbiguityDetection[]> {
    try {
      const prompt = `Identify potential ambiguities in this user request:

Message: "${message}"
Context: ${context.activeComponents.join(', ')}
Complexity: ${semanticAnalysis.complexity}/10

Look for:
- Unclear references ("the button" when multiple buttons exist)
- Vague scope ("change everything")
- Multiple possible interpretations
- Missing specifics

Return JSON array:
[{"term": "string", "type": "reference|scope|intent|target", "possibleMeanings": ["string"], "confidence": 0.0-1.0, "requiresClarification": true|false}]`

      const model = openrouter('anthropic/claude-3.5-sonnet')
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.2,
        maxTokens: 600
      })

      return JSON.parse(response.text || '[]')
    } catch (error) {
      console.error('AI ambiguity detection failed:', error)
      return []
    }
  }

  /**
   * Enhanced clarification question generation
   */
  async generateClarificationQuestions(
    ambiguities: string[],
    context: ConversationContext
  ): Promise<string[]> {
    const questions: string[] = []

    // Generate context-aware questions
    for (const ambiguity of ambiguities) {
      const contextualQuestions = await this.generateContextualQuestions(ambiguity, context)
      questions.push(...contextualQuestions)
    }

    // Use AI for complex clarification needs
    const aiQuestions = await this.getAIClarificationQuestions(ambiguities, context)
    questions.push(...aiQuestions)

    // Remove duplicates and limit to most important
    return [...new Set(questions)].slice(0, 3)
  }

  /**
   * Generate contextual clarification questions
   */
  private async generateContextualQuestions(ambiguity: string, context: ConversationContext): Promise<string[]> {
    const questions: string[] = []
    const matchingComponents = context.activeComponents.filter(c => 
      c.toLowerCase().includes(ambiguity.toLowerCase())
    )

    switch (ambiguity) {
      case 'button':
        if (matchingComponents.length > 1) {
          questions.push(`Which button do you want to modify? I see: ${matchingComponents.join(', ')}`)
        } else {
          questions.push("What type of button would you like? (primary, secondary, submit, etc.)")
        }
        break

      case 'component':
        questions.push(`Which specific component are you referring to? Available: ${context.activeComponents.join(', ')}`)
        break

      case 'scope':
        questions.push("Should this change apply to the entire component, just the styling, or only the functionality?")
        break

      case 'target':
        questions.push("There are multiple elements that could match. Could you be more specific about which one you want to modify?")
        break

      default:
        questions.push(`Could you clarify what you mean by "${ambiguity}"?`)
    }

    return questions
  }

  /**
   * AI-powered clarification question generation
   */
  private async getAIClarificationQuestions(ambiguities: string[], context: ConversationContext): Promise<string[]> {
    try {
      const prompt = `Generate helpful clarification questions for these ambiguous terms:

Ambiguities: ${ambiguities.join(', ')}
Context: User is working with ${context.activeComponents.join(', ')}

Generate 1-2 specific, actionable questions that will help resolve the ambiguity.
Return as JSON array of strings.`

      const model = openrouter('anthropic/claude-3.5-sonnet')
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.4,
        maxTokens: 300
      })

      return JSON.parse(response.text || '[]')
    } catch (error) {
      console.error('AI clarification generation failed:', error)
      return []
    }
  }

  // Private helper methods
  private calculatePatternConfidence(
    pattern: IntentPattern,
    message: string,
    context: ConversationContext
  ): number {
    let confidence = pattern.confidence

    // Adjust based on context
    if (pattern.requiresTarget) {
      const hasTarget = this.commonReferences.some(ref => 
        message.toLowerCase().includes(ref)
      )
      if (!hasTarget) {
        confidence *= 0.7
      }
    }

    // Adjust based on conversation history
    const recentIntents = context.conversationHistory
      .slice(-3)
      .map(turn => turn.intent.primary)
    
    if (recentIntents.includes(pattern.intent)) {
      confidence *= 1.1 // Boost if similar intent recently
    }

    return Math.min(confidence, 1.0)
  }

  private getDefaultIntent(message: string, context: ConversationContext): UserIntent {
    // Fallback intent based on context and message analysis
    const messageLower = message.toLowerCase()
    
    if (messageLower.includes('?')) {
      return {
        primary: 'question',
        confidence: 0.6,
        description: 'User is asking a question',
        targetElements: [],
        scope: 'global',
        urgency: 'low',
        complexity: 'simple'
      }
    }

    return {
      primary: 'modify',
      confidence: 0.5,
      description: 'General modification request',
      targetElements: [],
      scope: 'component',
      urgency: 'medium',
      complexity: 'medium'
    }
  }

  private extractTargetElements(message: string, context: ConversationContext): string[] {
    const targets: string[] = []
    const messageLower = message.toLowerCase()

    // Check for explicit mentions of components
    for (const component of context.activeComponents) {
      if (messageLower.includes(component.toLowerCase())) {
        targets.push(component)
      }
    }

    // Check for common elements
    for (const reference of this.commonReferences) {
      if (messageLower.includes(reference)) {
        targets.push(reference)
      }
    }

    return [...new Set(targets)] // Remove duplicates
  }

  private extractSecondaryIntents(message: string, primaryIntent: UserIntent['primary']): string[] {
    const secondary: string[] = []
    const messageLower = message.toLowerCase()

    // Common secondary intents based on primary
    switch (primaryIntent) {
      case 'add':
        if (messageLower.includes('style') || messageLower.includes('color')) {
          secondary.push('style')
        }
        break
      case 'modify':
        if (messageLower.includes('fix') || messageLower.includes('bug')) {
          secondary.push('fix')
        }
        if (messageLower.includes('style') || messageLower.includes('appearance')) {
          secondary.push('style')
        }
        break
    }

    return secondary
  }

  private determineUrgency(message: string, semanticAnalysis: SemanticAnalysis): UserIntent['urgency'] {
    const messageLower = message.toLowerCase()
    
    if (messageLower.includes('urgent') || messageLower.includes('asap') || messageLower.includes('immediately')) {
      return 'high'
    }
    if (messageLower.includes('when you can') || messageLower.includes('whenever')) {
      return 'low'
    }
    return 'medium'
  }

  private refineComplexity(
    baseComplexity: UserIntent['complexity'],
    message: string,
    context: ConversationContext,
    semanticAnalysis: SemanticAnalysis
  ): UserIntent['complexity'] {
    const messageLower = message.toLowerCase()
    
    // Increase complexity for certain keywords
    if (messageLower.includes('integration') || messageLower.includes('api') || messageLower.includes('database')) {
      return 'complex'
    }
    
    // Decrease complexity for simple styling
    if (messageLower.includes('color') && !messageLower.includes('dynamic')) {
      return 'simple'
    }
    
    return baseComplexity
  }

  private generateIntentDescription(
    intent: UserIntent['primary'],
    targets: string[],
    message: string,
    semanticAnalysis: SemanticAnalysis
  ): string {
    const targetString = targets.length > 0 ? targets.join(', ') : 'specified elements'
    
    const templates = {
      add: `Add ${targetString} to the application`,
      modify: `Modify ${targetString} in the application`,
      remove: `Remove ${targetString} from the application`,
      style: `Update styling for ${targetString}`,
      fix: `Fix issues with ${targetString}`,
      refactor: `Refactor ${targetString} for better structure`,
      optimize: `Optimize ${targetString} for better performance`,
      explain: `Explain how ${targetString} works`,
      question: `Answer question about ${targetString}`
    }
    
    return templates[intent] || `Perform ${intent} operation on ${targetString}`
  }

  private determineReferenceType(reference: string): ContextualReference['type'] {
    const styleTerms = ['color', 'background', 'font', 'size', 'margin', 'padding', 'border']
    const componentTerms = ['button', 'input', 'form', 'menu', 'nav', 'header', 'footer']
    const elementTerms = ['div', 'span', 'text', 'image', 'link']
    
    if (styleTerms.includes(reference.toLowerCase())) return 'style'
    if (componentTerms.includes(reference.toLowerCase())) return 'component'
    if (elementTerms.includes(reference.toLowerCase())) return 'element'
    
    return 'element' // default
  }

  private findSimilarReferences(reference: string, context: ConversationContext): string[] {
    return context.activeComponents.filter(component =>
      component.toLowerCase().includes(reference.toLowerCase()) ||
      reference.toLowerCase().includes(component.toLowerCase())
    )
  }

  private resolvePronounReference(
    pronoun: string,
    context: ConversationContext
  ): ContextualReference | null {
    const lastTurn = context.conversationHistory[context.conversationHistory.length - 1]
    if (!lastTurn) return null

    const lastTargets = lastTurn.intent.targetElements
    if (lastTargets.length > 0) {
      return {
        term: lastTargets[0], // Use the first target as reference
        type: 'component',
        confidence: 0.8,
        alternatives: lastTargets.slice(1)
      }
    }

    return null
  }

  private deduplicateReferences(references: ContextualReference[]): ContextualReference[] {
    const seen = new Set<string>()
    return references.filter(ref => {
      const key = ref.term.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private getPossibleMeanings(term: string, context: ConversationContext): string[] {
    const meanings: string[] = []
    
    switch (term.toLowerCase()) {
      case 'button':
        meanings.push('Submit button', 'Navigation button', 'Action button', 'Toggle button')
        break
      case 'component':
        meanings.push(...context.activeComponents)
        break
      case 'element':
        meanings.push('HTML element', 'UI component', 'Design element')
        break
      default:
        meanings.push(term) // Fallback
    }
    
    return meanings
  }

  private hasVagueScope(message: string): boolean {
    const vagueWords = ['everything', 'all', 'whole', 'entire', 'overall', 'general']
    const messageLower = message.toLowerCase()
    return vagueWords.some(word => messageLower.includes(word))
  }

  private fuzzyMatch(reference: string, message: string): boolean {
    const messageLower = message.toLowerCase()
    const words = message.split(/\s+/)
    return words.some(word => word.includes(reference.toLowerCase()))
  }

  /**
   * Analyze conversation flow and extract insights
   */
  async analyzeConversationFlow(turns: ConversationTurn[]): Promise<ConversationInsight> {
    const patterns: string[] = []
    const intents = turns.map(t => t.intent.primary)
    const commonIntents = this.getFrequentIntents(intents)
    
    // Detect patterns
    if (intents.filter(i => i === 'style').length > intents.length * 0.4) {
      patterns.push('style-focused')
    }
    if (intents.filter(i => i === 'add').length > intents.length * 0.3) {
      patterns.push('feature-building')
    }
    if (turns.some(t => t.context.clarificationNeeded)) {
      patterns.push('needs-clarification')
    }

    // Determine user expertise
    const userExpertise = this.determineUserExpertise(turns)
    
    // Identify preferred style
    const preferredStyle = this.identifyPreferredStyle(turns)
    
    // Find learning opportunities
    const learningOpportunities = this.identifyLearningOpportunities(turns, userExpertise)

    return {
      patterns,
      userExpertise,
      preferredStyle,
      commonIntents,
      learningOpportunities
    }
  }

  private getFrequentIntents(intents: UserIntent['primary'][]): string[] {
    const counts = new Map<string, number>()
    intents.forEach(intent => {
      counts.set(intent, (counts.get(intent) || 0) + 1)
    })
    
    return Array.from(counts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([intent]) => intent)
  }

  private determineUserExpertise(turns: ConversationTurn[]): 'beginner' | 'intermediate' | 'advanced' {
    let score = 0
    
    for (const turn of turns) {
      // Technical language usage
      if (turn.userMessage.includes('component') || turn.userMessage.includes('props')) score += 2
      if (turn.userMessage.includes('state') || turn.userMessage.includes('hook')) score += 3
      if (turn.userMessage.includes('API') || turn.userMessage.includes('async')) score += 4
      
      // Clarity of requests
      if (turn.context.clarificationNeeded) score -= 1
      if (turn.context.confidence > 0.8) score += 1
    }
    
    const averageScore = score / Math.max(turns.length, 1)
    
    if (averageScore >= 3) return 'advanced'
    if (averageScore >= 1) return 'intermediate'
    return 'beginner'
  }

  private identifyPreferredStyle(turns: ConversationTurn[]): string {
    const verbosityScores = turns.map(turn => turn.userMessage.split(' ').length)
    const avgVerbosity = verbosityScores.reduce((a, b) => a + b, 0) / verbosityScores.length
    
    if (avgVerbosity > 15) return 'detailed'
    if (avgVerbosity > 8) return 'balanced'
    return 'concise'
  }

  private identifyLearningOpportunities(
    turns: ConversationTurn[],
    expertise: 'beginner' | 'intermediate' | 'advanced'
  ): string[] {
    const opportunities: string[] = []
    
    if (expertise === 'beginner') {
      opportunities.push('Component composition', 'State management basics', 'Props and data flow')
    } else if (expertise === 'intermediate') {
      opportunities.push('Advanced hooks', 'Performance optimization', 'Testing strategies')
    } else {
      opportunities.push('Architecture patterns', 'Custom hooks', 'Advanced TypeScript')
    }
    
    return opportunities
  }

  /**
   * Detect conversation patterns for contextual assistance
   */
  detectConversationPattern(turns: ConversationTurn[]): ConversationPattern | null {
    for (const pattern of this.conversationPatterns) {
      const matchingTurns = turns.filter(turn => 
        pattern.triggers.some(trigger => 
          turn.intent.primary === trigger || 
          turn.userMessage.toLowerCase().includes(trigger)
        )
      )

      if (matchingTurns.length >= 2) {
        return pattern
      }
    }

    return null
  }

  /**
   * Generate follow-up suggestions based on conversation pattern
   */
  generateFollowUpSuggestions(pattern: ConversationPattern | null, context: ConversationContext): string[] {
    if (!pattern) {
      return [
        "What would you like to modify next?",
        "Would you like to add any interactive features?",
        "Should we optimize the styling?"
      ]
    }

    return pattern.followUpQuestions.slice(0, 2)
  }

  /**
   * Predict next likely user actions based on conversation flow
   */
  predictNextActions(turns: ConversationTurn[]): Array<{
    action: UserIntent['primary']
    confidence: number
    description: string
  }> {
    const recentIntents = turns.slice(-3).map(t => t.intent.primary)
    const predictions: Array<{ action: UserIntent['primary'], confidence: number, description: string }> = []

    // Pattern-based predictions
    if (recentIntents.includes('add')) {
      predictions.push({
        action: 'style',
        confidence: 0.8,
        description: 'Likely to want to style the newly added element'
      })
    }

    if (recentIntents.includes('style')) {
      predictions.push({
        action: 'modify',
        confidence: 0.7,
        description: 'May want to adjust the styling further'
      })
    }

    if (recentIntents.includes('fix')) {
      predictions.push({
        action: 'question',
        confidence: 0.6,
        description: 'Might ask for clarification or verification'
      })
    }

    return predictions.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Calculate conversation coherence score
   */
  calculateCoherenceScore(turns: ConversationTurn[]): number {
    if (turns.length < 2) return 1.0

    let coherenceScore = 0
    const windowSize = 3

    for (let i = 1; i < turns.length; i++) {
      const currentTurn = turns[i]
      const recentTurns = turns.slice(Math.max(0, i - windowSize), i)
      
      // Check if current turn relates to recent context
      const hasRelatedTargets = currentTurn.intent.targetElements.some(target =>
        recentTurns.some(turn => turn.intent.targetElements.includes(target))
      )

      const hasSimilarIntent = recentTurns.some(turn => 
        turn.intent.primary === currentTurn.intent.primary ||
        (turn.intent.secondary && turn.intent.secondary.includes(currentTurn.intent.primary))
      )

      if (hasRelatedTargets || hasSimilarIntent) {
        coherenceScore += 1
      }
    }

    return coherenceScore / (turns.length - 1)
  }

  /**
   * Extract contextual hints from conversation history
   */
  extractContextualHints(turns: ConversationTurn[]): Array<{
    type: 'preference' | 'expertise' | 'goal' | 'constraint'
    hint: string
    confidence: number
  }> {
    const hints: Array<{ type: 'preference' | 'expertise' | 'goal' | 'constraint', hint: string, confidence: number }> = []

    // Analyze user preferences
    const styleIntents = turns.filter(t => t.intent.primary === 'style')
    if (styleIntents.length > 2) {
      const commonColors = this.extractCommonTerms(styleIntents, ['red', 'blue', 'green', 'dark', 'light'])
      if (commonColors.length > 0) {
        hints.push({
          type: 'preference',
          hint: `Prefers ${commonColors[0]} color scheme`,
          confidence: 0.7
        })
      }
    }

    // Analyze expertise level
    const technicalTerms = turns.flatMap(t => 
      t.userMessage.toLowerCase().split(/\s+/).filter(word => 
        ['component', 'props', 'state', 'hook', 'api', 'async', 'jsx', 'tsx'].includes(word)
      )
    )

    if (technicalTerms.length > 5) {
      hints.push({
        type: 'expertise',
        hint: 'Advanced React developer',
        confidence: 0.8
      })
    }

    return hints
  }

  private extractCommonTerms(turns: ConversationTurn[], terms: string[]): string[] {
    const termCounts = new Map<string, number>()
    
    turns.forEach(turn => {
      terms.forEach(term => {
        if (turn.userMessage.toLowerCase().includes(term)) {
          termCounts.set(term, (termCounts.get(term) || 0) + 1)
        }
      })
    })

    return Array.from(termCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
  }
}

export const naturalLanguageProcessor = new EnhancedNaturalLanguageProcessor() 
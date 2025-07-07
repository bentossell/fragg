import { openrouter } from '@/lib/ai-config'
import { generateText } from 'ai'
import { z } from 'zod'

export interface TriageResult {
  stack: 'static' | 'nextjs' | 'streamlit' | 'gradio' | 'vue'
  template: string
  reasoning: string
  requirements: {
    needsBackend: boolean
    needsDatabase: boolean
    needsAuth: boolean
    isDataHeavy: boolean
    complexity: 'simple' | 'medium' | 'complex'
    isInteractive: boolean
    needsRealtime: boolean
  }
  components: string[]
  estimatedTokens: number
  priority: 'ultra-fast' | 'fast' | 'standard'
  // Enhanced context and intent analysis
  context: {
    intent: 'create' | 'modify' | 'fix' | 'enhance' | 'explain'
    userExperience: 'beginner' | 'intermediate' | 'advanced'
    domain: string
    urgency: 'low' | 'medium' | 'high'
    preferences: {
      stylePreference: 'modern' | 'classic' | 'minimal' | 'corporate'
      colorScheme: 'auto' | 'light' | 'dark' | 'custom'
      framework: 'preferred' | 'any' | 'specific'
    }
  }
  // Conversation context
  conversationContext?: {
    isFollowUp: boolean
    previousRequests: string[]
    currentSession: string
    relatedTopics: string[]
    userFeedback: 'positive' | 'negative' | 'neutral'
  }
  // Enhanced prompt optimization
  promptOptimization: {
    suggestedPrompts: string[]
    improvementTips: string[]
    clarificationQuestions: string[]
  }
}

// Enhanced context analysis patterns
const CONTEXT_PATTERNS = {
  intent: {
    create: [
      'make', 'build', 'create', 'generate', 'develop', 'new',
      'i want', 'i need', 'help me create', 'build me'
    ],
    modify: [
      'change', 'update', 'modify', 'edit', 'alter', 'adjust',
      'improve', 'enhance', 'add to', 'remove from', 'fix'
    ],
    fix: [
      'fix', 'debug', 'error', 'broken', 'not working',
      'issue', 'problem', 'bug', 'wrong'
    ],
    enhance: [
      'improve', 'better', 'optimize', 'enhance', 'upgrade',
      'make it better', 'more features', 'add functionality'
    ],
    explain: [
      'explain', 'how does', 'what is', 'help me understand',
      'describe', 'clarify', 'show me how'
    ]
  },
  userExperience: {
    beginner: [
      'simple', 'basic', 'easy', 'beginner', 'new to',
      'dont know', 'never used', 'first time', 'learning'
    ],
    intermediate: [
      'familiar with', 'some experience', 'know a bit',
      'used before', 'comfortable with'
    ],
    advanced: [
      'complex', 'advanced', 'professional', 'enterprise',
      'production', 'scalable', 'optimized'
    ]
  },
  domain: {
    'e-commerce': ['shop', 'store', 'product', 'cart', 'checkout', 'payment'],
    'education': ['learn', 'course', 'quiz', 'study', 'lesson', 'tutorial'],
    'social': ['chat', 'social', 'share', 'comment', 'like', 'follow'],
    'productivity': ['todo', 'task', 'calendar', 'note', 'organize', 'manage'],
    'entertainment': ['game', 'quiz', 'music', 'video', 'fun', 'play'],
    'business': ['dashboard', 'analytics', 'report', 'crm', 'invoice', 'admin'],
    'finance': ['budget', 'expense', 'money', 'finance', 'investment', 'calculator'],
    'health': ['health', 'fitness', 'medical', 'doctor', 'appointment', 'exercise'],
    'travel': ['travel', 'booking', 'hotel', 'flight', 'trip', 'location'],
    'food': ['recipe', 'restaurant', 'food', 'cooking', 'menu', 'delivery']
  },
  urgency: {
    high: ['urgent', 'asap', 'immediately', 'quick', 'fast', 'rush'],
    medium: ['soon', 'need', 'want', 'should have'],
    low: ['maybe', 'eventually', 'when possible', 'nice to have']
  },
  stylePreference: {
    modern: ['modern', 'contemporary', 'sleek', 'clean', 'minimalist'],
    classic: ['classic', 'traditional', 'elegant', 'formal'],
    minimal: ['minimal', 'simple', 'clean', 'basic', 'plain'],
    corporate: ['professional', 'business', 'corporate', 'enterprise', 'formal']
  }
}

// Conversation context tracking
class ConversationContextManager {
  private static instance: ConversationContextManager
  private sessionContexts = new Map<string, {
    requests: string[]
    feedback: ('positive' | 'negative' | 'neutral')[]
    topics: string[]
    preferences: Record<string, any>
  }>()

  static getInstance(): ConversationContextManager {
    if (!ConversationContextManager.instance) {
      ConversationContextManager.instance = new ConversationContextManager()
    }
    return ConversationContextManager.instance
  }

  addRequest(sessionId: string, request: string): void {
    if (!this.sessionContexts.has(sessionId)) {
      this.sessionContexts.set(sessionId, {
        requests: [],
        feedback: [],
        topics: [],
        preferences: {}
      })
    }
    
    const context = this.sessionContexts.get(sessionId)!
    context.requests.push(request)
    
    // Keep only last 10 requests
    if (context.requests.length > 10) {
      context.requests = context.requests.slice(-10)
    }
  }

  addFeedback(sessionId: string, feedback: 'positive' | 'negative' | 'neutral'): void {
    const context = this.sessionContexts.get(sessionId)
    if (context) {
      context.feedback.push(feedback)
    }
  }

  getSessionContext(sessionId: string) {
    return this.sessionContexts.get(sessionId)
  }

  extractTopics(requests: string[]): string[] {
    const topics = new Set<string>()
    
    requests.forEach(request => {
      const requestLower = request.toLowerCase()
      
      // Extract domain topics
      Object.entries(CONTEXT_PATTERNS.domain).forEach(([domain, keywords]) => {
        if (keywords.some(keyword => requestLower.includes(keyword))) {
          topics.add(domain)
        }
      })
      
      // Extract technology topics
      const techKeywords = [
        'react', 'vue', 'angular', 'nextjs', 'streamlit', 'gradio',
        'typescript', 'javascript', 'python', 'html', 'css'
      ]
      
      techKeywords.forEach(tech => {
        if (requestLower.includes(tech)) {
          topics.add(tech)
        }
      })
    })
    
    return Array.from(topics)
  }
}

// Enhanced prompt analysis
class PromptAnalyzer {
  static analyzeIntent(prompt: string): 'create' | 'modify' | 'fix' | 'enhance' | 'explain' {
    const promptLower = prompt.toLowerCase()
    
    for (const [intent, keywords] of Object.entries(CONTEXT_PATTERNS.intent)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return intent as any
      }
    }
    
    return 'create' // default
  }

  static analyzeUserExperience(prompt: string): 'beginner' | 'intermediate' | 'advanced' {
    const promptLower = prompt.toLowerCase()
    
    for (const [level, keywords] of Object.entries(CONTEXT_PATTERNS.userExperience)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return level as any
      }
    }
    
    // Default based on complexity indicators
    if (promptLower.includes('simple') || promptLower.includes('basic')) {
      return 'beginner'
    }
    
    if (promptLower.includes('complex') || promptLower.includes('advanced')) {
      return 'advanced'
    }
    
    return 'intermediate'
  }

  static analyzeDomain(prompt: string): string {
    const promptLower = prompt.toLowerCase()
    
    for (const [domain, keywords] of Object.entries(CONTEXT_PATTERNS.domain)) {
      const matchCount = keywords.filter(keyword => promptLower.includes(keyword)).length
      if (matchCount > 0) {
        return domain
      }
    }
    
    return 'general'
  }

  static analyzeUrgency(prompt: string): 'low' | 'medium' | 'high' {
    const promptLower = prompt.toLowerCase()
    
    for (const [urgency, keywords] of Object.entries(CONTEXT_PATTERNS.urgency)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return urgency as any
      }
    }
    
    return 'medium'
  }

  static analyzeStylePreference(prompt: string): 'modern' | 'classic' | 'minimal' | 'corporate' {
    const promptLower = prompt.toLowerCase()
    
    for (const [style, keywords] of Object.entries(CONTEXT_PATTERNS.stylePreference)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return style as any
      }
    }
    
    return 'modern' // default
  }

  static generatePromptSuggestions(prompt: string, domain: string): string[] {
    const suggestions: string[] = []
    
    // Domain-specific suggestions
    switch (domain) {
      case 'e-commerce':
        suggestions.push(
          'Add product filtering and sorting functionality',
          'Include user reviews and ratings',
          'Implement shopping cart with checkout flow'
        )
        break
      case 'productivity':
        suggestions.push(
          'Add task categorization and priority levels',
          'Include due dates and reminders',
          'Implement progress tracking and analytics'
        )
        break
      case 'social':
        suggestions.push(
          'Add real-time messaging functionality',
          'Include user profiles and connections',
          'Implement content sharing and interactions'
        )
        break
      default:
        suggestions.push(
          'Add responsive design for mobile devices',
          'Include accessibility features',
          'Implement user-friendly navigation'
        )
    }
    
    return suggestions
  }

  static generateClarificationQuestions(prompt: string, context: any): string[] {
    const questions: string[] = []
    
    // Check for ambiguous terms
    if (prompt.includes('app') && !prompt.includes('web') && !prompt.includes('mobile')) {
      questions.push('Should this be a web app or mobile app?')
    }
    
    if (prompt.includes('database') && !prompt.includes('local') && !prompt.includes('cloud')) {
      questions.push('Do you need a local database or cloud storage?')
    }
    
    if (prompt.includes('users') && !prompt.includes('auth')) {
      questions.push('Do you need user authentication and accounts?')
    }
    
    // Domain-specific questions
    if (context.domain === 'e-commerce') {
      questions.push('Do you need payment processing integration?')
    }
    
    if (context.domain === 'social') {
      questions.push('Should users be able to create accounts and profiles?')
    }
    
    return questions
  }
}

// Fast keyword-based rules for instant decisions
const ULTRA_FAST_RULES: Record<string, Partial<TriageResult>> = {
  // CDN-compatible React apps - instant preview
  'counter|timer|clock|stopwatch|countdown|todo|todo list|task list|calculator|converter|quiz|simple form|color picker|theme switcher|note app|flashcard|pomodoro|habit tracker|expense tracker|simple game|tic tac toe|memory game|puzzle|card game': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'ultra-fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'simple',
      isInteractive: true,
      needsRealtime: false
    }
  },
  
  // Static site patterns - fastest generation
  'personal website|portfolio|resume|cv|about me|landing page|company website|business website|personal site|my website|homepage|home page|personal page|portfolio site|online resume|digital resume|bio|biography|personal bio|showcase|personal showcase|profile|personal profile|professional profile|online presence|web presence|single page|simple website|basic website|static website|static site|html website|html site|introduction|personal introduction|about page': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'ultra-fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'simple',
      isInteractive: false,
      needsRealtime: false
    }
  },
  
  // Business/Marketing sites that should be static
  'marketing site|marketing website|brochure site|brochure website|info site|information site|promotional site|promotional website|agency website|agency site|consulting website|service website|services website|product page|sales page|coming soon|under construction|maintenance page|contact page|about us|company info|company information': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'ultra-fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'simple',
      isInteractive: false,
      needsRealtime: false
    }
  },
  
  // Simple interactive tools
  'calculator|converter|timer|counter|quiz|form|contact form|survey|simple form|basic form|feedback form|newsletter|email signup|subscribe|subscription form|simple tool|basic tool|utility|web tool|online tool': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'simple',
      isInteractive: true,
      needsRealtime: false
    }
  },
  
  // Data visualization - Python stack
  'data analysis|visualization|chart|graph|plot|dataset|pandas|numpy|matplotlib|seaborn|plotly': {
    stack: 'streamlit',
    template: 'streamlit-developer',
    priority: 'fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: true,
      complexity: 'medium',
      isInteractive: true,
      needsRealtime: false
    }
  },
  
  // AI/ML demos
  'gradio|model demo|ml demo|ai demo|machine learning|inference|huggingface': {
    stack: 'gradio',
    template: 'gradio-developer',
    priority: 'fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: true,
      complexity: 'medium',
      isInteractive: true,
      needsRealtime: false
    }
  }
}

const FAST_RULES: Record<string, Partial<TriageResult>> = {
  // More static patterns that are slightly more complex
  'restaurant website|restaurant site|cafe website|menu page|food menu|restaurant menu|small business website|small business site|local business|service page|pricing page|price list|testimonials|reviews page|faq page|frequently asked questions|help page|documentation page|simple docs|product showcase|service showcase|photo gallery|image gallery|portfolio gallery': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'simple',
      isInteractive: false,
      needsRealtime: false
    }
  },
  
  // Apps requiring more complex UI but no backend
  'dashboard|admin panel|ui library|component library|design system': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'medium',
      isInteractive: true,
      needsRealtime: false
    }
  },
  
  // Simple games
  'game|puzzle|tic tac toe|memory game|snake|tetris|simple game': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'fast',
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'medium',
      isInteractive: true,
      needsRealtime: false
    }
  }
}

const STANDARD_RULES: Record<string, Partial<TriageResult>> = {
  // Full-stack apps
  'todo app|task manager|blog|cms|ecommerce|shopping cart|user management|authentication': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'standard',
    requirements: {
      needsBackend: true,
      needsDatabase: true,
      needsAuth: true,
      isDataHeavy: false,
      complexity: 'complex',
      isInteractive: true,
      needsRealtime: false
    }
  },
  
  // Real-time apps
  'chat app|messaging|real-time|websocket|live updates|collaboration': {
    stack: 'nextjs',
    template: 'nextjs-developer',
    priority: 'standard',
    requirements: {
      needsBackend: true,
      needsDatabase: true,
      needsAuth: true,
      isDataHeavy: false,
      complexity: 'complex',
      isInteractive: true,
      needsRealtime: true
    }
  }
}

// AI analysis schema for complex requests
const triageSchema = z.object({
  stack: z.enum(['static', 'nextjs', 'streamlit', 'gradio', 'vue']),
  template: z.string(),
  reasoning: z.string(),
  requirements: z.object({
    needsBackend: z.boolean(),
    needsDatabase: z.boolean(),
    needsAuth: z.boolean(),
    isDataHeavy: z.boolean(),
    complexity: z.enum(['simple', 'medium', 'complex']),
    isInteractive: z.boolean(),
    needsRealtime: z.boolean()
  }),
  components: z.array(z.string()),
  estimatedTokens: z.number(),
  priority: z.enum(['ultra-fast', 'fast', 'standard'])
})

export async function triageRequest(userPrompt: string, sessionId?: string, existingCode?: string): Promise<TriageResult> {
  const promptLower = userPrompt.toLowerCase()
  
  // Enhanced context analysis
  const contextManager = ConversationContextManager.getInstance()
  const sessionContext = sessionId ? contextManager.getSessionContext(sessionId) : null
  
  // Track this request
  if (sessionId) {
    contextManager.addRequest(sessionId, userPrompt)
  }

  // Analyze prompt context
  const intent = PromptAnalyzer.analyzeIntent(userPrompt)
  const userExperience = PromptAnalyzer.analyzeUserExperience(userPrompt)
  const domain = PromptAnalyzer.analyzeDomain(userPrompt)
  const urgency = PromptAnalyzer.analyzeUrgency(userPrompt)
  const stylePreference = PromptAnalyzer.analyzeStylePreference(userPrompt)

  // Determine if this is a modification request
  const isModification = intent === 'modify' || intent === 'fix' || intent === 'enhance' || 
                        (existingCode && (promptLower.includes('change') || promptLower.includes('update') || promptLower.includes('fix')))

  // Enhanced conversation context
  const conversationContext = sessionContext ? {
    isFollowUp: sessionContext.requests.length > 1,
    previousRequests: sessionContext.requests.slice(-5), // Last 5 requests
    currentSession: sessionId || 'anonymous',
    relatedTopics: contextManager.extractTopics(sessionContext.requests),
    userFeedback: sessionContext.feedback.length > 0 ? 
      sessionContext.feedback[sessionContext.feedback.length - 1] : 'neutral' as const
  } : undefined

  // For modification requests, prefer faster processing
  if (isModification && existingCode) {
    const result = await buildEnhancedTriageResult(
      { 
        priority: 'fast', 
        requirements: { 
          needsBackend: false,
          needsDatabase: false,
          needsAuth: false,
          isDataHeavy: false,
          complexity: 'simple',
          isInteractive: true,
          needsRealtime: false
        } 
      },
      'modification request',
      userPrompt,
      {
        intent,
        userExperience,
        domain,
        urgency,
        preferences: {
          stylePreference,
          colorScheme: 'auto' as const,
          framework: 'preferred' as const
        }
      },
      conversationContext
    )
    
    return result
  }

  // NEW: Check if user explicitly wants something simple/static
  const wantsSimple = /simple|basic|static|just html|plain html|no framework|vanilla|pure css|without react|without framework/i.test(userPrompt)
  
  // NEW: Check if it's obviously a personal/small site
  const isPersonalSite = /my |personal |for me|i want|i need|my own|build me/i.test(userPrompt) && 
                        /website|site|page|portfolio|resume|cv|blog|landing/i.test(userPrompt)
  
  // If user explicitly wants simple or it's a personal site, prefer static
  if (wantsSimple || isPersonalSite) {
    // Check if it actually needs complex features
    const needsComplex = /database|auth|login|user|account|payment|ecommerce|real-time|chat|api|backend/i.test(userPrompt)
    
    if (!needsComplex) {
      return await buildEnhancedTriageResult(
        {
          stack: 'nextjs',
          template: 'nextjs-developer',
          priority: 'ultra-fast',
          requirements: {
            needsBackend: false,
            needsDatabase: false,
            needsAuth: false,
            isDataHeavy: false,
            complexity: 'simple',
            isInteractive: promptLower.includes('interactive') || promptLower.includes('form'),
            needsRealtime: false
          }
        },
        wantsSimple ? 'User explicitly requested a simple/static site' : 'Personal website detected - using Next.js for simplicity',
        userPrompt,
        {
          intent,
          userExperience,
          domain,
          urgency,
          preferences: {
            stylePreference,
            colorScheme: 'auto' as const,
            framework: 'preferred' as const
          }
        },
        conversationContext
      )
    }
  }
  
  // Try ultra-fast rules first (for sub-5-second generation)
  for (const [pattern, result] of Object.entries(ULTRA_FAST_RULES)) {
    if (matchesPattern(promptLower, pattern)) {
      return await buildEnhancedTriageResult(
        result,
        pattern,
        userPrompt,
        {
          intent,
          userExperience,
          domain,
          urgency,
          preferences: {
            stylePreference,
            colorScheme: 'auto' as const,
            framework: 'preferred' as const
          }
        },
        conversationContext
      )
    }
  }
  
  // Try fast rules (for sub-10-second generation)
  for (const [pattern, result] of Object.entries(FAST_RULES)) {
    if (matchesPattern(promptLower, pattern)) {
      return await buildEnhancedTriageResult(
        result,
        pattern,
        userPrompt,
        {
          intent,
          userExperience,
          domain,
          urgency,
          preferences: {
            stylePreference,
            colorScheme: 'auto' as const,
            framework: 'preferred' as const
          }
        },
        conversationContext
      )
    }
  }
  
  // Try standard rules (for sub-15-second generation)
  for (const [pattern, result] of Object.entries(STANDARD_RULES)) {
    if (matchesPattern(promptLower, pattern)) {
      return await buildEnhancedTriageResult(
        result,
        pattern,
        userPrompt,
        {
          intent,
          userExperience,
          domain,
          urgency,
          preferences: {
            stylePreference,
            colorScheme: 'auto' as const,
            framework: 'preferred' as const
          }
        },
        conversationContext
      )
    }
  }
  
  // Fall back to AI analysis for complex/unclear requests
  return await enhancedAiAnalyze(userPrompt, {
    intent,
    userExperience,
    domain,
    urgency,
    preferences: {
      stylePreference,
      colorScheme: 'auto' as const,
      framework: 'preferred' as const
    }
  }, conversationContext)
}

function matchesPattern(prompt: string, pattern: string): boolean {
  const keywords = pattern.split('|')
  return keywords.some(keyword => prompt.includes(keyword.trim()))
}

async function buildEnhancedTriageResult(
  partial: Partial<TriageResult>, 
  pattern: string, 
  prompt: string,
  context: TriageResult['context'],
  conversationContext?: TriageResult['conversationContext']
): Promise<TriageResult> {
  const components = extractComponents(prompt)
  
  return {
    stack: partial.stack || 'nextjs',
    template: partial.template || 'nextjs-developer',
    reasoning: `Matched pattern: "${pattern}" with enhanced context analysis`,
    requirements: {
      needsBackend: false,
      needsDatabase: false,
      needsAuth: false,
      isDataHeavy: false,
      complexity: 'simple',
      isInteractive: false,
      needsRealtime: false,
      ...partial.requirements
    },
    components,
    estimatedTokens: estimateTokens(partial.requirements?.complexity || 'simple'),
    priority: partial.priority || 'fast',
    context,
    conversationContext,
    promptOptimization: {
      suggestedPrompts: PromptAnalyzer.generatePromptSuggestions(prompt, context.domain),
      improvementTips: generateImprovementTips(prompt, context),
      clarificationQuestions: PromptAnalyzer.generateClarificationQuestions(prompt, context)
    }
  }
}

async function enhancedAiAnalyze(
  userPrompt: string, 
  context: TriageResult['context'],
  conversationContext?: TriageResult['conversationContext']
): Promise<TriageResult> {
  try {
    const model = openrouter('google/gemini-2.5-flash-lite-preview-06-17')
    
    const systemPrompt = `You are an advanced tech stack analyzer with deep understanding of user intent and context. 
    
Analyze the user's request and return a JSON object with the recommended stack.

USER CONTEXT:
- Intent: ${context.intent}
- Experience Level: ${context.userExperience}
- Domain: ${context.domain}
- Urgency: ${context.urgency}
- Style Preference: ${context.preferences.stylePreference}
${conversationContext ? `
- Previous requests: ${conversationContext.previousRequests.slice(-3).join(', ')}
- Related topics: ${conversationContext.relatedTopics.join(', ')}
- User feedback: ${conversationContext.userFeedback}
` : ''}

Available stacks:
- static: HTML/CSS/JS with Tailwind for simple sites, forms, calculators, games
- nextjs: React/Next.js apps with routing, complex UI, SPAs
- streamlit: Python data apps with visualizations, analysis tools
- gradio: ML model demos and AI interfaces
- vue: Vue.js apps (only if specifically requested)

ENHANCED GUIDELINES:
- Consider user's experience level when recommending complexity
- Factor in domain-specific requirements (e.g., e-commerce needs backend)
- Respect user's style and urgency preferences
- For ${context.intent} requests, prioritize appropriate stack selection
- For ${context.userExperience} users, adjust complexity accordingly
- STRONGLY prefer "static" for ANY personal website, portfolio, landing page, company website, or simple site
- Use "static" for anything that doesn't explicitly need a backend, database, or user accounts
- Only use "nextjs" if the user specifically mentions React, Next.js, or needs complex features
- Personal websites, portfolios, and landing pages should ALWAYS be static unless explicitly stated otherwise
- If unsure, default to "static" for simplicity and speed
- Estimate tokens conservatively (1000-5000 range)

Return valid JSON only, no markdown or explanations.`

    const response = await generateText({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      maxTokens: 500
    })
    
    const responseText = response.text || '{}'
    
    // Add null checks for better error handling
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from AI model')
    }
    
    let parsed
    try {
      parsed = triageSchema.parse(JSON.parse(responseText))
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText)
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`)
    }
    
    return {
      ...parsed,
      components: extractComponents(userPrompt.toLowerCase()),
      context,
      conversationContext,
      promptOptimization: {
        suggestedPrompts: PromptAnalyzer.generatePromptSuggestions(userPrompt, context.domain),
        improvementTips: generateImprovementTips(userPrompt, context),
        clarificationQuestions: PromptAnalyzer.generateClarificationQuestions(userPrompt, context)
      }
    }
  } catch (error) {
    console.warn('Enhanced AI triage failed, using smart default:', error)
    
    // Smart default based on prompt analysis
    const isSimple = /personal|portfolio|landing|about|resume|cv|simple|basic|website|site|page|home|company|business|agency|service|restaurant|cafe|small/i.test(userPrompt.toLowerCase())
    const needsBackend = /database|auth|login|user|account|api|backend|server|dynamic|cms|blog with admin|ecommerce|payment/i.test(userPrompt.toLowerCase())
    const isData = /data|chart|graph|analysis|visualization|plot/i.test(userPrompt.toLowerCase())
    
    if (isData) {
      return {
        stack: 'streamlit',
        template: 'streamlit-developer',
        reasoning: 'Default for data-related request with enhanced context analysis',
        requirements: {
          needsBackend: false,
          needsDatabase: false,
          needsAuth: false,
          isDataHeavy: true,
          complexity: 'medium',
          isInteractive: true,
          needsRealtime: false
        },
        components: extractComponents(userPrompt.toLowerCase()),
        estimatedTokens: 2000,
        priority: 'fast',
        context,
        conversationContext,
        promptOptimization: {
          suggestedPrompts: PromptAnalyzer.generatePromptSuggestions(userPrompt, context.domain),
          improvementTips: generateImprovementTips(userPrompt, context),
          clarificationQuestions: PromptAnalyzer.generateClarificationQuestions(userPrompt, context)
        }
      }
    }
    
    // Default to static for simple sites unless backend features are needed
    const shouldUseStatic = (isSimple && !needsBackend) || (!needsBackend && userPrompt.length < 100)
    
    return {
      stack: 'nextjs',
      template: 'nextjs-developer',
      reasoning: shouldUseStatic ? 'Simple site without backend requirements - enhanced analysis' : 'Complex features or backend requirements detected - enhanced analysis',
      requirements: {
        needsBackend: needsBackend,
        needsDatabase: needsBackend,
        needsAuth: needsBackend,
        isDataHeavy: false,
        complexity: shouldUseStatic ? 'simple' : 'medium',
        isInteractive: true,
        needsRealtime: false
      },
      components: extractComponents(userPrompt.toLowerCase()),
      estimatedTokens: shouldUseStatic ? 1000 : 2500,
      priority: shouldUseStatic ? 'ultra-fast' : 'fast',
      context,
      conversationContext,
      promptOptimization: {
        suggestedPrompts: PromptAnalyzer.generatePromptSuggestions(userPrompt, context.domain),
        improvementTips: generateImprovementTips(userPrompt, context),
        clarificationQuestions: PromptAnalyzer.generateClarificationQuestions(userPrompt, context)
      }
    }
  }
}

function generateImprovementTips(prompt: string, context: TriageResult['context']): string[] {
  const tips: string[] = []
  
  // Generic tips based on prompt analysis
  if (prompt.length < 20) {
    tips.push('Consider providing more details about your requirements')
  }
  
  if (!prompt.includes('style') && !prompt.includes('design')) {
    tips.push('Specify your preferred design style (modern, minimal, corporate, etc.)')
  }
  
  if (context.intent === 'create' && !prompt.includes('responsive')) {
    tips.push('Consider mentioning if you need mobile-responsive design')
  }
  
  // Experience-level specific tips
  if (context.userExperience === 'beginner') {
    tips.push('Start with simple features and add complexity gradually')
  } else if (context.userExperience === 'advanced') {
    tips.push('Consider specifying technical requirements and performance constraints')
  }
  
  // Domain-specific tips
  switch (context.domain) {
    case 'e-commerce':
      tips.push('Consider payment integration and inventory management needs')
      break
    case 'social':
      tips.push('Think about user authentication and data privacy requirements')
      break
    case 'productivity':
      tips.push('Consider data persistence and synchronization needs')
      break
  }
  
  return tips
}

function extractComponents(prompt: string): string[] {
  const components: string[] = []
  
  // UI components
  if (/button|btn|click|submit/.test(prompt)) components.push('button')
  if (/form|input|field|contact|survey/.test(prompt)) components.push('form', 'input')
  if (/card|grid|layout|section/.test(prompt)) components.push('card')
  if (/nav|menu|header|navigation/.test(prompt)) components.push('navigation')
  if (/table|list|data|rows|columns/.test(prompt)) components.push('table')
  if (/modal|dialog|popup|alert/.test(prompt)) components.push('dialog')
  if (/tab|accordion|collapse/.test(prompt)) components.push('tabs')
  if (/slider|range|carousel/.test(prompt)) components.push('slider')
  if (/search|filter|find/.test(prompt)) components.push('search')
  if (/avatar|profile|user/.test(prompt)) components.push('avatar')
  if (/badge|tag|label/.test(prompt)) components.push('badge')
  if (/toast|notification|message/.test(prompt)) components.push('toast')
  if (/progress|loading|spinner/.test(prompt)) components.push('progress')
  if (/dropdown|select|menu/.test(prompt)) components.push('dropdown')
  if (/checkbox|radio|switch/.test(prompt)) components.push('checkbox')
  if (/textarea|text|input/.test(prompt)) components.push('textarea')
  if (/calendar|date|time/.test(prompt)) components.push('calendar')
  if (/chart|graph|visualization/.test(prompt)) components.push('chart')
  
  return [...new Set(components)] // Remove duplicates
}

function estimateTokens(complexity: string): number {
  switch (complexity) {
    case 'simple': return 1000
    case 'medium': return 2500
    case 'complex': return 4000
    default: return 2000
  }
}

// Export enhanced functionality
export { 
  extractComponents, 
  estimateTokens, 
  PromptAnalyzer,
  ConversationContextManager,
  CONTEXT_PATTERNS 
}

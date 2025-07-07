import { TriageResult } from './ai-triage'
import { AgentContext } from './ai-agents'
import { Template } from './templates'

export interface PromptTemplate {
  id: string
  name: string
  category: 'creation' | 'modification' | 'debugging' | 'optimization' | 'explanation'
  framework: 'react' | 'nextjs' | 'streamlit' | 'gradio' | 'python' | 'html' | 'universal'
  complexity: 'simple' | 'medium' | 'complex'
  basePrompt: string
  contextVariables: string[]
  examples: PromptExample[]
  optimizations: PromptOptimization[]
}

export interface PromptExample {
  input: string
  expectedOutput: string
  context: Record<string, any>
  explanation: string
}

export interface PromptOptimization {
  trigger: string // condition that triggers this optimization
  modification: string // how to modify the prompt
  purpose: string // why this optimization helps
}

export interface EnhancedPromptResult {
  prompt: string
  confidence: number
  optimizations: string[]
  contextUsed: Record<string, any>
  estimatedTokens: number
  fallbackPrompts: string[]
  metadata: {
    templateUsed: string
    frameworkOptimized: boolean
    contextAware: boolean
    qualityScore: number
  }
}

// Framework-specific prompt templates
export class SmartPromptEngine {
  private templates = new Map<string, PromptTemplate>()
  private contextHistory = new Map<string, any[]>()
  
  constructor() {
    this.initializeTemplates()
  }

  /**
   * Generate an optimized prompt based on context and intent
   */
  generatePrompt(
    userPrompt: string,
    triageResult: TriageResult,
    context?: AgentContext,
    sessionId?: string,
    existingCode?: string
  ): EnhancedPromptResult {
    // Analyze the request type and select appropriate template
    const templateId = this.selectOptimalTemplate(userPrompt, triageResult, context)
    const template = this.templates.get(templateId)
    
    if (!template) {
      return this.generateFallbackPrompt(userPrompt, triageResult)
    }

    // Build context variables
    const contextVars = this.buildContextVariables(userPrompt, triageResult, context, existingCode)
    
    // Apply framework-specific optimizations
    const frameworkOptimizations = this.applyFrameworkOptimizations(template, triageResult.stack, contextVars)
    
    // Apply user experience optimizations
    const experienceOptimizations = this.applyExperienceOptimizations(template, triageResult.context.userExperience)
    
    // Apply domain-specific optimizations
    const domainOptimizations = this.applyDomainOptimizations(template, triageResult.context.domain)
    
    // Apply conversation context optimizations
    const conversationOptimizations = this.applyConversationOptimizations(template, triageResult.conversationContext, sessionId)
    
    // Build the final prompt
    const enhancedPrompt = this.constructPrompt(
      template,
      contextVars,
      [...frameworkOptimizations, ...experienceOptimizations, ...domainOptimizations, ...conversationOptimizations]
    )
    
    // Calculate confidence and quality metrics
    const confidence = this.calculateConfidence(template, contextVars, triageResult)
    const qualityScore = this.calculateQualityScore(enhancedPrompt, triageResult)
    
    return {
      prompt: enhancedPrompt,
      confidence,
      optimizations: [
        ...frameworkOptimizations.map(o => o.purpose),
        ...experienceOptimizations.map(o => o.purpose),
        ...domainOptimizations.map(o => o.purpose),
        ...conversationOptimizations.map(o => o.purpose)
      ],
      contextUsed: contextVars,
      estimatedTokens: this.estimateTokens(enhancedPrompt),
      fallbackPrompts: this.generateFallbackPrompts(userPrompt, triageResult),
      metadata: {
        templateUsed: templateId,
        frameworkOptimized: frameworkOptimizations.length > 0,
        contextAware: Object.keys(contextVars).length > 0,
        qualityScore
      }
    }
  }

  /**
   * Initialize framework-specific prompt templates
   */
  private initializeTemplates(): void {
    // React/Next.js Creation Template
    this.templates.set('nextjs-creation', {
      id: 'nextjs-creation',
      name: 'Next.js App Creation',
      category: 'creation',
      framework: 'nextjs',
      complexity: 'medium',
      basePrompt: `You are a world-class React/Next.js developer creating modern, beautiful applications.

USER REQUEST: "{userPrompt}"

CONTEXT:
- Framework: Next.js with React
- Complexity: {complexity}
- User Experience: {userExperience}
- Domain: {domain}
- Style Preference: {stylePreference}
- Components needed: {components}

REQUIREMENTS:
- Create a modern, responsive React component using TypeScript
- Use Tailwind CSS for styling with {stylePreference} design approach
- Implement proper TypeScript interfaces and type safety
- Use React hooks appropriately (useState, useEffect, etc.)
- Include accessibility features (ARIA labels, semantic HTML)
- Make it mobile-first and responsive
- Add smooth animations and micro-interactions
- Use modern patterns and best practices

{frameworkSpecific}
{experienceSpecific}
{domainSpecific}
{conversationSpecific}

Generate clean, production-ready code that follows Next.js conventions:`,
      contextVariables: [
        'userPrompt', 'complexity', 'userExperience', 'domain', 'stylePreference', 
        'components', 'frameworkSpecific', 'experienceSpecific', 'domainSpecific', 'conversationSpecific'
      ],
      examples: [
        {
          input: 'Create a todo list app',
          expectedOutput: 'Modern todo app with TypeScript, state management, and beautiful UI',
          context: { complexity: 'medium', domain: 'productivity' },
          explanation: 'Focuses on state management and user interaction patterns'
        }
      ],
      optimizations: [
        {
          trigger: 'userExperience === "beginner"',
          modification: 'Add detailed comments and simpler patterns',
          purpose: 'Make code more accessible for beginners'
        },
        {
          trigger: 'domain === "e-commerce"',
          modification: 'Include commerce-specific patterns and components',
          purpose: 'Optimize for e-commerce requirements'
        }
      ]
    })

    // React/Next.js Modification Template
    this.templates.set('nextjs-modification', {
      id: 'nextjs-modification',
      name: 'Next.js App Modification',
      category: 'modification',
      framework: 'nextjs',
      complexity: 'simple',
      basePrompt: `You are modifying an existing React/Next.js application. Make targeted changes while preserving existing functionality.

USER REQUEST: "{userPrompt}"

EXISTING CODE CONTEXT:
{existingCodeContext}

MODIFICATION REQUIREMENTS:
- Only modify the parts that need to change based on the request
- Preserve all existing functionality unless explicitly asked to change it
- Maintain the same code style and patterns
- Keep existing component structure and props
- Use the same state management approach
- Maintain TypeScript types and interfaces

{modificationStrategy}
{frameworkSpecific}
{experienceSpecific}

CRITICAL: Focus only on the requested changes. Do not rewrite the entire component.`,
      contextVariables: [
        'userPrompt', 'existingCodeContext', 'modificationStrategy', 
        'frameworkSpecific', 'experienceSpecific'
      ],
      examples: [
        {
          input: 'Change the button color to blue',
          expectedOutput: 'Modified only the button className with blue color',
          context: { modificationType: 'styling', scope: 'minimal' },
          explanation: 'Surgical change to specific styling'
        }
      ],
      optimizations: [
        {
          trigger: 'existingCode includes "useState"',
          modification: 'Preserve existing state management patterns',
          purpose: 'Maintain consistency with existing state handling'
        }
      ]
    })

    // Streamlit Creation Template
    this.templates.set('streamlit-creation', {
      id: 'streamlit-creation',
      name: 'Streamlit App Creation',
      category: 'creation',
      framework: 'streamlit',
      complexity: 'medium',
      basePrompt: `You are creating a modern Streamlit application for data science and analytics.

USER REQUEST: "{userPrompt}"

CONTEXT:
- Framework: Streamlit with Python
- Data Focus: {dataFocus}
- Complexity: {complexity}
- User Experience: {userExperience}
- Domain: {domain}

REQUIREMENTS:
- Create a well-structured Streamlit app with proper layout
- Use st.columns(), st.container(), and st.expander() for organization
- Implement beautiful custom CSS with st.markdown() for styling
- Add interactive widgets and visualizations
- Include proper error handling and loading states
- Use caching with @st.cache_data for performance
- Add beautiful charts with plotly or similar libraries
- Create an intuitive user interface

{dataSpecific}
{frameworkSpecific}
{experienceSpecific}

Generate clean, efficient Python code:`,
      contextVariables: [
        'userPrompt', 'dataFocus', 'complexity', 'userExperience', 'domain',
        'dataSpecific', 'frameworkSpecific', 'experienceSpecific'
      ],
      examples: [
        {
          input: 'Create a sales dashboard',
          expectedOutput: 'Interactive dashboard with charts, filters, and metrics',
          context: { dataFocus: 'business analytics', domain: 'business' },
          explanation: 'Focuses on business metrics and interactive visualizations'
        }
      ],
      optimizations: [
        {
          trigger: 'domain === "finance"',
          modification: 'Include financial chart types and metrics',
          purpose: 'Optimize for financial data visualization'
        }
      ]
    })

    // Gradio Creation Template
    this.templates.set('gradio-creation', {
      id: 'gradio-creation',
      name: 'Gradio App Creation',
      category: 'creation',
      framework: 'gradio',
      complexity: 'medium',
      basePrompt: `You are creating a Gradio interface for machine learning models and AI demos.

USER REQUEST: "{userPrompt}"

CONTEXT:
- Framework: Gradio with Python
- ML Focus: {mlFocus}
- Complexity: {complexity}
- User Experience: {userExperience}

REQUIREMENTS:
- Create an intuitive Gradio interface using gr.Blocks()
- Design clear input and output components
- Add proper examples and descriptions
- Implement error handling for ML model inputs
- Use gr.Row() and gr.Column() for layout
- Add custom CSS for beautiful styling
- Include helpful instructions and tooltips
- Make the interface user-friendly for non-technical users

{mlSpecific}
{frameworkSpecific}
{experienceSpecific}

Generate clean, well-documented Python code:`,
      contextVariables: [
        'userPrompt', 'mlFocus', 'complexity', 'userExperience',
        'mlSpecific', 'frameworkSpecific', 'experienceSpecific'
      ],
      examples: [
        {
          input: 'Create an image classifier demo',
          expectedOutput: 'Gradio interface with image upload and classification results',
          context: { mlFocus: 'computer vision', userExperience: 'beginner' },
          explanation: 'Simple interface for image classification with clear outputs'
        }
      ],
      optimizations: [
        {
          trigger: 'mlFocus === "text"',
          modification: 'Include text processing components and examples',
          purpose: 'Optimize for text-based ML models'
        }
      ]
    })

    // Debugging Template
    this.templates.set('universal-debugging', {
      id: 'universal-debugging',
      name: 'Universal Debugging',
      category: 'debugging',
      framework: 'universal',
      complexity: 'simple',
      basePrompt: `You are debugging code to identify and fix issues.

PROBLEM DESCRIPTION: "{userPrompt}"

CODE CONTEXT:
{codeContext}

DEBUG APPROACH:
1. Analyze the code for common issues
2. Identify the root cause of the problem
3. Provide a targeted fix
4. Explain why the issue occurred
5. Suggest prevention strategies

FOCUS AREAS:
- Syntax and logic errors
- State management issues
- Type safety problems
- Performance bottlenecks
- Accessibility concerns

{debugSpecific}
{frameworkSpecific}

Provide a clear, focused solution:`,
      contextVariables: [
        'userPrompt', 'codeContext', 'debugSpecific', 'frameworkSpecific'
      ],
      examples: [
        {
          input: 'Button click is not working',
          expectedOutput: 'Identified missing event handler and provided fix',
          context: { framework: 'react', issue: 'event handling' },
          explanation: 'Common React event handling issue with solution'
        }
      ],
      optimizations: []
    })
  }

  /**
   * Select the optimal template based on context
   */
  private selectOptimalTemplate(
    userPrompt: string, 
    triageResult: TriageResult, 
    context?: AgentContext
  ): string {
    const { intent } = triageResult.context
    const { stack } = triageResult

    // Handle modification/debugging intents
    if (intent === 'fix' || intent === 'modify') {
      if (stack === 'nextjs') return 'nextjs-modification'
      return 'universal-debugging'
    }

    // Handle creation intents
    if (intent === 'create' || intent === 'enhance') {
      switch (stack) {
        case 'nextjs': return 'nextjs-creation'
        case 'streamlit': return 'streamlit-creation'
        case 'gradio': return 'gradio-creation'
        default: return 'nextjs-creation'
      }
    }

    // Default to framework-specific creation
    return `${stack}-creation`
  }

  /**
   * Build context variables for prompt construction
   */
  private buildContextVariables(
    userPrompt: string,
    triageResult: TriageResult,
    context?: AgentContext,
    existingCode?: string
  ): Record<string, any> {
    const vars: Record<string, any> = {
      userPrompt,
      complexity: triageResult.requirements.complexity,
      userExperience: triageResult.context.userExperience,
      domain: triageResult.context.domain,
      stylePreference: triageResult.context.preferences.stylePreference,
      components: triageResult.components.join(', '),
      stack: triageResult.stack,
      template: triageResult.template
    }

    // Add existing code context if available
    if (existingCode) {
      vars.existingCodeContext = this.analyzeExistingCode(existingCode)
      vars.modificationStrategy = this.determineModificationStrategy(userPrompt, existingCode)
    }

    // Add domain-specific context
    if (triageResult.context.domain === 'finance') {
      vars.dataFocus = 'financial analysis and metrics'
    } else if (triageResult.context.domain === 'e-commerce') {
      vars.dataFocus = 'product and sales data'
    } else if (triageResult.context.domain === 'social') {
      vars.dataFocus = 'user interaction and engagement'
    }

    // Add ML focus for Gradio
    if (triageResult.stack === 'gradio') {
      vars.mlFocus = this.determineMlFocus(userPrompt)
    }

    return vars
  }

  /**
   * Apply framework-specific optimizations
   */
  private applyFrameworkOptimizations(
    template: PromptTemplate,
    framework: string,
    contextVars: Record<string, any>
  ): PromptOptimization[] {
    const optimizations: PromptOptimization[] = []

    switch (framework) {
      case 'nextjs':
        optimizations.push({
          trigger: 'nextjs-specific',
          modification: `
NEXT.JS SPECIFIC OPTIMIZATIONS:
- Use Next.js 13+ App Router conventions if complex routing needed
- Implement proper TypeScript interfaces
- Use 'use client' directive only when necessary for interactivity
- Prefer Server Components for static content
- Use Tailwind CSS classes extensively for styling
- Implement proper error boundaries and loading states`,
          purpose: 'Optimize for Next.js best practices and conventions'
        })
        break

      case 'streamlit':
        optimizations.push({
          trigger: 'streamlit-specific',
          modification: `
STREAMLIT SPECIFIC OPTIMIZATIONS:
- Use st.cache_data for data processing functions
- Implement proper layout with columns and containers
- Add custom CSS through st.markdown for better styling
- Use st.form() for complex inputs to prevent reruns
- Add st.spinner() for loading states
- Include proper error handling with st.error()`,
          purpose: 'Optimize for Streamlit performance and user experience'
        })
        break

      case 'gradio':
        optimizations.push({
          trigger: 'gradio-specific',
          modification: `
GRADIO SPECIFIC OPTIMIZATIONS:
- Use gr.Blocks() for custom layouts
- Add clear examples with gr.Examples()
- Implement proper input validation
- Use gr.State() for maintaining state between interactions
- Add custom CSS for professional appearance
- Include helpful descriptions and tooltips`,
          purpose: 'Optimize for Gradio interface design and usability'
        })
        break
    }

    return optimizations
  }

  /**
   * Apply user experience level optimizations
   */
  private applyExperienceOptimizations(
    template: PromptTemplate,
    userExperience: string
  ): PromptOptimization[] {
    const optimizations: PromptOptimization[] = []

    switch (userExperience) {
      case 'beginner':
        optimizations.push({
          trigger: 'beginner-friendly',
          modification: `
BEGINNER-FRIENDLY APPROACH:
- Add detailed code comments explaining key concepts
- Use simpler patterns and avoid complex abstractions
- Include inline explanations for React hooks and patterns
- Provide clear variable names and function names
- Add helpful console.log statements for debugging
- Include step-by-step implementation comments`,
          purpose: 'Make code accessible and educational for beginners'
        })
        break

      case 'advanced':
        optimizations.push({
          trigger: 'advanced-patterns',
          modification: `
ADVANCED PATTERNS:
- Use advanced TypeScript features (generics, utility types)
- Implement performance optimizations (useMemo, useCallback)
- Use advanced React patterns (compound components, render props)
- Include proper error boundaries and loading states
- Implement accessibility best practices
- Use modern CSS features and advanced Tailwind patterns`,
          purpose: 'Leverage advanced patterns for experienced developers'
        })
        break

      default: // intermediate
        optimizations.push({
          trigger: 'intermediate-approach',
          modification: `
INTERMEDIATE APPROACH:
- Balance between simplicity and advanced features
- Include moderate TypeScript usage
- Use common React patterns appropriately
- Add some performance considerations
- Include basic accessibility features`,
          purpose: 'Provide balanced complexity for intermediate users'
        })
    }

    return optimizations
  }

  /**
   * Apply domain-specific optimizations
   */
  private applyDomainOptimizations(
    template: PromptTemplate,
    domain: string
  ): PromptOptimization[] {
    const optimizations: PromptOptimization[] = []

    switch (domain) {
      case 'e-commerce':
        optimizations.push({
          trigger: 'e-commerce-patterns',
          modification: `
E-COMMERCE SPECIFIC FEATURES:
- Include product card layouts with images and pricing
- Add shopping cart functionality patterns
- Implement product filtering and sorting
- Include customer review components
- Add payment flow considerations
- Use commerce-appropriate color schemes and trust signals`,
          purpose: 'Optimize for e-commerce user experience patterns'
        })
        break

      case 'productivity':
        optimizations.push({
          trigger: 'productivity-patterns',
          modification: `
PRODUCTIVITY APP FEATURES:
- Implement task management patterns
- Add date/time pickers and calendar integration
- Include progress tracking and analytics
- Add keyboard shortcuts and accessibility
- Implement data persistence patterns
- Use productivity-focused UI patterns`,
          purpose: 'Optimize for productivity and task management workflows'
        })
        break

      case 'social':
        optimizations.push({
          trigger: 'social-patterns',
          modification: `
SOCIAL APP FEATURES:
- Include user profile and avatar components
- Add social interaction patterns (like, share, comment)
- Implement real-time update considerations
- Add privacy and security considerations
- Include content moderation patterns
- Use social media design patterns`,
          purpose: 'Optimize for social interaction and community features'
        })
        break

      case 'finance':
        optimizations.push({
          trigger: 'finance-patterns',
          modification: `
FINANCE APP FEATURES:
- Include data visualization for financial metrics
- Add number formatting for currency and percentages
- Implement secure input patterns
- Include financial calculation components
- Add audit trail considerations
- Use professional, trustworthy design patterns`,
          purpose: 'Optimize for financial data and professional trust'
        })
        break
    }

    return optimizations
  }

  /**
   * Apply conversation context optimizations
   */
  private applyConversationOptimizations(
    template: PromptTemplate,
    conversationContext?: TriageResult['conversationContext'],
    sessionId?: string
  ): PromptOptimization[] {
    const optimizations: PromptOptimization[] = []

    if (conversationContext?.isFollowUp) {
      optimizations.push({
        trigger: 'follow-up-request',
        modification: `
CONVERSATION CONTEXT:
- Previous requests: ${conversationContext.previousRequests.slice(-3).join(', ')}
- Related topics: ${conversationContext.relatedTopics.join(', ')}
- This is a follow-up request - consider building upon previous work
- Maintain consistency with previous responses
- Reference previous context when relevant`,
        purpose: 'Maintain conversation continuity and context awareness'
      })
    }

    if (conversationContext?.userFeedback === 'negative') {
      optimizations.push({
        trigger: 'negative-feedback',
        modification: `
FEEDBACK CONSIDERATION:
- Previous feedback was negative - focus on addressing potential issues
- Provide clearer explanations and better code quality
- Consider alternative approaches to previous solutions
- Add more detailed comments and documentation`,
        purpose: 'Improve based on negative user feedback'
      })
    }

    return optimizations
  }

  /**
   * Construct the final prompt with all optimizations
   */
  private constructPrompt(
    template: PromptTemplate,
    contextVars: Record<string, any>,
    optimizations: PromptOptimization[]
  ): string {
    let prompt = template.basePrompt

    // Replace context variables
    for (const [key, value] of Object.entries(contextVars)) {
      const placeholder = `{${key}}`
      prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value))
    }

    // Apply optimizations
    optimizations.forEach(opt => {
      const placeholder = `{${opt.trigger.replace(/[^a-zA-Z]/g, '')}}`
      prompt = prompt.replace(placeholder, opt.modification)
    })

    // Clean up any remaining placeholders
    prompt = prompt.replace(/\{[^}]+\}/g, '')

    return prompt.trim()
  }

  /**
   * Calculate confidence in the prompt based on context completeness
   */
  private calculateConfidence(
    template: PromptTemplate,
    contextVars: Record<string, any>,
    triageResult: TriageResult
  ): number {
    let confidence = 0.7 // base confidence

    // Boost for complete context variables
    const providedVars = Object.keys(contextVars).length
    const requiredVars = template.contextVariables.length
    confidence += (providedVars / requiredVars) * 0.2

    // Boost for clear user intent
    if (triageResult.context.intent !== 'create') {
      confidence += 0.1
    }

    // Boost for domain specificity
    if (triageResult.context.domain !== 'general') {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Calculate quality score for the generated prompt
   */
  private calculateQualityScore(prompt: string, triageResult: TriageResult): number {
    let score = 0.6 // base score

    // Check prompt length (sweet spot is 500-2000 chars)
    const length = prompt.length
    if (length >= 500 && length <= 2000) {
      score += 0.2
    } else if (length > 2000 && length <= 3000) {
      score += 0.1
    }

    // Check for specific patterns
    if (prompt.includes('TypeScript')) score += 0.05
    if (prompt.includes('accessibility')) score += 0.05
    if (prompt.includes('responsive')) score += 0.05
    if (prompt.includes('performance')) score += 0.05
    if (prompt.includes('best practices')) score += 0.05
    if (prompt.includes('error handling')) score += 0.05

    return Math.min(score, 1.0)
  }

  /**
   * Analyze existing code to provide context for modifications
   */
  private analyzeExistingCode(code: string): string {
    const analysis: string[] = []

    // Detect patterns
    if (code.includes('useState')) {
      analysis.push('Uses React state management with useState')
    }
    if (code.includes('useEffect')) {
      analysis.push('Includes side effects with useEffect')
    }
    if (code.includes('interface ') || code.includes('type ')) {
      analysis.push('Uses TypeScript types/interfaces')
    }
    if (code.includes('className=')) {
      analysis.push('Styled with CSS classes (likely Tailwind)')
    }
    if (code.includes('onClick')) {
      analysis.push('Has interactive event handlers')
    }

    // Detect component structure
    if (code.includes('export default')) {
      analysis.push('Exports a default component')
    }

    return analysis.join('. ') + '.'
  }

  /**
   * Determine modification strategy based on request and existing code
   */
  private determineModificationStrategy(userPrompt: string, existingCode: string): string {
    const promptLower = userPrompt.toLowerCase()

    if (promptLower.includes('color') || promptLower.includes('style')) {
      return 'Focus on styling changes - modify className properties and CSS-related code'
    }
    
    if (promptLower.includes('add') || promptLower.includes('include')) {
      return 'Add new functionality while preserving existing features'
    }
    
    if (promptLower.includes('remove') || promptLower.includes('delete')) {
      return 'Remove specified features while maintaining code structure'
    }
    
    if (promptLower.includes('fix') || promptLower.includes('bug')) {
      return 'Debug and fix issues while maintaining existing functionality'
    }

    return 'Make targeted changes based on the specific request'
  }

  /**
   * Determine ML focus for Gradio applications
   */
  private determineMlFocus(userPrompt: string): string {
    const promptLower = userPrompt.toLowerCase()

    if (promptLower.includes('image') || promptLower.includes('vision') || promptLower.includes('photo')) {
      return 'computer vision'
    }
    
    if (promptLower.includes('text') || promptLower.includes('nlp') || promptLower.includes('language')) {
      return 'natural language processing'
    }
    
    if (promptLower.includes('audio') || promptLower.includes('speech') || promptLower.includes('voice')) {
      return 'audio processing'
    }
    
    if (promptLower.includes('chat') || promptLower.includes('conversation') || promptLower.includes('bot')) {
      return 'conversational AI'
    }

    return 'general machine learning'
  }

  /**
   * Estimate token usage for the prompt
   */
  private estimateTokens(prompt: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(prompt.length / 4)
  }

  /**
   * Generate fallback prompts in case the main prompt fails
   */
  private generateFallbackPrompts(userPrompt: string, triageResult: TriageResult): string[] {
    const fallbacks: string[] = []

    // Simple fallback
    fallbacks.push(`Create a ${triageResult.stack} application for: ${userPrompt}`)

    // Framework-specific fallback
    switch (triageResult.stack) {
      case 'nextjs':
        fallbacks.push(`Build a React component that ${userPrompt.toLowerCase()}`)
        break
      case 'streamlit':
        fallbacks.push(`Create a Streamlit app that ${userPrompt.toLowerCase()}`)
        break
      case 'gradio':
        fallbacks.push(`Build a Gradio interface that ${userPrompt.toLowerCase()}`)
        break
    }

    // Generic fallback
    fallbacks.push(`Help me build: ${userPrompt}`)

    return fallbacks
  }

  /**
   * Generate fallback result when template is not found
   */
  private generateFallbackPrompt(userPrompt: string, triageResult: TriageResult): EnhancedPromptResult {
    const fallbackPrompt = `You are a skilled developer. Create a ${triageResult.stack} application based on this request: ${userPrompt}`

    return {
      prompt: fallbackPrompt,
      confidence: 0.4,
      optimizations: ['Using fallback template due to missing specific template'],
      contextUsed: { userPrompt, stack: triageResult.stack },
      estimatedTokens: this.estimateTokens(fallbackPrompt),
      fallbackPrompts: [fallbackPrompt],
      metadata: {
        templateUsed: 'fallback',
        frameworkOptimized: false,
        contextAware: false,
        qualityScore: 0.4
      }
    }
  }
}

// Export the singleton instance
export const smartPromptEngine = new SmartPromptEngine() 
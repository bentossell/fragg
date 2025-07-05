import { openrouter } from '@/lib/ai-config'
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
}

// Fast keyword-based rules for instant decisions
const ULTRA_FAST_RULES: Record<string, Partial<TriageResult>> = {
  // Static site patterns - fastest generation
  'personal website|portfolio|resume|cv|about me|landing page|company website|business website|personal site|my website|homepage|home page|personal page|portfolio site|online resume|digital resume|bio|biography|personal bio|showcase|personal showcase|profile|personal profile|professional profile|online presence|web presence|single page|simple website|basic website|static website|static site|html website|html site|introduction|personal introduction|about page': {
    stack: 'static',
    template: 'static-html',
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
    stack: 'static',
    template: 'static-html',
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
    stack: 'static',
    template: 'static-html',
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
    stack: 'static',
    template: 'static-html',
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
    stack: 'static',
    template: 'static-html',
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

export async function triageRequest(userPrompt: string): Promise<TriageResult> {
  const promptLower = userPrompt.toLowerCase()
  
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
      return {
        stack: 'static',
        template: 'static-html',
        reasoning: wantsSimple ? 'User explicitly requested a simple/static site' : 'Personal website detected - using static HTML for simplicity',
        requirements: {
          needsBackend: false,
          needsDatabase: false,
          needsAuth: false,
          isDataHeavy: false,
          complexity: 'simple',
          isInteractive: promptLower.includes('interactive') || promptLower.includes('form'),
          needsRealtime: false
        },
        components: extractComponents(promptLower),
        estimatedTokens: 1000,
        priority: 'ultra-fast'
      }
    }
  }
  
  // Try ultra-fast rules first (for sub-5-second generation)
  for (const [pattern, result] of Object.entries(ULTRA_FAST_RULES)) {
    if (matchesPattern(promptLower, pattern)) {
      return buildTriageResult(result, pattern, promptLower)
    }
  }
  
  // Try fast rules (for sub-10-second generation)
  for (const [pattern, result] of Object.entries(FAST_RULES)) {
    if (matchesPattern(promptLower, pattern)) {
      return buildTriageResult(result, pattern, promptLower)
    }
  }
  
  // Try standard rules (for sub-15-second generation)
  for (const [pattern, result] of Object.entries(STANDARD_RULES)) {
    if (matchesPattern(promptLower, pattern)) {
      return buildTriageResult(result, pattern, promptLower)
    }
  }
  
  // Fall back to AI analysis for complex/unclear requests
  return await aiAnalyze(userPrompt)
}

function matchesPattern(prompt: string, pattern: string): boolean {
  const keywords = pattern.split('|')
  return keywords.some(keyword => prompt.includes(keyword.trim()))
}

function buildTriageResult(partial: Partial<TriageResult>, pattern: string, prompt: string): TriageResult {
  return {
    stack: partial.stack || 'nextjs',
    template: partial.template || 'nextjs-developer',
    reasoning: `Matched fast rule: "${pattern}"`,
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
    components: extractComponents(prompt),
    estimatedTokens: estimateTokens(partial.requirements?.complexity || 'simple'),
    priority: partial.priority || 'fast'
  }
}

async function aiAnalyze(userPrompt: string): Promise<TriageResult> {
  try {
    const model = openrouter('google/gemini-2.5-flash-lite-preview-06-17')
    
    const systemPrompt = `You are a tech stack analyzer. Analyze the user's request and return a JSON object with the recommended stack.

Available stacks:
- static: HTML/CSS/JS with Tailwind for simple sites, forms, calculators, games
- nextjs: React/Next.js apps with routing, complex UI, SPAs
- streamlit: Python data apps with visualizations, analysis tools
- gradio: ML model demos and AI interfaces
- vue: Vue.js apps (only if specifically requested)

CRITICAL Guidelines:
- STRONGLY prefer "static" for ANY personal website, portfolio, landing page, company website, or simple site
- Use "static" for anything that doesn't explicitly need a backend, database, or user accounts
- Only use "nextjs" if the user specifically mentions React, Next.js, or needs complex features like:
  - User authentication/accounts
  - Database operations
  - API endpoints
  - Server-side rendering for SEO at scale
  - Complex state management
- Personal websites, portfolios, and landing pages should ALWAYS be static unless explicitly stated otherwise
- If unsure, default to "static" for simplicity and speed
- Estimate tokens conservatively (1000-5000 range)

Return valid JSON only, no markdown or explanations.`

    const response = await model.doGenerate({
      inputFormat: 'prompt',
      prompt: [
        { role: 'system', content: systemPrompt } as any,
        { role: 'user', content: userPrompt } as any
      ],
      providerOptions: {
        temperature: 0.1,
        max_tokens: 500
      }
    } as any)
    
    const responseText = response.text || '{}'
    const parsed = triageSchema.parse(JSON.parse(responseText))
    
    return {
      ...parsed,
      components: extractComponents(userPrompt.toLowerCase())
    }
  } catch (error) {
    console.warn('AI triage failed, using default:', error)
    
    // Smart default based on prompt analysis
    const isSimple = /personal|portfolio|landing|about|resume|cv|simple|basic|website|site|page|home|company|business|agency|service|restaurant|cafe|small/i.test(userPrompt.toLowerCase())
    const needsBackend = /database|auth|login|user|account|api|backend|server|dynamic|cms|blog with admin|ecommerce|payment/i.test(userPrompt.toLowerCase())
    const isData = /data|chart|graph|analysis|visualization|plot/i.test(userPrompt.toLowerCase())
    
    if (isData) {
      return {
        stack: 'streamlit',
        template: 'streamlit-developer',
        reasoning: 'Default for data-related request',
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
        priority: 'fast'
      }
    }
    
    // Default to static for simple sites unless backend features are needed
    const shouldUseStatic = (isSimple && !needsBackend) || (!needsBackend && userPrompt.length < 100)
    
    return {
      stack: shouldUseStatic ? 'static' : 'nextjs',
      template: shouldUseStatic ? 'static-html' : 'nextjs-developer',
      reasoning: shouldUseStatic ? 'Simple site without backend requirements' : 'Complex features or backend requirements detected',
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
      priority: shouldUseStatic ? 'ultra-fast' : 'fast'
    }
  }
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

// Export for use in other modules
export { extractComponents, estimateTokens }

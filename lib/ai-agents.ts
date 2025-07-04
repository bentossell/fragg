import { openrouter } from '@/lib/ai-config'
import { TriageResult } from './ai-triage'
import { componentLibrary, Component } from './component-library'

export interface AgentContext {
  triageResult: TriageResult
  userPrompt: string
  components: Component[]
  sharedState: Map<string, any>
  targetTemplate: string
}

export interface AgentResult {
  agentName: string
  code: string
  dependencies?: string[]
  metadata?: Record<string, any>
  executionTime: number
  errors?: string[]
}

// Base agent class with optimized prompts
export abstract class CodeAgent {
  constructor(protected name: string, protected model = 'anthropic/claude-3.5-haiku') {}
  
  abstract generate(context: AgentContext): Promise<AgentResult>
  
  protected async callAI(prompt: string, maxTokens = 2000): Promise<string> {
    const startTime = Date.now()
    
    try {
      const model = openrouter(this.model)
      
      const response = await model.doGenerate({
        inputFormat: 'prompt',
        mode: { type: 'regular' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0.3,
        maxTokens: maxTokens,
        topP: 0.9
      })
      
      return response.text || ''
    } catch (error) {
      console.error(`${this.name} AI call failed:`, error)
      throw new Error(`${this.name} generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  protected createPrompt(
    role: string,
    context: AgentContext,
    specificInstructions: string,
    codeFormat: string
  ): string {
    return `You are a ${role} specialized in creating ${codeFormat} code.

USER REQUEST: "${context.userPrompt}"

CONTEXT:
- Stack: ${context.triageResult.stack}
- Template: ${context.targetTemplate}
- Priority: ${context.triageResult.priority} (aim for speed)
- Complexity: ${context.triageResult.requirements.complexity}
- Components needed: ${context.triageResult.components.join(', ')}

REQUIREMENTS:
${specificInstructions}

CRITICAL:
- Generate ONLY clean, working ${codeFormat} code
- NO explanations, comments, or markdown
- Modern, responsive design
- Accessible (ARIA labels, semantic HTML)
- Performance optimized
- Mobile-first approach

Generate the ${codeFormat} code now:`
  }
}

// HTML Structure Agent
export class HTMLAgent extends CodeAgent {
  constructor() {
    super('HTML Agent')
  }
  
  async generate(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    try {
      const components = await componentLibrary.getComponents(context.triageResult.components)
      const componentHTML = components.map(c => c.html).join('\n\n')
      
      const prompt = this.createPrompt(
        'Senior Frontend Developer',
        context,
        `- Create semantic HTML5 structure
- Use Tailwind CSS classes for styling
- Include proper meta tags and viewport
- Structure should support: ${context.triageResult.components.join(', ')}
- Responsive design (mobile-first)
- Accessibility best practices
- Clean, modern layout
${componentHTML ? `\nAvailable component patterns:\n${componentHTML}` : ''}`,
        'HTML'
      )
      
      const code = await this.callAI(prompt, 3000)
      
      // Store HTML structure for other agents
      context.sharedState.set('htmlStructure', code)
      
      return {
        agentName: this.name,
        code: this.cleanCode(code),
        dependencies: [],
        metadata: { 
          type: 'html',
          hasComponents: context.triageResult.components.length > 0
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        agentName: this.name,
        code: this.getFallbackHTML(context),
        dependencies: [],
        metadata: { type: 'html', fallback: true },
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
  
  private getFallbackHTML(context: AgentContext): string {
    return componentLibrary.generateStarterTemplate('app', context.triageResult.components)
  }
  
  private cleanCode(code: string): string {
    // Remove markdown formatting and extra whitespace
    return code
      .replace(/```html|```/g, '')
      .replace(/^\s*\n/gm, '')
      .trim()
  }
}

// CSS Styling Agent
export class CSSAgent extends CodeAgent {
  constructor() {
    super('CSS Agent')
  }
  
  async generate(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    try {
      const components = await componentLibrary.getComponents(context.triageResult.components)
      const componentSet = componentLibrary.getComponentSet(context.triageResult.components)
      
      const prompt = this.createPrompt(
        'Senior CSS Developer and UI/UX Designer',
        context,
        `- Create modern, clean CSS styles
- Use CSS custom properties for theming
- Implement smooth animations and transitions
- Responsive design with mobile-first approach
- Dark mode support
- Performance optimized (no unused styles)
- Beautiful color scheme and typography
- Modern layout techniques (Grid, Flexbox)
${componentSet.css ? `\nComponent styles to integrate:\n${componentSet.css}` : ''}`,
        'CSS'
      )
      
      const code = await this.callAI(prompt, 2500)
      
      return {
        agentName: this.name,
        code: componentSet.theme + '\n\n' + this.cleanCode(code),
        dependencies: [],
        metadata: { 
          type: 'css',
          hasTheme: true,
          componentStyles: componentSet.css.length > 0
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      const componentSet = componentLibrary.getComponentSet(context.triageResult.components)
      return {
        agentName: this.name,
        code: componentSet.theme + '\n\n' + componentSet.css,
        dependencies: [],
        metadata: { type: 'css', fallback: true },
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
  
  private cleanCode(code: string): string {
    return code
      .replace(/```css|```/g, '')
      .replace(/^\s*\n/gm, '')
      .trim()
  }
}

// JavaScript Logic Agent
export class JavaScriptAgent extends CodeAgent {
  constructor() {
    super('JavaScript Agent')
  }
  
  async generate(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    try {
      const components = await componentLibrary.getComponents(context.triageResult.components)
      const componentSet = componentLibrary.getComponentSet(context.triageResult.components)
      const htmlStructure = context.sharedState.get('htmlStructure') || ''
      
      const prompt = this.createPrompt(
        'Senior JavaScript Developer',
        context,
        `- Write modern ES6+ JavaScript
- Event delegation for dynamic content
- Error handling and loading states
- Smooth animations and interactions
- Form validation if forms exist
- API integration patterns
- Performance optimized
- Accessible keyboard navigation
- Mobile touch support
${componentSet.js ? `\nComponent functionality to integrate:\n${componentSet.js}` : ''}
${htmlStructure ? '\nHTML structure context available' : ''}`,
        'JavaScript'
      )
      
      const code = await this.callAI(prompt, 2500)
      
      return {
        agentName: this.name,
        code: componentSet.js + '\n\n' + this.cleanCode(code),
        dependencies: [],
        metadata: { 
          type: 'javascript',
          hasComponentJS: (componentSet.js?.length ?? 0) > 0,
          hasHTMLContext: !!htmlStructure
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      const componentSet = componentLibrary.getComponentSet(context.triageResult.components)
      return {
        agentName: this.name,
        code: componentSet.js || '// Basic interactivity\nconsole.log("App loaded");',
        dependencies: [],
        metadata: { type: 'javascript', fallback: true },
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
  
  private cleanCode(code: string): string {
    return code
      .replace(/```javascript|```js|```/g, '')
      .replace(/^\s*\n/gm, '')
      .trim()
  }
}

// React Component Agent (for Next.js)
export class ReactAgent extends CodeAgent {
  constructor() {
    super('React Agent', 'anthropic/claude-3.5-sonnet') // Use more powerful model for React
  }
  
  async generate(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    try {
      const components = await componentLibrary.getComponents(context.triageResult.components)
      const reactComponents = componentLibrary.getCombinedReact(components)
      
      const prompt = this.createPrompt(
        'Senior React/Next.js Developer',
        context,
        `- Create a modern React component with TypeScript
- Use hooks (useState, useEffect, etc.) appropriately
- Implement proper TypeScript interfaces
- Use Tailwind CSS for styling
- Include error boundaries and loading states
- Responsive design with mobile-first approach
- Accessible components (ARIA attributes)
- Performance optimized (React.memo, useMemo when needed)
- Use Next.js features when appropriate
- Export as default function for pages/index.tsx
${reactComponents ? `\nAvailable component patterns:\n${reactComponents}` : ''}

STRUCTURE:
1. Imports (React, types, components)
2. TypeScript interfaces
3. Main component with hooks
4. Return JSX with Tailwind classes
5. Default export`,
        'React/TypeScript'
      )
      
      const code = await this.callAI(prompt, 4000)
      
      return {
        agentName: this.name,
        code: this.cleanCode(code),
        dependencies: this.extractDependencies(code),
        metadata: { 
          type: 'react',
          hasTypeScript: true,
          framework: 'nextjs'
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        agentName: this.name,
        code: this.getFallbackReact(context),
        dependencies: ['react'],
        metadata: { type: 'react', fallback: true },
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
  
  private extractDependencies(code: string): string[] {
    const deps: string[] = []
    
    // Extract common dependencies from imports
    if (code.includes('lucide-react')) deps.push('lucide-react')
    if (code.includes('@/components/ui/')) deps.push('@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge')
    if (code.includes('framer-motion')) deps.push('framer-motion')
    if (code.includes('react-hook-form')) deps.push('react-hook-form')
    if (code.includes('zod')) deps.push('zod')
    
    return [...new Set(deps)]
  }
  
  private getFallbackReact(context: AgentContext): string {
    return `import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Welcome to Your App
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            ${context.userPrompt}
          </p>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}`
  }
  
  private cleanCode(code: string): string {
    return code
      .replace(/```typescript|```tsx|```jsx|```/g, '')
      .replace(/^\s*\n/gm, '')
      .trim()
  }
}

// Backend API Agent (for Next.js API routes)
export class BackendAgent extends CodeAgent {
  constructor() {
    super('Backend Agent')
  }
  
  async generate(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    if (!context.triageResult.requirements.needsBackend) {
      return {
        agentName: this.name,
        code: '',
        dependencies: [],
        metadata: { type: 'backend', skipped: true },
        executionTime: Date.now() - startTime
      }
    }
    
    try {
      const prompt = this.createPrompt(
        'Senior Backend Developer',
        context,
        `- Create Next.js API routes
- Implement RESTful API design
- Include proper error handling
- Input validation and sanitization
- CORS configuration if needed
- Rate limiting considerations
- Type-safe responses
- Database integration (in-memory for demo)
- Authentication logic if needed
- Proper HTTP status codes`,
        'TypeScript API'
      )
      
      const code = await this.callAI(prompt, 3000)
      
      return {
        agentName: this.name,
        code: this.cleanCode(code),
        dependencies: [],
        metadata: { 
          type: 'backend',
          framework: 'nextjs-api',
          hasAuth: context.triageResult.requirements.needsAuth
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        agentName: this.name,
        code: this.getFallbackAPI(context),
        dependencies: [],
        metadata: { type: 'backend', fallback: true },
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
  
  private getFallbackAPI(context: AgentContext): string {
    return `// pages/api/data.ts
import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'API is working',
      timestamp: new Date().toISOString()
    })
  }
  
  if (req.method === 'POST') {
    const { data } = req.body
    return res.status(201).json({ 
      success: true, 
      data,
      id: Date.now()
    })
  }
  
  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(\`Method \${req.method} Not Allowed\`)
}`
  }
  
  private cleanCode(code: string): string {
    return code
      .replace(/```typescript|```ts|```/g, '')
      .replace(/^\s*\n/gm, '')
      .trim()
  }
}

// Python Agent (for Streamlit/Gradio)
export class PythonAgent extends CodeAgent {
  constructor() {
    super('Python Agent')
  }
  
  async generate(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now()
    
    try {
      const isStreamlit = context.targetTemplate === 'streamlit-developer'
      const isGradio = context.targetTemplate === 'gradio-developer'
      
      const frameworkInstructions = isStreamlit 
        ? `- Use Streamlit components (st.title, st.write, st.columns, etc.)
- Custom CSS with st.markdown for styling
- Interactive widgets (st.button, st.selectbox, etc.)
- Data visualization with st.plotly_chart or st.pyplot
- Page configuration with st.set_page_config`
        : `- Use Gradio Blocks for layout control
- Create interactive interfaces with gr.Interface or gr.Blocks
- Include input/output components
- Custom CSS with gr.HTML
- Launch with demo.launch() at the end`
      
      const prompt = this.createPrompt(
        `Senior Python Developer specializing in ${isStreamlit ? 'Streamlit' : 'Gradio'}`,
        context,
        `${frameworkInstructions}
- Clean, readable Python code
- Proper error handling
- Data processing capabilities
- Modern UI with custom styling
- Responsive layout
- Interactive elements
- Professional appearance`,
        'Python'
      )
      
      const code = await this.callAI(prompt, 3000)
      
      return {
        agentName: this.name,
        code: this.cleanCode(code),
        dependencies: isStreamlit 
          ? ['streamlit', 'pandas', 'numpy', 'plotly']
          : ['gradio', 'pandas', 'numpy'],
        metadata: { 
          type: 'python',
          framework: isStreamlit ? 'streamlit' : 'gradio'
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        agentName: this.name,
        code: this.getFallbackPython(context),
        dependencies: context.targetTemplate === 'streamlit-developer' ? ['streamlit'] : ['gradio'],
        metadata: { type: 'python', fallback: true },
        executionTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
  
  private getFallbackPython(context: AgentContext): string {
    if (context.targetTemplate === 'streamlit-developer') {
      return `import streamlit as st

st.set_page_config(page_title="App", layout="wide")

st.title("Welcome to Your App")
st.write("${context.userPrompt}")

col1, col2 = st.columns(2)

with col1:
    st.write("Column 1 content")

with col2:
    st.write("Column 2 content")
    
if st.button("Click me"):
    st.success("Button clicked!")`
    } else {
      return `import gradio as gr

def greet(name):
    return f"Hello {name}!"

demo = gr.Interface(
    fn=greet,
    inputs="text",
    outputs="text",
    title="Welcome to Your App"
)

if __name__ == "__main__":
    demo.launch()`
    }
  }
  
  private cleanCode(code: string): string {
    return code
      .replace(/```python|```py|```/g, '')
      .replace(/^\s*\n/gm, '')
      .trim()
  }
}

// Agent factory for easy instantiation
export class AgentFactory {
  static createAgents(stack: string): CodeAgent[] {
    switch (stack) {
      case 'static':
        return [
          new HTMLAgent(),
          new CSSAgent(),
          new JavaScriptAgent()
        ]
      case 'nextjs':
        return [
          new ReactAgent(),
          new BackendAgent() // Only runs if backend needed
        ]
      case 'streamlit':
      case 'gradio':
        return [
          new PythonAgent()
        ]
      default:
        return [new ReactAgent()]
    }
  }
  
  static getEstimatedTime(stack: string, complexity: string): number {
    // Estimated generation times in milliseconds
    const baseTime: Record<string, number> = {
      'static': 3000,    // HTML/CSS/JS agents in parallel
      'nextjs': 4000,    // React agent + optional backend
      'streamlit': 2000, // Single Python agent
      'gradio': 2000     // Single Python agent
    }
    
    const complexityMultiplier: Record<string, number> = {
      'simple': 1,
      'medium': 1.3,
      'complex': 1.6
    }
    
    return (baseTime[stack] || 3000) * (complexityMultiplier[complexity] || 1)
  }
}

 
import { TriageResult, triageRequest } from './ai-triage'
import { 
  AgentContext, 
  AgentResult,
  AgentFactory,
  CodeAgent
} from './ai-agents'
import { componentLibrary } from './component-library'

export interface GenerationResult {
  code: string
  template: string
  dependencies: string[]
  executionTime: number
  agentResults: AgentResult[]
  metadata: {
    triageTime: number
    generationTime: number
    assemblyTime: number
    totalAgents: number
    errors: string[]
    fallbacks: number
    cacheHits: number
  }
}

export interface StreamingUpdate {
  type: 'triage' | 'agent_start' | 'agent_complete' | 'assembly' | 'complete'
  data: any
  timestamp: number
}

export class CodeOrchestrator {
  private cache = new Map<string, GenerationResult>()
  private maxCacheSize = 100
  
  // Main generation method with caching
  async generateApp(
    userPrompt: string, 
    onUpdate?: (update: StreamingUpdate) => void
  ): Promise<GenerationResult> {
    const startTime = Date.now()
    
    // Check cache first
    const cacheKey = this.createCacheKey(userPrompt)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      onUpdate?.({
        type: 'complete',
        data: { ...cached, fromCache: true },
        timestamp: Date.now()
      })
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cacheHits: cached.metadata.cacheHits + 1
        }
      }
    }
    
    try {
      // Step 1: Triage the request
      onUpdate?.({
        type: 'triage',
        data: { status: 'analyzing', prompt: userPrompt },
        timestamp: Date.now()
      })
      
      const triageStart = Date.now()
      const triageResult = await triageRequest(userPrompt)
      const triageTime = Date.now() - triageStart
      
      onUpdate?.({
        type: 'triage',
        data: { 
          status: 'complete', 
          result: triageResult,
          executionTime: triageTime
        },
        timestamp: Date.now()
      })
      
      // Step 2: Get components from library
      const components = await componentLibrary.getComponents(triageResult.components)
      
      // Step 3: Create shared context
      const context: AgentContext = {
        triageResult,
        userPrompt,
        components,
        sharedState: new Map<string, any>([
          ['components', components],
          ['triage', triageResult],
          ['startTime', startTime]
        ]),
        targetTemplate: triageResult.template
      }
      
      // Step 4: Create and run agents in parallel
      const generationStart = Date.now()
      const agents = AgentFactory.createAgents(triageResult.stack)
      
      onUpdate?.({
        type: 'agent_start',
        data: { 
          agents: agents.map(a => a.constructor.name),
          stack: triageResult.stack,
          estimatedTime: AgentFactory.getEstimatedTime(triageResult.stack, triageResult.requirements.complexity)
        },
        timestamp: Date.now()
      })
      
      // Run agents in parallel with progress updates
      const agentPromises = agents.map(async (agent) => {
        try {
          const result = await agent.generate(context)
          
          onUpdate?.({
            type: 'agent_complete',
            data: { 
              agent: result.agentName,
              success: true,
              executionTime: result.executionTime,
              codeLength: result.code.length,
              hasFallback: !!result.errors?.length
            },
            timestamp: Date.now()
          })
          
          return result
        } catch (error) {
          onUpdate?.({
            type: 'agent_complete',
            data: { 
              agent: agent.constructor.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            },
            timestamp: Date.now()
          })
          
          // Return fallback result
          return {
            agentName: agent.constructor.name,
            code: '',
            dependencies: [],
            metadata: { type: 'fallback', error: error instanceof Error ? error.message : 'Unknown error' },
            executionTime: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          }
        }
      })
      
      const results = await Promise.all(agentPromises)
      const generationTime = Date.now() - generationStart
      
      // Step 5: Assemble the final code
      onUpdate?.({
        type: 'assembly',
        data: { status: 'assembling', agentCount: results.length },
        timestamp: Date.now()
      })
      
      const assemblyStart = Date.now()
      const assembledCode = await this.assembleCode(results, triageResult, context)
      const assemblyTime = Date.now() - assemblyStart
      
      // Step 6: Extract all dependencies
      const allDependencies = this.extractAllDependencies(results, triageResult)
      
      // Step 7: Create final result
      const result: GenerationResult = {
        code: assembledCode,
        template: triageResult.template,
        dependencies: allDependencies,
        executionTime: Date.now() - startTime,
        agentResults: results,
        metadata: {
          triageTime,
          generationTime,
          assemblyTime,
          totalAgents: agents.length,
          errors: results.flatMap(r => r.errors || []),
          fallbacks: results.filter(r => r.errors?.length).length,
          cacheHits: 0
        }
      }
      
      // Cache the result
      this.cacheResult(cacheKey, result)
      
      onUpdate?.({
        type: 'complete',
        data: result,
        timestamp: Date.now()
      })
      
      return result
      
    } catch (error) {
      console.error('Code generation failed:', error)
      
      // Return fallback result
      const fallbackResult = await this.generateFallback(userPrompt, startTime)
      
      onUpdate?.({
        type: 'complete',
        data: { ...fallbackResult, error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now()
      })
      
      return fallbackResult
    }
  }
  
  // Assemble code based on stack type
  private async assembleCode(
    results: AgentResult[], 
    triage: TriageResult,
    context: AgentContext
  ): Promise<string> {
    const codeMap = new Map(
      results
        .filter(r => r.code.trim().length > 0)
        .map(r => [r.metadata?.type || r.agentName, r])
    )
    
    switch (triage.stack) {
      case 'static':
        return this.assembleStaticSite(codeMap, context)
      case 'nextjs':
        return this.assembleNextJsApp(codeMap, context)
      case 'streamlit':
      case 'gradio':
        return this.assemblePythonApp(codeMap, context)
      default:
        return results.map(r => r.code).filter(Boolean).join('\n\n')
    }
  }
  
  private assembleStaticSite(codeMap: Map<string, AgentResult>, context: AgentContext): string {
    const htmlResult = codeMap.get('html')
    const cssResult = codeMap.get('css') 
    const jsResult = codeMap.get('javascript')
    
    if (!htmlResult) {
      // Generate fallback HTML
      return componentLibrary.generateStarterTemplate('app', context.triageResult.components)
    }
    
    let html = htmlResult.code
    const css = cssResult?.code || ''
    const js = jsResult?.code || ''
    
    // Smart injection - look for existing head/body tags
    if (css && html.includes('</head>')) {
      html = html.replace('</head>', `  <style>\n${css}\n  </style>\n</head>`)
    } else if (css) {
      html = `<style>\n${css}\n</style>\n` + html
    }
    
    if (js && html.includes('</body>')) {
      html = html.replace('</body>', `  <script>\n${js}\n  </script>\n</body>`)
    } else if (js) {
      html = html + `\n<script>\n${js}\n</script>`
    }
    
    // Ensure basic HTML structure
    if (!html.includes('<!DOCTYPE html>')) {
      html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Generated App</title>\n  <script src="https://cdn.tailwindcss.com"></script>\n</head>\n<body>\n${html}\n</body>\n</html>`
    }
    
    return html
  }
  
  private assembleNextJsApp(codeMap: Map<string, AgentResult>, context: AgentContext): string {
    const reactResult = codeMap.get('react')
    const backendResult = codeMap.get('backend')
    
    if (!reactResult) {
      // Generate fallback React component
      return this.getFallbackReactCode(context)
    }
    
    let code = reactResult.code
    
    // Ensure proper imports
    if (!code.includes('import React')) {
      code = `import React from 'react'\n\n${code}`
    }
    
    // Ensure default export
    if (!code.includes('export default')) {
      const componentMatch = code.match(/function\s+(\w+)/);
      const componentName = componentMatch ? componentMatch[1] : 'App'
      code += `\n\nexport default ${componentName}`
    }
    
    // Add backend routes as comments if they exist
    if (backendResult && backendResult.code) {
      code += `\n\n/*\nAPI Routes to create:\n${backendResult.code}\n*/`
    }
    
    return code
  }
  
  private assemblePythonApp(codeMap: Map<string, AgentResult>, context: AgentContext): string {
    const pythonResult = codeMap.get('python')
    
    if (!pythonResult) {
      return this.getFallbackPythonCode(context)
    }
    
    return pythonResult.code
  }
  
  private extractAllDependencies(results: AgentResult[], triage: TriageResult): string[] {
    const deps = new Set<string>()
    
    // Collect from all agents
    results.forEach(result => {
      result.dependencies?.forEach(dep => deps.add(dep))
    })
    
    // Add stack-specific defaults
    switch (triage.stack) {
      case 'nextjs':
        deps.add('react')
        deps.add('next')
        deps.add('typescript')
        deps.add('@types/react')
        deps.add('@types/node')
        deps.add('tailwindcss')
        deps.add('postcss')
        deps.add('autoprefixer')
        break
      case 'streamlit':
        deps.add('streamlit')
        break
      case 'gradio':
        deps.add('gradio')
        break
    }
    
    return Array.from(deps).sort()
  }
  
  // Caching methods
  private createCacheKey(userPrompt: string): string {
    // Create a simple hash of the prompt
    return btoa(userPrompt.toLowerCase().trim().replace(/\s+/g, ' ')).slice(0, 32)
  }
  
  private cacheResult(key: string, result: GenerationResult): void {
    // Implement LRU cache
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, result)
  }
  
  // Fallback methods
  private async generateFallback(userPrompt: string, startTime: number): Promise<GenerationResult> {
    // Quick fallback using templates
    const template = this.detectSimpleTemplate(userPrompt)
    const code = componentLibrary.generateStarterTemplate(template, ['button', 'card'])
    
    return {
      code,
      template: 'static-html',
      dependencies: [],
      executionTime: Date.now() - startTime,
      agentResults: [{
        agentName: 'Fallback',
        code,
        dependencies: [],
        metadata: { type: 'fallback' },
        executionTime: Date.now() - startTime
      }],
      metadata: {
        triageTime: 0,
        generationTime: 0,
        assemblyTime: 0,
        totalAgents: 0,
        errors: ['Generation failed, using fallback'],
        fallbacks: 1,
        cacheHits: 0
      }
    }
  }
  
  private detectSimpleTemplate(prompt: string): 'landing' | 'dashboard' | 'app' {
    const lower = prompt.toLowerCase()
    
    if (/landing|portfolio|website|company/.test(lower)) return 'landing'
    if (/dashboard|admin|analytics/.test(lower)) return 'dashboard'
    return 'app'
  }
  
  private getFallbackReactCode(context: AgentContext): string {
    return `import React, { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Your App
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            ${context.userPrompt}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Interactive Counter</h2>
              <div className="text-3xl font-bold text-blue-600 mb-4">{count}</div>
              <div className="space-x-4">
                <button 
                  onClick={() => setCount(count + 1)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Increment
                </button>
                <button 
                  onClick={() => setCount(count - 1)}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Decrement
                </button>
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
              <ul className="space-y-2 text-gray-600">
                <li>✅ Modern React with hooks</li>
                <li>✅ Responsive Tailwind CSS</li>
                <li>✅ Interactive components</li>
                <li>✅ Ready to customize</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}`
  }
  
  private getFallbackPythonCode(context: AgentContext): string {
    if (context.targetTemplate === 'streamlit-developer') {
      return `import streamlit as st
import pandas as pd
import numpy as np

st.set_page_config(
    page_title="Generated App",
    page_icon="🚀",
    layout="wide"
)

st.title("🚀 Welcome to Your App")
st.markdown("---")

st.markdown(f"""
### Your Request:
> {context.userPrompt}
""")

col1, col2, col3 = st.columns(3)

with col1:
    st.metric("Users", "1,234", "12%")

with col2:
    st.metric("Revenue", "$45,678", "8%")

with col3:
    st.metric("Growth", "23%", "5%")

st.markdown("---")

# Interactive demo
st.subheader("Interactive Demo")

name = st.text_input("Enter your name:")
if name:
    st.success(f"Hello, {name}! 👋")

# Sample chart
st.subheader("Sample Visualization")
chart_data = pd.DataFrame(
    np.random.randn(20, 3),
    columns=['A', 'B', 'C']
)
st.line_chart(chart_data)`
    } else {
      return `import gradio as gr
import numpy as np

def process_input(text, number):
    """Process user input and return results."""
    if not text:
        return "Please enter some text!"
    
    result = f"Hello! You entered: '{text}' with number: {number}"
    return result

def create_demo():
    with gr.Blocks(title="Generated App") as demo:
        gr.Markdown("# 🚀 Welcome to Your App")
        gr.Markdown(f"**Your request:** {context.userPrompt}")
        
        with gr.Row():
            with gr.Column():
                text_input = gr.Textbox(
                    label="Enter text",
                    placeholder="Type something..."
                )
                number_input = gr.Number(
                    label="Enter a number",
                    value=42
                )
                submit_btn = gr.Button("Submit", variant="primary")
            
            with gr.Column():
                output = gr.Textbox(
                    label="Result",
                    interactive=False
                )
        
        submit_btn.click(
            process_input,
            inputs=[text_input, number_input],
            outputs=output
        )
        
        gr.Markdown("---")
        gr.Markdown("*Generated with AI*")
    
    return demo

if __name__ == "__main__":
    demo = create_demo()
    demo.launch()`
    }
  }
  
  // Utility methods
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    const totalHits = Array.from(this.cache.values())
      .reduce((sum, result) => sum + result.metadata.cacheHits, 0)
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: totalHits / Math.max(this.cache.size, 1)
    }
  }
  
  clearCache(): void {
    this.cache.clear()
  }
}

// Export singleton instance
export const codeOrchestrator = new CodeOrchestrator() 
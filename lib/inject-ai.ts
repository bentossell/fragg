export function injectAI(code: string, template: string, filePath?: string, apiKey?: string): string {
  try {
    // For React/Next.js apps with JSX/TSX files, skip AI injection on component files
    // Only inject into HTML files or the main entry point
    if (filePath && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))) {
      // Don't inject into React component files to avoid parsing errors
      // Add a comment instead
      return code + '\n\n// AI capabilities available via window.AI (loaded in HTML head)'
    }
    
    // Detect file type and inject accordingly
    if (template === 'streamlit-developer' || template === 'gradio-developer') {
      return injectAIForPython(code, template, apiKey)
    }
    
    if (template === 'code-interpreter-v1') {
      return code + '\n\n# Note: AI capabilities are available in the web interface'
    }
    
    // For HTML files or when we can't detect the type safely
    return injectAIForHTML(code, template, apiKey)
    
  } catch (error) {
    console.error('AI injection failed:', error)
    // Return original code if injection fails - don't break the app
    return code + '\n\n/* AI injection failed - window.AI not available */'
  }
}

function injectAIForHTML(code: string, template: string, apiKey?: string): string {
  const openRouterKey = apiKey || process.env.OPENROUTER_API_KEY || 'YOUR_API_KEY_HERE';
  
  const aiScript = `
    <script>
      // Wait for page to load before setting up AI
      if (typeof window !== 'undefined') {
        window.AI = {
          async chat(messages, options = {}) {
            try {
              const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ${openRouterKey}',
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://fragments.e2b.dev',
                  'X-Title': 'E2B Fragments - Generated App'
                },
                body: JSON.stringify({
                  messages: Array.isArray(messages) ? messages : [{ role: 'user', content: messages }],
                  model: options.model || 'anthropic/claude-3-haiku',
                  stream: options.stream || false,
                  max_tokens: options.max_tokens || 1000
                })
              });
              
              if (!response.ok) {
                throw new Error('AI request failed: ' + response.status);
              }
              
              const data = await response.json();
              return data.choices[0].message.content;
            } catch (error) {
              console.error('AI Error:', error);
              throw error;
            }
          },
          
          async ask(prompt, model = 'anthropic/claude-3-haiku') {
            return this.chat([{ role: 'user', content: prompt }], { model });
          },
          
          models: {
            fast: 'anthropic/claude-3-haiku',
            balanced: 'anthropic/claude-3.5-sonnet',
            powerful: 'openai/gpt-4-turbo',
            cheap: 'anthropic/claude-3-haiku:floor',
            turbo: 'anthropic/claude-3.5-sonnet:nitro'
          }
        };
        
        console.log('🤖 AI capabilities loaded!');
        console.log('Usage: await window.AI.ask("your question")');
        console.log('Available models:', window.AI.models);
      }
    </script>
  `;

  // Try to inject in head first
  if (code.includes('</head>')) {
    return code.replace('</head>', `${aiScript}</head>`)
  }
  
  // Try body
  if (code.includes('<body>')) {
    return code.replace('<body>', `<body>${aiScript}`)
  }
  
  // Try html tag
  if (code.includes('<html>')) {
    return code.replace('<html>', `<html>${aiScript}`)
  }
  
  // For Vue templates
  if (template === 'vue' && code.includes('<template>')) {
    return `${aiScript}\n${code}`
  }
  
  // For other cases, try to add at the beginning if it looks like HTML
  if (code.includes('<') && code.includes('>')) {
    return `${aiScript}\n${code}`
  }
  
  // Last resort: add as comment
  return code + '\n\n<!-- AI capabilities: window.AI object will be available -->'
}

function injectAIForPython(code: string, template: string, apiKey?: string): string {
  const openRouterKey = apiKey || process.env.OPENROUTER_API_KEY || 'YOUR_API_KEY_HERE';
  
  if (template === 'streamlit-developer') {
    const aiScript = `
    <script>
      window.AI = {
        async chat(messages, options = {}) {
          try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ${openRouterKey}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://fragments.e2b.dev',
                'X-Title': 'E2B Fragments - Streamlit App'
              },
              body: JSON.stringify({
                messages: Array.isArray(messages) ? messages : [{ role: 'user', content: messages }],
                model: options.model || 'anthropic/claude-3-haiku',
                stream: options.stream || false,
                max_tokens: options.max_tokens || 1000
              })
            });
            
            if (!response.ok) {
              throw new Error('AI request failed: ' + response.status);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
          } catch (error) {
            console.error('AI Error:', error);
            throw error;
          }
        },
        
        async ask(prompt, model = 'anthropic/claude-3-haiku') {
          return this.chat([{ role: 'user', content: prompt }], { model });
        },
        
        models: {
          fast: 'anthropic/claude-3-haiku',
          balanced: 'anthropic/claude-3.5-sonnet',
          powerful: 'openai/gpt-4-turbo',
          cheap: 'anthropic/claude-3-haiku:floor',
          turbo: 'anthropic/claude-3.5-sonnet:nitro'
        }
      };
      
      console.log('🤖 AI capabilities loaded!');
      console.log('Usage: await window.AI.ask("your question")');
      console.log('Available models:', window.AI.models);
    </script>
  `
    const escapedScript = aiScript.replace(/'/g, "\\'").replace(/\n/g, '').replace(/\s+/g, ' ')
    return code + `\n\n# AI capabilities\nimport streamlit.components.v1 as components\ncomponents.html('${escapedScript}', height=0)`
  }
  
  if (template === 'gradio-developer') {
    // For Gradio, inject a proper Python function that calls OpenRouter directly
    const aiHelperCode = `

# AI Helper Functions
import requests
import json

def ai_ask(prompt, model="anthropic/claude-3-haiku"):
    """Ask AI a question and get a response."""
    try:
        response = requests.post('https://openrouter.ai/api/v1/chat/completions', 
            headers={
                'Authorization': 'Bearer ${openRouterKey}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://fragments.e2b.dev',
                'X-Title': 'E2B Fragments - Gradio App'
            },
            json={
                'messages': [{'role': 'user', 'content': prompt}],
                'model': model,
                'stream': False,
                'max_tokens': 1000
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('choices', [{}])[0].get('message', {}).get('content', 'No response')
        else:
            return f"AI Error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"AI Error: {str(e)}"

def ai_chat(messages, model="anthropic/claude-3-haiku"):
    """Chat with AI using a list of messages."""
    try:
        response = requests.post('https://openrouter.ai/api/v1/chat/completions',
            headers={
                'Authorization': 'Bearer ${openRouterKey}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://fragments.e2b.dev',
                'X-Title': 'E2B Fragments - Gradio App'
            },
            json={
                'messages': messages,
                'model': model,
                'stream': False,
                'max_tokens': 1000
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get('choices', [{}])[0].get('message', {}).get('content', 'No response')
        else:
            return f"AI Error: {response.status_code} - {response.text}"
    except Exception as e:
        return f"AI Error: {str(e)}"

# Available AI models
AI_MODELS = {
    'fast': 'anthropic/claude-3-haiku',
    'balanced': 'anthropic/claude-3.5-sonnet', 
    'powerful': 'openai/gpt-4-turbo',
    'cheap': 'anthropic/claude-3-haiku:floor',
    'turbo': 'anthropic/claude-3.5-sonnet:nitro'
}

print("🤖 AI capabilities loaded!")
print("Usage: ai_ask('your question') or ai_chat([{'role': 'user', 'content': 'hello'}])")
print("Available models:", list(AI_MODELS.keys()))
`
    return code + aiHelperCode
  }
  
  // Generic Python - add as comment
  return code + `\n\n# AI capabilities available in web interface`
}
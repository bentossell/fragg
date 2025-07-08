export function injectAI(code: string, template: string, filePath?: string, apiKey?: string): string {
  try {
    // For React/Next.js apps with JSX/TSX files, skip AI injection on component files
    // Only inject into HTML files or the main entry point
    if (filePath && (filePath.endsWith('.tsx') || filePath.endsWith('.jsx'))) {
      // Don't inject into React component files to avoid parsing errors
      // Add a comment instead
      return code + '\n\n// AI capabilities available via window.AI (loaded in HTML head)'
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
                  'HTTP-Referer': 'https://fragg.app',
                  'X-Title': 'Fragg - Generated App'
                },
                body: JSON.stringify({
                  messages: Array.isArray(messages) ? messages : [{ role: 'user', content: messages }],
                  model: options.model || 'google/gemini-2.5-flash-lite-preview-06-17',
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
          
          async ask(prompt, model = 'google/gemini-2.5-flash-lite-preview-06-17') {
            return this.chat([{ role: 'user', content: prompt }], { model });
          },
          
          models: {
            fast: 'google/gemini-2.5-flash-lite-preview-06-17',
            balanced: 'google/gemini-2.5-flash-lite-preview-06-17',
            powerful: 'google/gemini-2.5-flash-lite-preview-06-17',
            cheap: 'deepseek/deepseek-chat:free',
            turbo: 'google/gemini-2.5-flash'
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

/**
 * HTML Generator Service for Browser Preview
 * Generates self-contained HTML content for different templates
 */

export function generateHTMLContent(code: string, template: string): string {
  const templates: Record<string, (code: string) => string> = {
    'nextjs-developer': generateReactHTML,
    'vue-developer': generateVueHTML,
    'static-html': (code) => code,
  }

  const generator = templates[template]
  if (!generator) {
    // Check if it's a known unsupported template
    if (template === 'streamlit-developer' || template === 'gradio-developer') {
      return generateUnsupportedTemplateHTML(template)
    }
    return generateDefaultHTML(code)
  }

  return generator(code)
}

function generateReactHTML(code: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>React Preview</title>
        
        <!-- React 18 UMD scripts from CDN -->
        <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        
        <!-- Babel Standalone for JSX transformation -->
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        
        <!-- Tailwind CSS from CDN -->
        <script src="https://cdn.tailwindcss.com"></script>
        
        <style>
          body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          #root { 
            min-height: 100vh; 
          }
          
          .error-container {
            padding: 20px;
            margin: 20px;
            background-color: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            color: #c00;
            font-family: monospace;
            white-space: pre-wrap;
          }
          
          .error-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 16px;
          }
          
          .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div id="root">
          <div class="loading">Loading...</div>
        </div>
        
        <script type="text/babel" data-type="module">
          // Wrap everything in an IIFE to avoid polluting global scope
          (function() {
            try {
              // Clear loading message
              document.getElementById('root').innerHTML = '';
              
              // User code
              ${code}
              
              // Auto-detect and render the main component
              const componentNames = ['App', 'Component', 'Main', 'Page', 'default']
              let MainComponent = null
              
              // Check for exported components
              for (const name of componentNames) {
                if (typeof window[name] === 'function' || (window[name] && typeof window[name] === 'object' && window[name].$$typeof)) {
                  MainComponent = window[name]
                  break
                }
              }
              
              // If no component found, check if the code exports a default function
              if (!MainComponent) {
                // Try to evaluate if there's a function declaration
                const funcMatch = ${JSON.stringify(code)}.match(/function\\s+(\\w+)\\s*\\(/)
                if (funcMatch && funcMatch[1]) {
                  MainComponent = window[funcMatch[1]]
                }
              }
              
              if (MainComponent) {
                const root = ReactDOM.createRoot(document.getElementById('root'))
                root.render(React.createElement(MainComponent))
              } else {
                document.getElementById('root').innerHTML = \`
                  <div class="error-container">
                    <div class="error-title">No React component found</div>
                    <div>Make sure to define one of the following:</div>
                    <div>• function App() { ... }</div>
                    <div>• function Component() { ... }</div>
                    <div>• function Main() { ... }</div>
                    <div>• function Page() { ... }</div>
                  </div>
                \`
              }
            } catch (error) {
              console.error('Error rendering React component:', error)
              document.getElementById('root').innerHTML = \`
                <div class="error-container">
                  <div class="error-title">Error rendering component</div>
                  <div>\${error.name}: \${error.message}</div>
                  \${error.stack ? '<div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">' + error.stack + '</div>' : ''}
                </div>
              \`
            }
          })()
        </script>
      </body>
    </html>
  `
}

function generateVueHTML(code: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Vue Preview</title>
        
        <!-- Vue 3 from CDN -->
        <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
        
        <!-- Tailwind CSS from CDN -->
        <script src="https://cdn.tailwindcss.com"></script>
        
        <style>
          body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          #app { 
            min-height: 100vh; 
          }
          
          .error-container {
            padding: 20px;
            margin: 20px;
            background-color: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            color: #c00;
            font-family: monospace;
            white-space: pre-wrap;
          }
          
          .error-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 16px;
          }
          
          .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div id="app">
          <div class="loading">Loading...</div>
        </div>
        
        <script>
          const { createApp, ref, reactive, computed, watch, onMounted } = Vue;
          
          try {
            // Clear loading message
            document.getElementById('app').innerHTML = '';
            
            // Create a wrapper component that executes user code
            const AppComponent = {
              setup() {
                ${code}
                
                // Return all defined variables for template access
                return {
                  ...Object.getOwnPropertyNames(this).reduce((acc, key) => {
                    if (typeof this[key] !== 'undefined') {
                      acc[key] = this[key]
                    }
                    return acc
                  }, {})
                }
              },
              template: \`
                <div id="app-content">
                  <!-- User can define template in their code -->
                  <div>
                    <h1>Vue App</h1>
                    <p>Define your Vue component in the code editor.</p>
                  </div>
                </div>
              \`
            }
            
            // Check if user defined a custom app configuration
            if (typeof window.App !== 'undefined') {
              createApp(window.App).mount('#app')
            } else if (typeof window.app !== 'undefined') {
              window.app.mount('#app')
            } else {
              // Mount the wrapper component
              createApp(AppComponent).mount('#app')
            }
          } catch (error) {
            console.error('Error rendering Vue component:', error)
            document.getElementById('app').innerHTML = \`
              <div class="error-container">
                <div class="error-title">Error rendering Vue component</div>
                <div>\${error.name}: \${error.message}</div>
                \${error.stack ? '<div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">' + error.stack + '</div>' : ''}
              </div>
            \`
          }
        </script>
      </body>
    </html>
  `
}

function generateDefaultHTML(code: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Preview</title>
        
        <!-- Tailwind CSS from CDN -->
        <script src="https://cdn.tailwindcss.com"></script>
        
        <style>
          body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          .error-container {
            padding: 20px;
            margin: 20px;
            background-color: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            color: #c00;
            font-family: monospace;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <div id="root"></div>
        
        <script>
          try {
            ${code}
          } catch (error) {
            console.error('Error executing code:', error)
            document.body.innerHTML = \`
              <div class="error-container">
                <div style="font-weight: bold; margin-bottom: 10px;">Error executing code</div>
                <div>\${error.name}: \${error.message}</div>
                \${error.stack ? '<div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">' + error.stack + '</div>' : ''}
              </div>
            \`
          }
        </script>
      </body>
    </html>
  `
}

function generateUnsupportedTemplateHTML(template: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Unsupported Template</title>
        
        <style>
          body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: #f5f5f5;
          }
          
          .message-container {
            max-width: 500px;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
          }
          
          .message-container h2 {
            color: #333;
            margin-bottom: 16px;
          }
          
          .message-container p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 8px;
          }
          
          .template-name {
            font-family: monospace;
            background-color: #f0f0f0;
            padding: 2px 6px;
            border-radius: 3px;
          }
        </style>
      </head>
      <body>
        <div class="message-container">
          <h2>Browser preview is not available</h2>
          <p>The <span class="template-name">${template}</span> template requires a server environment and cannot be previewed in the browser.</p>
          <p>This template now runs instantly in the browser.</p>
        </div>
      </body>
    </html>
  `
} 
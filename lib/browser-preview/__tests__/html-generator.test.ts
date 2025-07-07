import { generateHTMLContent } from '../html-generator'

describe('HTML Generator', () => {
  describe('generateHTMLContent', () => {
    describe('React Templates', () => {
      it('generates correct HTML for React component', () => {
        const code = 'function App() { return <div>Hello React</div> }'
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<div id="root">')
        expect(html).toContain('https://unpkg.com/react@18')
        expect(html).toContain('https://unpkg.com/react-dom@18')
        expect(html).toContain('babel.min.js')
        expect(html).toContain('tailwindcss.com')
        expect(html).toContain(code)
      })

      it('handles React components with hooks', () => {
        const code = `
          function App() {
            const [count, setCount] = React.useState(0)
            
            return (
              <div>
                <h1>Count: {count}</h1>
                <button onClick={() => setCount(count + 1)}>Increment</button>
              </div>
            )
          }
        `
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('React.useState(0)')
        expect(html).toContain('onClick={() => setCount(count + 1)}')
      })

      it('handles React components with effects', () => {
        const code = `
          function App() {
            React.useEffect(() => {
              console.log('Component mounted')
            }, [])
            
            return <div>App with Effect</div>
          }
        `
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('React.useEffect')
      })

      it('handles multiple React components', () => {
        const code = `
          function Header() {
            return <h1>Header</h1>
          }
          
          function App() {
            return (
              <div>
                <Header />
                <p>Content</p>
              </div>
            )
          }
        `
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('function Header()')
        expect(html).toContain('function App()')
        expect(html).toContain('<Header />')
      })

      it('handles React with CSS-in-JS', () => {
        const code = `
          function App() {
            return (
              <div style={{ backgroundColor: 'blue', padding: '20px' }}>
                Styled Component
              </div>
            )
          }
        `
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('style={{ backgroundColor: \'blue\', padding: \'20px\' }}')
      })
    })

    describe('Vue Templates', () => {
      it('generates correct HTML for Vue component', () => {
        const code = `
          const App = {
            template: '<h1>{{ message }}</h1>',
            data() {
              return { message: 'Hello Vue!' }
            }
          }
        `
        const html = generateHTMLContent(code, 'vue-developer')
        
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<div id="app">')
        expect(html).toContain('unpkg.com/vue@3/dist/vue.global.prod.js')
        expect(html).toContain('const App = {')
        expect(html).toContain('createApp')
      })

      it('handles Vue SFC-style syntax', () => {
        const code = `
          <template>
            <div>
              <h1>{{ title }}</h1>
              <button @click="increment">Count: {{ count }}</button>
            </div>
          </template>
          
          <script>
          export default {
            data() {
              return {
                title: 'Vue App',
                count: 0
              }
            },
            methods: {
              increment() {
                this.count++
              }
            }
          }
          </script>
        `
        const html = generateHTMLContent(code, 'vue-developer')
        
        expect(html).toContain('template:')
        expect(html).toContain('data() {')
        expect(html).toContain('methods: {')
      })

      it('handles Vue 3 Composition API', () => {
        const code = `
          const App = {
            setup() {
              const count = Vue.ref(0)
              const increment = () => count.value++
              
              return { count, increment }
            },
            template: '<button @click="increment">{{ count }}</button>'
          }
        `
        const html = generateHTMLContent(code, 'vue-developer')
        
        expect(html).toContain('setup()')
        expect(html).toContain('Vue.ref(0)')
      })

      it('handles Vue with computed properties', () => {
        const code = `
          const App = {
            data() {
              return { firstName: 'John', lastName: 'Doe' }
            },
            computed: {
              fullName() {
                return this.firstName + ' ' + this.lastName
              }
            },
            template: '<h1>{{ fullName }}</h1>'
          }
        `
        const html = generateHTMLContent(code, 'vue-developer')
        
        expect(html).toContain('computed: {')
        expect(html).toContain('fullName()')
      })
    })

    describe('Static HTML', () => {
      it('returns static HTML unchanged', () => {
        const htmlCode = '<h1>Hello World</h1><p>This is static HTML</p>'
        const result = generateHTMLContent(htmlCode, 'static-html')
        
        expect(result).toBe(htmlCode)
      })

      it('handles complex static HTML', () => {
        const htmlCode = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Test Page</title>
              <style>
                body { font-family: Arial; }
              </style>
            </head>
            <body>
              <h1>Test</h1>
              <script>
                console.log('Hello')
              </script>
            </body>
          </html>
        `
        const result = generateHTMLContent(htmlCode, 'static-html')
        
        expect(result).toBe(htmlCode)
      })
    })

    describe('Unsupported Templates', () => {
      it('returns informative message for Python templates', () => {
        const code = 'print("Hello Python")'
        const html = generateHTMLContent(code, 'streamlit-developer')
        
        expect(html).toContain('Browser preview is not available')
        expect(html).toContain('streamlit-developer')
        expect(html).toContain('requires a server environment')
      })

      it('returns informative message for Gradio templates', () => {
        const code = 'import gradio as gr'
        const html = generateHTMLContent(code, 'gradio-developer')
        
        expect(html).toContain('Browser preview is not available')
        expect(html).toContain('gradio-developer')
      })

      it('handles unknown templates gracefully', () => {
        const code = 'unknown code'
        const html = generateHTMLContent(code, 'unknown-template')
        
        // Unknown templates fall back to default HTML template
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<div id="root"></div>')
      })
    })

    describe('Error Handling', () => {
      it('handles empty code', () => {
        const html = generateHTMLContent('', 'nextjs-developer')
        
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('ReactDOM.createRoot')
      })

      it('handles null/undefined code', () => {
        const html1 = generateHTMLContent(null as any, 'nextjs-developer')
        const html2 = generateHTMLContent(undefined as any, 'vue-developer')
        
        expect(html1).toContain('<!DOCTYPE html>')
        expect(html2).toContain('<!DOCTYPE html>')
      })

      it('handles malformed React JSX', () => {
        const code = 'function App() { return <div>Unclosed tag }'
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        // Should still generate HTML, Babel will handle syntax errors
        expect(html).toContain(code)
        expect(html).toContain('ReactDOM.createRoot')
      })

      it('handles malformed Vue templates', () => {
        const code = 'const App = { template: "<div>Unclosed", data() { return {} } }'
        const html = generateHTMLContent(code, 'vue-developer')
        
        // Should still generate HTML, Vue will handle errors
        expect(html).toContain(code)
        expect(html).toContain('createApp')
      })
    })

    describe('Special Characters', () => {
      it('handles Unicode characters', () => {
        const code = 'function App() { return <div>Hello 世界 🌍</div> }'
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('世界')
        expect(html).toContain('🌍')
        expect(html).toContain('charset="utf-8"')
      })

      it('escapes HTML entities in React', () => {
        const code = 'function App() { return <div>{"<script>alert(1)</script>"}</div> }'
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('{"<script>alert(1)</script>"}')
      })

      it('handles template literals', () => {
        const code = 'function App() { const msg = `Hello ${name}`; return <div>{msg}</div> }'
        const html = generateHTMLContent(code, 'nextjs-developer')
        
        expect(html).toContain('`Hello ${name}`')
      })
    })
  })

  describe('CDN URL Generation', () => {
    it('uses correct React CDN URLs', () => {
      const code = 'function App() { return <div>Test</div> }'
      const html = generateHTMLContent(code, 'nextjs-developer')
      
      expect(html).toMatch(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/)
      expect(html).toMatch(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/)
      expect(html).toMatch(/unpkg\.com\/@babel\/standalone/)
    })

    it('uses correct Vue CDN URL', () => {
      const code = 'const App = { template: "<div>Test</div>" }'
      const html = generateHTMLContent(code, 'vue-developer')
      
      expect(html).toMatch(/unpkg\.com\/vue@3\/dist\/vue\.global\.prod\.js/)
    })

    it('includes crossorigin attribute for CDN scripts', () => {
      const code = 'function App() { return <div>Test</div> }'
      const html = generateHTMLContent(code, 'nextjs-developer')
      
      expect(html).toContain('crossorigin')
    })
  })

  describe('Performance', () => {
    it('generates HTML quickly', () => {
      const code = 'function App() { return <div>Performance Test</div> }'
      const iterations = 1000
      
      const startTime = performance.now()
      for (let i = 0; i < iterations; i++) {
        generateHTMLContent(code, 'nextjs-developer')
      }
      const endTime = performance.now()
      
      const avgTime = (endTime - startTime) / iterations
      expect(avgTime).toBeLessThan(1) // Less than 1ms per generation
    })

    it('handles large code files efficiently', () => {
      const largeCode = Array(100).fill('function Component() { return <div>Test</div> }').join('\n')
      
      const startTime = performance.now()
      const html = generateHTMLContent(largeCode, 'nextjs-developer')
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(10) // Less than 10ms
      expect(html).toContain(largeCode)
    })
  })
}) 
'use client'

import { useState } from 'react'
import { BrowserPreview } from '@/components/browser-preview'
import { BrowserConsole, LogEntry } from '@/components/browser-console'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const exampleReactCode = `function App() {
  const [count, setCount] = React.useState(0);
  
  React.useEffect(() => {
    console.log('App mounted!');
    console.info('Current count:', count);
  }, [count]);

  const handleClick = () => {
    setCount(count + 1);
    console.log('Button clicked! New count:', count + 1);
    
    if (count >= 9) {
      console.warn('Count is getting high!');
    }
    
    if (count >= 15) {
      console.error('Count is too high! Resetting...');
      setCount(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">React Counter</h1>
        <p className="text-gray-600 mb-6">Click the button to increment the counter!</p>
        
        <div className="text-6xl font-bold text-center mb-8 text-purple-600">
          {count}
        </div>
        
        <button
          onClick={handleClick}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:scale-105 transition-all duration-200"
        >
          Click me!
        </button>
        
        {count >= 10 && (
          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
            <p className="text-yellow-800 text-sm">⚠️ High count warning!</p>
          </div>
        )}
      </div>
    </div>
  );
}`

const exampleVueCode = `const App = {
  template: \`
    <div class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-8">
      <div class="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <h1 class="text-3xl font-bold text-gray-800 mb-4">Vue Todo App</h1>
        
        <div class="mb-4">
          <input
            v-model="newTodo"
            @keyup.enter="addTodo"
            placeholder="Add a new todo..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <ul class="space-y-2">
          <li
            v-for="(todo, index) in todos"
            :key="index"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span :class="{ 'line-through text-gray-400': todo.done }">
              {{ todo.text }}
            </span>
            <div class="flex gap-2">
              <button
                @click="toggleTodo(index)"
                class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {{ todo.done ? 'Undo' : 'Done' }}
              </button>
              <button
                @click="removeTodo(index)"
                class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Remove
              </button>
            </div>
          </li>
        </ul>
        
        <div v-if="todos.length === 0" class="text-center text-gray-400 mt-8">
          No todos yet. Add one above!
        </div>
      </div>
    </div>
  \`,
  data() {
    return {
      newTodo: '',
      todos: [
        { text: 'Learn Vue 3', done: false },
        { text: 'Build something awesome', done: false }
      ]
    }
  },
  mounted() {
    console.log('Vue app mounted!');
    console.info('Initial todos:', this.todos.length);
  },
  methods: {
    addTodo() {
      if (this.newTodo.trim()) {
        this.todos.push({ text: this.newTodo, done: false });
        console.log('Added todo:', this.newTodo);
        this.newTodo = '';
      } else {
        console.warn('Cannot add empty todo!');
      }
    },
    toggleTodo(index) {
      this.todos[index].done = !this.todos[index].done;
      console.log('Toggled todo:', this.todos[index].text);
    },
    removeTodo(index) {
      const removed = this.todos.splice(index, 1)[0];
      console.log('Removed todo:', removed.text);
      
      if (this.todos.length === 0) {
        console.info('All todos completed! 🎉');
      }
    }
  }
}`

const exampleHtmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Animated Landing Page</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-20px); }
    }
    .float { animation: float 3s ease-in-out infinite; }
  </style>
</head>
<body class="bg-gradient-to-br from-purple-600 to-blue-600 min-h-screen text-white">
  <div class="container mx-auto px-6 py-16">
    <header class="text-center mb-16">
      <h1 class="text-6xl font-bold mb-4 float">Welcome to the Future</h1>
      <p class="text-xl opacity-90">Experience instant preview with zero latency</p>
    </header>
    
    <div class="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
      <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-all hover:scale-105">
        <div class="text-4xl mb-4">⚡</div>
        <h3 class="text-xl font-semibold mb-2">Lightning Fast</h3>
        <p class="opacity-80">Preview updates in under 100ms</p>
      </div>
      
      <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-all hover:scale-105">
        <div class="text-4xl mb-4">🔒</div>
        <h3 class="text-xl font-semibold mb-2">Secure</h3>
        <p class="opacity-80">Sandboxed execution environment</p>
      </div>
      
      <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition-all hover:scale-105">
        <div class="text-4xl mb-4">🎨</div>
        <h3 class="text-xl font-semibold mb-2">Beautiful</h3>
        <p class="opacity-80">Tailwind CSS pre-loaded</p>
      </div>
    </div>
    
    <div class="text-center mt-16">
      <button onclick="alert('Browser Preview Works! 🎉')" class="bg-white text-purple-600 px-8 py-4 rounded-full font-semibold text-lg hover:shadow-2xl transform hover:scale-105 transition-all">
        Click to Test
      </button>
    </div>
  </div>
  
  <script>
    console.log('Page loaded successfully!');
    console.info('This is running directly in your browser');
    
    // Simulate some console activity
    setTimeout(() => console.log('1 second elapsed'), 1000);
    setTimeout(() => console.warn('This is a warning example'), 2000);
    setTimeout(() => console.error('This is an error example (not a real error!)'), 3000);
  </script>
</body>
</html>`

export default function TestBrowserPreview() {
  const [code, setCode] = useState(exampleReactCode)
  const [template, setTemplate] = useState<'nextjs-developer' | 'vue-developer' | 'static-html'>('nextjs-developer')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const handlePreviewReady = () => {
    setPreviewStatus('ready')
    addLog('info', 'Preview ready!')
  }

  const handlePreviewError = (error: Error) => {
    setPreviewStatus('error')
    addLog('error', `Preview error: ${error.message}`)
  }

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, {
      type,
      message,
      timestamp: new Date().toLocaleTimeString()
    }])
  }

  const loadExample = (exampleType: 'react' | 'vue' | 'html') => {
    switch (exampleType) {
      case 'react':
        setCode(exampleReactCode)
        setTemplate('nextjs-developer')
        break
      case 'vue':
        setCode(exampleVueCode)
        setTemplate('vue-developer')
        break
      case 'html':
        setCode(exampleHtmlCode)
        setTemplate('static-html')
        break
    }
    setLogs([])
    addLog('info', `Loaded ${exampleType} example`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Browser Preview Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the new instant browser preview - no sandbox required! Updates in {'<'}100ms.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              previewStatus === 'ready' ? 'bg-green-500' : 
              previewStatus === 'error' ? 'bg-red-500' : 
              'bg-yellow-500 animate-pulse'
            }`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Status: {previewStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Editor Panel */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Code Editor</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => loadExample('react')}>
                  React Example
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadExample('vue')}>
                  Vue Example
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadExample('html')}>
                  HTML Example
                </Button>
              </div>
            </div>
            
            <div className="mb-4">
              <Label htmlFor="template">Template</Label>
              <select
                id="template"
                value={template}
                onChange={(e) => setTemplate(e.target.value as any)}
                className="w-full mt-1 px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="nextjs-developer">React / Next.js</option>
                <option value="vue-developer">Vue</option>
                <option value="static-html">Static HTML</option>
              </select>
            </div>

            <div>
              <Label htmlFor="code">Code</Label>
              <Textarea
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 font-mono text-sm"
                rows={20}
              />
            </div>
          </Card>

          {/* Preview Panel */}
          <div className="space-y-6">
            <Card className="h-[500px] overflow-hidden">
              <Tabs defaultValue="preview" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="console">Console</TabsTrigger>
                </TabsList>
                
                <TabsContent value="preview" className="flex-1 m-0">
                  <BrowserPreview
                    code={code}
                    template={template}
                    onReady={handlePreviewReady}
                    onError={handlePreviewError}
                  />
                </TabsContent>
                
                <TabsContent value="console" className="flex-1 m-0">
                  <BrowserConsole
                    logs={logs}
                    onClear={() => setLogs([])}
                  />
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">How it works</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>✅ No E2B sandbox required - runs entirely in browser</li>
                <li>✅ Instant preview updates (no 20+ minute timeouts!)</li>
                <li>✅ React, Vue, and HTML support out of the box</li>
                <li>✅ Tailwind CSS pre-loaded for beautiful styling</li>
                <li>✅ Console output captured and displayed</li>
                <li>✅ Secure iframe sandboxing</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 
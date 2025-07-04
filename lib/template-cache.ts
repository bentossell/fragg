interface CachedTemplate {
  name: string
  stack: 'static' | 'nextjs' | 'streamlit' | 'gradio'
  baseCode: string
  structure: {
    imports: string
    styles: string
    body: string
    scripts: string
    components: string
  }
  variables: string[]
  metadata: {
    complexity: 'simple' | 'medium' | 'complex'
    estimatedTokens: number
    components: string[]
    dependencies: string[]
  }
}

interface QuickStartTemplate {
  name: string
  description: string
  category: 'landing' | 'dashboard' | 'app' | 'tool' | 'game'
  code: string
  template: string
  components: string[]
}

export class TemplateCache {
  private templates = new Map<string, CachedTemplate>()
  private quickStarts = new Map<string, QuickStartTemplate>()
  
  constructor() {
    this.initializeTemplates()
    this.initializeQuickStarts()
  }
  
  private initializeTemplates() {
    // Static HTML template with modern structure
    this.templates.set('static-html', {
      name: 'static-html',
      stack: 'static',
      baseCode: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <meta name="description" content="{{description}}">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              primary: {
                50: '#eff6ff',
                500: '#3b82f6',
                600: '#2563eb',
                700: '#1d4ed8',
                900: '#1e3a8a',
              }
            }
          }
        }
      }
    </script>
    {{imports}}
    <style>
        {{styles}}
    </style>
</head>
<body class="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
    {{body}}
    
    <script>
        {{scripts}}
    </script>
</body>
</html>`,
      structure: {
        imports: '',
        styles: '',
        body: '',
        scripts: '',
        components: ''
      },
      variables: ['title', 'description', 'imports', 'styles', 'body', 'scripts'],
      metadata: {
        complexity: 'simple',
        estimatedTokens: 1000,
        components: [],
        dependencies: []
      }
    })
    
    // Modern React/Next.js template
    this.templates.set('nextjs-page', {
      name: 'nextjs-page',
      stack: 'nextjs',
      baseCode: `import React, { useState, useEffect } from 'react'
{{imports}}

{{interfaces}}

export default function {{componentName}}({{propsParam}}: Props) {
  {{state}}
  
  {{effects}}
  
  {{handlers}}
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {{jsx}}
    </div>
  )
}`,
      structure: {
        imports: '',
        styles: '',
        body: '',
        scripts: '',
        components: ''
      },
      variables: ['imports', 'interfaces', 'componentName', 'propsParam', 'state', 'effects', 'handlers', 'jsx'],
      metadata: {
        complexity: 'medium',
        estimatedTokens: 2500,
        components: [],
        dependencies: ['react', 'next', '@types/react']
      }
    })
    
    // Enhanced Streamlit template
    this.templates.set('streamlit-app', {
      name: 'streamlit-app',
      stack: 'streamlit',
      baseCode: `import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
{{imports}}

# Page configuration
st.set_page_config(
    page_title="{{title}}",
    page_icon="{{icon}}",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for modern styling
st.markdown("""
<style>
    .main > div {
        padding-top: 2rem;
    }
    .stMetric > div > div > div > div {
        font-size: 1rem;
    }
    {{styles}}
</style>
""", unsafe_allow_html=True)

def main():
    # App header
    st.title("{{title}}")
    st.markdown("{{description}}")
    st.markdown("---")
    
    {{content}}

if __name__ == "__main__":
    main()`,
      structure: {
        imports: '',
        styles: '',
        body: '',
        scripts: '',
        components: ''
      },
      variables: ['imports', 'title', 'icon', 'styles', 'description', 'content'],
      metadata: {
        complexity: 'medium',
        estimatedTokens: 2000,
        components: [],
        dependencies: ['streamlit', 'pandas', 'numpy', 'plotly']
      }
    })
    
    // Enhanced Gradio template
    this.templates.set('gradio-app', {
      name: 'gradio-app',
      stack: 'gradio',
      baseCode: `import gradio as gr
import pandas as pd
import numpy as np
from datetime import datetime
{{imports}}

# Custom CSS for modern styling
custom_css = """
    .gradio-container {
        font-family: 'Inter', sans-serif;
    }
    .main-header {
        text-align: center;
        padding: 2rem 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        margin: -1rem -1rem 2rem -1rem;
        border-radius: 0 0 1rem 1rem;
    }
    {{styles}}
"""

{{functions}}

def create_interface():
    with gr.Blocks(css=custom_css, title="{{title}}") as demo:
        gr.HTML('''
        <div class="main-header">
            <h1>{{title}}</h1>
            <p>{{description}}</p>
        </div>
        ''')
        
        {{interface}}
        
        gr.Markdown("---")
        gr.Markdown("*Generated with AI • Powered by Gradio*")
    
    return demo

if __name__ == "__main__":
    demo = create_interface()
    demo.launch({{launch_options}})`,
      structure: {
        imports: '',
        styles: '',
        body: '',
        scripts: '',
        components: ''
      },
      variables: ['imports', 'styles', 'functions', 'title', 'description', 'interface', 'launch_options'],
      metadata: {
        complexity: 'medium',
        estimatedTokens: 2200,
        components: [],
        dependencies: ['gradio', 'pandas', 'numpy']
      }
    })
  }
  
  private initializeQuickStarts() {
    // Landing page templates
    this.quickStarts.set('modern-landing', {
      name: 'modern-landing',
      description: 'Modern landing page with hero section and features',
      category: 'landing',
      template: 'static-html',
      components: ['navigation', 'button', 'card'],
      code: `<nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
            <div class="flex items-center">
                <h1 class="text-xl font-bold text-gray-900">Brand</h1>
            </div>
            <div class="hidden md:block">
                <div class="ml-10 flex items-baseline space-x-4">
                    <a href="#" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Home</a>
                    <a href="#" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">About</a>
                    <a href="#" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Services</a>
                    <a href="#" class="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Contact</a>
                </div>
            </div>
            <button class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                Get Started
            </button>
        </div>
    </div>
</nav>

<!-- Hero Section -->
<section class="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div class="text-center">
            <h1 class="text-4xl md:text-6xl font-bold mb-6">
                Build Something Amazing
            </h1>
            <p class="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
                Create beautiful, modern applications with our powerful tools and seamless workflow.
            </p>
            <div class="space-x-4">
                <button class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                    Start Free Trial
                </button>
                <button class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors">
                    Watch Demo
                </button>
            </div>
        </div>
    </div>
    <div class="absolute inset-0 bg-black opacity-10"></div>
</section>

<!-- Features Section -->
<section class="py-20 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
            <h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Everything you need to succeed
            </h2>
            <p class="text-xl text-gray-600 max-w-2xl mx-auto">
                Powerful features designed to help you build and scale your applications faster than ever.
            </p>
        </div>
        
        <div class="grid md:grid-cols-3 gap-8">
            <div class="bg-white p-8 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Lightning Fast</h3>
                <p class="text-gray-600">Build and deploy applications in minutes, not hours. Our optimized workflow gets you from idea to production quickly.</p>
            </div>
            
            <div class="bg-white p-8 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Reliable</h3>
                <p class="text-gray-600">Built on enterprise-grade infrastructure with 99.9% uptime guarantee. Your applications will always be available.</p>
            </div>
            
            <div class="bg-white p-8 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"></path>
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900 mb-2">Scalable</h3>
                <p class="text-gray-600">From prototype to millions of users. Our platform scales automatically to meet your application's demands.</p>
            </div>
        </div>
    </div>
</section>

<!-- CTA Section -->
<section class="bg-gray-900 text-white py-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl md:text-4xl font-bold mb-4">
            Ready to get started?
        </h2>
        <p class="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of developers who are already building amazing applications with our platform.
        </p>
        <button class="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Start Building Today
        </button>
    </div>
</section>`
    })
    
    this.quickStarts.set('simple-calculator', {
      name: 'simple-calculator',
      description: 'Interactive calculator with modern design',
      category: 'tool',
      template: 'static-html',
      components: ['button'],
      code: `<div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white rounded-2xl shadow-xl p-8 w-96">
        <div class="mb-6">
            <input type="text" id="display" class="w-full text-right text-3xl font-mono bg-gray-50 rounded-lg p-4 border-none outline-none" readonly value="0">
        </div>
        
        <div class="grid grid-cols-4 gap-3">
            <!-- Row 1 -->
            <button onclick="clearDisplay()" class="col-span-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors">
                Clear
            </button>
            <button onclick="deleteLast()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                ⌫
            </button>
            <button onclick="appendToDisplay('/')" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors">
                ÷
            </button>
            
            <!-- Row 2 -->
            <button onclick="appendToDisplay('7')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                7
            </button>
            <button onclick="appendToDisplay('8')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                8
            </button>
            <button onclick="appendToDisplay('9')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                9
            </button>
            <button onclick="appendToDisplay('*')" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors">
                ×
            </button>
            
            <!-- Row 3 -->
            <button onclick="appendToDisplay('4')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                4
            </button>
            <button onclick="appendToDisplay('5')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                5
            </button>
            <button onclick="appendToDisplay('6')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                6
            </button>
            <button onclick="appendToDisplay('-')" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors">
                −
            </button>
            
            <!-- Row 4 -->
            <button onclick="appendToDisplay('1')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                1
            </button>
            <button onclick="appendToDisplay('2')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                2
            </button>
            <button onclick="appendToDisplay('3')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                3
            </button>
            <button onclick="appendToDisplay('+')" class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors">
                +
            </button>
            
            <!-- Row 5 -->
            <button onclick="appendToDisplay('0')" class="col-span-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                0
            </button>
            <button onclick="appendToDisplay('.')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-lg transition-colors">
                .
            </button>
            <button onclick="calculate()" class="bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors">
                =
            </button>
        </div>
    </div>
</div>

<script>
let display = document.getElementById('display');
let currentInput = '0';
let shouldResetDisplay = false;

function updateDisplay() {
    display.value = currentInput;
}

function appendToDisplay(value) {
    if (shouldResetDisplay) {
        currentInput = '';
        shouldResetDisplay = false;
    }
    
    if (currentInput === '0' && value !== '.') {
        currentInput = value;
    } else {
        currentInput += value;
    }
    
    updateDisplay();
}

function clearDisplay() {
    currentInput = '0';
    updateDisplay();
}

function deleteLast() {
    if (currentInput.length > 1) {
        currentInput = currentInput.slice(0, -1);
    } else {
        currentInput = '0';
    }
    updateDisplay();
}

function calculate() {
    try {
        // Replace display operators with calculation operators
        let expression = currentInput
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-');
        
        let result = eval(expression);
        currentInput = result.toString();
        shouldResetDisplay = true;
        updateDisplay();
    } catch (error) {
        currentInput = 'Error';
        shouldResetDisplay = true;
        updateDisplay();
    }
}

// Keyboard support
document.addEventListener('keydown', function(event) {
    const key = event.key;
    
    if (key >= '0' && key <= '9' || key === '.') {
        appendToDisplay(key);
    } else if (key === '+' || key === '-') {
        appendToDisplay(key);
    } else if (key === '*') {
        appendToDisplay('*');
    } else if (key === '/') {
        event.preventDefault();
        appendToDisplay('/');
    } else if (key === 'Enter' || key === '=') {
        calculate();
    } else if (key === 'Escape') {
        clearDisplay();
    } else if (key === 'Backspace') {
        deleteLast();
    }
});
</script>`
    })
    
    this.quickStarts.set('dashboard-template', {
      name: 'dashboard-template',
      description: 'Modern dashboard with metrics and charts',
      category: 'dashboard',
      template: 'nextjs-page',
      components: ['card', 'table', 'search'],
      code: `import React, { useState, useEffect } from 'react'

interface DashboardStats {
  users: number
  revenue: number
  growth: number
  orders: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    users: 12543,
    revenue: 89750,
    growth: 12.5,
    orders: 342
  })
  
  const [searchTerm, setSearchTerm] = useState('')
  
  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        users: prev.users + Math.floor(Math.random() * 5),
        orders: prev.orders + Math.floor(Math.random() * 3)
      }))
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">JD</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.users.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">\${stats.revenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Growth</p>
                <p className="text-2xl font-bold text-gray-900">{stats.growth}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Orders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.orders}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[
                  { user: 'John Doe', action: 'Completed purchase', time: '2 minutes ago', amount: '$299' },
                  { user: 'Jane Smith', action: 'Created account', time: '5 minutes ago', amount: null },
                  { user: 'Mike Johnson', action: 'Updated profile', time: '12 minutes ago', amount: null },
                  { user: 'Sarah Wilson', action: 'Completed purchase', time: '18 minutes ago', amount: '$156' },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">{activity.user.split(' ').map(n => n[0]).join('')}</span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                        <p className="text-sm text-gray-600">{activity.action}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {activity.amount && (
                        <p className="text-sm font-medium text-green-600">{activity.amount}</p>
                      )}
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Top Products</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[
                  { name: 'Premium Plan', sales: 1247, revenue: '$24,940' },
                  { name: 'Basic Plan', sales: 893, revenue: '$8,930' },
                  { name: 'Pro Plan', sales: 567, revenue: '$17,010' },
                  { name: 'Enterprise Plan', sales: 234, revenue: '$23,400' },
                ].map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">{product.sales} sales</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{product.revenue}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}`
    })
  }
  
  getTemplate(name: string): CachedTemplate | undefined {
    return this.templates.get(name)
  }
  
  getQuickStart(name: string): QuickStartTemplate | undefined {
    return this.quickStarts.get(name)
  }
  
  getQuickStartsByCategory(category: string): QuickStartTemplate[] {
    return Array.from(this.quickStarts.values()).filter(q => q.category === category)
  }
  
  getAllQuickStarts(): QuickStartTemplate[] {
    return Array.from(this.quickStarts.values())
  }
  
  fillTemplate(templateName: string, values: Record<string, string>): string {
    const template = this.templates.get(templateName)
    if (!template) return ''
    
    let code = template.baseCode
    
    // Replace all variables
    for (const variable of template.variables) {
      const value = values[variable] || ''
      const regex = new RegExp(`{{${variable}}}`, 'g')
      code = code.replace(regex, value)
    }
    
    return code
  }
  
  // Get a pre-filled template for common use cases
  getQuickTemplate(type: 'landing' | 'dashboard' | 'tool' | 'game'): string {
    const quickStart = Array.from(this.quickStarts.values()).find(q => q.category === type)
    
    if (quickStart) {
      const template = this.templates.get(quickStart.template)
      if (template) {
        return this.fillTemplate(quickStart.template, {
          title: `Generated ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          description: quickStart.description,
          body: quickStart.code,
          icon: '🚀',
          componentName: 'App',
          propsParam: 'props',
          interfaces: 'interface Props {}',
          state: 'const [loading, setLoading] = useState(false)',
          effects: '',
          handlers: '',
          jsx: quickStart.code,
          imports: '',
          styles: '',
          scripts: '',
          content: quickStart.code,
          functions: '',
          interface: quickStart.code,
          launch_options: 'share=True'
        })
      }
    }
    
    // Fallback to basic template
    const template = this.templates.get('static-html')
    return template ? this.fillTemplate('static-html', {
      title: `Generated ${type}`,
      description: `A ${type} application`,
      body: `<div class="container mx-auto px-6 py-12 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Welcome</h1>
        <p class="text-lg text-gray-600">Your ${type} is ready!</p>
      </div>`,
      imports: '',
      styles: '',
      scripts: ''
    }) : ''
  }
  
  // Smart template suggestion based on prompt
  suggestTemplate(prompt: string): { template: string; quickStart?: string; confidence: number } {
    const lower = prompt.toLowerCase()
    
    // High confidence matches
    if (/calculator|compute|math|arithmetic/.test(lower)) {
      return { template: 'static-html', quickStart: 'simple-calculator', confidence: 0.9 }
    }
    
    if (/landing|homepage|website|company|business/.test(lower)) {
      return { template: 'static-html', quickStart: 'modern-landing', confidence: 0.9 }
    }
    
    if (/dashboard|analytics|admin|metrics|stats/.test(lower)) {
      return { template: 'nextjs-page', quickStart: 'dashboard-template', confidence: 0.9 }
    }
    
    // Medium confidence - framework matches
    if (/react|next\.?js|component/.test(lower)) {
      return { template: 'nextjs-page', confidence: 0.7 }
    }
    
    if (/streamlit|data|visualization|plot|chart/.test(lower)) {
      return { template: 'streamlit-app', confidence: 0.7 }
    }
    
    if (/gradio|ml|machine learning|model|ai demo/.test(lower)) {
      return { template: 'gradio-app', confidence: 0.7 }
    }
    
    // Low confidence - default
    return { template: 'static-html', confidence: 0.3 }
  }
  
  // Generate code instantly from cache
  generateInstant(type: 'landing' | 'dashboard' | 'tool' | 'game', customizations: Record<string, string> = {}): {
    code: string
    template: string
    executionTime: number
  } {
    const startTime = Date.now()
    
    const quickStart = Array.from(this.quickStarts.values()).find(q => q.category === type)
    
    if (quickStart) {
      const template = this.templates.get(quickStart.template)
      if (template) {
        const values = {
          title: `My ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          description: quickStart.description,
          body: quickStart.code,
          icon: '🚀',
          componentName: 'App',
          propsParam: 'props',
          interfaces: 'interface Props {}',
          state: 'const [loading, setLoading] = useState(false)',
          effects: '',
          handlers: '',
          jsx: quickStart.code,
          imports: '',
          styles: '',
          scripts: '',
          content: quickStart.code,
          functions: '',
          interface: quickStart.code,
          launch_options: 'share=True',
          ...customizations
        }
        
        const code = this.fillTemplate(quickStart.template, values)
        
        return {
          code,
          template: quickStart.template,
          executionTime: Date.now() - startTime
        }
      }
    }
    
    // Fallback
    return {
      code: this.getQuickTemplate(type),
      template: 'static-html',
      executionTime: Date.now() - startTime
    }
  }
  
  // Utility methods
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys())
  }
  
  getQuickStartNames(): string[] {
    return Array.from(this.quickStarts.keys())
  }
  
  addCustomTemplate(template: CachedTemplate): void {
    this.templates.set(template.name, template)
  }
  
  addCustomQuickStart(quickStart: QuickStartTemplate): void {
    this.quickStarts.set(quickStart.name, quickStart)
  }
}

// Export singleton instance
export const templateCache = new TemplateCache() 
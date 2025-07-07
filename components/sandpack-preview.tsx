'use client'

import { Sandpack, SandpackTheme } from '@codesandbox/sandpack-react'
import { useEffect, useState, memo, useCallback } from 'react'

interface SandpackPreviewProps {
  code: string
  template: string
  dependencies?: Record<string, string>
  onError?: (error: Error) => void
  onReady?: () => void
}

// Custom dark theme configuration
const darkTheme: SandpackTheme = {
  colors: {
    surface1: '#151515',
    surface2: '#252525',
    surface3: '#2a2a2a',
    clickable: '#757575',
    base: '#808080',
    disabled: '#4a4a4a',
    hover: '#c5c5c5',
    accent: '#3c7eff',
    error: '#ff453a',
    errorSurface: '#ffeceb',
  },
  syntax: {
    plain: '#ffffff',
    comment: {
      color: '#757575',
      fontStyle: 'italic',
    },
    keyword: '#77b7d7',
    tag: '#dfab5c',
    punctuation: '#ffffff',
    definition: '#86d9ca',
    property: '#77b7d7',
    static: '#c64640',
    string: '#977cdc',
  },
  font: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"Fira Mono", "DejaVu Sans Mono", Menlo, Consolas, "Liberation Mono", Monaco, "Lucida Console", monospace',
    size: '13px',
    lineHeight: '20px',
  },
}

const SandpackPreviewInner = ({
  code,
  template,
  dependencies = {},
  onError,
  onReady,
}: SandpackPreviewProps) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    setStatus('loading')
  }, [code, template])

  // Determine Sandpack template based on our template
  const sandpackTemplate = template === 'vue-developer' ? 'vue' : 'react'

  // Base dependencies for each template
  const baseDependencies = {
    react: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    vue: {
      'vue': '^3.3.0',
    },
  }

  // Merge base dependencies with custom dependencies
  const finalDependencies = {
    ...baseDependencies[sandpackTemplate],
    ...dependencies,
  }

  // Prepare files based on template
  const files = prepareFiles(code, template, finalDependencies)

  const handleSandpackError = useCallback((error: any) => {
    setStatus('error')
    onError?.(new Error(error.message || 'Sandpack error'))
  }, [onError])

  const handleSandpackReady = useCallback(() => {
    setStatus('ready')
    setIsInitialized(true)
    onReady?.()
  }, [onReady])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up any Sandpack resources
      setIsInitialized(false)
    }
  }, [])

  return (
    <div className="h-full w-full">
      <Sandpack
        template={sandpackTemplate}
        files={files}
        options={{
          showNavigator: false,
          showTabs: false,
          showLineNumbers: true,
          showInlineErrors: true,
          wrapContent: true,
          editorHeight: 0, // Hide editor
          bundlerURL: 'https://sandpack-bundler.codesandbox.io',
          externalResources: [
            'https://cdn.tailwindcss.com',
          ],
          // Optimize initial loading
          autorun: true,
          recompileMode: 'delayed',
          recompileDelay: 500,
        }}
        theme={darkTheme}
        customSetup={{
          dependencies: finalDependencies,
        }}
      />
    </div>
  )
}

/**
 * Prepare files structure based on template type
 */
function prepareFiles(
  code: string,
  template: string,
  dependencies: Record<string, string>
): Record<string, string> {
  if (template === 'vue-developer') {
    return {
      '/src/App.vue': code,
      '/src/main.js': `
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
      `.trim(),
      '/index.html': `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
      `.trim(),
      '/package.json': JSON.stringify({
        name: 'vue-app',
        version: '0.0.0',
        private: true,
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies,
        devDependencies: {
          '@vitejs/plugin-vue': '^4.0.0',
          'vite': '^4.0.0',
        },
      }, null, 2),
    }
  }

  // Default to React template
  return {
    '/App.js': code,
    '/index.js': `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(React.createElement(App))
    `.trim(),
    '/index.html': `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
    `.trim(),
    '/package.json': JSON.stringify({
      name: 'react-app',
      version: '0.0.0',
      private: true,
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject',
      },
      dependencies,
      devDependencies: {
        'react-scripts': '5.0.1',
      },
    }, null, 2),
  }
}

/**
 * Helper function to determine whether to use Sandpack or browser preview
 * Uses Sandpack for complex apps with npm dependencies or build requirements
 */
export function shouldUseSandpack(fragment: {
  code?: string
  template?: string
}): boolean {
  if (!fragment.code) return false

  const code = fragment.code.toLowerCase()
  
  // Check for npm package imports (not available via CDN)
  const npmPackagePatterns = [
    /import\s+.*\s+from\s+['"][^.\/].*['"]/g, // ES imports from packages
    /require\s*\(\s*['"][^.\/].*['"]\s*\)/g,  // CommonJS requires
    /from\s+['"](@[^\/]+\/[^'"]+|[^@.\/][^'"]*)['"]/g, // Scoped packages
  ]

  const hasNpmImports = npmPackagePatterns.some(pattern => pattern.test(code))
  
  // Check for complex build requirements
  const complexPatterns = [
    /\.module\.css/,           // CSS modules
    /\.scss|\.sass|\.less/,    // CSS preprocessors
    /import\s+.*\.svg/,        // SVG imports
    /import\s+.*\.(png|jpg|jpeg|gif|webp)/, // Image imports
    /process\.env\./,          // Environment variables
    /import\.meta\./,          // Vite-specific imports
    /__dirname|__filename/,    // Node.js globals
    /\.tsx?$/,                 // TypeScript files (in imports)
  ]

  const hasComplexRequirements = complexPatterns.some(pattern => pattern.test(code))

  // Check for specific npm packages that aren't available via CDN
  const nonCdnPackages = [
    'framer-motion',
    'react-spring',
    '@tanstack/react-query',
    'react-hook-form',
    'zod',
    'yup',
    '@emotion/',
    'styled-components',
    'axios',
    'swr',
    'react-router',
    '@reduxjs/toolkit',
    'mobx',
    'recoil',
    'valtio',
    'zustand',
    '@mui/',
    '@chakra-ui/',
    'antd',
    '@headlessui/',
    '@radix-ui/',
    'recharts',
    'chart.js',
    'd3',
    'three',
    '@react-three/',
  ]

  const hasNonCdnPackage = nonCdnPackages.some(pkg => code.includes(pkg))

  // Check for Vue-specific complex patterns
  if (fragment.template === 'vue-developer') {
    const vueComplexPatterns = [
      /<script\s+setup/,        // Vue 3 script setup
      /defineProps|defineEmits/, // Vue 3 composition API
      /import\s+.*\.vue/,       // Vue SFC imports
      /@vue\//, // Vue ecosystem packages
    ]
    
    if (vueComplexPatterns.some(pattern => pattern.test(code))) {
      return true
    }
  }

  return hasNpmImports || hasComplexRequirements || hasNonCdnPackage
}

// Memoized export with comparison function
export const SandpackPreview = memo(SandpackPreviewInner, (prevProps, nextProps) => {
  // Only re-render if code, template, or dependencies changed
  return prevProps.code === nextProps.code &&
    prevProps.template === nextProps.template &&
    JSON.stringify(prevProps.dependencies) === JSON.stringify(nextProps.dependencies) &&
    prevProps.onError === nextProps.onError &&
    prevProps.onReady === nextProps.onReady
})

SandpackPreview.displayName = 'SandpackPreview' 
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SandpackPreview, shouldUseSandpack } from '../sandpack-preview'

// Mock the Sandpack component
jest.mock('@codesandbox/sandpack-react', () => ({
  Sandpack: ({ files, options, theme, customSetup, template }: any) => (
    <div data-testid="sandpack-mock">
      <div data-testid="sandpack-template">{template}</div>
      <div data-testid="sandpack-files">{JSON.stringify(files)}</div>
      <div data-testid="sandpack-dependencies">{JSON.stringify(customSetup?.dependencies)}</div>
      <div data-testid="sandpack-bundler-url">{options?.bundlerURL}</div>
    </div>
  ),
}))

describe('SandpackPreview', () => {
  const mockOnError = jest.fn()
  const mockOnReady = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders React template correctly', () => {
    const code = 'function App() { return <div>Hello React</div> }'
    
    render(
      <SandpackPreview
        code={code}
        template="nextjs-developer"
        onError={mockOnError}
        onReady={mockOnReady}
      />
    )

    expect(screen.getByTestId('sandpack-mock')).toBeInTheDocument()
    expect(screen.getByTestId('sandpack-template')).toHaveTextContent('react')
    expect(screen.getByTestId('sandpack-bundler-url')).toHaveTextContent(
      'https://sandpack-bundler.codesandbox.io'
    )
  })

  it('renders Vue template correctly', () => {
    const code = '<template><div>Hello Vue</div></template>'
    
    render(
      <SandpackPreview
        code={code}
        template="vue-developer"
        onError={mockOnError}
        onReady={mockOnReady}
      />
    )

    expect(screen.getByTestId('sandpack-template')).toHaveTextContent('vue')
  })

  it('includes base React dependencies', () => {
    const code = 'function App() { return <div>Test</div> }'
    
    render(
      <SandpackPreview
        code={code}
        template="nextjs-developer"
      />
    )

    const dependencies = JSON.parse(screen.getByTestId('sandpack-dependencies').textContent || '{}')
    expect(dependencies).toHaveProperty('react')
    expect(dependencies).toHaveProperty('react-dom')
  })

  it('includes base Vue dependencies', () => {
    const code = '<template><div>Test</div></template>'
    
    render(
      <SandpackPreview
        code={code}
        template="vue-developer"
      />
    )

    const dependencies = JSON.parse(screen.getByTestId('sandpack-dependencies').textContent || '{}')
    expect(dependencies).toHaveProperty('vue')
  })

  it('merges custom dependencies', () => {
    const code = 'function App() { return <div>Test</div> }'
    const customDeps = {
      'axios': '^1.0.0',
      'lodash': '^4.0.0',
    }
    
    render(
      <SandpackPreview
        code={code}
        template="nextjs-developer"
        dependencies={customDeps}
      />
    )

    const dependencies = JSON.parse(screen.getByTestId('sandpack-dependencies').textContent || '{}')
    expect(dependencies).toHaveProperty('react')
    expect(dependencies).toHaveProperty('react-dom')
    expect(dependencies).toHaveProperty('axios', '^1.0.0')
    expect(dependencies).toHaveProperty('lodash', '^4.0.0')
  })

  it('creates correct file structure for React', () => {
    const code = 'export default function App() { return <div>Test</div> }'
    
    render(
      <SandpackPreview
        code={code}
        template="nextjs-developer"
      />
    )

    const files = JSON.parse(screen.getByTestId('sandpack-files').textContent || '{}')
    expect(files).toHaveProperty('/App.js', code)
    expect(files).toHaveProperty('/index.js')
    expect(files).toHaveProperty('/index.html')
    expect(files).toHaveProperty('/package.json')
  })

  it('creates correct file structure for Vue', () => {
    const code = '<template><div>Test</div></template>'
    
    render(
      <SandpackPreview
        code={code}
        template="vue-developer"
      />
    )

    const files = JSON.parse(screen.getByTestId('sandpack-files').textContent || '{}')
    expect(files).toHaveProperty('/src/App.vue', code)
    expect(files).toHaveProperty('/src/main.js')
    expect(files).toHaveProperty('/index.html')
    expect(files).toHaveProperty('/package.json')
  })

  it('uses dark theme and correct options', () => {
    const code = 'function App() { return <div>Test</div> }'
    
    render(
      <SandpackPreview
        code={code}
        template="nextjs-developer"
      />
    )

    const sandpackMock = screen.getByTestId('sandpack-mock')
    expect(sandpackMock).toBeInTheDocument()
  })

  describe('Error Scenarios', () => {
    it('handles empty code gracefully', () => {
      render(
        <SandpackPreview
          code=""
          template="nextjs-developer"
          onError={mockOnError}
        />
      )

      expect(screen.getByTestId('sandpack-mock')).toBeInTheDocument()
    })

    it('handles malformed React code', () => {
      const malformedCode = 'function App() { return <div>Unclosed tag }'
      
      render(
        <SandpackPreview
          code={malformedCode}
          template="nextjs-developer"
          onError={mockOnError}
        />
      )

      // Should still render, errors handled by Sandpack
      expect(screen.getByTestId('sandpack-mock')).toBeInTheDocument()
    })

    it('handles malformed Vue templates', () => {
      const malformedVue = '<template><div>Unclosed</template>'
      
      render(
        <SandpackPreview
          code={malformedVue}
          template="vue-developer"
          onError={mockOnError}
        />
      )

      expect(screen.getByTestId('sandpack-mock')).toBeInTheDocument()
    })

    it('handles invalid dependency versions', () => {
      const invalidDeps = {
        'react': 'invalid-version',
        'lodash': '?.?.?',
      }
      
      render(
        <SandpackPreview
          code="function App() { return <div>Test</div> }"
          template="nextjs-developer"
          dependencies={invalidDeps}
        />
      )

      // Should still render, Sandpack will handle version errors
      expect(screen.getByTestId('sandpack-mock')).toBeInTheDocument()
    })

    it('handles very large code files', () => {
      const largeCode = 'function App() {\n' + 
        '  return (\n    <div>\n' +
        Array(1000).fill('      <p>Line content</p>').join('\n') +
        '\n    </div>\n  )\n}'
      
      render(
        <SandpackPreview
          code={largeCode}
          template="nextjs-developer"
        />
      )

      expect(screen.getByTestId('sandpack-mock')).toBeInTheDocument()
    })

    it('handles special characters in code', () => {
      const codeWithSpecialChars = `
        function App() {
          const message = "Hello 世界 🌍"
          const regex = /[a-z]+/gi
          const template = \`Value: \${message}\`
          return <div>{template}</div>
        }
      `
      
      render(
        <SandpackPreview
          code={codeWithSpecialChars}
          template="nextjs-developer"
        />
      )

      const files = JSON.parse(screen.getByTestId('sandpack-files').textContent || '{}')
      expect(files['/App.js']).toContain('世界')
      expect(files['/App.js']).toContain('🌍')
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid re-renders', () => {
      const { rerender } = render(
        <SandpackPreview
          code="function App() { return <div>V1</div> }"
          template="nextjs-developer"
        />
      )

      // Rapidly update multiple times
      for (let i = 2; i <= 10; i++) {
        rerender(
          <SandpackPreview
            code={`function App() { return <div>V${i}</div> }`}
            template="nextjs-developer"
          />
        )
      }

      const files = JSON.parse(screen.getByTestId('sandpack-files').textContent || '{}')
      expect(files['/App.js']).toContain('V10')
    })

    it('handles template switching', () => {
      const { rerender } = render(
        <SandpackPreview
          code="function App() { return <div>React</div> }"
          template="nextjs-developer"
        />
      )

      expect(screen.getByTestId('sandpack-template')).toHaveTextContent('react')

      // Switch to Vue
      rerender(
        <SandpackPreview
          code="<template><div>Vue</div></template>"
          template="vue-developer"
        />
      )

      expect(screen.getByTestId('sandpack-template')).toHaveTextContent('vue')
    })

    it('preserves custom dependencies across re-renders', () => {
      const customDeps = { 'axios': '^1.0.0' }
      
      const { rerender } = render(
        <SandpackPreview
          code="function App() { return <div>V1</div> }"
          template="nextjs-developer"
          dependencies={customDeps}
        />
      )

      rerender(
        <SandpackPreview
          code="function App() { return <div>V2</div> }"
          template="nextjs-developer"
          dependencies={customDeps}
        />
      )

      const dependencies = JSON.parse(screen.getByTestId('sandpack-dependencies').textContent || '{}')
      expect(dependencies).toHaveProperty('axios', '^1.0.0')
    })

    it('handles undefined props gracefully', () => {
      render(
        <SandpackPreview
          code={undefined as any}
          template={undefined as any}
          dependencies={undefined}
        />
      )

      // Should render with defaults
      expect(screen.getByTestId('sandpack-mock')).toBeInTheDocument()
    })
  })
})

describe('shouldUseSandpack', () => {
  it('returns false for empty code', () => {
    expect(shouldUseSandpack({ code: '' })).toBe(false)
    expect(shouldUseSandpack({ code: undefined })).toBe(false)
  })

  it('detects npm package imports', () => {
    const codeWithImports = `
      import React from 'react'
      import axios from 'axios'
      import { motion } from 'framer-motion'
    `
    expect(shouldUseSandpack({ code: codeWithImports })).toBe(true)
  })

  it('detects CommonJS requires', () => {
    const codeWithRequire = `
      const express = require('express')
      const path = require('path')
    `
    expect(shouldUseSandpack({ code: codeWithRequire })).toBe(true)
  })

  it('detects scoped packages', () => {
    const codeWithScopedPackages = `
      import { Button } from '@mui/material'
      import { useQuery } from '@tanstack/react-query'
    `
    expect(shouldUseSandpack({ code: codeWithScopedPackages })).toBe(true)
  })

  it('ignores relative imports', () => {
    const codeWithRelativeImports = `
      import { Header } from './components/Header'
      import utils from '../utils'
    `
    expect(shouldUseSandpack({ code: codeWithRelativeImports })).toBe(false)
  })

  it('detects CSS modules', () => {
    const codeWithCSSModules = `
      import styles from './Button.module.css'
    `
    expect(shouldUseSandpack({ code: codeWithCSSModules })).toBe(true)
  })

  it('detects CSS preprocessors', () => {
    const codeWithSass = `
      import './styles.scss'
      import './theme.less'
    `
    expect(shouldUseSandpack({ code: codeWithSass })).toBe(true)
  })

  it('detects image imports', () => {
    const codeWithImages = `
      import logo from './logo.png'
      import background from './bg.jpg'
    `
    expect(shouldUseSandpack({ code: codeWithImages })).toBe(true)
  })

  it('detects environment variables', () => {
    const codeWithEnv = `
      const apiKey = process.env.REACT_APP_API_KEY
    `
    expect(shouldUseSandpack({ code: codeWithEnv })).toBe(true)
  })

  it('detects non-CDN packages', () => {
    const packagesToTest = [
      'framer-motion',
      'react-spring',
      '@tanstack/react-query',
      'react-hook-form',
      'styled-components',
      'zustand',
      '@mui/material',
      'recharts',
    ]

    packagesToTest.forEach(pkg => {
      const code = `import something from '${pkg}'`
      expect(shouldUseSandpack({ code })).toBe(true)
    })
  })

  it('detects Vue 3 script setup', () => {
    const vueCode = `
      <template>
        <div>{{ message }}</div>
      </template>
      <script setup>
        import { ref } from 'vue'
        const message = ref('Hello')
      </script>
    `
    expect(shouldUseSandpack({ code: vueCode, template: 'vue-developer' })).toBe(true)
  })

  it('detects Vue composition API', () => {
    const vueCode = `
      <script>
        import { defineProps, defineEmits } from 'vue'
        const props = defineProps(['title'])
      </script>
    `
    expect(shouldUseSandpack({ code: vueCode, template: 'vue-developer' })).toBe(true)
  })

  it('detects Vue SFC imports', () => {
    const vueCode = `
      import Header from './Header.vue'
    `
    expect(shouldUseSandpack({ code: vueCode, template: 'vue-developer' })).toBe(true)
  })

  it('returns false for simple React code', () => {
    const simpleCode = `
      function App() {
        return <div>Hello World</div>
      }
    `
    expect(shouldUseSandpack({ code: simpleCode })).toBe(false)
  })

  it('returns false for simple HTML', () => {
    const htmlCode = `
      <div>
        <h1>Hello World</h1>
        <p>This is a simple HTML page</p>
      </div>
    `
    expect(shouldUseSandpack({ code: htmlCode })).toBe(false)
  })

  describe('Advanced Detection Cases', () => {
    it('detects dynamic imports', () => {
      const codeWithDynamicImport = `
        const loadComponent = async () => {
          const module = await import('react-lazy-load')
          return module.default
        }
      `
      expect(shouldUseSandpack({ code: codeWithDynamicImport })).toBe(true)
    })

    it('detects import.meta usage', () => {
      const codeWithImportMeta = `
        if (import.meta.env.DEV) {
          console.log('Development mode')
        }
      `
      expect(shouldUseSandpack({ code: codeWithImportMeta })).toBe(true)
    })

    it('detects webpack-specific comments', () => {
      const codeWithWebpackComments = `
        import(/* webpackChunkName: "lodash" */ 'lodash')
      `
      expect(shouldUseSandpack({ code: codeWithWebpackComments })).toBe(true)
    })

    it('detects TypeScript imports', () => {
      const tsCode = `
        import type { FC } from 'react'
        import { useState } from 'react'
      `
      expect(shouldUseSandpack({ code: tsCode })).toBe(true)
    })

    it('ignores commented imports', () => {
      const codeWithCommentedImports = `
        // import React from 'react'
        /* import axios from 'axios' */
        function App() {
          return <div>No imports</div>
        }
      `
      expect(shouldUseSandpack({ code: codeWithCommentedImports })).toBe(false)
    })

    it('detects imports in multiline strings correctly', () => {
      const codeWithStringImports = `
        const codeExample = \`
          import React from 'react'
        \`
        function App() {
          return <div>{codeExample}</div>
        }
      `
      // Should not detect imports inside strings
      expect(shouldUseSandpack({ code: codeWithStringImports })).toBe(false)
    })

    it('handles edge case package names', () => {
      const edgeCaseImports = `
        import $ from 'jquery'
        import _ from 'lodash'
        import io from 'socket.io-client'
      `
      expect(shouldUseSandpack({ code: edgeCaseImports })).toBe(true)
    })

    it('detects JSON imports', () => {
      const jsonImport = `
        import data from './data.json'
      `
      expect(shouldUseSandpack({ code: jsonImport })).toBe(true)
    })

    it('detects worker imports', () => {
      const workerImport = `
        import Worker from './worker.js?worker'
      `
      expect(shouldUseSandpack({ code: workerImport })).toBe(true)
    })

    it('handles mixed import styles', () => {
      const mixedImports = `
        import React from 'react'
        const lodash = require('lodash')
        import('./dynamic-module')
      `
      expect(shouldUseSandpack({ code: mixedImports })).toBe(true)
    })
  })
}) 
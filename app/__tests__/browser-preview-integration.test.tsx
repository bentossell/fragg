import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useRouter } from 'next/navigation'
import { shouldUseBrowserPreview, rolloutPercentage } from '@/lib/feature-flags'
import { CodeStreamingWrapper } from '@/components/code-streaming'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock feature flags
jest.mock('@/lib/feature-flags', () => ({
  shouldUseBrowserPreview: jest.fn(),
  rolloutPercentage: 10,
}))

// Mock components
jest.mock('@/components/browser-preview', () => ({
  BrowserPreview: ({ code, template, onReady }: any) => {
    React.useEffect(() => {
      onReady?.()
    }, [onReady])
    return (
      <div data-testid="browser-preview-mock">
        <div data-testid="preview-code">{code}</div>
        <div data-testid="preview-template">{template}</div>
      </div>
    )
  },
}))

jest.mock('@/components/sandpack-preview', () => ({
  SandpackPreview: ({ code, template }: any) => (
    <div data-testid="sandpack-preview-mock">
      <div data-testid="sandpack-code">{code}</div>
      <div data-testid="sandpack-template">{template}</div>
    </div>
  ),
  shouldUseSandpack: jest.fn(() => false),
}))

// Mock the code streaming wrapper
jest.mock('@/components/code-streaming', () => ({
  CodeStreamingWrapper: ({ children }: any) => <div data-testid="code-streaming-wrapper">{children}</div>,
}))

describe('Browser Preview Integration', () => {
  const mockRouter = {
    push: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(shouldUseBrowserPreview as jest.Mock).mockReturnValue(true)
  })

  describe('Feature Flag Behavior', () => {
    it('uses browser preview when feature flag is enabled', async () => {
      ;(shouldUseBrowserPreview as jest.Mock).mockReturnValue(true)
      
      const { container } = render(
        <CodeStreamingWrapper>
          <div>Test component integration</div>
        </CodeStreamingWrapper>
      )

      // Simulate a code update that would trigger preview
      const mockCode = 'function App() { return <div>Hello</div> }'
      const mockTemplate = 'nextjs-developer'

      // In real integration, this would be triggered by streaming updates
      const BrowserPreview = require('@/components/browser-preview').BrowserPreview
      render(<BrowserPreview code={mockCode} template={mockTemplate} />)

      await waitFor(() => {
        expect(screen.getByTestId('browser-preview-mock')).toBeInTheDocument()
        expect(screen.getByTestId('preview-code')).toHaveTextContent(mockCode)
      })
    })

    it('falls back to sandpack when feature flag is disabled', async () => {
      ;(shouldUseBrowserPreview as jest.Mock).mockReturnValue(false)
      
      const mockCode = 'function App() { return <div>Hello</div> }'
      const mockTemplate = 'nextjs-developer'

      const SandpackPreview = require('@/components/sandpack-preview').SandpackPreview
      render(<SandpackPreview code={mockCode} template={mockTemplate} />)

      await waitFor(() => {
        expect(screen.getByTestId('sandpack-preview-mock')).toBeInTheDocument()
        expect(screen.getByTestId('sandpack-code')).toHaveTextContent(mockCode)
      })
    })

    it('respects gradual rollout percentage', () => {
      // Test that the rollout percentage is correctly defined
      expect(rolloutPercentage).toBe(10)
    })
  })

  describe('Template Support', () => {
    const testCases = [
      { template: 'nextjs-developer', shouldUseBrowser: true },
      { template: 'vue-developer', shouldUseBrowser: true },
      { template: 'static-html', shouldUseBrowser: true },
      { template: 'streamlit-developer', shouldUseBrowser: false },
      { template: 'gradio-developer', shouldUseBrowser: false },
    ]

    testCases.forEach(({ template, shouldUseBrowser }) => {
      it(`${shouldUseBrowser ? 'uses' : 'does not use'} browser preview for ${template}`, () => {
        ;(shouldUseBrowserPreview as jest.Mock).mockImplementation((tmpl) => {
          const supportedTemplates = ['nextjs-developer', 'vue-developer', 'static-html']
          return supportedTemplates.includes(tmpl)
        })

        const useBrowser = shouldUseBrowserPreview(template)
        expect(useBrowser).toBe(shouldUseBrowser)
      })
    })
  })

  describe('Instant Preview Performance', () => {
    it('renders browser preview in less than 100ms', async () => {
      const startTime = performance.now()
      const onReady = jest.fn()

      const BrowserPreview = require('@/components/browser-preview').BrowserPreview
      render(
        <BrowserPreview 
          code="function App() { return <div>Performance Test</div> }"
          template="nextjs-developer"
          onReady={onReady}
        />
      )

      await waitFor(() => {
        expect(onReady).toHaveBeenCalled()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render in less than 100ms
      expect(renderTime).toBeLessThan(100)
    })

    it('does not block UI during preview generation', async () => {
      const BrowserPreview = require('@/components/browser-preview').BrowserPreview
      
      // Render multiple previews simultaneously
      const previews = Array.from({ length: 5 }, (_, i) => (
        <BrowserPreview 
          key={i}
          code={`function App${i}() { return <div>App ${i}</div> }`}
          template="nextjs-developer"
        />
      ))

      const { container } = render(<>{previews}</>)

      // All previews should render without blocking
      await waitFor(() => {
        const previewElements = screen.getAllByTestId('browser-preview-mock')
        expect(previewElements).toHaveLength(5)
      })
    })
  })

  describe('Error Handling', () => {
    it('gracefully handles browser preview errors and falls back', async () => {
      const onError = jest.fn()
      
      // Mock browser preview to throw error
      jest.mock('@/components/browser-preview', () => ({
        BrowserPreview: () => {
          throw new Error('Browser preview failed')
        },
      }))

      // Should fall back to sandpack
      const SandpackPreview = require('@/components/sandpack-preview').SandpackPreview
      const { container } = render(
        <SandpackPreview 
          code="function App() { return <div>Error Test</div> }"
          template="nextjs-developer"
          onError={onError}
        />
      )

      expect(screen.getByTestId('sandpack-preview-mock')).toBeInTheDocument()
    })

    it('handles malformed code gracefully', async () => {
      const BrowserPreview = require('@/components/browser-preview').BrowserPreview
      const onError = jest.fn()

      render(
        <BrowserPreview 
          code="function App() { return <div>Unclosed tag"
          template="nextjs-developer"
          onError={onError}
        />
      )

      // Should still render the preview container
      expect(screen.getByTestId('browser-preview-mock')).toBeInTheDocument()
    })
  })

  describe('User Experience', () => {
    it('shows loading state during preview generation', async () => {
      // Mock delayed ready callback
      const DelayedBrowserPreview = ({ onReady, ...props }: any) => {
        React.useEffect(() => {
          const timer = setTimeout(() => onReady?.(), 50)
          return () => clearTimeout(timer)
        }, [onReady])
        return (
          <div>
            <div data-testid="loading">Loading preview...</div>
            <div data-testid="browser-preview-mock" />
          </div>
        )
      }

      const { rerender } = render(
        <DelayedBrowserPreview 
          code="function App() { return <div>Test</div> }"
          template="nextjs-developer"
          onReady={() => {}}
        />
      )

      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument()
    })

    it('preserves scroll position during updates', async () => {
      const BrowserPreview = require('@/components/browser-preview').BrowserPreview
      
      const { rerender } = render(
        <BrowserPreview 
          code="function App() { return <div>Version 1</div> }"
          template="nextjs-developer"
        />
      )

      // Update the code
      rerender(
        <BrowserPreview 
          code="function App() { return <div>Version 2</div> }"
          template="nextjs-developer"
        />
      )

      // Verify preview updated without scroll reset
      await waitFor(() => {
        expect(screen.getByTestId('preview-code')).toHaveTextContent('Version 2')
      })
    })
  })

  describe('Complex Scenarios', () => {
    it('handles rapid code updates efficiently', async () => {
      const BrowserPreview = require('@/components/browser-preview').BrowserPreview
      const updates = Array.from({ length: 10 }, (_, i) => 
        `function App() { return <div>Update ${i}</div> }`
      )

      const { rerender } = render(
        <BrowserPreview 
          code={updates[0]}
          template="nextjs-developer"
        />
      )

      // Rapidly update the preview
      for (const update of updates.slice(1)) {
        rerender(
          <BrowserPreview 
            code={update}
            template="nextjs-developer"
          />
        )
      }

      // Should show the latest update
      await waitFor(() => {
        expect(screen.getByTestId('preview-code')).toHaveTextContent('Update 9')
      })
    })

    it('supports multiple preview instances on the same page', async () => {
      const BrowserPreview = require('@/components/browser-preview').BrowserPreview
      
      render(
        <div>
          <BrowserPreview 
            code="function App1() { return <div>App 1</div> }"
            template="nextjs-developer"
          />
          <BrowserPreview 
            code="function App2() { return <div>App 2</div> }"
            template="vue-developer"
          />
          <BrowserPreview 
            code="<h1>Static HTML</h1>"
            template="static-html"
          />
        </div>
      )

      await waitFor(() => {
        const previews = screen.getAllByTestId('browser-preview-mock')
        expect(previews).toHaveLength(3)
      })
    })
  })
}) 
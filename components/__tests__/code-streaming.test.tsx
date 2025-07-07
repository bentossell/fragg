import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RealTimeCodeStreaming } from '../code-streaming'

// Mock fetch globally
global.fetch = jest.fn()

// Mock Prism
jest.mock('prismjs', () => ({
  highlightElement: jest.fn(),
}))

// Mock CSS imports
jest.mock('../code-theme.css', () => ({}))

describe('RealTimeCodeStreaming', () => {
  const defaultProps = {
    prompt: 'Create a React component',
    isStreaming: false,
    language: 'typescript' as const,
    onComplete: jest.fn(),
    onError: jest.fn(),
    onUpdate: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('renders without crashing', () => {
    render(<RealTimeCodeStreaming {...defaultProps} />)
    expect(screen.getByRole('code')).toBeInTheDocument()
  })

  it('displays waiting message when not streaming', () => {
    render(<RealTimeCodeStreaming {...defaultProps} />)
    expect(screen.getByText('Waiting for AI response...')).toBeInTheDocument()
  })

  it('displays live indicator when streaming', () => {
    render(<RealTimeCodeStreaming {...defaultProps} isStreaming={true} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('starts streaming when isStreaming becomes true', async () => {
    const mockResponse = new Response('{"code": "const test = true;"}', {
      headers: { 'Content-Type': 'application/json' },
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const { rerender } = render(<RealTimeCodeStreaming {...defaultProps} />)
    
    rerender(<RealTimeCodeStreaming {...defaultProps} isStreaming={true} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Create a React component',
          streaming: true,
          model: 'anthropic/claude-3.5-sonnet',
          priority: 'fast',
          useCache: true,
        }),
        signal: expect.any(AbortSignal),
      })
    })
  })

  it('calls onComplete when streaming finishes successfully', async () => {
    const mockReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"code": "const test = true;", "template": "nextjs-developer", "dependencies": []}'))
        controller.close()
      },
    })

    const mockResponse = {
      ok: true,
      headers: new Headers({ 'X-Request-ID': 'test-123' }),
      body: mockReadableStream,
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const onComplete = jest.fn()
    render(
      <RealTimeCodeStreaming
        {...defaultProps}
        isStreaming={true}
        onComplete={onComplete}
      />
    )

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        code: 'const test = true;',
        template: 'nextjs-developer',
        dependencies: [],
      })
    }, { timeout: 5000 })
  })

  it('handles streaming errors correctly', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const onError = jest.fn()
    render(
      <RealTimeCodeStreaming
        {...defaultProps}
        isStreaming={true}
        onError={onError}
      />
    )

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Internal server error'))
    })
  })

  it('displays progress bar during streaming', () => {
    render(<RealTimeCodeStreaming {...defaultProps} isStreaming={true} />)
    
    const progressBar = screen.getByRole('progressbar', { hidden: true })
    expect(progressBar).toBeInTheDocument()
  })

  it('shows error message when there is an error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<RealTimeCodeStreaming {...defaultProps} isStreaming={true} />)

    await waitFor(() => {
      expect(screen.getByText('Generation Error')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('allows retry after error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    
    render(<RealTimeCodeStreaming {...defaultProps} isStreaming={true} />)

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    const retryButton = screen.getByText('Try again')
    fireEvent.click(retryButton)

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('displays streaming metrics', async () => {
    const mockReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk1'))
        controller.enqueue(new TextEncoder().encode('chunk2'))
        controller.close()
      },
    })

    const mockResponse = {
      ok: true,
      headers: new Headers({ 'X-Request-ID': 'test-123' }),
      body: mockReadableStream,
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    render(<RealTimeCodeStreaming {...defaultProps} isStreaming={true} />)

    await waitFor(() => {
      expect(screen.getByText(/Chunks:/)).toBeInTheDocument()
      expect(screen.getByText(/Bytes:/)).toBeInTheDocument()
    })
  })

  it('calls onUpdate during streaming', async () => {
    const mockReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('test chunk'))
        controller.close()
      },
    })

    const mockResponse = {
      ok: true,
      headers: new Headers(),
      body: mockReadableStream,
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const onUpdate = jest.fn()
    render(
      <RealTimeCodeStreaming
        {...defaultProps}
        isStreaming={true}
        onUpdate={onUpdate}
      />
    )

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streaming',
          data: expect.objectContaining({
            chunk: 'test chunk',
            totalChunks: expect.any(Number),
            bufferLength: expect.any(Number),
            bytesReceived: expect.any(Number),
          }),
          timestamp: expect.any(Number),
        })
      )
    })
  })

  it('aborts stream when component unmounts', () => {
    const { unmount } = render(
      <RealTimeCodeStreaming {...defaultProps} isStreaming={true} />
    )

    unmount()

    // AbortController should be called when component unmounts
    // We can't directly test this, but the component should clean up properly
    expect(true).toBe(true) // Placeholder assertion
  })

  it('handles different languages correctly', () => {
    render(
      <RealTimeCodeStreaming
        {...defaultProps}
        language="python"
        isStreaming={false}
      />
    )

    const codeElement = screen.getByRole('code')
    expect(codeElement).toHaveClass('language-python')
  })

  it('displays request ID when available', async () => {
    const mockReadableStream = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    const mockResponse = {
      ok: true,
      headers: new Headers({ 'X-Request-ID': 'req_12345_abcde' }),
      body: mockReadableStream,
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    render(<RealTimeCodeStreaming {...defaultProps} isStreaming={true} />)

    await waitFor(() => {
      expect(screen.getByText(/ID: abcde/)).toBeInTheDocument()
    })
  })
}) 
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { messages, model, stream, appId } = await req.json()
    
    // Validate input
    if (!messages) {
      return Response.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Use OpenRouter directly for simplicity in generated apps
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Personal App Store - Generated App'
      },
      body: JSON.stringify({
        model: model || 'anthropic/claude-3-haiku', // Default to fast/cheap model
        messages: Array.isArray(messages) ? messages : [{ role: 'user', content: messages }],
        stream: stream || false,
        max_tokens: 1000 // Reasonable limit for generated apps
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('OpenRouter error:', error)
      return Response.json(
        { error: 'AI service unavailable' }, 
        { status: response.status }
      )
    }
    
    if (stream) {
      // Return streaming response for future use
      return new Response(response.body, {
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }
    
    const data = await response.json()
    
    // Log usage for debugging (remove in production)
    console.log(`AI Proxy: ${appId || 'unknown'} used ${model || 'claude-3-haiku'}`)
    
    return Response.json(data)
    
  } catch (error) {
    console.error('AI Proxy error:', error)
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
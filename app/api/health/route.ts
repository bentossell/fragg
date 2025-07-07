import { singleActiveSandboxManager } from '@/archive/sandbox/single-active-manager'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const activeSessionId = singleActiveSandboxManager.getCurrentSessionId()

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: Math.round(
          (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) *
            100,
        ),
      },
      sandbox: {
        active: !!activeSessionId,
        sessionId: activeSessionId || null,
      },
    }

    return NextResponse.json(health)
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

// HEAD request for quick health checks
export async function HEAD() {
  try {
    const activeSessionId = singleActiveSandboxManager.getCurrentSessionId()

    return new Response(null, {
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'X-Sandbox-Active': activeSessionId ? 'true' : 'false',
        'X-Timestamp': new Date().toISOString(),
      },
    })
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'unhealthy',
        'X-Error': error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
} 
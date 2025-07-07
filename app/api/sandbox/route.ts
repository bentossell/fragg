import { NextRequest, NextResponse } from 'next/server'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultWeb, ExecutionResultInterpreter } from '@/lib/types'
import { Sandbox } from '@e2b/code-interpreter'
import { injectAI } from '@/lib/inject-ai'
import { sandboxReconnectionManager } from '@/archive/sandbox/reconnect'
import { singleActiveSandboxManager } from '@/archive/sandbox/single-active-manager'
import { getTemplate, TemplateId } from '@/lib/templates'
import { appSandboxManager } from '@/archive/sandbox/app-sandbox-manager'
import { getSandboxConfig } from '@/lib/sandbox-config'

export const maxDuration = 300 // 5 minutes to allow for longer sandbox operations

async function startAppAndGetURL(
  sbx: Sandbox,
  fragment: FragmentSchema,
  isReused: boolean,
): Promise<string> {
  const port = fragment.port || 3000 // Default to 3000, adjust if needed
  let url = ''

  if (isReused) {
    try {
      const host = await sbx.getHost(port)
      if (host) {
        url = `https://${host}`
        console.log(`Reused sandbox already has app at: ${url}`)
        // Quick check to see if it's alive with a timeout
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
          if (res.ok || res.status < 500) {
            console.log(`✅ Reused app is still running at ${url}`)
            return url
          }
          console.log(`Reused app returned status ${res.status}, will restart`)
        } catch (fetchError) {
          console.log(`Could not reach reused app: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
        }
      }
    } catch (e) {
      console.log('Could not get host for reused sandbox, will try starting app again.')
    }
  }

  const templateInfo = getTemplate(fragment.template as TemplateId)
  if (!templateInfo?.start_cmd) {
    throw new Error(`No start command found for template ${fragment.template}`)
  }

  // Kill any existing processes on the port to ensure clean startup
  try {
    console.log(`Killing any existing processes on port ${port}...`)
    await sbx.commands.run(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
      user: 'root',
      cwd: '/home/user',
    })
    // Give it a moment to clean up
    await new Promise(resolve => setTimeout(resolve, 1000))
  } catch (killError) {
    console.log('No existing processes to kill or kill failed:', killError)
  }

  console.log(`Starting app with command: ${templateInfo.start_cmd}`)
  await sbx.commands.run(templateInfo.start_cmd, {
    onStdout: (data) => console.log('[Sandbox STDOUT]', data),
    onStderr: (data) => console.error('[Sandbox STDERR]', data),
    user: 'root',
    cwd: '/home/user',
  })
  console.log(`App start command executed`)

  // Wait for the app to start and get the URL
  let retries = 0
  const config = getSandboxConfig()
  const maxRetries = config.startupRetries
  const retryDelay = config.startupRetryDelayMs
  
  console.log(`Waiting for app to start on port ${port}...`)
  
  while (retries < maxRetries) {
    try {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      const host = await sbx.getHost(port)
      if (host) {
        url = `https://${host}`
        console.log(`Checking ${url} for live status... (attempt ${retries + 1}/${maxRetries})`)
        const res = await fetch(url, { 
          signal: AbortSignal.timeout(5000) // 5 second timeout for fetch
        })
        if (res.ok || res.status < 500) {
          console.log(`✅ Site is live: ${url}`)
          return url
        }
        console.log(`App returned status ${res.status}, still waiting...`)
      } else {
        console.log(`Port ${port} not available yet... (attempt ${retries + 1}/${maxRetries})`)
      }
    } catch (error) {
      console.log(`App not ready yet: ${error instanceof Error ? error.message : 'Unknown error'} (attempt ${retries + 1}/${maxRetries})`)
    }
    retries++
  }

  throw new Error(`App failed to start after ${maxRetries * retryDelay / 1000} seconds. This might be due to: 1) Dependencies still installing, 2) Build errors, 3) Runtime errors. Check the sandbox logs for details.`)
}

export async function POST(req: Request) {
  const { fragment, sessionId, appId }: { fragment: FragmentSchema; sessionId?: string; appId?: string } =
    await req.json()

  console.log('POST /api/sandbox')
  console.log('Template:', fragment.template)
  console.log('SessionID:', sessionId)
  console.log('AppID:', appId)

  // Ensure a session ID exists
  const effectiveSessionId = sessionId || `anon-session-${Date.now()}`

  try {
    let sbx: Sandbox
    let isNew: boolean
    let needsRestart: boolean = true
    let cachedUrl: string | undefined

    // If we have an appId, use app-specific sandbox management
    if (appId) {
      console.log(`🔄 Getting app sandbox for appId: ${appId}`)
      try {
        const appSandboxResult = await appSandboxManager.getAppSandbox(appId, fragment)
        sbx = appSandboxResult.sandbox
        isNew = appSandboxResult.isNew
        needsRestart = appSandboxResult.needsRestart
        cachedUrl = appSandboxResult.url
        
        console.log(
          `📱 App ${appId}: ${isNew ? 'new sandbox' : 'existing sandbox'}, ` +
          `needs restart: ${needsRestart}, cached URL: ${cachedUrl || 'none'}`
        )
      } catch (sandboxError: any) {
        if (sandboxError.message?.includes('timeout') || sandboxError.message?.includes('deadline_exceeded')) {
          throw new Error(
            `Sandbox creation timed out. This can happen when:\n` +
            `1. The E2B service is experiencing high load\n` +
            `2. Network connectivity issues\n` +
            `3. Template initialization is taking longer than expected\n\n` +
            `Please try again in a moment. Original error: ${sandboxError.message}`
          )
        }
        throw sandboxError
      }
    } else {
      // Fallback to regular sandbox management
      console.log(`🔄 Getting session sandbox for sessionId: ${effectiveSessionId}`)
      try {
        const result = await sandboxReconnectionManager.getOrCreateSandbox(
          effectiveSessionId,
          fragment.template as TemplateId,
        )
        sbx = result.sandbox
        isNew = result.isNew
      } catch (sandboxError: any) {
        if (sandboxError.message?.includes('timeout') || sandboxError.message?.includes('deadline_exceeded')) {
          throw new Error(
            `Sandbox creation timed out. This can happen when:\n` +
            `1. The E2B service is experiencing high load\n` +
            `2. Network connectivity issues\n` +
            `3. Template initialization is taking longer than expected\n\n` +
            `Please try again in a moment. Original error: ${sandboxError.message}`
          )
        }
        throw sandboxError
      }
    }

    console.log(
      `${isNew ? '🆕 Created' : '♻️ Reusing'} sandbox ${sbx.sandboxId} for session ${effectiveSessionId}`,
    )

    // 1. Install dependencies (only for new sandboxes)
    if (isNew && fragment.has_additional_dependencies) {
      console.log('Installing dependencies...')
      await sbx.commands.run(fragment.install_dependencies_command)
      
      // Mark sandbox as having installed dependencies
      const { sandboxPool } = await import('@/archive/sandbox/sandbox-pool')
      sandboxPool.markDependenciesInstalled(sbx.sandboxId)
    }

    // 2. Check if we can skip code writing and app restart
    if (appId && !needsRestart && cachedUrl) {
      // App is already running with same code - instant return!
      console.log(`⚡ Instant response - app already running at ${cachedUrl}`)
      const result: ExecutionResultWeb = {
        sbxId: sbx.sandboxId,
        url: cachedUrl,
        template: fragment.template as Exclude<TemplateId, 'code-interpreter-v1'>,
      }
      return NextResponse.json(result)
    }

    // 3. Inject AI capabilities and write the code
    const codeWithAI = injectAI(fragment.code, fragment.template)
    await sbx.files.write(fragment.file_path, codeWithAI)
    console.log(`Wrote file to ${fragment.file_path}`)

    // 4. Handle execution based on template type
    if (fragment.template === 'code-interpreter-v1') {
       const { logs, error, results } = await sbx.runCode(fragment.code)
      const result: ExecutionResultInterpreter = {
        sbxId: sbx.sandboxId,
        template: 'code-interpreter-v1',
        stdout: logs.stdout,
        stderr: logs.stderr,
        runtimeError: error,
        cellResults: results,
      }
      return NextResponse.json(result)
    } else {
      // For web apps, start the app and get the URL
      // Only consider it "reused" if it's not new AND doesn't need restart
      const isReused = !isNew && !needsRestart
      const url = await startAppAndGetURL(sbx, fragment, isReused)
      
      // Cache the URL for this app
      if (appId) {
        appSandboxManager.setAppUrl(appId, url)
      }
      
      const result: ExecutionResultWeb = {
        sbxId: sbx.sandboxId,
        url: url,
        template: fragment.template as Exclude<TemplateId, 'code-interpreter-v1'>,
      }
      return NextResponse.json(result)
    }
  } catch (error: any) {
    console.error('Sandbox error:', error)
    return new Response(
      JSON.stringify({
        error: 'Sandbox Operation Failed',
        details: error.message,
      }),
      { status: 500 },
    )
  }
}

// Endpoint to release a session's sandbox
export async function DELETE(req: Request) {
  const { sessionId, appId } = await req.json()
  console.log('DELETE /api/sandbox for session:', sessionId, 'app:', appId)

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
      status: 400,
    })
  }

  try {
    // If we have an appId, just release it (keep it running)
    if (appId) {
      appSandboxManager.releaseApp(appId)
      return NextResponse.json({
        success: true,
        message: `App ${appId} released but kept running for instant access.`,
      })
    }
    
    // Otherwise, use the regular release flow
    if (singleActiveSandboxManager.isActive(sessionId)) {
      await singleActiveSandboxManager.closeCurrent()
      return NextResponse.json({
        success: true,
        message: `Session ${sessionId} released.`,
      })
    } else {
      // It's not an error if the session isn't active, it might have been replaced already.
      return NextResponse.json({
        success: true,
        message: `Session ${sessionId} was not the active session, no action taken.`,
      })
    }
  } catch (error: any) {
    console.error('Failed to release session:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to release session', details: error.message }),
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultWeb, ExecutionResultInterpreter } from '@/lib/types'
import { Sandbox } from '@e2b/code-interpreter'
import { injectAI } from '@/lib/inject-ai'
import { sandboxReconnectionManager } from '@/lib/sandbox/reconnect'
import { singleActiveSandboxManager } from '@/lib/sandbox/single-active-manager'
import { getTemplate, TemplateId } from '@/lib/templates'

export const maxDuration = 60

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
        // Quick check to see if it's alive
        const res = await fetch(url)
        if (res.ok) return url
      }
    } catch (e) {
      console.log('Could not get host for reused sandbox, will try starting app again.')
    }
  }

  const templateInfo = getTemplate(fragment.template as TemplateId)
  if (!templateInfo?.start_cmd) {
    throw new Error(`No start command found for template ${fragment.template}`)
  }

  await sbx.commands.run(templateInfo.start_cmd, {
    onStdout: (data) => console.log('[Sandbox STDOUT]', data),
    onStderr: (data) => console.error('[Sandbox STDERR]', data),
  })
  console.log(`Started app with command: ${templateInfo.start_cmd}`)

  // Wait for the app to start and get the URL
  let retries = 0
  const maxRetries = 15
  while (retries < maxRetries) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s
      const host = await sbx.getHost(port)
      if (host) {
        url = `https://${host}`
        console.log(`Checking ${url} for live status...`)
        const res = await fetch(url)
        if (res.ok || res.status < 500) {
          console.log(`Site is live: ${url}`)
          return url
        }
      }
    } catch (error) {
      console.log(`App not ready yet, retrying... (attempt ${retries + 1})`)
    }
    retries++
  }

  throw new Error('App failed to start after maximum retries')
}

export async function POST(req: Request) {
  const { fragment, sessionId }: { fragment: FragmentSchema; sessionId?: string } =
    await req.json()

  console.log('POST /api/sandbox')
  console.log('Template:', fragment.template)
  console.log('SessionID:', sessionId)

  // Ensure a session ID exists
  const effectiveSessionId = sessionId || `anon-session-${Date.now()}`

  try {
    const { sandbox: sbx, isNew } =
      await sandboxReconnectionManager.getOrCreateSandbox(
        effectiveSessionId,
        fragment.template as TemplateId,
      )

    console.log(
      `${isNew ? '🆕 Created' : '♻️ Reusing'} sandbox ${sbx.sandboxId} for session ${effectiveSessionId}`,
    )

    // 1. Install dependencies (only for new sandboxes)
    if (isNew && fragment.has_additional_dependencies) {
      console.log('Installing dependencies...')
      await sbx.commands.run(fragment.install_dependencies_command)
    }

    // 2. Inject AI capabilities and write the code
    const codeWithAI = injectAI(fragment.code, fragment.template)
    await sbx.files.write(fragment.file_path, codeWithAI)
    console.log(`Wrote file to ${fragment.file_path}`)

    // 3. Handle execution based on template type
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
      const url = await startAppAndGetURL(sbx, fragment, !isNew)
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
  const { sessionId } = await req.json()
  console.log('DELETE /api/sandbox for session:', sessionId)

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
      status: 400,
    })
  }

  try {
    // Only the active session can be closed via this endpoint.
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

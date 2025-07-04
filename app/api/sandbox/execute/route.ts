import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import { Sandbox } from '@e2b/code-interpreter'
import { injectAI } from '@/lib/inject-ai'
import { sandboxReconnectionManager } from '@/lib/sandbox/reconnect'
import { singleActiveSandboxManager } from '@/lib/sandbox/single-active-manager'

const sandboxTimeout = 10 * 60 * 1000 // 10 minute in ms

export const maxDuration = 60

export async function POST(req: Request) {
  const {
    fragment,
    template,
    userID,
    teamID,
    accessToken,
    sandboxId,
    sessionId,
    isNewSandbox,
  }: {
    fragment: FragmentSchema
    template: any
    userID: string | undefined
    teamID: string | undefined
    accessToken: string | undefined
    sandboxId?: string
    sessionId?: string
    isNewSandbox?: boolean
  } = await req.json()
  
  console.log('fragment', fragment)
  console.log('sandboxId', sandboxId)
  console.log('sessionId', sessionId)
  console.log('isNewSandbox', isNewSandbox)

  let sbx: Sandbox
  let needsSetup = false
  
  // Use reconnection manager to get or create sandbox
  if (sessionId) {
    const { sandbox, isNew } = await sandboxReconnectionManager.getOrCreateSandbox(
      sessionId,
      isNewSandbox ? undefined : sandboxId,
      fragment.template
    )
    sbx = sandbox
    needsSetup = isNew
  } else {
    // Fallback for requests without sessionId
    if (sandboxId && !isNewSandbox) {
      try {
        sbx = await Sandbox.connect(sandboxId)
        console.log(`Reconnected to existing sandbox: ${sandboxId}`)
      } catch (error) {
        console.error('Failed to reconnect to sandbox, creating new one:', error)
        sbx = await Sandbox.create(fragment.template, {
          metadata: {
            template: fragment.template,
            userID: userID ?? '',
            teamID: teamID ?? '',
          },
          timeoutMs: sandboxTimeout,
          ...(teamID && accessToken
            ? {
                headers: {
                  'X-Supabase-Team': teamID,
                  'X-Supabase-Token': accessToken,
                },
              }
            : {}),
        })
        needsSetup = true
      }
    } else {
      sbx = await Sandbox.create(fragment.template, {
        metadata: {
          template: fragment.template,
          userID: userID ?? '',
          teamID: teamID ?? '',
        },
        timeoutMs: sandboxTimeout,
        ...(teamID && accessToken
          ? {
              headers: {
                'X-Supabase-Team': teamID,
                'X-Supabase-Token': accessToken,
              },
            }
          : {}),
      })
      needsSetup = true
    }
  }

  // Install packages (only for new sandboxes or if dependencies changed)
  if (fragment.has_additional_dependencies && needsSetup) {
    await sbx.commands.run(fragment.install_dependencies_command)
    console.log(
      `Installed dependencies: ${fragment.additional_dependencies.join(', ')} in sandbox ${sbx.sandboxId}`,
    )
  }

  // Inject AI capabilities
  const codeWithAI = injectAI(fragment.code, fragment.template)

  // Write code
  await sbx.files.write(fragment.file_path, codeWithAI)
  console.log(`Wrote file to ${fragment.file_path} in sandbox ${sbx.sandboxId}`)

  let url: string | undefined

  // Execute based on template type
  if (fragment.template === 'code-interpreter-v1') {
    // Python interpreter execution
    const execution = await sbx.runCode(codeWithAI)
    console.log('Execution result:', execution)

    const executionLogs = execution.logs
    const executionError = execution.error
    const executionResults = execution.results

    return Response.json({
      sbxId: sbx.sandboxId,
      template: template.id,
      stdout: executionLogs.stdout,
      stderr: executionLogs.stderr,
      runtimeError: executionError,
      cellResults: executionResults,
    } satisfies ExecutionResultInterpreter)
    
  } else if (template.file) {
    // Start the app server
    const command = fragment.file_path.includes(' ')
      ? `python '${fragment.file_path}'`
      : `python ${fragment.file_path}`

    console.log('Running command:', command)

    sbx.commands
      .run(command)
      .then((result) => console.log('Started server', result))
      .catch((error) => console.error('Error starting server', error))

    // Get URL when available
    const timeout = 60000
    url = await sbx.getHost(template.port || 80)
    
    const { protocol } = new URL(url)
    url = url.replace(protocol, 'https:')
  } else {
    // Install dependencies and start dev server
    sbx.commands
      .run('npm install')
      .then(() => sbx.commands.run('npm run dev'))
      .then((result) => console.log('Dev server started', result))
      .catch((error) => console.error('Error starting dev server', error))

    // For frameworks, check common ports
    const ports = [3000, 3001, 3002, 3003, 5173, 5174, 5175]
    
    for (const port of ports) {
      try {
        const timeout = 60000
        url = await sbx.getHost(port)
        if (url) {
          console.log(`Got URL on port ${port}:`, url)
          const { protocol } = new URL(url)
          url = url.replace(protocol, 'https:')
          break
        }
      } catch (error) {
        console.log(`No response on port ${port}`)
      }
    }
  }

  return Response.json({
    sbxId: sbx.sandboxId,
    template: template.id,
    url: url || '',
  } satisfies ExecutionResultWeb)
}
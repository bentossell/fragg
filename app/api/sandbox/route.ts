import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import { Sandbox } from '@e2b/code-interpreter'
import { injectAI } from '@/lib/inject-ai'
import { singleActiveSandboxManager } from '@/lib/sandbox/single-active-manager'

const sandboxTimeout = 10 * 60 * 1000 // 10 minute in ms

export const maxDuration = 60

export async function POST(req: Request) {
  const {
    fragment,
    userID,
    teamID,
    accessToken,
    sessionId,
  }: {
    fragment: FragmentSchema
    userID: string | undefined
    teamID: string | undefined
    accessToken: string | undefined
    sessionId?: string
  } = await req.json()
  console.log('fragment', fragment)
  console.log('userID', userID)
  console.log('sessionId', sessionId)
  // console.log('apiKey', apiKey)

  // Create an interpreter or a sandbox
  const sbx = await Sandbox.create(fragment.template, {
    metadata: {
      template: fragment.template,
      userID: userID ?? '',
      teamID: teamID ?? '',
      sessionId: sessionId ?? '',
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

  // Register this sandbox as the active one if sessionId provided
  if (sessionId) {
    await singleActiveSandboxManager.setActiveSandbox(sessionId, sbx)
  }

  // Install packages
  if (fragment.has_additional_dependencies) {
    await sbx.commands.run(fragment.install_dependencies_command)
    console.log(
      `Installed dependencies: ${fragment.additional_dependencies.join(', ')} in sandbox ${sbx.sandboxId}`,
    )
  }

  // Copy code to fs with AI injection
  if (fragment.code && Array.isArray(fragment.code)) {
    fragment.code.forEach(async (file) => {
      const codeWithAI = injectAI(file.file_content, fragment.template, file.file_path, process.env.OPENROUTER_API_KEY)
      await sbx.files.write(file.file_path, codeWithAI)
      console.log(`Copied file with AI to ${file.file_path} in ${sbx.sandboxId}`)
    })
  } else {
    const codeWithAI = injectAI(fragment.code, fragment.template, fragment.file_path, process.env.OPENROUTER_API_KEY)
    await sbx.files.write(fragment.file_path, codeWithAI)
    console.log(`Copied file with AI to ${fragment.file_path} in ${sbx.sandboxId}`)
  }

  // Execute code or return a URL to the running sandbox
  if (fragment.template === 'code-interpreter-v1') {
    const { logs, error, results } = await sbx.runCode(fragment.code || '')

    return new Response(
      JSON.stringify({
        sbxId: sbx?.sandboxId,
        template: fragment.template,
        stdout: logs.stdout,
        stderr: logs.stderr,
        runtimeError: error,
        cellResults: results,
      } as ExecutionResultInterpreter),
    )
  }

  return new Response(
    JSON.stringify({
      sbxId: sbx?.sandboxId,
      template: fragment.template,
      url: `https://${sbx?.getHost(fragment.port || 80)}`,
    } as ExecutionResultWeb),
  )
}

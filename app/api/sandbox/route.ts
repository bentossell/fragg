import { FragmentSchema } from '@/lib/schema'
import { ExecutionResultInterpreter, ExecutionResultWeb } from '@/lib/types'
import { Sandbox } from '@e2b/code-interpreter'
import { injectAI } from '@/lib/inject-ai'
import { singleActiveSandboxManager } from '@/lib/sandbox/single-active-manager'

const sandboxTimeout = 10 * 60 * 1000 // 10 minute in ms

export const maxDuration = 60

// Helper function to detect if a file is binary based on its extension
function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
    '.pdf', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.wav', '.avi',
    '.mov', '.wmv', '.flv', '.mkv', '.woff', '.woff2', '.ttf', '.eot',
    '.otf', '.bin', '.exe', '.dll', '.so', '.dylib'
  ]
  
  const ext = filePath.toLowerCase().match(/\.[^.]*$/)?.[0] || ''
  return binaryExtensions.includes(ext)
}

// Helper function to process file content for binary files
function processBinaryContent(content: string, filePath: string): Buffer {
  // Check if content is base64 encoded
  if (content.startsWith('data:')) {
    // Extract base64 data from data URL
    const base64Match = content.match(/^data:[^;]+;base64,(.+)$/)
    if (base64Match) {
      return Buffer.from(base64Match[1], 'base64')
    }
  }
  
  // Try to decode as base64 directly
  try {
    // Check if it's valid base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
    if (base64Regex.test(content.replace(/\s/g, ''))) {
      return Buffer.from(content, 'base64')
    }
  } catch (e) {
    // Not base64, treat as raw string
  }
  
  // Default: convert string to buffer
  return Buffer.from(content)
}

// Helper function to convert Buffer to ArrayBuffer
function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.length)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < buffer.length; i++) {
    view[i] = buffer[i]
  }
  return arrayBuffer
}

export async function POST(req: Request) {
  try {
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
    
    console.log('=== Sandbox API Request ===')
    console.log('fragment:', JSON.stringify(fragment, null, 2))
    console.log('userID:', userID)
    console.log('teamID:', teamID)
    console.log('sessionId:', sessionId)
    console.log('fragment.template:', fragment?.template)
    
    // Validate fragment
    if (!fragment || !fragment.template) {
      console.error('Invalid fragment:', fragment)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid fragment: missing template',
          details: 'Fragment must include a template property'
        }),
        { status: 400 }
      )
    }
    
    // Create an interpreter or a sandbox
    console.log('Creating sandbox with template:', fragment.template)
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
    console.log('Sandbox created successfully:', sbx.sandboxId)
    
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
    
    // Handle different code formats
    if (fragment.code) {
      console.log('Fragment code type:', typeof fragment.code)
      console.log('Fragment has file_path:', !!fragment.file_path)
      console.log('Fragment has files:', !!(fragment as any).files)
      
      // Check if fragment has a 'files' property (new format)
      if ((fragment as any).files && Array.isArray((fragment as any).files)) {
        console.log('Processing fragment.files array:', (fragment as any).files.length, 'files')
        for (const file of (fragment as any).files) {
          if (isBinaryFile(file.path)) {
            // Handle binary files without AI injection
            console.log(`Processing binary file: ${file.path}`)
            const binaryContent = processBinaryContent(file.content, file.path)
            // Convert Buffer to ArrayBuffer for compatibility with the API
            const arrayBuffer = bufferToArrayBuffer(binaryContent)
            await sbx.files.write(file.path, arrayBuffer)
            console.log(`Wrote binary file: ${file.path} (${binaryContent.length} bytes) in ${sbx.sandboxId}`)
          } else {
            // Handle text files with AI injection
            const codeWithAI = injectAI(file.content, fragment.template, file.path, process.env.OPENROUTER_API_KEY)
            await sbx.files.write(file.path, codeWithAI)
            console.log(`Wrote text file: ${file.path} (${file.content.length} chars) in ${sbx.sandboxId}`)
          }
        }
      } else if (Array.isArray(fragment.code)) {
        // Handle array format
        console.log('Processing fragment.code array:', fragment.code.length, 'files')
        for (const file of fragment.code) {
          if (isBinaryFile(file.file_path)) {
            // Handle binary files without AI injection
            console.log(`Processing binary file: ${file.file_path}`)
            const binaryContent = processBinaryContent(file.file_content, file.file_path)
            // Convert Buffer to ArrayBuffer for compatibility with the API
            const arrayBuffer = bufferToArrayBuffer(binaryContent)
            await sbx.files.write(file.file_path, arrayBuffer)
            console.log(`Wrote binary file: ${file.file_path} (${binaryContent.length} bytes) in ${sbx.sandboxId}`)
          } else {
            // Handle text files with AI injection
            const codeWithAI = injectAI(file.file_content, fragment.template, file.file_path, process.env.OPENROUTER_API_KEY)
            await sbx.files.write(file.file_path, codeWithAI)
            console.log(`Wrote text file: ${file.file_path} in ${sbx.sandboxId}`)
          }
        }
      } else if (typeof fragment.code === 'string' && fragment.file_path) {
        // Handle string format
        console.log('Processing fragment.code string')
        if (isBinaryFile(fragment.file_path)) {
          // Handle binary file without AI injection
          console.log(`Processing binary file: ${fragment.file_path}`)
          const binaryContent = processBinaryContent(fragment.code, fragment.file_path)
          // Convert Buffer to ArrayBuffer for compatibility with the API
          const arrayBuffer = bufferToArrayBuffer(binaryContent)
          await sbx.files.write(fragment.file_path, arrayBuffer)
          console.log(`Wrote binary file: ${fragment.file_path} (${binaryContent.length} bytes) in ${sbx.sandboxId}`)
        } else {
          // Handle text file with AI injection
          const codeWithAI = injectAI(fragment.code, fragment.template, fragment.file_path, process.env.OPENROUTER_API_KEY)
          await sbx.files.write(fragment.file_path, codeWithAI)
          console.log(`Copied file with AI to ${fragment.file_path} in ${sbx.sandboxId}`)
        }
      } else {
        console.warn('Fragment has code but no recognized format')
      }
    } else {
      console.warn('Fragment has no code property')
    }
    
    // For Next.js templates, restart the dev server to pick up changes
    if (fragment.template === 'nextjs-developer') {
      console.log('Restarting Next.js dev server to pick up changes...')
      try {
        // Kill existing Next.js process and restart
        await sbx.commands.run('pkill -f "next"')
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        
        // Start Next.js dev server in background
        sbx.commands.run('cd /home/user && npm run dev')
        console.log('Next.js dev server restarted')
      } catch (error) {
        console.warn('Failed to restart Next.js dev server:', error)
        // Continue anyway, the original server might still work
      }
    }
    
    // Execute code or return a URL to the running sandbox
    if (fragment.template === 'code-interpreter-v1') {
      const codeToRun = typeof fragment.code === 'string' ? fragment.code : ''
      const { logs, error, results } = await sbx.runCode(codeToRun)
      
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
    
    // For web templates, return the sandbox URL
    // Wait a bit for the server to fully start/restart
    if (fragment.template === 'nextjs-developer') {
      await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds for Next.js to start
    }
    
    const sandboxUrl = await sbx.getHost(fragment.port || 80)
    const httpsUrl = sandboxUrl.startsWith('http://') 
      ? sandboxUrl.replace('http://', 'https://') 
      : sandboxUrl.startsWith('https://') 
        ? sandboxUrl 
        : `https://${sandboxUrl}`
    
    console.log('Returning sandbox URL:', httpsUrl)
    
    return new Response(
      JSON.stringify({
        sbxId: sbx?.sandboxId,
        template: fragment.template,
        url: httpsUrl,
      } as ExecutionResultWeb),
    )
  } catch (error) {
    console.error('Sandbox creation error:', error)
    
    // Extract more specific error information
    let errorMessage = 'Failed to create sandbox'
    let errorDetails = 'Unknown error'
    
    if (error instanceof Error) {
      errorDetails = error.message
      
      // Check for specific E2B errors
      if (error.message.includes('does not have access to the template')) {
        errorMessage = 'Template access denied'
        errorDetails = `Your team doesn't have access to this template. ${error.message}`
      } else if (error.message.includes('403')) {
        errorMessage = 'Permission denied'
        errorDetails = 'You may not have permission to create sandboxes with this configuration.'
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage, 
        details: errorDetails 
      }),
      { status: 500 }
    )
  }
}

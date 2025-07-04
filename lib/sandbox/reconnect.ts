import { Sandbox } from '@e2b/code-interpreter'
import { singleActiveSandboxManager } from './single-active-manager'

export class SandboxReconnectionManager {
  private reconnectAttempts = new Map<string, number>()
  private maxAttempts = 3
  
  async getOrCreateSandbox(
    sessionId: string,
    sandboxId: string | undefined,
    template: string
  ): Promise<{ sandbox: Sandbox, isNew: boolean }> {
    // First check if this session already has the active sandbox
    const activeSandbox = singleActiveSandboxManager.getCurrentSandbox(sessionId)
    if (activeSandbox) {
      console.log('Using already active sandbox for session:', sessionId)
      return { sandbox: activeSandbox, isNew: false }
    }
    
    // Try to reconnect to existing sandbox
    if (sandboxId) {
      const attempts = this.reconnectAttempts.get(sandboxId) || 0
      if (attempts < this.maxAttempts) {
        try {
          const sandbox = await Sandbox.connect(sandboxId)
          console.log('Reconnected to existing sandbox:', sandboxId)
          
          // Verify sandbox is still alive
          await sandbox.files.list('/')
          
          console.log(`Successfully reconnected to sandbox: ${sandboxId}`)
          this.reconnectAttempts.delete(sandboxId)
          
          // Register as active sandbox
          await singleActiveSandboxManager.setActiveSandbox(sessionId, sandbox)
          
          return { sandbox, isNew: false }
        } catch (error) {
          console.log(`Failed to reconnect (attempt ${attempts + 1}):`, error)
          this.reconnectAttempts.set(sandboxId, attempts + 1)
        }
      }
    }
    
    // Create new sandbox
    console.log(`Creating new sandbox for session: ${sessionId}`)
    const sandbox = await Sandbox.create(template, {
      metadata: {
        sessionId
      }
    })
    
    console.log(`Created new sandbox: ${sandbox.sandboxId}`)
    
    // Register as active sandbox
    await singleActiveSandboxManager.setActiveSandbox(sessionId, sandbox)
    
    return { sandbox, isNew: true }
  }
  
  async closeSandbox(sandbox: Sandbox) {
    try {
      await sandbox.kill()
      console.log(`Closed sandbox: ${sandbox.sandboxId}`)
    } catch (error) {
      console.warn(`Error closing sandbox ${sandbox.sandboxId}:`, error)
    }
  }
  
  cleanup() {
    this.reconnectAttempts.clear()
  }
}

export const sandboxReconnectionManager = new SandboxReconnectionManager()
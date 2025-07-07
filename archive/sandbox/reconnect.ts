import { Sandbox } from '@e2b/code-interpreter'
import { singleActiveSandboxManager } from './single-active-manager'
import { getTemplate, TemplateId } from '../../lib/templates'
import { sandboxPool } from './sandbox-pool'

export class SandboxReconnectionManager {
  private sessionToSandbox = new Map<string, string>()
  private reconnectAttempts = new Map<string, number>()
  private maxAttempts = 3

  async getOrCreateSandbox(
    sessionId: string,
    template: TemplateId,
  ): Promise<{ sandbox: Sandbox; isNew: boolean }> {
    // 1. Check if sandbox pool already has a sandbox for this session
    const poolSandbox = await sandboxPool.findSandboxBySession(sessionId)
    if (poolSandbox) {
      console.log(`[reconnect] Found sandbox in pool for session ${sessionId}`)
      await singleActiveSandboxManager.setActiveSandbox(sessionId, poolSandbox)
      const hasInstalledDeps = sandboxPool.hasDependenciesInstalled(poolSandbox.sandboxId)
      return { sandbox: poolSandbox, isNew: !hasInstalledDeps }
    }
    
    // 2. Check if this session already has the active sandbox
    const activeSandbox = singleActiveSandboxManager.getCurrentSandbox(sessionId)
    if (activeSandbox) {
      console.log(`[reconnect] Using active sandbox ${activeSandbox.sandboxId} for session ${sessionId}`)
      const hasInstalledDeps = sandboxPool.hasDependenciesInstalled(activeSandbox.sandboxId)
      return { sandbox: activeSandbox, isNew: !hasInstalledDeps }
    }

    // 3. Check if we have a sandbox ID for this session
    const sandboxId = this.sessionToSandbox.get(sessionId)
    if (sandboxId) {
      const attempts = this.reconnectAttempts.get(sandboxId) || 0
      if (attempts < this.maxAttempts) {
        try {
          console.log(`[reconnect] Attempting to reconnect to sandbox ${sandboxId} for session ${sessionId}`)
          const sandbox = await Sandbox.connect(sandboxId)
          
          this.reconnectAttempts.delete(sandboxId)
          await singleActiveSandboxManager.setActiveSandbox(sessionId, sandbox)
          
          console.log(`[reconnect] Reconnected to ${sandboxId}`)
          const hasInstalledDeps = sandboxPool.hasDependenciesInstalled(sandboxId)
          return { sandbox, isNew: !hasInstalledDeps }
        } catch (error) {
          console.error(`[reconnect] Failed to reconnect to sandbox ${sandboxId}:`, error)
          this.reconnectAttempts.set(sandboxId, (this.reconnectAttempts.get(sandboxId) || 0) + 1)
        }
      } else {
        console.log(`[reconnect] Max reconnection attempts reached for ${sandboxId}. Creating a new one.`)
        this.sessionToSandbox.delete(sessionId)
        this.reconnectAttempts.delete(sandboxId)
      }
    }

    // 4. Get sandbox from pool or create a new one
    console.log(`[reconnect] Getting sandbox from pool for session ${sessionId} with template ${template}`)
    const sandbox = await sandboxPool.getSandbox(template, sessionId)

    // 5. Store the new sandbox ID and set it as active
    this.sessionToSandbox.set(sessionId, sandbox.sandboxId)
    await singleActiveSandboxManager.setActiveSandbox(sessionId, sandbox)

    console.log(`[reconnect] Got sandbox ${sandbox.sandboxId} for session ${sessionId}`)
    const hasInstalledDeps = sandboxPool.hasDependenciesInstalled(sandbox.sandboxId)
    return { sandbox, isNew: !hasInstalledDeps }
  }

  public clearSession(sessionId: string) {
    const sandboxId = this.sessionToSandbox.get(sessionId)
    if (sandboxId) {
      this.sessionToSandbox.delete(sessionId)
      this.reconnectAttempts.delete(sandboxId)
      console.log(`[reconnect] Cleared session ${sessionId} and sandbox ${sandboxId}`)
    }
  }
}

// Export singleton instance
export const sandboxReconnectionManager = new SandboxReconnectionManager() 
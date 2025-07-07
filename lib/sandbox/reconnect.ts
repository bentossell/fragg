import { Sandbox } from '@e2b/code-interpreter'
import { singleActiveSandboxManager } from './single-active-manager'
import { getTemplate, TemplateId } from '../templates'

export class SandboxReconnectionManager {
  private sessionToSandbox = new Map<string, string>()
  private reconnectAttempts = new Map<string, number>()
  private maxAttempts = 3

  async getOrCreateSandbox(
    sessionId: string,
    template: TemplateId,
  ): Promise<{ sandbox: Sandbox; isNew: boolean }> {
    // 1. Check if this session already has the active sandbox
    const activeSandbox = singleActiveSandboxManager.getCurrentSandbox(sessionId)
    if (activeSandbox) {
      console.log(`[reconnect] Using active sandbox ${activeSandbox.sandboxId} for session ${sessionId}`)
      return { sandbox: activeSandbox, isNew: false }
    }

    // 2. Check if we have a sandbox ID for this session
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
          return { sandbox, isNew: false }
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

    // 3. Create a new sandbox
    console.log(`[reconnect] Creating new sandbox for session ${sessionId} with template ${template}`)
    const templateInfo = getTemplate(template)
    if (!templateInfo) {
      throw new Error(`Template ${template} not found.`)
    }

    const sandbox = await Sandbox.create(templateInfo.id, {
      metadata: {
        sessionId,
        template,
        createdAt: new Date().toISOString(),
      },
      timeoutMs: 10 * 60 * 1000, // 10 minutes
    })

    // 4. Store the new sandbox ID and set it as active
    this.sessionToSandbox.set(sessionId, sandbox.sandboxId)
    await singleActiveSandboxManager.setActiveSandbox(sessionId, sandbox)

    console.log(`[reconnect] Created new sandbox ${sandbox.sandboxId} for session ${sessionId}`)
    return { sandbox, isNew: true }
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
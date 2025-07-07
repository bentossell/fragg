import { Sandbox } from '@e2b/code-interpreter'

export class SingleActiveSandboxManager {
  private currentSandbox: Sandbox | null = null
  private currentSessionId: string | null = null
  
  /**
   * Get the current active sandbox if it belongs to the requested session
   */
  getCurrentSandbox(sessionId: string): Sandbox | null {
    if (this.currentSessionId === sessionId && this.currentSandbox) {
      return this.currentSandbox
    }
    return null
  }
  
  /**
   * Set a sandbox as the current active one, closing any previous sandbox
   */
  async setActiveSandbox(sessionId: string, sandbox: Sandbox): Promise<void> {
    // If there's a different sandbox active, close it first
    if (this.currentSandbox && this.currentSessionId !== sessionId) {
      await this.closeCurrent()
    }
    
    this.currentSandbox = sandbox
    this.currentSessionId = sessionId
  }
  
  /**
   * Close the current active sandbox
   */
  async closeCurrent(): Promise<void> {
    if (this.currentSandbox) {
      // Import here to avoid circular dependencies
      const { sandboxReconnectionManager } = await import('./reconnect')
      const { sandboxPool } = await import('./sandbox-pool')
      const { getTemplate } = await import('../../lib/templates')
      
      try {
        console.log(`Closing sandbox for session ${this.currentSessionId}`)
        
        // Try to get template info from sandbox metadata
        let template = 'nextjs-developer' as any
        try {
          const metadata = (this.currentSandbox as any).metadata
          if (metadata?.template) {
            template = metadata.template
          }
        } catch (e) {
          console.log('Could not get template from sandbox metadata')
        }
        
        // Release sandbox back to pool instead of killing it
        sandboxPool.releaseSandbox(this.currentSandbox, template)
        
        if (this.currentSessionId) {
          sandboxReconnectionManager.clearSession(this.currentSessionId)
        }
      } catch (error) {
        console.warn(`Error releasing sandbox: ${error}`)
        // If release fails, kill the sandbox
        try {
          await this.currentSandbox.kill()
        } catch (killError) {
          console.warn(`Error killing sandbox: ${killError}`)
        }
      } finally {
        this.currentSandbox = null
        this.currentSessionId = null
      }
    }
  }
  
  /**
   * Check if a session has the active sandbox
   */
  isActive(sessionId: string): boolean {
    return this.currentSessionId === sessionId && this.currentSandbox !== null
  }
  
  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }
}

// Export singleton instance
export const singleActiveSandboxManager = new SingleActiveSandboxManager() 
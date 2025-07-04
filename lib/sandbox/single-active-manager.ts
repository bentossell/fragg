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
      try {
        console.log(`Closing sandbox for session ${this.currentSessionId}`)
        await this.currentSandbox.kill()
      } catch (error) {
        console.warn(`Error closing sandbox: ${error}`)
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
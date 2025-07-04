import { Sandbox } from '@e2b/code-interpreter'

export class SandboxRefreshManager {
  private sandboxes: Map<string, Sandbox> = new Map()
  
  /**
   * Register a sandbox instance
   */
  registerSandbox(sandboxId: string, sandbox: Sandbox) {
    this.sandboxes.set(sandboxId, sandbox)
  }
  
  /**
   * Unregister a sandbox instance
   */
  unregisterSandbox(sandboxId: string) {
    this.sandboxes.delete(sandboxId)
  }
  
  /**
   * Get a sandbox instance
   */
  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.sandboxes.get(sandboxId)
  }
  
  /**
   * Refresh a sandbox by recreating it
   */
  async refreshSandbox(
    sandboxId: string,
    recreateFunction: () => Promise<{ sandbox: Sandbox; url?: string }>
  ): Promise<{ newSandboxId: string; url?: string } | null> {
    try {
      // Kill the old sandbox if it exists
      const oldSandbox = this.sandboxes.get(sandboxId)
      if (oldSandbox) {
        await oldSandbox.kill()
        this.unregisterSandbox(sandboxId)
      }
      
      // Create a new sandbox
      const { sandbox: newSandbox, url } = await recreateFunction()
      const newSandboxId = newSandbox.sandboxId
      
      // Register the new sandbox
      this.registerSandbox(newSandboxId, newSandbox)
      
      return { newSandboxId, url }
    } catch (error) {
      console.error('Error refreshing sandbox:', error)
      return null
    }
  }
  
  /**
   * Kill all sandboxes
   */
  async killAllSandboxes() {
    const promises: Promise<void>[] = []
    
    this.sandboxes.forEach((sandbox, id) => {
      promises.push(
        sandbox.kill().catch(err => 
          console.error(`Error killing sandbox ${id}:`, err)
        )
      )
    })
    
    await Promise.all(promises)
    this.sandboxes.clear()
  }
  
  /**
   * Get all active sandbox IDs
   */
  getActiveSandboxIds(): string[] {
    return Array.from(this.sandboxes.keys())
  }
}

// Global instance
export const sandboxRefreshManager = new SandboxRefreshManager() 
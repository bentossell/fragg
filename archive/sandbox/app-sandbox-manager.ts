import { Sandbox } from '@e2b/code-interpreter'
import { ExecutionResult } from '../../lib/types'
import { FragmentSchema } from '../../lib/schema'
import { DeepPartial } from 'ai'

interface AppSandbox {
  appId: string
  sandbox: Sandbox
  url?: string
  template: string
  lastAccessed: number
  isRunning: boolean
  codeHash: string
}

export class AppSandboxManager {
  private appSandboxes = new Map<string, AppSandbox>()
  private urlCache = new Map<string, string>()
  private maxIdleTime = 5 * 60 * 1000 // 5 minutes
  private maintenanceInterval: NodeJS.Timeout | null = null
  
  constructor() {
    // Start maintenance cycle to clean up idle sandboxes
    this.startMaintenance()
  }
  
  /**
   * Get or create a sandbox for a specific app
   */
  async getAppSandbox(
    appId: string,
    fragment: DeepPartial<FragmentSchema>
  ): Promise<{ sandbox: Sandbox; url?: string; isNew: boolean; needsRestart: boolean }> {
    const existingApp = this.appSandboxes.get(appId)
    const codeHash = this.hashCode(fragment.code || '')
    
    if (existingApp) {
      console.log(`[AppSandboxManager] Found existing sandbox for app ${appId}`)
      
      // First, check if the sandbox is still alive
      const isAlive = await this.isAppSandboxAlive(appId)
      if (!isAlive) {
        console.log(`[AppSandboxManager] Sandbox for app ${appId} is no longer alive, removing it`)
        this.appSandboxes.delete(appId)
        this.urlCache.delete(appId)
        // Fall through to create a new one
      } else {
        existingApp.lastAccessed = Date.now()
        
        // Check if code has changed
        const needsRestart = existingApp.codeHash !== codeHash
        
        if (!needsRestart && existingApp.url) {
          // App is running with same code - instant return!
          console.log(`[AppSandboxManager] ⚡ Instant return - app already running at ${existingApp.url}`)
          return {
            sandbox: existingApp.sandbox,
            url: existingApp.url,
            isNew: false,
            needsRestart: false
          }
        }
        
        // Code changed, need to update
        existingApp.codeHash = codeHash
        return {
          sandbox: existingApp.sandbox,
          url: existingApp.url,
          isNew: false,
          needsRestart: true
        }
      }
    }
    
    // Create new sandbox for this app
    console.log(`[AppSandboxManager] Creating new sandbox for app ${appId}`)
    const { sandboxPool } = await import('./sandbox-pool')
    
    // Ensure pool is initialized
    if (sandboxPool.getActiveTemplates().length === 0) {
      console.log(`[AppSandboxManager] Sandbox pool not initialized, initializing now...`)
      await sandboxPool.initialize([fragment.template as any])
    }
    
    const sandbox = await sandboxPool.getSandbox(fragment.template as any, appId)
    
    const appSandbox: AppSandbox = {
      appId,
      sandbox,
      template: fragment.template as string,
      lastAccessed: Date.now(),
      isRunning: false,
      codeHash
    }
    
    this.appSandboxes.set(appId, appSandbox)
    
    return {
      sandbox,
      isNew: true,
      needsRestart: true
    }
  }
  
  /**
   * Store the URL for an app after it starts
   */
  setAppUrl(appId: string, url: string): void {
    const appSandbox = this.appSandboxes.get(appId)
    if (appSandbox) {
      appSandbox.url = url
      appSandbox.isRunning = true
      this.urlCache.set(appId, url)
      console.log(`[AppSandboxManager] Stored URL for app ${appId}: ${url}`)
    }
  }
  
  /**
   * Get cached URL for an app
   */
  getCachedUrl(appId: string): string | undefined {
    return this.urlCache.get(appId)
  }
  
  /**
   * Check if an app's sandbox is still alive
   */
  async isAppSandboxAlive(appId: string): Promise<boolean> {
    const appSandbox = this.appSandboxes.get(appId)
    if (!appSandbox) return false
    
    try {
      // Test if sandbox is still responsive
      await appSandbox.sandbox.files.list('/')
      return true
    } catch (error) {
      console.log(`[AppSandboxManager] Sandbox for app ${appId} is not responsive`)
      return false
    }
  }
  
  /**
   * Release an app's sandbox (but keep it running)
   */
  releaseApp(appId: string): void {
    const appSandbox = this.appSandboxes.get(appId)
    if (appSandbox) {
      appSandbox.lastAccessed = Date.now()
      console.log(`[AppSandboxManager] Released app ${appId} but keeping it running`)
    }
  }
  
  /**
   * Force close an app's sandbox
   */
  async closeApp(appId: string): Promise<void> {
    const appSandbox = this.appSandboxes.get(appId)
    if (appSandbox) {
      try {
        await appSandbox.sandbox.kill()
        console.log(`[AppSandboxManager] Closed sandbox for app ${appId}`)
      } catch (error) {
        console.error(`[AppSandboxManager] Error closing sandbox for app ${appId}:`, error)
      } finally {
        this.appSandboxes.delete(appId)
        this.urlCache.delete(appId)
      }
    }
  }
  
  /**
   * Start maintenance cycle
   */
  private startMaintenance(): void {
    this.maintenanceInterval = setInterval(() => {
      this.cleanupIdleSandboxes()
    }, 60000) // Check every minute
  }
  
  /**
   * Clean up sandboxes that have been idle too long
   */
  private async cleanupIdleSandboxes(): Promise<void> {
    const now = Date.now()
    const toClose: string[] = []
    
    for (const [appId, appSandbox] of this.appSandboxes) {
      if (now - appSandbox.lastAccessed > this.maxIdleTime) {
        toClose.push(appId)
      }
    }
    
    for (const appId of toClose) {
      console.log(`[AppSandboxManager] Cleaning up idle sandbox for app ${appId}`)
      await this.closeApp(appId)
    }
  }
  
  /**
   * Simple hash function for code comparison
   */
  private hashCode(code: string): string {
    // Use a more reliable hash that handles undefined/null
    if (!code) return 'empty'
    
    let hash = 0
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
  
  /**
   * Get all active app sandboxes
   */
  getActiveApps(): string[] {
    return Array.from(this.appSandboxes.keys())
  }
  
  /**
   * Shutdown and clean up
   */
  async shutdown(): Promise<void> {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval)
    }
    
    // Close all app sandboxes
    const closePromises = Array.from(this.appSandboxes.keys()).map(appId =>
      this.closeApp(appId)
    )
    
    await Promise.all(closePromises)
    console.log('[AppSandboxManager] Shutdown complete')
  }
}

// Export singleton
export const appSandboxManager = new AppSandboxManager() 
import { Sandbox } from '@e2b/code-interpreter'
import { TemplateId } from '../../lib/templates'
import { getSandboxCreationTimeout, logSandboxConfig } from '../../lib/sandbox-config'

interface PoolConfig {
  template: TemplateId
  minSize: number
  maxSize: number
  timeout: number
}

interface SandboxInfo {
  sandbox: Sandbox
  template: TemplateId
  createdAt: number
  lastUsed: number
  inUse: boolean
  sessionId?: string
  hasInstalledDeps?: boolean
}

interface PoolStats {
  availableSandboxes: number
  totalSandboxes: number
  totalRequests: number
  cacheHits: number
  hitRate: number
  averageInitTime: number
  errors: number
}

export class SandboxPool {
  private pools: Map<TemplateId, SandboxInfo[]> = new Map()
  private poolConfigs: Map<TemplateId, PoolConfig> = new Map()
  private stats: Map<TemplateId, PoolStats> = new Map()
  private maintenanceInterval: NodeJS.Timeout | null = null
  private refillPromises: Map<TemplateId, Promise<void>> = new Map()
  
  // Default configurations
  private readonly DEFAULT_MIN_SIZE = 2
  private readonly DEFAULT_MAX_SIZE = 5
  private readonly DEFAULT_TIMEOUT = 600000 // 10 minutes
  private readonly MAINTENANCE_INTERVAL = 30000 // 30 seconds
  // Sandbox creation timeout - configured centrally
  private readonly SANDBOX_CREATION_TIMEOUT = getSandboxCreationTimeout()
  
  constructor() {
    // Log sandbox configuration
    logSandboxConfig()
    
    // Initialize default pool configurations
    const defaultTemplates: TemplateId[] = [
      'nextjs-developer',
      'streamlit-developer',
      'vue-developer'
    ]
    
    defaultTemplates.forEach(template => {
      this.poolConfigs.set(template, {
        template,
        minSize: this.DEFAULT_MIN_SIZE,
        maxSize: this.DEFAULT_MAX_SIZE,
        timeout: this.DEFAULT_TIMEOUT
      })
      
      this.pools.set(template, [])
      this.stats.set(template, {
        availableSandboxes: 0,
        totalSandboxes: 0,
        totalRequests: 0,
        cacheHits: 0,
        hitRate: 0,
        averageInitTime: 0,
        errors: 0
      })
    })
  }
  
  /**
   * Initialize sandbox pools with pre-warmed instances
   */
  async initialize(templates?: TemplateId[]): Promise<void> {
    const templatesToInit = templates || Array.from(this.poolConfigs.keys())
    console.log('🚀 Initializing sandbox pools for:', templatesToInit)
    
    // Start maintenance cycle
    this.startMaintenance()
    
    // Initialize pools in parallel
    const initPromises = templatesToInit.map(template => 
      this.initializePool(template)
    )
    
    await Promise.allSettled(initPromises)
    console.log('✅ Sandbox pool initialization complete')
  }
  
  /**
   * Initialize a single template pool
   */
  private async initializePool(template: TemplateId): Promise<void> {
    const config = this.poolConfigs.get(template)
    if (!config) return
    
    const promises: Promise<void>[] = []
    
    for (let i = 0; i < config.minSize; i++) {
      promises.push(this.createWarmSandbox(template))
    }
    
    await Promise.allSettled(promises)
  }
  
  /**
   * Create a pre-warmed sandbox
   */
  private async createWarmSandbox(template: TemplateId): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`🔥 Creating warm sandbox for ${template}...`)
      
      const sandbox = await Sandbox.create(template, {
        metadata: { template, pool: 'true' },
        timeoutMs: this.SANDBOX_CREATION_TIMEOUT
      })
      
      const pool = this.pools.get(template) || []
      const sandboxInfo: SandboxInfo = {
        sandbox,
        template,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: false,
        hasInstalledDeps: false
      }
      
      pool.push(sandboxInfo)
      this.pools.set(template, pool)
      
      // Update stats
      const stats = this.stats.get(template)!
      stats.totalSandboxes++
      stats.availableSandboxes++
      const initTime = Date.now() - startTime
      stats.averageInitTime = (stats.averageInitTime * (stats.totalSandboxes - 1) + initTime) / stats.totalSandboxes
      
      console.log(`✅ Warm sandbox created for ${template} in ${initTime}ms`)
    } catch (error) {
      console.error(`❌ Failed to create warm sandbox for ${template}:`, error)
      const stats = this.stats.get(template)!
      stats.errors++
    }
  }
  
  /**
   * Get a sandbox from the pool or create a new one
   */
  async getSandbox(template: TemplateId, sessionId?: string): Promise<Sandbox> {
    const stats = this.stats.get(template)!
    stats.totalRequests++
    
    // Try to find an available sandbox in the pool
    const pool = this.pools.get(template) || []
    const availableSandbox = pool.find(s => !s.inUse && !s.sessionId)
    
    if (availableSandbox) {
      // Use warm sandbox from pool
      availableSandbox.inUse = true
      availableSandbox.sessionId = sessionId
      availableSandbox.lastUsed = Date.now()
      
      stats.cacheHits++
      stats.availableSandboxes--
      stats.hitRate = stats.cacheHits / stats.totalRequests
      
      console.log(`⚡ Using warm sandbox for ${template} (${stats.availableSandboxes} remaining)`)
      
      // Trigger background refill if needed
      this.triggerRefillIfNeeded(template)
      
      return availableSandbox.sandbox
    }
    
    // No available sandbox, create new one
    console.log(`🔨 Creating new sandbox for ${template} (pool empty)`)
    
    try {
      const sandbox = await Sandbox.create(template, {
        metadata: { template, sessionId: sessionId || '' },
        timeoutMs: this.SANDBOX_CREATION_TIMEOUT
      })
      
      // Add to pool for tracking
      const sandboxInfo: SandboxInfo = {
        sandbox,
        template,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: true,
        sessionId,
        hasInstalledDeps: false
      }
      
      pool.push(sandboxInfo)
      this.pools.set(template, pool)
      stats.totalSandboxes++
      
      return sandbox
    } catch (error) {
      stats.errors++
      throw error
    }
  }
  
  /**
   * Release a sandbox back to the pool
   */
  releaseSandbox(sandbox: Sandbox, template: TemplateId): void {
    const pool = this.pools.get(template) || []
    const sandboxInfo = pool.find(s => s.sandbox.sandboxId === sandbox.sandboxId)
    
    if (sandboxInfo) {
      sandboxInfo.inUse = false
      sandboxInfo.sessionId = undefined
      sandboxInfo.lastUsed = Date.now()
      
      const stats = this.stats.get(template)!
      stats.availableSandboxes++
      
      console.log(`🔄 Released sandbox back to ${template} pool`)
    }
  }
  
  /**
   * Mark a sandbox as having installed dependencies
   */
  markDependenciesInstalled(sandboxId: string): void {
    for (const [_, pool] of this.pools) {
      const sandboxInfo = pool.find(s => s.sandbox.sandboxId === sandboxId)
      if (sandboxInfo) {
        sandboxInfo.hasInstalledDeps = true
        console.log(`📦 Marked sandbox ${sandboxId} as having installed dependencies`)
        break
      }
    }
  }
  
  /**
   * Check if a sandbox has installed dependencies
   */
  hasDependenciesInstalled(sandboxId: string): boolean {
    for (const [_, pool] of this.pools) {
      const sandboxInfo = pool.find(s => s.sandbox.sandboxId === sandboxId)
      if (sandboxInfo) {
        return sandboxInfo.hasInstalledDeps || false
      }
    }
    return false
  }
  
  /**
   * Find an existing sandbox by session ID
   */
  async findSandboxBySession(sessionId: string): Promise<Sandbox | null> {
    for (const [_, pool] of this.pools) {
      const sandboxInfo = pool.find(s => s.sessionId === sessionId && s.inUse)
      if (sandboxInfo) {
        console.log(`🔍 Found existing sandbox for session ${sessionId}`)
        sandboxInfo.lastUsed = Date.now()
        return sandboxInfo.sandbox
      }
    }
    return null
  }
  
  /**
   * Trigger background refill if pool is getting low
   */
  private triggerRefillIfNeeded(template: TemplateId): void {
    const config = this.poolConfigs.get(template)!
    const stats = this.stats.get(template)!
    
    if (stats.availableSandboxes < config.minSize && !this.refillPromises.has(template)) {
      console.log(`🔄 Refilling ${template} pool...`)
      
      const refillPromise = this.refillPool(template).finally(() => {
        this.refillPromises.delete(template)
      })
      
      this.refillPromises.set(template, refillPromise)
    }
  }
  
  /**
   * Refill pool to minimum size
   */
  private async refillPool(template: TemplateId): Promise<void> {
    const config = this.poolConfigs.get(template)!
    const stats = this.stats.get(template)!
    const needed = config.minSize - stats.availableSandboxes
    
    if (needed <= 0) return
    
    const promises: Promise<void>[] = []
    for (let i = 0; i < needed; i++) {
      promises.push(this.createWarmSandbox(template))
    }
    
    await Promise.allSettled(promises)
  }
  
  /**
   * Start periodic maintenance
   */
  private startMaintenance(): void {
    if (this.maintenanceInterval) return
    
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance()
    }, this.MAINTENANCE_INTERVAL)
  }
  
  /**
   * Perform periodic maintenance
   */
  private async performMaintenance(): Promise<void> {
    console.log('🧹 Performing sandbox pool maintenance...')
    
    for (const [template, pool] of this.pools) {
      const config = this.poolConfigs.get(template)!
      const now = Date.now()
      
      // Remove expired sandboxes
      const expiredSandboxes = pool.filter(s => 
        !s.inUse && 
        (now - s.lastUsed) > config.timeout
      )
      
      for (const expired of expiredSandboxes) {
        try {
          await expired.sandbox.kill()
          const index = pool.indexOf(expired)
          pool.splice(index, 1)
          
          const stats = this.stats.get(template)!
          stats.totalSandboxes--
          stats.availableSandboxes--
          
          console.log(`🗑️ Removed expired sandbox for ${template}`)
        } catch (error) {
          console.error(`Failed to kill expired sandbox:`, error)
        }
      }
      
      // Refill if needed
      this.triggerRefillIfNeeded(template)
    }
  }
  
  /**
   * Get pool statistics
   */
  getPoolStats(): Record<TemplateId, PoolStats> {
    const result: Record<string, PoolStats> = {}
    
    for (const [template, stats] of this.stats) {
      result[template] = { ...stats }
    }
    
    return result
  }
  
  /**
   * Get active templates
   */
  getActiveTemplates(): TemplateId[] {
    return Array.from(this.poolConfigs.keys())
  }
  
  /**
   * Set pool size for a template
   */
  setPoolSize(template: TemplateId, minSize: number, maxSize?: number): void {
    const config = this.poolConfigs.get(template)
    if (config) {
      config.minSize = minSize
      config.maxSize = maxSize || minSize * 2
      console.log(`📏 Set pool size for ${template} to ${minSize}-${config.maxSize}`)
      
      // Trigger refill if needed
      this.triggerRefillIfNeeded(template)
    }
  }
  
  /**
   * Force refresh a template pool
   */
  async forceRefresh(template: TemplateId): Promise<void> {
    console.log(`🔄 Force refreshing ${template} pool...`)
    
    const pool = this.pools.get(template) || []
    const toKill = pool.filter(s => !s.inUse)
    
    // Kill all available sandboxes
    for (const sandboxInfo of toKill) {
      try {
        await sandboxInfo.sandbox.kill()
        const index = pool.indexOf(sandboxInfo)
        pool.splice(index, 1)
        
        const stats = this.stats.get(template)!
        stats.totalSandboxes--
        stats.availableSandboxes--
      } catch (error) {
        console.error(`Failed to kill sandbox during refresh:`, error)
      }
    }
    
    // Refill pool
    await this.refillPool(template)
  }
  
  /**
   * Pre-warm sandboxes for a template
   */
  async preWarmTemplate(template: TemplateId, count: number): Promise<void> {
    console.log(`🔥 Pre-warming ${count} sandboxes for ${template}...`)
    
    const promises: Promise<void>[] = []
    for (let i = 0; i < count; i++) {
      promises.push(this.createWarmSandbox(template))
    }
    
    await Promise.allSettled(promises)
  }
  
  /**
   * Shutdown the pool and clean up resources
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down sandbox pool...')
    
    // Stop maintenance
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval)
      this.maintenanceInterval = null
    }
    
    // Kill all sandboxes
    const killPromises: Promise<void>[] = []
    
    for (const [_, pool] of this.pools) {
      for (const sandboxInfo of pool) {
        killPromises.push(
          sandboxInfo.sandbox.kill().catch(error => 
            console.error('Failed to kill sandbox during shutdown:', error)
          )
        )
      }
    }
    
    await Promise.allSettled(killPromises)
    
    // Clear pools
    this.pools.clear()
    this.stats.clear()
    
    console.log('✅ Sandbox pool shutdown complete')
  }
}

// Export singleton instance
export const sandboxPool = new SandboxPool() 
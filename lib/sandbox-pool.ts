import { Sandbox } from '@e2b/code-interpreter'

interface PooledSandbox {
  sandbox: Sandbox
  template: string
  createdAt: number
  lastUsed: number
  inUse: boolean
  warmupComplete: boolean
  metadata: {
    initTime: number
    totalUses: number
    errors: number
  }
}

interface PoolStats {
  totalSandboxes: number
  availableSandboxes: number
  activeSandboxes: number
  averageInitTime: number
  hitRate: number
  errorRate: number
}

export class SandboxPool {
  private pools = new Map<string, PooledSandbox[]>()
  private poolSize = 3 // Default pool size per template
  private maxAge = 10 * 60 * 1000 // 10 minutes max age
  private warmupTimeout = 30 * 1000 // 30 seconds warmup timeout
  private refillTimers = new Map<string, NodeJS.Timeout>()
  private cleanupTimer?: NodeJS.Timeout
  private stats = new Map<string, { requests: number; hits: number; errors: number }>()
  
  // Priority templates to pre-warm
  private priorityTemplates = ['nextjs-developer', 'static-html', 'streamlit-developer']
  
  async initialize(templates: string[] = this.priorityTemplates) {
    console.log('🚀 Initializing sandbox pools for:', templates)
    
    // Start with warm-up for priority templates
    const warmupPromises = templates.map(template => this.warmupTemplate(template))
    
    try {
      await Promise.allSettled(warmupPromises)
      console.log('✅ Initial sandbox pool warmup complete')
    } catch (error) {
      console.error('⚠️ Some sandbox pools failed to initialize:', error)
    }
    
    // Start background maintenance
    this.startBackgroundTasks()
  }
  
  private async warmupTemplate(template: string) {
    console.log(`🔥 Warming up ${template} template pool...`)
    
    // Create initial sandbox in parallel (but limit to 2 to avoid overwhelming)
    const initialCount = Math.min(2, this.poolSize)
    const promises = Array(initialCount).fill(null).map(() => this.createWarmSandbox(template))
    
    try {
      await Promise.all(promises)
      console.log(`✅ ${template} pool warmed up with ${initialCount} sandboxes`)
      
      // Schedule the rest in background
      this.scheduleRefill(template, 1000)
    } catch (error) {
      console.error(`❌ Failed to warm up ${template} pool:`, error)
    }
  }
  
  async getSandbox(template: string): Promise<Sandbox> {
    const startTime = Date.now()
    
    // Update stats
    this.updateStats(template, 'request')
    
    try {
      const pool = this.pools.get(template) || []
      
      // Find best available sandbox
      const available = pool.find(p => 
        !p.inUse && 
        this.isValid(p) && 
        p.warmupComplete
      )
      
      if (available) {
        // Mark as in use
        available.inUse = true
        available.lastUsed = Date.now()
        available.metadata.totalUses++
        
        this.updateStats(template, 'hit')
        
        console.log(`⚡ Using warm sandbox for ${template} (${Date.now() - startTime}ms)`)
        
        // Schedule refill if pool is getting low
        const availableCount = pool.filter(p => !p.inUse && this.isValid(p)).length
        if (availableCount < Math.ceil(this.poolSize / 2)) {
          this.scheduleRefill(template, 100) // Quick refill
        }
        
        return available.sandbox
      }
      
      // No warm sandbox available - create one immediately
      console.log(`🔨 Creating new sandbox for ${template} (no warm available)`)
      const sandbox = await this.createSandbox(template)
      
      // Add to pool for tracking
      const pooledSandbox: PooledSandbox = {
        sandbox,
        template,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: true,
        warmupComplete: true,
        metadata: {
          initTime: Date.now() - startTime,
          totalUses: 1,
          errors: 0
        }
      }
      
      if (!this.pools.has(template)) {
        this.pools.set(template, [])
      }
      this.pools.get(template)!.push(pooledSandbox)
      
      // Schedule aggressive refill
      this.scheduleRefill(template, 0)
      
      console.log(`✅ New sandbox created for ${template} (${Date.now() - startTime}ms)`)
      return sandbox
      
    } catch (error) {
      this.updateStats(template, 'error')
      console.error(`❌ Failed to get sandbox for ${template}:`, error)
      throw error
    }
  }
  
  releaseSandbox(sandbox: Sandbox, template: string) {
    const pool = this.pools.get(template) || []
    const pooled = pool.find(p => p.sandbox.sandboxId === sandbox.sandboxId)
    
    if (pooled && pooled.inUse) {
      pooled.inUse = false
      pooled.lastUsed = Date.now()
      console.log(`🔄 Released sandbox back to ${template} pool`)
    }
  }
  
  private async createWarmSandbox(template: string): Promise<void> {
    const startTime = Date.now()
    
    try {
      const sandbox = await this.createSandbox(template)
      
      // Perform warmup operations
      await this.performWarmup(sandbox, template)
      
      const pooledSandbox: PooledSandbox = {
        sandbox,
        template,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: false,
        warmupComplete: true,
        metadata: {
          initTime: Date.now() - startTime,
          totalUses: 0,
          errors: 0
        }
      }
      
      if (!this.pools.has(template)) {
        this.pools.set(template, [])
      }
      
      this.pools.get(template)!.push(pooledSandbox)
      console.log(`🔥 Warm sandbox added to ${template} pool (${Date.now() - startTime}ms)`)
      
    } catch (error) {
      console.error(`❌ Failed to create warm sandbox for ${template}:`, error)
      this.updateStats(template, 'error')
    }
  }
  
  private async createSandbox(template: string): Promise<Sandbox> {
    return await Sandbox.create(template, {
      metadata: {
        pooled: 'true',
        template,
        createdAt: new Date().toISOString()
      },
      timeoutMs: 10 * 60 * 1000 // 10 minutes
    })
  }
  
  private async performWarmup(sandbox: Sandbox, template: string): Promise<void> {
    try {
      // Basic warmup operations to make sandbox ready
      switch (template) {
        case 'nextjs-developer':
          // Pre-compile Next.js and install common packages
          await Promise.race([
            sandbox.commands.run('npm install --silent'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), this.warmupTimeout))
          ])
          break
          
        case 'streamlit-developer':
          // Warm up Python environment
          await Promise.race([
            sandbox.commands.run('python -c "import streamlit, pandas, numpy"'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), this.warmupTimeout))
          ])
          break
          
        case 'gradio-developer':
          // Warm up Gradio environment
          await Promise.race([
            sandbox.commands.run('python -c "import gradio, pandas, numpy"'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), this.warmupTimeout))
          ])
          break
          
        default:
          // Basic file system check
          await sandbox.files.list('/')
      }
    } catch (error) {
      console.warn(`⚠️ Warmup failed for ${template}:`, error instanceof Error ? error.message : 'Unknown error')
      // Don't throw - sandbox might still be usable
    }
  }
  
  private isValid(pooled: PooledSandbox): boolean {
    const age = Date.now() - pooled.createdAt
    const idleTime = Date.now() - pooled.lastUsed
    
    // Check if sandbox is too old or has been idle too long
    return age < this.maxAge && idleTime < this.maxAge && pooled.metadata.errors < 3
  }
  
  private scheduleRefill(template: string, delay = 0) {
    // Clear any existing timer
    if (this.refillTimers.has(template)) {
      clearTimeout(this.refillTimers.get(template)!)
    }
    
    const timer = setTimeout(async () => {
      await this.refillPool(template)
      this.refillTimers.delete(template)
    }, delay)
    
    this.refillTimers.set(template, timer)
  }
  
  private async refillPool(template: string) {
    const pool = this.pools.get(template) || []
    
    // Clean up invalid sandboxes
    const validPool = []
    for (const pooled of pool) {
      if (this.isValid(pooled) || pooled.inUse) {
        validPool.push(pooled)
      } else {
        // Clean up invalid sandbox
        try {
          await pooled.sandbox.kill()
        } catch (error) {
          console.warn(`⚠️ Failed to cleanup sandbox:`, error)
        }
      }
    }
    this.pools.set(template, validPool)
    
    // Calculate how many warm sandboxes we need
    const availableCount = validPool.filter(p => !p.inUse && p.warmupComplete).length
    const needed = this.poolSize - availableCount
    
    if (needed > 0) {
      console.log(`🔄 Refilling ${template} pool (need ${needed} sandboxes)`)
      
      // Create new sandboxes in parallel (but limit to 2 at a time)
      const batchSize = Math.min(2, needed)
      const promises = Array(batchSize).fill(null).map(() => this.createWarmSandbox(template))
      
      try {
        await Promise.all(promises)
        
        // If we still need more, schedule another refill
        if (needed > batchSize) {
          this.scheduleRefill(template, 2000)
        }
      } catch (error) {
        console.error(`❌ Failed to refill ${template} pool:`, error)
        // Retry with backoff
        this.scheduleRefill(template, 5000)
      }
    }
  }
  
  private startBackgroundTasks() {
    // Cleanup task every 2 minutes
    this.cleanupTimer = setInterval(async () => {
      await this.performMaintenance()
    }, 2 * 60 * 1000)
    
    console.log('🧹 Background maintenance tasks started')
  }
  
  private async performMaintenance() {
    let totalCleaned = 0
    
    for (const [template, pool] of this.pools.entries()) {
      const beforeCount = pool.length
      
      // Remove invalid sandboxes
      const validPool = []
      
      for (const pooled of pool) {
        if (pooled.inUse) {
          validPool.push(pooled)
        } else if (this.isValid(pooled)) {
          validPool.push(pooled)
        } else {
          // Clean up
          try {
            await pooled.sandbox.kill()
            totalCleaned++
          } catch (error) {
            console.warn(`⚠️ Failed to cleanup sandbox:`, error)
          }
        }
      }
      
      this.pools.set(template, validPool)
      
      if (beforeCount > validPool.length) {
        console.log(`🧹 Cleaned up ${beforeCount - validPool.length} sandboxes from ${template} pool`)
        
        // Schedule refill if needed
        const availableCount = validPool.filter(p => !p.inUse).length
        if (availableCount < Math.ceil(this.poolSize / 2)) {
          this.scheduleRefill(template, 1000)
        }
      }
    }
    
    if (totalCleaned > 0) {
      console.log(`🧹 Maintenance complete: cleaned ${totalCleaned} sandboxes`)
    }
  }
  
  private updateStats(template: string, type: 'request' | 'hit' | 'error') {
    if (!this.stats.has(template)) {
      this.stats.set(template, { requests: 0, hits: 0, errors: 0 })
    }
    
    const stat = this.stats.get(template)!
    
    switch (type) {
      case 'request':
        stat.requests++
        break
      case 'hit':
        stat.hits++
        break
      case 'error':
        stat.errors++
        break
    }
  }
  
  // Public methods for monitoring
  getPoolStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {}
    
    for (const [template, pool] of this.pools.entries()) {
      const available = pool.filter(p => !p.inUse && this.isValid(p) && p.warmupComplete)
      const active = pool.filter(p => p.inUse)
      const avgInitTime = pool.length > 0 
        ? pool.reduce((sum, p) => sum + p.metadata.initTime, 0) / pool.length 
        : 0
      
      const templateStats = this.stats.get(template) || { requests: 0, hits: 0, errors: 0 }
      const hitRate = templateStats.requests > 0 ? templateStats.hits / templateStats.requests : 0
      const errorRate = templateStats.requests > 0 ? templateStats.errors / templateStats.requests : 0
      
      stats[template] = {
        totalSandboxes: pool.length,
        availableSandboxes: available.length,
        activeSandboxes: active.length,
        averageInitTime: Math.round(avgInitTime),
        hitRate: Math.round(hitRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100
      }
    }
    
    return stats
  }
  
  async preWarmTemplate(template: string, count = this.poolSize): Promise<void> {
    console.log(`🔥 Pre-warming ${count} sandboxes for ${template}`)
    
    const promises = Array(count).fill(null).map(() => this.createWarmSandbox(template))
    
    try {
      await Promise.all(promises)
      console.log(`✅ Pre-warmed ${count} sandboxes for ${template}`)
    } catch (error) {
      console.error(`❌ Failed to pre-warm ${template}:`, error)
    }
  }
  
  async forceRefresh(template: string): Promise<void> {
    console.log(`🔄 Force refreshing ${template} pool`)
    
    const pool = this.pools.get(template) || []
    
    // Kill all non-active sandboxes
    const killPromises = pool
      .filter(p => !p.inUse)
      .map(p => p.sandbox.kill().catch(() => {}))
    
    await Promise.all(killPromises)
    
    // Keep only active sandboxes
    const activePool = pool.filter(p => p.inUse)
    this.pools.set(template, activePool)
    
    // Refill immediately
    await this.refillPool(template)
  }
  
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down sandbox pool...')
    
    // Clear all timers
    for (const timer of this.refillTimers.values()) {
      clearTimeout(timer)
    }
    this.refillTimers.clear()
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    // Kill all sandboxes
    const killPromises: Promise<void>[] = []
    
    for (const pool of this.pools.values()) {
      for (const pooled of pool) {
        killPromises.push(
          pooled.sandbox.kill().catch(err => 
            console.warn(`⚠️ Failed to kill sandbox ${pooled.sandbox.sandboxId}:`, err)
          )
        )
      }
    }
    
    await Promise.all(killPromises)
    this.pools.clear()
    this.stats.clear()
    
    console.log('✅ Sandbox pool shutdown complete')
  }
  
  // Utility methods
  getTotalSandboxes(): number {
    return Array.from(this.pools.values()).reduce((sum, pool) => sum + pool.length, 0)
  }
  
  getActiveTemplates(): string[] {
    return Array.from(this.pools.keys())
  }
  
  setPoolSize(template: string, size: number): void {
    this.poolSize = size
    console.log(`📏 Set pool size for ${template} to ${size}`)
    
    // Schedule refill to match new size
    this.scheduleRefill(template, 1000)
  }
}

// Global instance
export const sandboxPool = new SandboxPool()

// Auto-initialize in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  sandboxPool.initialize().catch(console.error)
  
  // Graceful shutdown
  process.on('SIGTERM', () => sandboxPool.shutdown())
  process.on('SIGINT', () => sandboxPool.shutdown())
}

// For development, provide manual initialization
export const initializeSandboxPool = (templates?: string[]) => {
  return sandboxPool.initialize(templates)
} 
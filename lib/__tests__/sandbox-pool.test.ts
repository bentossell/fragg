import { SandboxPool } from '../../archive/sandbox/sandbox-pool'

// Mock the Sandbox class
const mockSandbox = {
  sandboxId: 'test-sandbox-123',
  kill: jest.fn().mockResolvedValue(undefined),
  files: {
    list: jest.fn().mockResolvedValue([])
  }
}

// Mock the E2B Sandbox
jest.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: jest.fn().mockResolvedValue(mockSandbox)
  }
}))

describe('SandboxPool', () => {
  let sandboxPool: SandboxPool
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    sandboxPool = new SandboxPool()
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    jest.clearAllMocks()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('initialization', () => {
    it('should initialize with default templates', async () => {
      await sandboxPool.initialize()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Initializing sandbox pools for:'),
        expect.arrayContaining(['nextjs-developer', 'streamlit-developer', 'vue-developer'])
      )
    })

    it('should initialize with custom templates', async () => {
      const customTemplates = ['nextjs-developer', 'vue-developer']
      await sandboxPool.initialize(customTemplates)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Initializing sandbox pools for:'),
        customTemplates
      )
    })

    it('should handle initialization errors gracefully', async () => {
      const { Sandbox } = require('@e2b/code-interpreter')
      Sandbox.create.mockRejectedValueOnce(new Error('Sandbox creation failed'))
      
      await sandboxPool.initialize(['nextjs-developer'])
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to create warm sandbox for nextjs-developer:'),
        expect.any(Error)
      )
    })
  })

  describe('getSandbox', () => {
    beforeEach(async () => {
      await sandboxPool.initialize(['nextjs-developer'])
    })

    it('should return a warm sandbox when available', async () => {
      const sandbox = await sandboxPool.getSandbox('nextjs-developer')
      
      expect(sandbox).toBe(mockSandbox)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚡ Using warm sandbox for nextjs-developer')
      )
    })

    it('should create new sandbox when pool is empty', async () => {
      // Get all available sandboxes to empty the pool
      await sandboxPool.getSandbox('nextjs-developer')
      await sandboxPool.getSandbox('nextjs-developer')
      await sandboxPool.getSandbox('nextjs-developer')
      
      const sandbox = await sandboxPool.getSandbox('nextjs-developer')
      
      expect(sandbox).toBe(mockSandbox)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔨 Creating new sandbox for nextjs-developer')
      )
    })

    it('should handle sandbox creation errors', async () => {
      const { Sandbox } = require('@e2b/code-interpreter')
      Sandbox.create.mockRejectedValueOnce(new Error('Creation failed'))
      
      await expect(sandboxPool.getSandbox('invalid-template')).rejects.toThrow('Creation failed')
    })

    it('should track sandbox usage statistics', async () => {
      await sandboxPool.getSandbox('nextjs-developer')
      
      const stats = sandboxPool.getPoolStats()
      expect(stats['nextjs-developer']).toMatchObject({
        totalRequests: expect.any(Number),
        cacheHits: expect.any(Number),
        errors: expect.any(Number)
      })
    })
  })

  describe('releaseSandbox', () => {
    it('should mark sandbox as available for reuse', async () => {
      const sandbox = await sandboxPool.getSandbox('nextjs-developer')
      sandboxPool.releaseSandbox(sandbox, 'nextjs-developer')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Released sandbox back to nextjs-developer pool')
      )
    })

    it('should handle invalid sandbox release gracefully', () => {
      const invalidSandbox = { ...mockSandbox, sandboxId: 'invalid' }
      
      expect(() => {
        sandboxPool.releaseSandbox(invalidSandbox, 'nextjs-developer')
      }).not.toThrow()
    })
  })

  describe('pool statistics', () => {
    beforeEach(async () => {
      await sandboxPool.initialize(['nextjs-developer'])
    })

    it('should provide accurate pool statistics', async () => {
      await sandboxPool.getSandbox('nextjs-developer')
      
      const stats = sandboxPool.getPoolStats()
      
      expect(stats['nextjs-developer']).toMatchObject({
        availableSandboxes: expect.any(Number),
        totalSandboxes: expect.any(Number),
        totalRequests: expect.any(Number),
        cacheHits: expect.any(Number),
        hitRate: expect.any(Number),
        averageInitTime: expect.any(Number),
        errors: expect.any(Number)
      })
    })

    it('should track active templates', () => {
      const activeTemplates = sandboxPool.getActiveTemplates()
      expect(activeTemplates).toContain('nextjs-developer')
    })

    it('should calculate hit rate correctly', async () => {
      // Get multiple sandboxes to establish hit rate
      await sandboxPool.getSandbox('nextjs-developer')
      await sandboxPool.getSandbox('nextjs-developer')
      
      const stats = sandboxPool.getPoolStats()
      expect(stats['nextjs-developer'].hitRate).toBeGreaterThanOrEqual(0)
      expect(stats['nextjs-developer'].hitRate).toBeLessThanOrEqual(1)
    })
  })

  describe('maintenance and cleanup', () => {
    beforeEach(async () => {
      await sandboxPool.initialize(['nextjs-developer'])
    })

    it('should perform periodic maintenance', async () => {
      // Trigger maintenance manually
      await (sandboxPool as any).performMaintenance()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🧹')
      )
    })

    it('should refill pools when needed', async () => {
      // Empty the pool
      await sandboxPool.getSandbox('nextjs-developer')
      await sandboxPool.getSandbox('nextjs-developer')
      await sandboxPool.getSandbox('nextjs-developer')
      
      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Refilling nextjs-developer pool')
      )
    })

    it('should force refresh template pools', async () => {
      await sandboxPool.forceRefresh('nextjs-developer')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔄 Force refreshing nextjs-developer pool')
      )
    })

    it('should pre-warm template pools', async () => {
      await sandboxPool.preWarmTemplate('vue-developer', 2)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔥 Pre-warming 2 sandboxes for vue-developer')
      )
    })
  })

  describe('pool configuration', () => {
    it('should set custom pool size', () => {
      sandboxPool.setPoolSize('nextjs-developer', 5)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📏 Set pool size for nextjs-developer to 5')
      )
    })

    it('should handle pool size changes dynamically', async () => {
      await sandboxPool.initialize(['nextjs-developer'])
      sandboxPool.setPoolSize('nextjs-developer', 10)
      
      // Should trigger refill for larger pool size
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📏 Set pool size')
      )
    })
  })

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await sandboxPool.initialize(['nextjs-developer'])
      await sandboxPool.shutdown()
      
      expect(consoleSpy).toHaveBeenCalledWith('🛑 Shutting down sandbox pool...')
      expect(consoleSpy).toHaveBeenCalledWith('✅ Sandbox pool shutdown complete')
      expect(mockSandbox.kill).toHaveBeenCalled()
    })

    it('should handle shutdown errors gracefully', async () => {
      await sandboxPool.initialize(['nextjs-developer'])
      mockSandbox.kill.mockRejectedValueOnce(new Error('Kill failed'))
      
      await sandboxPool.shutdown()
      
      expect(consoleSpy).toHaveBeenCalledWith('✅ Sandbox pool shutdown complete')
    })
  })

  describe('error handling', () => {
    it('should handle invalid template requests', async () => {
      await expect(
        sandboxPool.getSandbox('non-existent-template')
      ).rejects.toThrow()
    })

    it('should recover from temporary failures', async () => {
      const { Sandbox } = require('@e2b/code-interpreter')
      
      // Fail once, then succeed
      Sandbox.create
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(mockSandbox)
      
      // First call should fail
      await expect(sandboxPool.getSandbox('nextjs-developer')).rejects.toThrow()
      
      // Second call should succeed
      const sandbox = await sandboxPool.getSandbox('nextjs-developer')
      expect(sandbox).toBe(mockSandbox)
    })

    it('should track error rates', async () => {
      const { Sandbox } = require('@e2b/code-interpreter')
      Sandbox.create.mockRejectedValueOnce(new Error('Test error'))
      
      try {
        await sandboxPool.getSandbox('nextjs-developer')
      } catch (error) {
        // Expected to fail
      }
      
      const stats = sandboxPool.getPoolStats()
      expect(stats['nextjs-developer'].errors).toBeGreaterThan(0)
    })
  })

  describe('performance', () => {
    it('should handle concurrent sandbox requests', async () => {
      await sandboxPool.initialize(['nextjs-developer'])
      
      const promises = Array(5).fill(null).map(() => 
        sandboxPool.getSandbox('nextjs-developer')
      )
      
      const sandboxes = await Promise.all(promises)
      expect(sandboxes).toHaveLength(5)
      sandboxes.forEach(sandbox => {
        expect(sandbox).toBeDefined()
        expect(sandbox.sandboxId).toBeDefined()
      })
    })

    it('should optimize pool sizes based on usage', async () => {
      await sandboxPool.initialize(['nextjs-developer'])
      
      // Simulate high usage
      for (let i = 0; i < 10; i++) {
        await sandboxPool.getSandbox('nextjs-developer')
      }
      
      const stats = sandboxPool.getPoolStats()
      expect(stats['nextjs-developer'].totalRequests).toBe(10)
    })
  })
}) 
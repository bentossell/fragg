import { shouldUseBrowserPreview, rolloutPercentage } from '../feature-flags'

// Mock crypto for consistent testing
const mockRandomValues = jest.fn()
global.crypto = {
  getRandomValues: mockRandomValues,
} as any

describe('Feature Flags', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default to 50% for predictable tests
    mockRandomValues.mockImplementation((arr: Uint8Array) => {
      arr[0] = 128 // ~50%
      return arr
    })
  })

  describe('shouldUseBrowserPreview', () => {
    describe('Template Support', () => {
      it('returns true for supported templates', () => {
        const supportedTemplates = ['nextjs-developer', 'vue-developer', 'static-html']
        
        supportedTemplates.forEach(template => {
          // Mock to always be in rollout
          mockRandomValues.mockImplementation((arr: Uint8Array) => {
            arr[0] = 0 // 0% - definitely in rollout
            return arr
          })
          
          expect(shouldUseBrowserPreview(template)).toBe(true)
        })
      })

      it('returns false for unsupported templates', () => {
        const unsupportedTemplates = ['streamlit-developer', 'gradio-developer', 'code-interpreter-v1']
        
        unsupportedTemplates.forEach(template => {
          expect(shouldUseBrowserPreview(template)).toBe(false)
        })
      })

      it('returns false for unknown templates', () => {
        expect(shouldUseBrowserPreview('unknown-template')).toBe(false)
        expect(shouldUseBrowserPreview('')).toBe(false)
        expect(shouldUseBrowserPreview(undefined as any)).toBe(false)
      })
    })

    describe('Gradual Rollout', () => {
      it('respects rollout percentage for supported templates', () => {
        const template = 'nextjs-developer'
        let inRolloutCount = 0
        const iterations = 1000

        // Test with different random values
        for (let i = 0; i < iterations; i++) {
          // Generate random value between 0-255
          const randomValue = Math.floor(Math.random() * 256)
          mockRandomValues.mockImplementation((arr: Uint8Array) => {
            arr[0] = randomValue
            return arr
          })
          
          if (shouldUseBrowserPreview(template)) {
            inRolloutCount++
          }
        }

        // Should be roughly equal to rollout percentage (with some variance)
        const actualPercentage = (inRolloutCount / iterations) * 100
        expect(actualPercentage).toBeGreaterThan(rolloutPercentage - 5)
        expect(actualPercentage).toBeLessThan(rolloutPercentage + 5)
      })

      it('always returns false for unsupported templates regardless of rollout', () => {
        const unsupportedTemplate = 'streamlit-developer'
        
        // Even with 0% random (always in rollout), should return false
        mockRandomValues.mockImplementation((arr: Uint8Array) => {
          arr[0] = 0
          return arr
        })
        
        expect(shouldUseBrowserPreview(unsupportedTemplate)).toBe(false)
      })

      it('returns consistent results for the same user', () => {
        const template = 'nextjs-developer'
        
        // Mock a specific "user" (consistent random value)
        mockRandomValues.mockImplementation((arr: Uint8Array) => {
          arr[0] = 5 // Low value, should be in rollout
          return arr
        })
        
        // Call multiple times - should always return the same result
        const results = Array.from({ length: 10 }, () => shouldUseBrowserPreview(template))
        expect(results.every(r => r === results[0])).toBe(true)
      })
    })

    describe('Edge Cases', () => {
      it('handles crypto.getRandomValues not being available', () => {
        // Remove crypto
        const originalCrypto = global.crypto
        ;(global as any).crypto = undefined
        
        // Should fall back gracefully
        expect(() => shouldUseBrowserPreview('nextjs-developer')).not.toThrow()
        
        // Restore
        global.crypto = originalCrypto
      })

      it('handles malformed template names', () => {
        const malformedTemplates = [
          'NEXTJS-DEVELOPER', // wrong case
          'nextjs_developer', // wrong separator
          'next-js-developer', // extra hyphen
          ' nextjs-developer ', // whitespace
        ]
        
        malformedTemplates.forEach(template => {
          expect(shouldUseBrowserPreview(template)).toBe(false)
        })
      })
    })
  })

  describe('Rollout Configuration', () => {
    it('has a reasonable rollout percentage', () => {
      expect(rolloutPercentage).toBeGreaterThanOrEqual(0)
      expect(rolloutPercentage).toBeLessThanOrEqual(100)
      expect(rolloutPercentage).toBe(10) // Current expected value
    })

    it('rollout percentage is a number', () => {
      expect(typeof rolloutPercentage).toBe('number')
      expect(Number.isInteger(rolloutPercentage)).toBe(true)
    })
  })

  describe('User ID Consistency', () => {
    it('generates consistent results for user sessions', () => {
      // Simulate multiple calls in the same session
      const template = 'nextjs-developer'
      const results: boolean[] = []
      
      // Use a fixed random value to simulate same user
      mockRandomValues.mockImplementation((arr: Uint8Array) => {
        arr[0] = 15 // Low value, likely in 10% rollout
        return arr
      })
      
      // Multiple calls should return same result
      for (let i = 0; i < 5; i++) {
        results.push(shouldUseBrowserPreview(template))
      }
      
      expect(new Set(results).size).toBe(1) // All results should be the same
    })

    it('generates different results for different users', () => {
      const template = 'nextjs-developer'
      const userResults: boolean[] = []
      
      // Simulate 100 different users
      for (let i = 0; i < 100; i++) {
        mockRandomValues.mockImplementation((arr: Uint8Array) => {
          arr[0] = i * 2.55 // Spread across 0-255
          return arr
        })
        
        userResults.push(shouldUseBrowserPreview(template))
      }
      
      // Should have both true and false results
      const trueCount = userResults.filter(r => r).length
      const falseCount = userResults.filter(r => !r).length
      
      expect(trueCount).toBeGreaterThan(0)
      expect(falseCount).toBeGreaterThan(0)
      
      // Roughly match rollout percentage
      const actualPercentage = (trueCount / userResults.length) * 100
      expect(actualPercentage).toBeCloseTo(rolloutPercentage, 0)
    })
  })

  describe('Production Readiness', () => {
    it('does not throw errors under any condition', () => {
      const testCases = [
        { template: 'nextjs-developer' },
        { template: null },
        { template: undefined },
        { template: '' },
        { template: 123 as any },
        { template: {} as any },
        { template: [] as any },
      ]
      
      testCases.forEach(({ template }) => {
        expect(() => shouldUseBrowserPreview(template)).not.toThrow()
      })
    })

    it('performs efficiently', () => {
      const iterations = 10000
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        shouldUseBrowserPreview('nextjs-developer')
      }
      
      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / iterations
      
      // Should be very fast (less than 0.01ms per call)
      expect(avgTime).toBeLessThan(0.01)
    })
  })
}) 
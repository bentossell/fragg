import { CodeOrchestrator } from '../ai-orchestrator'
import { StreamingUpdate } from '../types'

// Mock dependencies
jest.mock('../ai-triage', () => ({
  triageRequest: jest.fn().mockResolvedValue({
    stack: 'web',
    template: 'nextjs-developer',
    components: ['Button', 'Input'],
    requirements: {
      complexity: 'medium',
      userInterface: true,
      dataProcessing: false
    }
  })
}))

jest.mock('../component-library', () => ({
  componentLibrary: {
    getComponents: jest.fn().mockResolvedValue([
      { name: 'Button', code: 'button code' },
      { name: 'Input', code: 'input code' }
    ])
  }
}))

jest.mock('../ai-agents', () => ({
  AgentFactory: {
    createAgents: jest.fn().mockReturnValue([
      {
        constructor: { name: 'UIAgent' },
        execute: jest.fn().mockResolvedValue({
          code: 'ui code',
          success: true,
          executionTime: 100
        })
      },
      {
        constructor: { name: 'LogicAgent' },
        execute: jest.fn().mockResolvedValue({
          code: 'logic code',
          success: true,
          executionTime: 150
        })
      }
    ]),
    getEstimatedTime: jest.fn().mockReturnValue(500)
  }
}))

describe('CodeOrchestrator', () => {
  let orchestrator: CodeOrchestrator
  let updateCallback: jest.Mock

  beforeEach(() => {
    orchestrator = new CodeOrchestrator()
    updateCallback = jest.fn()
    jest.clearAllMocks()
  })

  describe('generateApp', () => {
    it('should complete full generation flow successfully', async () => {
      const prompt = 'Create a todo app with React'
      
      const result = await orchestrator.generateApp(prompt, updateCallback)

      expect(result).toMatchObject({
        code: expect.any(String),
        template: 'nextjs-developer',
        dependencies: expect.any(Array),
        executionTime: expect.any(Number),
        agentResults: expect.arrayContaining([
          expect.objectContaining({
            agentName: 'UIAgent',
            code: 'ui code',
            success: true,
            executionTime: 100
          }),
          expect.objectContaining({
            agentName: 'LogicAgent', 
            code: 'logic code',
            success: true,
            executionTime: 150
          })
        ]),
        metadata: expect.objectContaining({
          totalAgents: 2,
          triageTime: expect.any(Number),
          generationTime: expect.any(Number),
          assemblyTime: expect.any(Number)
        })
      })
    })

    it('should call update callback with correct sequence', async () => {
      const prompt = 'Create a simple app'
      
      await orchestrator.generateApp(prompt, updateCallback)

      // Verify the sequence of updates
      expect(updateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'triage',
          data: expect.objectContaining({ status: 'analyzing' })
        })
      )

      expect(updateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'triage',
          data: expect.objectContaining({ 
            status: 'complete',
            result: expect.any(Object)
          })
        })
      )

      expect(updateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_start',
          data: expect.objectContaining({
            agents: ['UIAgent', 'LogicAgent'],
            stack: 'web'
          })
        })
      )

      expect(updateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'assembly',
          data: expect.objectContaining({
            status: 'assembling'
          })
        })
      )

      expect(updateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'complete',
          data: expect.objectContaining({
            code: expect.any(String),
            template: 'nextjs-developer'
          })
        })
      )
    })

    it('should handle agent execution errors gracefully', async () => {
      // Mock one agent to fail
      const { AgentFactory } = require('../ai-agents')
      AgentFactory.createAgents.mockReturnValueOnce([
        {
          constructor: { name: 'UIAgent' },
          execute: jest.fn().mockRejectedValue(new Error('Agent failed'))
        },
        {
          constructor: { name: 'LogicAgent' },
          execute: jest.fn().mockResolvedValue({
            code: 'logic code',
            success: true,
            executionTime: 150
          })
        }
      ])

      const result = await orchestrator.generateApp('test prompt', updateCallback)

      expect(result.agentResults).toHaveLength(2)
      expect(result.agentResults[0].success).toBe(false)
      expect(result.agentResults[0].errors).toContain('Agent failed')
      expect(result.agentResults[1].success).toBe(true)
    })

    it('should work with existing code parameter', async () => {
      const existingCode = 'const existing = true;'
      const result = await orchestrator.generateApp(
        'Modify this code',
        updateCallback,
        existingCode
      )

      expect(result.code).toContain(existingCode)
    })

    it('should handle triage errors', async () => {
      const { triageRequest } = require('../ai-triage')
      triageRequest.mockRejectedValueOnce(new Error('Triage failed'))

      await expect(
        orchestrator.generateApp('test prompt', updateCallback)
      ).rejects.toThrow('Triage failed')
    })

    it('should measure execution times correctly', async () => {
      const result = await orchestrator.generateApp('test prompt', updateCallback)

      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.metadata.triageTime).toBeGreaterThan(0)
      expect(result.metadata.generationTime).toBeGreaterThan(0)
      expect(result.metadata.assemblyTime).toBeGreaterThan(0)
    })

    it('should handle component library failures', async () => {
      const { componentLibrary } = require('../component-library')
      componentLibrary.getComponents.mockRejectedValueOnce(new Error('Component library error'))

      // Should still complete with empty components
      const result = await orchestrator.generateApp('test prompt', updateCallback)
      expect(result).toBeDefined()
    })

    it('should update agent progress correctly', async () => {
      await orchestrator.generateApp('test prompt', updateCallback)

      // Check for agent_complete updates
      expect(updateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_complete',
          data: expect.objectContaining({
            agent: 'UIAgent',
            success: true,
            executionTime: 100
          })
        })
      )

      expect(updateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_complete',
          data: expect.objectContaining({
            agent: 'LogicAgent',
            success: true,
            executionTime: 150
          })
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle empty prompt', async () => {
      await expect(
        orchestrator.generateApp('', updateCallback)
      ).rejects.toThrow()
    })

    it('should handle null callback gracefully', async () => {
      const result = await orchestrator.generateApp('test prompt')
      expect(result).toBeDefined()
    })

    it('should collect all errors in metadata', async () => {
      const { AgentFactory } = require('../ai-agents')
      AgentFactory.createAgents.mockReturnValueOnce([
        {
          constructor: { name: 'FailingAgent' },
          execute: jest.fn().mockRejectedValue(new Error('Test error'))
        }
      ])

      const result = await orchestrator.generateApp('test prompt', updateCallback)
      
      expect(result.metadata.errors).toContain('Test error')
      expect(result.metadata.fallbacks).toBeGreaterThan(0)
    })
  })

  describe('performance', () => {
    it('should complete generation within reasonable time', async () => {
      const startTime = Date.now()
      await orchestrator.generateApp('test prompt', updateCallback)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent generations', async () => {
      const promises = [
        orchestrator.generateApp('prompt 1', updateCallback),
        orchestrator.generateApp('prompt 2', updateCallback),
        orchestrator.generateApp('prompt 3', updateCallback)
      ]

      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.code).toBeDefined()
        expect(result.template).toBeDefined()
      })
    })
  })
}) 
import { templatesToPrompt } from '../templates'
import templates from '../templates.json'

describe('templatesToPrompt', () => {
  test('handles valid templates object', () => {
    const result = templatesToPrompt(templates)
    expect(result).toContain('nextjs-developer')
    expect(result).toContain('nextjs-developer')
    expect(result).not.toContain('undefined')
  })

  test('handles empty templates object', () => {
    const result = templatesToPrompt({} as any)
    expect(result).toBe('No templates available')
  })

  test('handles null templates parameter', () => {
    const result = templatesToPrompt(null as any)
    expect(result).toBe('No templates available')
  })

  test('handles undefined templates parameter', () => {
    const result = templatesToPrompt(undefined as any)
    expect(result).toBe('No templates available')
  })

  test('handles templates with missing lib property', () => {
    const brokenTemplate = {
      'test-template': {
        name: 'Test Template',
        instructions: 'Test instructions',
        file: 'test.html',
        port: 3000
        // lib property is missing
      }
    } as any
    
    const result = templatesToPrompt(brokenTemplate)
    expect(result).toContain('test-template')
    expect(result).toContain('Dependencies installed: none')
    expect(result).not.toContain('undefined')
  })

  test('handles templates with null lib property', () => {
    const brokenTemplate = {
      'test-template': {
        name: 'Test Template',
        instructions: 'Test instructions',
        file: 'test.html',
        port: 3000,
        lib: null
      }
    } as any
    
    const result = templatesToPrompt(brokenTemplate)
    expect(result).toContain('test-template')
    expect(result).toContain('Dependencies installed: none')
    expect(result).not.toContain('undefined')
  })

  test('handles templates with non-array lib property', () => {
    const brokenTemplate = {
      'test-template': {
        name: 'Test Template',
        instructions: 'Test instructions',
        file: 'test.html',
        port: 3000,
        lib: 'not-an-array'
      }
    } as any
    
    const result = templatesToPrompt(brokenTemplate)
    expect(result).toContain('test-template')
    expect(result).toContain('Dependencies installed: none')
    expect(result).not.toContain('undefined')
  })

  test('handles templates with invalid template objects', () => {
    const brokenTemplate = {
      'valid-template': {
        name: 'Valid Template',
        instructions: 'Valid instructions',
        file: 'valid.html',
        port: 3000,
        lib: ['react', 'typescript']
      },
      'invalid-template': null
    } as any
    
    const result = templatesToPrompt(brokenTemplate)
    expect(result).toContain('valid-template')
    expect(result).toContain('invalid-template: Invalid template configuration')
    expect(result).not.toContain('undefined')
  })
}) 
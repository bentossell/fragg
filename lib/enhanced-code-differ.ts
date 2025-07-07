import { CodeDiff, DiffContext, DiffResult } from './code-differ'
import { AppVersion, VersionComparison } from './storage/enhanced-version-system'

export interface EnhancedDiffOptions {
  ignoreWhitespace?: boolean
  ignoreCase?: boolean
  context?: number
  algorithm?: 'myers' | 'patience' | 'histogram'
  semantic?: boolean
}

export interface CodeChange {
  type: 'insertion' | 'deletion' | 'modification' | 'move'
  startLine: number
  endLine: number
  content: string
  oldContent?: string
  confidence: number
  semantic?: {
    type: 'function' | 'variable' | 'import' | 'component' | 'style' | 'prop' | 'hook'
    name: string
    scope: string
    impact: 'low' | 'medium' | 'high'
  }
}

export interface EnhancedDiffResult extends DiffResult {
  changes: CodeChange[]
  semanticChanges: SemanticAnalysisResult
  complexity: {
    score: number
    factors: string[]
  }
  recommendations: string[]
}

export interface SemanticAnalysisResult {
  functionChanges: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  componentChanges: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  importChanges: {
    added: string[]
    removed: string[]
  }
  stateChanges: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  propChanges: {
    added: string[]
    removed: string[]
    modified: string[]
  }
  hookChanges: {
    added: string[]
    removed: string[]
  }
  riskScore: number
  breakingChanges: string[]
}

export class EnhancedCodeDiffer {
  
  /**
   * Create an enhanced diff with semantic analysis
   */
  static createEnhancedDiff(
    oldCode: any,
    newCode: any,
    options: EnhancedDiffOptions = {}
  ): EnhancedDiffResult {
    // Convert code to strings for analysis
    const oldStr = this.codeToString(oldCode)
    const newStr = this.codeToString(newCode)
    
    // Basic diff
    const basicDiff = this.performBasicDiff(oldStr, newStr, options)
    
    // Semantic analysis
    const semanticChanges = options.semantic ? 
      this.performSemanticAnalysis(oldCode, newCode) : 
      this.getEmptySemanticResult()
    
    // Extract changes
    const changes = this.extractChanges(oldStr, newStr, basicDiff.appliedDiffs)
    
    // Calculate complexity
    const complexity = this.calculateComplexity(changes, semanticChanges)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(changes, semanticChanges, complexity)
    
    return {
      ...basicDiff,
      changes,
      semanticChanges,
      complexity,
      recommendations
    }
  }

  /**
   * Compare two versions with enhanced analysis
   */
  static compareVersions(
    versionA: AppVersion,
    versionB: AppVersion,
    options: EnhancedDiffOptions = {}
  ): VersionComparison & { enhanced: EnhancedDiffResult } {
    const basicComparison = this.createBasicVersionComparison(versionA, versionB)
    const enhancedDiff = this.createEnhancedDiff(versionA.code, versionB.code, options)
    
    return {
      ...basicComparison,
      enhanced: enhancedDiff
    }
  }

  /**
   * Analyze code evolution across multiple versions
   */
  static analyzeEvolution(versions: AppVersion[]): {
    trends: {
      complexity: number[]
      linesOfCode: number[]
      functions: number[]
      components: number[]
    }
    patterns: {
      type: string
      description: string
      frequency: number
    }[]
    hotspots: {
      area: string
      changeFrequency: number
      lastChanged: number
    }[]
  } {
    const trends = {
      complexity: [] as number[],
      linesOfCode: [] as number[],
      functions: [] as number[],
      components: [] as number[]
    }
    
    const patterns: { type: string; description: string; frequency: number }[] = []
    const hotspots: { area: string; changeFrequency: number; lastChanged: number }[] = []
    
    // Analyze trends across versions
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i]
      const codeStr = this.codeToString(version.code)
      
      trends.linesOfCode.push(codeStr.split('\n').length)
      trends.functions.push(this.countFunctions(codeStr))
      trends.components.push(this.countComponents(codeStr))
      
      if (i > 0) {
        const prevVersion = versions[i - 1]
        const diff = this.createEnhancedDiff(prevVersion.code, version.code, { semantic: true })
        trends.complexity.push(diff.complexity.score)
        
        // Track patterns
        diff.changes.forEach(change => {
          const existingPattern = patterns.find(p => p.type === change.type)
          if (existingPattern) {
            existingPattern.frequency++
          } else {
            patterns.push({
              type: change.type,
              description: `${change.type} changes`,
              frequency: 1
            })
          }
        })
      }
    }
    
    return { trends, patterns, hotspots }
  }

  /**
   * Generate intelligent merge suggestions
   */
  static generateMergeStrategy(
    baseVersion: AppVersion,
    sourceVersion: AppVersion,
    targetVersion: AppVersion
  ): {
    strategy: 'auto' | 'manual' | 'conflict'
    conflicts: {
      type: 'function' | 'component' | 'import' | 'style'
      location: string
      description: string
      suggestions: string[]
    }[]
    autoMergeChanges: CodeChange[]
    manualReviewRequired: CodeChange[]
  } {
    const baseDiff = this.createEnhancedDiff(baseVersion.code, sourceVersion.code, { semantic: true })
    const targetDiff = this.createEnhancedDiff(baseVersion.code, targetVersion.code, { semantic: true })
    
    const conflicts: any[] = []
    const autoMergeChanges: CodeChange[] = []
    const manualReviewRequired: CodeChange[] = []
    
    // Analyze overlapping changes
    baseDiff.changes.forEach(sourceChange => {
      const conflictingChange = targetDiff.changes.find(targetChange =>
        this.changesOverlap(sourceChange, targetChange)
      )
      
      if (conflictingChange) {
        if (sourceChange.semantic && conflictingChange.semantic &&
            sourceChange.semantic.name === conflictingChange.semantic.name) {
          conflicts.push({
            type: sourceChange.semantic.type,
            location: sourceChange.semantic.scope,
            description: `Both branches modified ${sourceChange.semantic.name}`,
            suggestions: [
              'Review both changes and merge manually',
              'Keep source branch changes',
              'Keep target branch changes'
            ]
          })
          manualReviewRequired.push(sourceChange)
        } else {
          manualReviewRequired.push(sourceChange)
        }
      } else {
        autoMergeChanges.push(sourceChange)
      }
    })
    
    const strategy = conflicts.length > 0 ? 'conflict' : 
                    manualReviewRequired.length > 0 ? 'manual' : 'auto'
    
    return {
      strategy,
      conflicts,
      autoMergeChanges,
      manualReviewRequired
    }
  }

  // Private helper methods

  private static codeToString(code: any): string {
    if (typeof code === 'string') {
      return code
    }
    return JSON.stringify(code, null, 2)
  }

  private static performBasicDiff(
    oldStr: string,
    newStr: string,
    options: EnhancedDiffOptions
  ): DiffResult {
    // Use existing code-differ logic
    const context: DiffContext = {
      existingCode: oldStr,
      language: 'typescript',
      framework: 'react'
    }
    
    // Simple diff implementation
    const oldLines = oldStr.split('\n')
    const newLines = newStr.split('\n')
    
    const diffs: CodeDiff[] = []
    
    // Simple line-by-line comparison
    const maxLength = Math.max(oldLines.length, newLines.length)
    
    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]
      
      if (oldLine === undefined) {
        diffs.push({
          type: 'add',
          startLine: i,
          content: newLine,
          description: `Added line ${i + 1}`
        })
      } else if (newLine === undefined) {
        diffs.push({
          type: 'remove',
          startLine: i,
          content: oldLine,
          description: `Removed line ${i + 1}`
        })
      } else if (oldLine !== newLine) {
        diffs.push({
          type: 'replace',
          startLine: i,
          searchPattern: oldLine,
          content: newLine,
          description: `Modified line ${i + 1}`
        })
      }
    }
    
    return {
      success: true,
      modifiedCode: newStr,
      appliedDiffs: diffs
    }
  }

  private static performSemanticAnalysis(oldCode: any, newCode: any): SemanticAnalysisResult {
    const oldStr = this.codeToString(oldCode)
    const newStr = this.codeToString(newCode)
    
    const oldFunctions = this.extractFunctions(oldStr)
    const newFunctions = this.extractFunctions(newStr)
    
    const oldComponents = this.extractComponents(oldStr)
    const newComponents = this.extractComponents(newStr)
    
    const oldImports = this.extractImports(oldStr)
    const newImports = this.extractImports(newStr)
    
    const oldState = this.extractStateVariables(oldStr)
    const newState = this.extractStateVariables(newStr)
    
    const oldProps = this.extractProps(oldStr)
    const newProps = this.extractProps(newStr)
    
    const oldHooks = this.extractHooks(oldStr)
    const newHooks = this.extractHooks(newStr)
    
    const functionChanges = this.compareSets(oldFunctions, newFunctions)
    const componentChanges = this.compareSets(oldComponents, newComponents)
    const importChanges = this.compareArrays(oldImports, newImports)
    const stateChanges = this.compareSets(oldState, newState)
    const propChanges = this.compareSets(oldProps, newProps)
    const hookChanges = this.compareArrays(oldHooks, newHooks)
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore({
      functionChanges,
      componentChanges,
      importChanges,
      stateChanges,
      propChanges,
      hookChanges
    })
    
    // Identify breaking changes
    const breakingChanges = this.identifyBreakingChanges({
      functionChanges,
      componentChanges,
      propChanges
    })
    
    return {
      functionChanges,
      componentChanges,
      importChanges,
      stateChanges,
      propChanges,
      hookChanges,
      riskScore,
      breakingChanges
    }
  }

  private static extractChanges(
    oldStr: string,
    newStr: string,
    diffs: CodeDiff[]
  ): CodeChange[] {
    const changes: CodeChange[] = []
    
    diffs.forEach((diff, index) => {
      const change: CodeChange = {
        type: diff.type === 'add' ? 'insertion' :
              diff.type === 'remove' ? 'deletion' :
              'modification',
        startLine: diff.startLine || 0,
        endLine: diff.endLine || diff.startLine || 0,
        content: diff.content,
        oldContent: diff.searchPattern,
        confidence: 0.8
      }
      
      // Try to identify semantic meaning
      if (diff.content.includes('function') || diff.content.includes('=>')) {
        change.semantic = {
          type: 'function',
          name: this.extractFunctionName(diff.content),
          scope: 'global',
          impact: 'medium'
        }
      } else if (diff.content.includes('useState') || diff.content.includes('useEffect')) {
        change.semantic = {
          type: 'hook',
          name: this.extractHookName(diff.content),
          scope: 'component',
          impact: 'medium'
        }
      } else if (diff.content.includes('import')) {
        change.semantic = {
          type: 'import',
          name: this.extractImportName(diff.content),
          scope: 'file',
          impact: 'low'
        }
      }
      
      changes.push(change)
    })
    
    return changes
  }

  private static calculateComplexity(
    changes: CodeChange[],
    semanticChanges: SemanticAnalysisResult
  ): { score: number; factors: string[] } {
    let score = 0
    const factors: string[] = []
    
    // Base complexity from number of changes
    score += changes.length * 0.1
    
    // Semantic complexity
    const semanticChangeCount = 
      semanticChanges.functionChanges.added.length +
      semanticChanges.functionChanges.removed.length +
      semanticChanges.componentChanges.added.length +
      semanticChanges.componentChanges.removed.length
    
    score += semanticChangeCount * 0.2
    factors.push(`${semanticChangeCount} semantic changes`)
    
    // High-impact changes
    const highImpactChanges = changes.filter(c => c.semantic?.impact === 'high')
    if (highImpactChanges.length > 0) {
      score += highImpactChanges.length * 0.3
      factors.push(`${highImpactChanges.length} high-impact changes`)
    }
    
    // Breaking changes
    if (semanticChanges.breakingChanges.length > 0) {
      score += semanticChanges.breakingChanges.length * 0.5
      factors.push(`${semanticChanges.breakingChanges.length} breaking changes`)
    }
    
    return { score: Math.min(score, 10), factors }
  }

  private static generateRecommendations(
    changes: CodeChange[],
    semanticChanges: SemanticAnalysisResult,
    complexity: { score: number; factors: string[] }
  ): string[] {
    const recommendations: string[] = []
    
    if (complexity.score > 7) {
      recommendations.push('Consider breaking this change into smaller commits')
    }
    
    if (semanticChanges.breakingChanges.length > 0) {
      recommendations.push('This change includes breaking changes - update documentation')
      recommendations.push('Consider versioning strategy for breaking changes')
    }
    
    if (semanticChanges.functionChanges.removed.length > 0) {
      recommendations.push('Functions were removed - ensure no dependent code exists')
    }
    
    if (semanticChanges.importChanges.added.length > 3) {
      recommendations.push('Many new imports added - review bundle size impact')
    }
    
    const highRiskChanges = changes.filter(c => c.semantic?.impact === 'high')
    if (highRiskChanges.length > 0) {
      recommendations.push('High-risk changes detected - thorough testing recommended')
    }
    
    return recommendations
  }

  private static createBasicVersionComparison(
    versionA: AppVersion,
    versionB: AppVersion
  ): VersionComparison {
    const diffResult = this.performBasicDiff(
      this.codeToString(versionA.code),
      this.codeToString(versionB.code),
      {}
    )
    
    return {
      versionA,
      versionB,
      diff: {
        unified: this.generateUnifiedDiff(versionA.code, versionB.code),
        stats: {
          additions: diffResult.appliedDiffs.filter(d => d.type === 'add').length,
          deletions: diffResult.appliedDiffs.filter(d => d.type === 'remove').length,
          modifications: diffResult.appliedDiffs.filter(d => d.type === 'replace').length,
          filesChanged: 1
        },
        files: [{
          path: 'app.tsx',
          type: 'modified',
          hunks: []
        }]
      }
    }
  }

  private static generateUnifiedDiff(oldCode: any, newCode: any): string {
    const oldStr = this.codeToString(oldCode)
    const newStr = this.codeToString(newCode)
    
    const oldLines = oldStr.split('\n')
    const newLines = newStr.split('\n')
    
    let diff = '--- a/app.tsx\n+++ b/app.tsx\n'
    
    const maxLength = Math.max(oldLines.length, newLines.length)
    
    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]
      
      if (oldLine === undefined) {
        diff += `+${newLine}\n`
      } else if (newLine === undefined) {
        diff += `-${oldLine}\n`
      } else if (oldLine !== newLine) {
        diff += `-${oldLine}\n+${newLine}\n`
      } else {
        diff += ` ${oldLine}\n`
      }
    }
    
    return diff
  }

  private static getEmptySemanticResult(): SemanticAnalysisResult {
    return {
      functionChanges: { added: [], removed: [], modified: [] },
      componentChanges: { added: [], removed: [], modified: [] },
      importChanges: { added: [], removed: [] },
      stateChanges: { added: [], removed: [], modified: [] },
      propChanges: { added: [], removed: [], modified: [] },
      hookChanges: { added: [], removed: [] },
      riskScore: 0,
      breakingChanges: []
    }
  }

  // Utility methods for code analysis

  private static extractFunctions(code: string): Set<string> {
    const functions = new Set<string>()
    const lines = code.split('\n')
    
    lines.forEach(line => {
      const functionMatch = line.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=.*?=>|(\w+)\s*\(.*?\)\s*{)/)
      if (functionMatch) {
        const name = functionMatch[1] || functionMatch[2] || functionMatch[3]
        if (name) functions.add(name)
      }
    })
    
    return functions
  }

  private static extractComponents(code: string): Set<string> {
    const components = new Set<string>()
    const lines = code.split('\n')
    
    lines.forEach(line => {
      const componentMatch = line.match(/(?:function\s+([A-Z]\w+)|const\s+([A-Z]\w+)\s*=|<([A-Z]\w+))/)
      if (componentMatch) {
        const name = componentMatch[1] || componentMatch[2] || componentMatch[3]
        if (name) components.add(name)
      }
    })
    
    return components
  }

  private static extractImports(code: string): string[] {
    const imports: string[] = []
    const lines = code.split('\n')
    
    lines.forEach(line => {
      if (line.trim().startsWith('import')) {
        imports.push(line.trim())
      }
    })
    
    return imports
  }

  private static extractStateVariables(code: string): Set<string> {
    const state = new Set<string>()
    const lines = code.split('\n')
    
    lines.forEach(line => {
      const stateMatch = line.match(/const\s*\[(\w+),\s*set\w+\]\s*=\s*useState/)
      if (stateMatch) {
        state.add(stateMatch[1])
      }
    })
    
    return state
  }

  private static extractProps(code: string): Set<string> {
    const props = new Set<string>()
    const lines = code.split('\n')
    
    lines.forEach(line => {
      const propsMatch = line.match(/\{([^}]+)\}\s*:\s*\w+Props/)
      if (propsMatch) {
        const propList = propsMatch[1].split(',').map(p => p.trim())
        propList.forEach(prop => props.add(prop))
      }
    })
    
    return props
  }

  private static extractHooks(code: string): string[] {
    const hooks: string[] = []
    const lines = code.split('\n')
    
    lines.forEach(line => {
      const hookMatch = line.match(/use[A-Z]\w+/)
      if (hookMatch) {
        hooks.push(hookMatch[0])
      }
    })
    
    return hooks
  }

  private static compareSets<T>(oldSet: Set<T>, newSet: Set<T>): {
    added: T[]
    removed: T[]
    modified: T[]
  } {
    const added = Array.from(newSet).filter(item => !oldSet.has(item))
    const removed = Array.from(oldSet).filter(item => !newSet.has(item))
    const modified: T[] = [] // Would need more sophisticated analysis
    
    return { added, removed, modified }
  }

  private static compareArrays<T>(oldArray: T[], newArray: T[]): {
    added: T[]
    removed: T[]
  } {
    const oldSet = new Set(oldArray)
    const newSet = new Set(newArray)
    
    const added = newArray.filter(item => !oldSet.has(item))
    const removed = oldArray.filter(item => !newSet.has(item))
    
    return { added, removed }
  }

  private static calculateRiskScore(changes: any): number {
    let score = 0
    
    // Function changes carry medium risk
    score += (changes.functionChanges.added.length + changes.functionChanges.removed.length) * 0.3
    
    // Component changes carry high risk
    score += (changes.componentChanges.added.length + changes.componentChanges.removed.length) * 0.5
    
    // Import changes carry low risk
    score += (changes.importChanges.added.length + changes.importChanges.removed.length) * 0.1
    
    // State changes carry medium risk
    score += (changes.stateChanges.added.length + changes.stateChanges.removed.length) * 0.3
    
    // Prop changes carry high risk
    score += (changes.propChanges.added.length + changes.propChanges.removed.length) * 0.4
    
    return Math.min(score, 10)
  }

  private static identifyBreakingChanges(changes: any): string[] {
    const breaking: string[] = []
    
    // Removed functions are breaking
    changes.functionChanges.removed.forEach((fn: string) => {
      breaking.push(`Function '${fn}' was removed`)
    })
    
    // Removed components are breaking
    changes.componentChanges.removed.forEach((comp: string) => {
      breaking.push(`Component '${comp}' was removed`)
    })
    
    // Removed props are breaking
    changes.propChanges.removed.forEach((prop: string) => {
      breaking.push(`Prop '${prop}' was removed`)
    })
    
    return breaking
  }

  private static changesOverlap(changeA: CodeChange, changeB: CodeChange): boolean {
    return !(changeA.endLine < changeB.startLine || changeB.endLine < changeA.startLine)
  }

  private static extractFunctionName(content: string): string {
    const match = content.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=)/)
    return match ? (match[1] || match[2] || 'anonymous') : 'anonymous'
  }

  private static extractHookName(content: string): string {
    const match = content.match(/use[A-Z]\w+/)
    return match ? match[0] : 'unknown'
  }

  private static extractImportName(content: string): string {
    const match = content.match(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))/)
    return match ? (match[1] || match[2] || match[3] || 'unknown') : 'unknown'
  }

  private static countFunctions(code: string): number {
    return this.extractFunctions(code).size
  }

  private static countComponents(code: string): number {
    return this.extractComponents(code).size
  }
} 
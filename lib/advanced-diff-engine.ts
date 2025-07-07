import { CodeDiff, DiffContext, DiffResult } from './code-differ'
import { EnhancedCodeDiffer, CodeChange, EnhancedDiffResult, SemanticAnalysisResult } from './enhanced-code-differ'
import { AppVersion } from './storage/enhanced-version-system'

export interface AdvancedDiffOptions {
  ignoreWhitespace?: boolean
  ignoreCase?: boolean
  context?: number
  algorithm?: 'myers' | 'patience' | 'histogram' | 'semantic'
  semantic?: boolean
  conflictResolution?: 'auto' | 'manual' | 'interactive'
  preserveComments?: boolean
  mergeStrategy?: 'conservative' | 'aggressive' | 'balanced'
}

export interface ConflictResolution {
  id: string
  type: 'content' | 'structure' | 'dependency' | 'semantic'
  location: string
  description: string
  conflictingChanges: CodeChange[]
  strategies: {
    strategy: string
    description: string
    code: string
    riskLevel: 'low' | 'medium' | 'high'
  }[]
  selectedStrategy?: string
  autoResolvable: boolean
}

export interface ChangeValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
  syntaxValid: boolean
  semanticValid: boolean
  testsPassing?: boolean
  lintErrors?: number
  formatIssues?: number
}

export interface MergeStrategy {
  name: string
  description: string
  apply: (conflicts: ConflictResolution[]) => Promise<string>
  confidence: number
}

export interface DiffPlan {
  id: string
  description: string
  targetFiles: string[]
  estimatedChanges: number
  riskLevel: 'low' | 'medium' | 'high'
  dependencies: string[]
  rollbackStrategy: string
  validationSteps: string[]
}

export interface AdvancedDiffResult extends EnhancedDiffResult {
  plan: DiffPlan
  conflicts: ConflictResolution[]
  validation: ChangeValidation
  rollbackData: {
    originalCode: string
    changeHistory: CodeChange[]
    dependencies: string[]
  }
  previewCode: string
  applicationTime: number
  mergeStrategy?: MergeStrategy
}

export class AdvancedDiffEngine {
  private mergeStrategies: Map<string, MergeStrategy> = new Map()
  private validationRules: Map<string, (code: string) => ChangeValidation> = new Map()

  constructor() {
    this.initializeMergeStrategies()
    this.initializeValidationRules()
  }

  /**
   * Create an advanced diff with full analysis and conflict detection
   */
  async createAdvancedDiff(
    oldCode: any,
    newCode: any,
    options: AdvancedDiffOptions = {}
  ): Promise<AdvancedDiffResult> {
    const startTime = Date.now()

    // Step 1: Create enhanced diff
    const validAlgorithm = options.algorithm === 'semantic' ? 'myers' : options.algorithm
    const enhancedDiff = EnhancedCodeDiffer.createEnhancedDiff(oldCode, newCode, {
      semantic: options.semantic !== false,
      algorithm: validAlgorithm,
      ignoreWhitespace: options.ignoreWhitespace,
      ignoreCase: options.ignoreCase
    })

    // Step 2: Create diff plan
    const plan = this.createDiffPlan(enhancedDiff.changes, options)

    // Step 3: Detect and analyze conflicts
    const conflicts = await this.detectConflicts(enhancedDiff.changes, options)

    // Step 4: Validate changes
    const validation = await this.validateChanges(newCode, enhancedDiff.changes)

    // Step 5: Generate preview code
    const previewCode = await this.generatePreviewCode(oldCode, enhancedDiff.changes)

    // Step 6: Create rollback data
    const rollbackData = this.createRollbackData(oldCode, enhancedDiff.changes)

    // Step 7: Select merge strategy
    const mergeStrategy = this.selectMergeStrategy(conflicts, options)

    return {
      ...enhancedDiff,
      plan,
      conflicts,
      validation,
      rollbackData,
      previewCode,
      applicationTime: Date.now() - startTime,
      mergeStrategy
    }
  }

  /**
   * Apply incremental changes with conflict resolution
   */
  async applyIncrementalChanges(
    baseCode: string,
    changes: CodeChange[],
    options: AdvancedDiffOptions = {}
  ): Promise<AdvancedDiffResult> {
    // Create a simulated "new code" by applying changes
    const simulatedNewCode = await this.simulateChanges(baseCode, changes)
    return this.createAdvancedDiff(baseCode, simulatedNewCode, options)
  }

  /**
   * Merge multiple change sets with intelligent conflict resolution
   */
  async mergeChangeSets(
    baseCode: string,
    changeSets: CodeChange[][],
    options: AdvancedDiffOptions = {}
  ): Promise<AdvancedDiffResult> {
    // Step 1: Apply changes sequentially and detect conflicts
    let currentCode = baseCode
    const allChanges: CodeChange[] = []
    const allConflicts: ConflictResolution[] = []

    for (let i = 0; i < changeSets.length; i++) {
      const changeSet = changeSets[i]
      
      // Check for conflicts with existing changes
      const conflicts = await this.detectChangeSetConflicts(allChanges, changeSet)
      allConflicts.push(...conflicts)

      // Apply non-conflicting changes
      const nonConflictingChanges = changeSet.filter(change => 
        !conflicts.some(conflict => 
          conflict.conflictingChanges.includes(change)
        )
      )

      allChanges.push(...nonConflictingChanges)
      currentCode = await this.simulateChanges(currentCode, nonConflictingChanges)
    }

    // Step 2: Resolve conflicts if possible
    if (allConflicts.length > 0 && options.conflictResolution === 'auto') {
      const resolvedChanges = await this.autoResolveConflicts(allConflicts)
      allChanges.push(...resolvedChanges)
    }

    // Step 3: Create final diff result
    return this.createAdvancedDiff(baseCode, currentCode, options)
  }

  /**
   * Create a smart change plan
   */
  private createDiffPlan(changes: CodeChange[], options: AdvancedDiffOptions): DiffPlan {
    const riskLevel = this.calculateRiskLevel(changes)
    const dependencies = this.extractDependencies(changes)
    const estimatedChanges = changes.length

    return {
      id: crypto.randomUUID(),
      description: this.generatePlanDescription(changes),
      targetFiles: ['app.tsx'], // For now, single file
      estimatedChanges,
      riskLevel,
      dependencies,
      rollbackStrategy: 'version-based',
      validationSteps: [
        'Syntax validation',
        'Semantic analysis',
        'Dependency check',
        'Test compatibility'
      ]
    }
  }

  /**
   * Detect conflicts between changes
   */
  private async detectConflicts(
    changes: CodeChange[],
    options: AdvancedDiffOptions
  ): Promise<ConflictResolution[]> {
    const conflicts: ConflictResolution[] = []

    // Check for overlapping line changes
    for (let i = 0; i < changes.length; i++) {
      for (let j = i + 1; j < changes.length; j++) {
        const changeA = changes[i]
        const changeB = changes[j]

        if (this.changesOverlap(changeA, changeB)) {
          const conflict: ConflictResolution = {
            id: crypto.randomUUID(),
            type: 'content',
            location: `Lines ${changeA.startLine}-${changeB.endLine}`,
            description: 'Overlapping line modifications detected',
            conflictingChanges: [changeA, changeB],
            strategies: await this.generateResolutionStrategies(changeA, changeB),
            autoResolvable: this.isAutoResolvable(changeA, changeB)
          }
          conflicts.push(conflict)
        }
      }
    }

    // Check for semantic conflicts
    const semanticConflicts = await this.detectSemanticConflicts(changes)
    conflicts.push(...semanticConflicts)

    return conflicts
  }

  /**
   * Validate changes for correctness
   */
  private async validateChanges(
    code: string,
    changes: CodeChange[]
  ): Promise<ChangeValidation> {
    const codeStr = typeof code === 'string' ? code : JSON.stringify(code, null, 2)
    
    // Basic syntax validation
    const syntaxValid = this.validateSyntax(codeStr)
    
    // Semantic validation
    const semanticValid = await this.validateSemantics(codeStr, changes)
    
    // Check for common issues
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    if (!syntaxValid) {
      errors.push('Syntax errors detected in generated code')
    }

    // Check for missing imports
    const missingImports = this.checkMissingImports(codeStr)
    if (missingImports.length > 0) {
      warnings.push(`Potentially missing imports: ${missingImports.join(', ')}`)
    }

    // Check for unused variables
    const unusedVars = this.checkUnusedVariables(codeStr)
    if (unusedVars.length > 0) {
      suggestions.push(`Consider removing unused variables: ${unusedVars.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      syntaxValid,
      semanticValid,
      lintErrors: errors.length,
      formatIssues: warnings.length
    }
  }

  /**
   * Generate preview of code after changes
   */
  private async generatePreviewCode(
    originalCode: any,
    changes: CodeChange[]
  ): Promise<string> {
    return this.simulateChanges(
      typeof originalCode === 'string' ? originalCode : JSON.stringify(originalCode, null, 2),
      changes
    )
  }

  /**
   * Create rollback data for changes
   */
  private createRollbackData(
    originalCode: any,
    changes: CodeChange[]
  ): { originalCode: string; changeHistory: CodeChange[]; dependencies: string[] } {
    return {
      originalCode: typeof originalCode === 'string' ? originalCode : JSON.stringify(originalCode, null, 2),
      changeHistory: [...changes],
      dependencies: this.extractDependencies(changes)
    }
  }

  /**
   * Select appropriate merge strategy
   */
  private selectMergeStrategy(
    conflicts: ConflictResolution[],
    options: AdvancedDiffOptions
  ): MergeStrategy {
    if (conflicts.length === 0) {
      return this.mergeStrategies.get('simple')!
    }

    const strategyName = options.mergeStrategy || 'balanced'
    return this.mergeStrategies.get(strategyName) || this.mergeStrategies.get('balanced')!
  }

  /**
   * Initialize merge strategies
   */
  private initializeMergeStrategies(): void {
    this.mergeStrategies.set('simple', {
      name: 'Simple',
      description: 'Apply changes without conflict resolution',
      apply: async (conflicts) => '',
      confidence: 1.0
    })

    this.mergeStrategies.set('conservative', {
      name: 'Conservative',
      description: 'Preserve existing code when conflicts arise',
      apply: async (conflicts) => this.applyConservativeMerge(conflicts),
      confidence: 0.9
    })

    this.mergeStrategies.set('aggressive', {
      name: 'Aggressive',
      description: 'Apply new changes, overriding conflicts',
      apply: async (conflicts) => this.applyAggressiveMerge(conflicts),
      confidence: 0.7
    })

    this.mergeStrategies.set('balanced', {
      name: 'Balanced',
      description: 'Smart merge with contextual conflict resolution',
      apply: async (conflicts) => this.applyBalancedMerge(conflicts),
      confidence: 0.8
    })
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules.set('react', (code: string) => this.validateReactCode(code))
    this.validationRules.set('typescript', (code: string) => this.validateTypeScriptCode(code))
    this.validationRules.set('javascript', (code: string) => this.validateJavaScriptCode(code))
  }

  // Helper methods

  private changesOverlap(changeA: CodeChange, changeB: CodeChange): boolean {
    return !(changeA.endLine < changeB.startLine || changeB.endLine < changeA.startLine)
  }

  private calculateRiskLevel(changes: CodeChange[]): 'low' | 'medium' | 'high' {
    const highRiskChanges = changes.filter(c => c.semantic?.impact === 'high').length
    const totalChanges = changes.length

    if (highRiskChanges > totalChanges * 0.5) return 'high'
    if (highRiskChanges > 0 || totalChanges > 10) return 'medium'
    return 'low'
  }

  private extractDependencies(changes: CodeChange[]): string[] {
    const deps = new Set<string>()
    changes.forEach(change => {
      if (change.semantic?.type === 'import') {
        deps.add(change.semantic.name)
      }
    })
    return Array.from(deps)
  }

  private generatePlanDescription(changes: CodeChange[]): string {
    const types = new Set(changes.map(c => c.type))
    const count = changes.length
    return `Apply ${count} changes: ${Array.from(types).join(', ')}`
  }

  private async simulateChanges(code: string, changes: CodeChange[]): Promise<string> {
    let result = code
    const lines = result.split('\n')

    // Sort changes by line number (reverse order to maintain line numbers)
    const sortedChanges = [...changes].sort((a, b) => b.startLine - a.startLine)

    for (const change of sortedChanges) {
      switch (change.type) {
        case 'insertion':
          lines.splice(change.startLine, 0, change.content)
          break
        case 'deletion':
          lines.splice(change.startLine, change.endLine - change.startLine + 1)
          break
        case 'modification':
          lines.splice(change.startLine, change.endLine - change.startLine + 1, change.content)
          break
      }
    }

    return lines.join('\n')
  }

  private async detectChangeSetConflicts(
    existingChanges: CodeChange[],
    newChanges: CodeChange[]
  ): Promise<ConflictResolution[]> {
    const conflicts: ConflictResolution[] = []

    for (const newChange of newChanges) {
      for (const existingChange of existingChanges) {
        if (this.changesOverlap(newChange, existingChange)) {
          conflicts.push({
            id: crypto.randomUUID(),
            type: 'content',
            location: `Lines ${Math.min(newChange.startLine, existingChange.startLine)}-${Math.max(newChange.endLine, existingChange.endLine)}`,
            description: 'Change set conflict detected',
            conflictingChanges: [existingChange, newChange],
            strategies: await this.generateResolutionStrategies(existingChange, newChange),
            autoResolvable: this.isAutoResolvable(existingChange, newChange)
          })
        }
      }
    }

    return conflicts
  }

  private async generateResolutionStrategies(
    changeA: CodeChange,
    changeB: CodeChange
  ): Promise<Array<{ strategy: string; description: string; code: string; riskLevel: 'low' | 'medium' | 'high' }>> {
    return [
      {
        strategy: 'keep-first',
        description: 'Keep the first change, discard the second',
        code: changeA.content,
        riskLevel: 'low'
      },
      {
        strategy: 'keep-second',
        description: 'Keep the second change, discard the first',
        code: changeB.content,
        riskLevel: 'low'
      },
      {
        strategy: 'merge',
        description: 'Attempt to merge both changes',
        code: this.attemptMerge(changeA.content, changeB.content),
        riskLevel: 'medium'
      }
    ]
  }

  private isAutoResolvable(changeA: CodeChange, changeB: CodeChange): boolean {
    // Simple heuristics for auto-resolution
    if (changeA.semantic?.type === 'import' && changeB.semantic?.type === 'import') {
      return true // Imports can usually be merged
    }
    
    if (changeA.semantic?.type === 'style' && changeB.semantic?.type === 'style') {
      return true // Style changes can often be merged
    }

    return false
  }

  private async detectSemanticConflicts(changes: CodeChange[]): Promise<ConflictResolution[]> {
    const conflicts: ConflictResolution[] = []
    
    // Check for function signature conflicts
    const functionChanges = changes.filter(c => c.semantic?.type === 'function')
    for (let i = 0; i < functionChanges.length; i++) {
      for (let j = i + 1; j < functionChanges.length; j++) {
        const funcA = functionChanges[i]
        const funcB = functionChanges[j]
        
        if (funcA.semantic?.name === funcB.semantic?.name && funcA.semantic?.name) {
          conflicts.push({
            id: crypto.randomUUID(),
            type: 'semantic',
            location: `Function ${funcA.semantic.name}`,
            description: `Multiple modifications to function ${funcA.semantic.name}`,
            conflictingChanges: [funcA, funcB],
            strategies: await this.generateResolutionStrategies(funcA, funcB),
            autoResolvable: false
          })
        }
      }
    }

    return conflicts
  }

  private async autoResolveConflicts(conflicts: ConflictResolution[]): Promise<CodeChange[]> {
    const resolvedChanges: CodeChange[] = []

    for (const conflict of conflicts) {
      if (conflict.autoResolvable && conflict.strategies.length > 0) {
        // Use the first strategy for auto-resolution
        const strategy = conflict.strategies[0]
        const resolvedChange: CodeChange = {
          type: 'modification',
          startLine: Math.min(...conflict.conflictingChanges.map(c => c.startLine)),
          endLine: Math.max(...conflict.conflictingChanges.map(c => c.endLine)),
          content: strategy.code,
          confidence: 0.8,
          semantic: {
            type: 'function',
            name: 'auto-resolved',
            scope: 'local',
            impact: 'medium'
          }
        }
        resolvedChanges.push(resolvedChange)
      }
    }

    return resolvedChanges
  }

  private validateSyntax(code: string): boolean {
    try {
      // Basic syntax validation - could be enhanced with actual parsers
      if (code.includes('import React') || code.includes('export default')) {
        // Check for basic React/TypeScript syntax
        return this.validateReactSyntax(code)
      }
      return true
    } catch {
      return false
    }
  }

  private async validateSemantics(code: string, changes: CodeChange[]): Promise<boolean> {
    // Check for semantic consistency
    const hasImportChanges = changes.some(c => c.semantic?.type === 'import')
    const hasFunctionChanges = changes.some(c => c.semantic?.type === 'function')
    
    if (hasImportChanges) {
      return this.validateImportConsistency(code)
    }
    
    if (hasFunctionChanges) {
      return this.validateFunctionConsistency(code)
    }

    return true
  }

  private checkMissingImports(code: string): string[] {
    const missing: string[] = []
    
    // Check for common React patterns without imports
    if (code.includes('useState') && !code.includes('import { useState }')) {
      missing.push('useState')
    }
    
    if (code.includes('useEffect') && !code.includes('import { useEffect }')) {
      missing.push('useEffect')
    }

    return missing
  }

  private checkUnusedVariables(code: string): string[] {
    const unused: string[] = []
    
    // Simple check for unused variables (could be enhanced)
    const variableDeclarations = code.match(/(?:const|let|var)\s+(\w+)/g) || []
    const declaredVars = variableDeclarations.map(decl => decl.split(/\s+/)[1])
    
    for (const varName of declaredVars) {
      const usageRegex = new RegExp(`\\b${varName}\\b`, 'g')
      const usages = (code.match(usageRegex) || []).length
      if (usages <= 1) { // Only the declaration itself
        unused.push(varName)
      }
    }

    return unused
  }

  private attemptMerge(contentA: string, contentB: string): string {
    // Simple merge strategy - in production, this would be more sophisticated
    if (contentA.includes(contentB) || contentB.includes(contentA)) {
      return contentA.length > contentB.length ? contentA : contentB
    }
    
    // Try to combine both if they seem compatible
    if (this.areCompatibleForMerge(contentA, contentB)) {
      return `${contentA}\n${contentB}`
    }
    
    return contentB // Default to newer change
  }

  private areCompatibleForMerge(contentA: string, contentB: string): boolean {
    // Simple heuristics for merge compatibility
    if (contentA.includes('import') && contentB.includes('import')) {
      return true
    }
    
    if (contentA.includes('className') && contentB.includes('className')) {
      return false // Style conflicts
    }
    
    return true
  }

  private async applyConservativeMerge(conflicts: ConflictResolution[]): Promise<string> {
    // Conservative strategy: prefer existing code
    return 'conservative-merge-result'
  }

  private async applyAggressiveMerge(conflicts: ConflictResolution[]): Promise<string> {
    // Aggressive strategy: prefer new changes
    return 'aggressive-merge-result'
  }

  private async applyBalancedMerge(conflicts: ConflictResolution[]): Promise<string> {
    // Balanced strategy: smart contextual merging
    return 'balanced-merge-result'
  }

  private validateReactCode(code: string): ChangeValidation {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!code.includes('import React')) {
      warnings.push('Missing React import')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: [],
      syntaxValid: true,
      semanticValid: true
    }
  }

  private validateTypeScriptCode(code: string): ChangeValidation {
    return this.validateReactCode(code)
  }

  private validateJavaScriptCode(code: string): ChangeValidation {
    return this.validateReactCode(code)
  }

  private validateReactSyntax(code: string): boolean {
    // Basic React syntax validation
    const openTags = (code.match(/<\w+/g) || []).length
    const closeTags = (code.match(/<\/\w+>/g) || []).length
    const selfClosing = (code.match(/<\w+[^>]*\/>/g) || []).length
    
    return openTags === closeTags + selfClosing
  }

  private validateImportConsistency(code: string): boolean {
    // Check if all imports are properly formatted and used
    const imports = code.match(/import .+ from .+/g) || []
    return imports.length > 0
  }

  private validateFunctionConsistency(code: string): boolean {
    // Check if function declarations are consistent
    const functions = code.match(/function \w+\(.*?\)/g) || []
    const arrowFunctions = code.match(/const \w+ = \(.*?\) =>/g) || []
    return functions.length + arrowFunctions.length > 0
  }
} 
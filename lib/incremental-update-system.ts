import { AdvancedDiffEngine, AdvancedDiffResult, AdvancedDiffOptions, ConflictResolution } from './advanced-diff-engine'
import { CodeChange, EnhancedDiffResult } from './enhanced-code-differ'
import { AppVersion, EnhancedVersionSystem } from './storage/enhanced-version-system'

export interface FileModification {
  filePath: string
  originalContent: string
  modifiedContent: string
  changes: CodeChange[]
  dependencies: string[]
  status: 'pending' | 'applied' | 'failed' | 'skipped'
  error?: string
}

export interface UpdatePlan {
  id: string
  description: string
  targetFiles: FileModification[]
  dependencyGraph: Map<string, string[]>
  executionOrder: string[]
  rollbackStrategy: 'atomic' | 'incremental' | 'checkpoint'
  estimatedDuration: number
  riskAssessment: {
    overall: 'low' | 'medium' | 'high'
    factors: string[]
    mitigations: string[]
  }
  validationSteps: ValidationStep[]
}

export interface ValidationStep {
  id: string
  name: string
  description: string
  validator: (context: UpdateContext) => Promise<ValidationResult>
  required: boolean
  timeout?: number
}

export interface ValidationResult {
  passed: boolean
  errors: string[]
  warnings: string[]
  metrics?: Record<string, number>
}

export interface UpdateContext {
  plan: UpdatePlan
  currentState: Map<string, string>
  modifiedFiles: Map<string, FileModification>
  metadata: {
    startTime: number
    userId?: string
    requestId: string
    rollbackPoints: RollbackPoint[]
  }
}

export interface RollbackPoint {
  id: string
  timestamp: number
  description: string
  state: Map<string, string>
  appliedChanges: FileModification[]
}

export interface UpdateProgress {
  stage: 'planning' | 'validation' | 'execution' | 'verification' | 'complete' | 'rollback'
  currentFile?: string
  currentStep?: string
  progress: number
  estimatedTimeRemaining?: number
  errors: string[]
  warnings: string[]
}

export interface DependencyAnalysis {
  imports: {
    file: string
    dependencies: string[]
    circular: boolean
  }[]
  exports: {
    file: string
    exports: string[]
    consumers: string[]
  }[]
  conflicts: {
    type: 'naming' | 'version' | 'circular'
    description: string
    files: string[]
    severity: 'low' | 'medium' | 'high'
  }[]
}

export class IncrementalUpdateSystem {
  private diffEngine = new AdvancedDiffEngine()
  private versionSystem: EnhancedVersionSystem | null = null
  private activeUpdates = new Map<string, UpdateContext>()

  constructor(private appId: string) {
    this.versionSystem = new EnhancedVersionSystem(appId)
  }

  /**
   * Create an update plan for incremental changes
   */
  async createUpdatePlan(
    userRequest: string,
    currentCode: any,
    options: AdvancedDiffOptions = {}
  ): Promise<UpdatePlan> {
    const startTime = Date.now()

    // Step 1: Analyze the user request to identify target changes
    const targetChanges = await this.analyzeUserRequest(userRequest, currentCode)

    // Step 2: Create file modifications
    const fileModifications = await this.createFileModifications(targetChanges, currentCode)

    // Step 3: Analyze dependencies
    const dependencyAnalysis = await this.analyzeDependencies(fileModifications)

    // Step 4: Create execution order
    const executionOrder = this.createExecutionOrder(fileModifications, dependencyAnalysis)

    // Step 5: Assess risks
    const riskAssessment = this.assessRisks(fileModifications, dependencyAnalysis)

    // Step 6: Create validation steps
    const validationSteps = this.createValidationSteps(fileModifications, options)

    return {
      id: crypto.randomUUID(),
      description: this.generatePlanDescription(userRequest, fileModifications),
      targetFiles: fileModifications,
      dependencyGraph: this.buildDependencyGraph(dependencyAnalysis),
      executionOrder,
      rollbackStrategy: this.selectRollbackStrategy(riskAssessment),
      estimatedDuration: this.estimateDuration(fileModifications),
      riskAssessment,
      validationSteps
    }
  }

  /**
   * Execute an update plan with progress tracking
   */
  async executeUpdatePlan(
    plan: UpdatePlan,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ success: boolean; results: Map<string, FileModification>; errors: string[] }> {
    const requestId = crypto.randomUUID()
    const context: UpdateContext = {
      plan,
      currentState: new Map(),
      modifiedFiles: new Map(),
      metadata: {
        startTime: Date.now(),
        requestId,
        rollbackPoints: []
      }
    }

    this.activeUpdates.set(requestId, context)

    try {
      // Stage 1: Planning validation
      onProgress?.({
        stage: 'planning',
        progress: 0,
        errors: [],
        warnings: []
      })

      await this.validatePlan(plan)

      // Stage 2: Pre-execution validation
      onProgress?.({
        stage: 'validation',
        progress: 10,
        errors: [],
        warnings: []
      })

      const validationResults = await this.runValidationSteps(plan, context)
      const criticalErrors = validationResults.filter(r => !r.passed && r.required)

      if (criticalErrors.length > 0) {
        throw new Error(`Validation failed: ${criticalErrors.map(e => e.errors.join(', ')).join('; ')}`)
      }

      // Create initial rollback point
      const initialRollback = this.createRollbackPoint(context, 'Initial state')
      context.metadata.rollbackPoints.push(initialRollback)

      // Stage 3: Execute changes
      onProgress?.({
        stage: 'execution',
        progress: 20,
        errors: [],
        warnings: []
      })

      const results = await this.executeChanges(plan, context, onProgress)

      // Stage 4: Post-execution verification
      onProgress?.({
        stage: 'verification',
        progress: 90,
        errors: [],
        warnings: []
      })

      await this.verifyChanges(context)

      // Stage 5: Create version if successful
      if (this.versionSystem && results.success) {
        await this.createVersionFromUpdate(context)
      }

      onProgress?.({
        stage: 'complete',
        progress: 100,
        errors: results.errors,
        warnings: []
      })

      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      onProgress?.({
        stage: 'rollback',
        progress: 0,
        errors: [errorMessage],
        warnings: []
      })

      await this.rollbackChanges(context)
      
      return {
        success: false,
        results: new Map(),
        errors: [errorMessage]
      }
    } finally {
      this.activeUpdates.delete(requestId)
    }
  }

  /**
   * Apply targeted changes to specific parts of the code
   */
  async applyTargetedChanges(
    baseCode: string,
    changes: CodeChange[],
    options: AdvancedDiffOptions = {}
  ): Promise<AdvancedDiffResult> {
    return this.diffEngine.applyIncrementalChanges(baseCode, changes, options)
  }

  /**
   * Merge multiple change sets with conflict resolution
   */
  async mergeChangeSets(
    baseCode: string,
    changeSets: CodeChange[][],
    options: AdvancedDiffOptions = {}
  ): Promise<AdvancedDiffResult> {
    return this.diffEngine.mergeChangeSets(baseCode, changeSets, options)
  }

  /**
   * Rollback changes to a specific point
   */
  async rollbackToPoint(requestId: string, rollbackPointId: string): Promise<boolean> {
    const context = this.activeUpdates.get(requestId)
    if (!context) {
      throw new Error('Update context not found')
    }

    const rollbackPoint = context.metadata.rollbackPoints.find(rp => rp.id === rollbackPointId)
    if (!rollbackPoint) {
      throw new Error('Rollback point not found')
    }

    try {
      // Restore state from rollback point
      context.currentState = new Map(rollbackPoint.state)
      
      // Remove subsequent rollback points
      const pointIndex = context.metadata.rollbackPoints.findIndex(rp => rp.id === rollbackPointId)
      context.metadata.rollbackPoints = context.metadata.rollbackPoints.slice(0, pointIndex + 1)

      return true
    } catch (error) {
      console.error('Rollback failed:', error)
      return false
    }
  }

  /**
   * Get update progress for a specific request
   */
  getUpdateProgress(requestId: string): UpdateProgress | null {
    const context = this.activeUpdates.get(requestId)
    if (!context) return null

    // Calculate progress based on current stage
    const currentTime = Date.now()
    const elapsed = currentTime - context.metadata.startTime
    const estimated = context.plan.estimatedDuration

    return {
      stage: 'execution', // This would be tracked in real implementation
      progress: Math.min(95, (elapsed / estimated) * 100),
      estimatedTimeRemaining: Math.max(0, estimated - elapsed),
      errors: [],
      warnings: []
    }
  }

  // Private helper methods

  private async analyzeUserRequest(userRequest: string, currentCode: any): Promise<CodeChange[]> {
    // Analyze user request to identify target changes
    // This would use AI/NLP in a real implementation
    
    const codeStr = typeof currentCode === 'string' ? currentCode : JSON.stringify(currentCode, null, 2)
    
    // Simple analysis for demonstration
    const changes: CodeChange[] = []
    
    if (userRequest.toLowerCase().includes('add') || userRequest.toLowerCase().includes('create')) {
      changes.push({
        type: 'insertion',
        startLine: codeStr.split('\n').length,
        endLine: codeStr.split('\n').length,
        content: '// New content based on user request',
        confidence: 0.8,
        semantic: {
          type: 'function',
          name: 'newFeature',
          scope: 'global',
          impact: 'medium'
        }
      })
    }

    return changes
  }

  private async createFileModifications(
    changes: CodeChange[],
    currentCode: any
  ): Promise<FileModification[]> {
    const codeStr = typeof currentCode === 'string' ? currentCode : JSON.stringify(currentCode, null, 2)
    
    return [{
      filePath: 'app.tsx',
      originalContent: codeStr,
      modifiedContent: await this.applyChangesToContent(codeStr, changes),
      changes,
      dependencies: this.extractDependenciesFromChanges(changes),
      status: 'pending'
    }]
  }

  private async analyzeDependencies(fileModifications: FileModification[]): Promise<DependencyAnalysis> {
    const imports: { file: string; dependencies: string[]; circular: boolean }[] = []
    const exports: { file: string; exports: string[]; consumers: string[] }[] = []
    const conflicts: { type: 'naming' | 'version' | 'circular'; description: string; files: string[]; severity: 'low' | 'medium' | 'high' }[] = []

    for (const mod of fileModifications) {
      const fileDeps = this.extractImportsFromContent(mod.modifiedContent)
      const fileExports = this.extractExportsFromContent(mod.modifiedContent)

      imports.push({
        file: mod.filePath,
        dependencies: fileDeps,
        circular: false // Would be calculated properly
      })

      exports.push({
        file: mod.filePath,
        exports: fileExports,
        consumers: [] // Would be calculated from other files
      })
    }

    return { imports, exports, conflicts }
  }

  private createExecutionOrder(
    fileModifications: FileModification[],
    dependencyAnalysis: DependencyAnalysis
  ): string[] {
    // Simple topological sort for dependency order
    const visited = new Set<string>()
    const order: string[] = []

    const visit = (filePath: string) => {
      if (visited.has(filePath)) return
      visited.add(filePath)

      const deps = dependencyAnalysis.imports.find(imp => imp.file === filePath)?.dependencies || []
      for (const dep of deps) {
        const depFile = fileModifications.find(mod => mod.filePath.includes(dep))?.filePath
        if (depFile && !visited.has(depFile)) {
          visit(depFile)
        }
      }

      order.push(filePath)
    }

    for (const mod of fileModifications) {
      visit(mod.filePath)
    }

    return order
  }

  private assessRisks(
    fileModifications: FileModification[],
    dependencyAnalysis: DependencyAnalysis
  ): { overall: 'low' | 'medium' | 'high'; factors: string[]; mitigations: string[] } {
    const factors: string[] = []
    const mitigations: string[] = []

    // Check for high-impact changes
    const highImpactChanges = fileModifications.flatMap(mod => 
      mod.changes.filter(change => change.semantic?.impact === 'high')
    )

    if (highImpactChanges.length > 0) {
      factors.push(`${highImpactChanges.length} high-impact changes`)
      mitigations.push('Create checkpoint before each high-impact change')
    }

    // Check for dependency conflicts
    if (dependencyAnalysis.conflicts.length > 0) {
      factors.push(`${dependencyAnalysis.conflicts.length} dependency conflicts`)
      mitigations.push('Resolve conflicts before execution')
    }

    const overall = factors.length > 2 ? 'high' : factors.length > 0 ? 'medium' : 'low'

    return { overall, factors, mitigations }
  }

  private createValidationSteps(
    fileModifications: FileModification[],
    options: AdvancedDiffOptions
  ): ValidationStep[] {
    return [
      {
        id: 'syntax-validation',
        name: 'Syntax Validation',
        description: 'Validate syntax of modified files',
        validator: async (context) => this.validateSyntax(context),
        required: true
      },
      {
        id: 'dependency-validation',
        name: 'Dependency Validation',
        description: 'Check dependency consistency',
        validator: async (context) => this.validateDependencies(context),
        required: true
      },
      {
        id: 'semantic-validation',
        name: 'Semantic Validation',
        description: 'Validate semantic correctness',
        validator: async (context) => this.validateSemantics(context),
        required: false
      }
    ]
  }

  private buildDependencyGraph(dependencyAnalysis: DependencyAnalysis): Map<string, string[]> {
    const graph = new Map<string, string[]>()
    
    for (const imp of dependencyAnalysis.imports) {
      graph.set(imp.file, imp.dependencies)
    }

    return graph
  }

  private selectRollbackStrategy(
    riskAssessment: { overall: 'low' | 'medium' | 'high'; factors: string[]; mitigations: string[] }
  ): 'atomic' | 'incremental' | 'checkpoint' {
    switch (riskAssessment.overall) {
      case 'high': return 'checkpoint'
      case 'medium': return 'incremental'
      default: return 'atomic'
    }
  }

  private estimateDuration(fileModifications: FileModification[]): number {
    // Simple estimation based on number of changes
    const totalChanges = fileModifications.reduce((sum, mod) => sum + mod.changes.length, 0)
    return totalChanges * 1000 + 5000 // Base time + per-change time
  }

  private generatePlanDescription(userRequest: string, fileModifications: FileModification[]): string {
    const fileCount = fileModifications.length
    const changeCount = fileModifications.reduce((sum, mod) => sum + mod.changes.length, 0)
    return `Apply ${changeCount} changes across ${fileCount} file(s) for: ${userRequest}`
  }

  private async validatePlan(plan: UpdatePlan): Promise<void> {
    if (plan.targetFiles.length === 0) {
      throw new Error('No target files specified in plan')
    }

    if (plan.executionOrder.length === 0) {
      throw new Error('No execution order specified in plan')
    }
  }

  private async runValidationSteps(
    plan: UpdatePlan,
    context: UpdateContext
  ): Promise<Array<ValidationResult & { required: boolean }>> {
    const results: Array<ValidationResult & { required: boolean }> = []

    for (const step of plan.validationSteps) {
      try {
        const result = await step.validator(context)
        results.push({ ...result, required: step.required })
      } catch (error) {
        results.push({
          passed: false,
          errors: [error instanceof Error ? error.message : 'Validation error'],
          warnings: [],
          required: step.required
        })
      }
    }

    return results
  }

  private async executeChanges(
    plan: UpdatePlan,
    context: UpdateContext,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<{ success: boolean; results: Map<string, FileModification>; errors: string[] }> {
    const results = new Map<string, FileModification>()
    const errors: string[] = []

    for (let i = 0; i < plan.executionOrder.length; i++) {
      const filePath = plan.executionOrder[i]
      const modification = plan.targetFiles.find(mod => mod.filePath === filePath)

      if (!modification) {
        errors.push(`File modification not found for ${filePath}`)
        continue
      }

      onProgress?.({
        stage: 'execution',
        currentFile: filePath,
        progress: 20 + (i / plan.executionOrder.length) * 60,
        errors,
        warnings: []
      })

      try {
        // Apply changes to the file
        const diffResult = await this.diffEngine.createAdvancedDiff(
          modification.originalContent,
          modification.modifiedContent
        )

        if (!diffResult.validation.isValid) {
          modification.status = 'failed'
          modification.error = diffResult.validation.errors.join(', ')
          errors.push(`Failed to apply changes to ${filePath}: ${modification.error}`)
        } else {
          modification.status = 'applied'
          context.currentState.set(filePath, modification.modifiedContent)
          
          // Create rollback point if strategy requires it
          if (plan.rollbackStrategy === 'checkpoint') {
            const rollbackPoint = this.createRollbackPoint(context, `After modifying ${filePath}`)
            context.metadata.rollbackPoints.push(rollbackPoint)
          }
        }

        results.set(filePath, modification)
      } catch (error) {
        modification.status = 'failed'
        modification.error = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Error applying changes to ${filePath}: ${modification.error}`)
        results.set(filePath, modification)
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    }
  }

  private async verifyChanges(context: UpdateContext): Promise<void> {
    // Verify that all changes were applied correctly
    for (const [filePath, content] of context.currentState) {
      const modification = context.plan.targetFiles.find(mod => mod.filePath === filePath)
      if (modification && modification.status === 'applied') {
        // Additional verification could be done here
      }
    }
  }

  private createRollbackPoint(context: UpdateContext, description: string): RollbackPoint {
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      description,
      state: new Map(context.currentState),
      appliedChanges: [...context.modifiedFiles.values()]
    }
  }

  private async rollbackChanges(context: UpdateContext): Promise<void> {
    if (context.metadata.rollbackPoints.length > 0) {
      const lastRollbackPoint = context.metadata.rollbackPoints[0] // Initial state
      context.currentState = new Map(lastRollbackPoint.state)
    }
  }

  private async createVersionFromUpdate(context: UpdateContext): Promise<void> {
    if (!this.versionSystem) return

    const message = `Incremental update: ${context.plan.description}`
    const updatedCode = context.currentState.get('app.tsx') || ''

    this.versionSystem.createVersion(
      updatedCode,
      message,
      `Applied ${context.plan.targetFiles.length} modifications`,
      'system',
      ['incremental-update']
    )
  }

  // Validation methods

  private async validateSyntax(context: UpdateContext): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    for (const [filePath, content] of context.currentState) {
      try {
        // Basic syntax validation
        if (!this.isValidSyntax(content)) {
          errors.push(`Syntax error in ${filePath}`)
        }
      } catch (error) {
        errors.push(`Syntax validation failed for ${filePath}: ${error}`)
      }
    }

    return { passed: errors.length === 0, errors, warnings }
  }

  private async validateDependencies(context: UpdateContext): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for missing dependencies
    for (const modification of context.plan.targetFiles) {
      const missingDeps = this.checkMissingDependencies(modification.modifiedContent)
      if (missingDeps.length > 0) {
        warnings.push(`Missing dependencies in ${modification.filePath}: ${missingDeps.join(', ')}`)
      }
    }

    return { passed: errors.length === 0, errors, warnings }
  }

  private async validateSemantics(context: UpdateContext): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic semantic validation
    for (const [filePath, content] of context.currentState) {
      if (!this.isSemanticallySafe(content)) {
        warnings.push(`Potential semantic issues in ${filePath}`)
      }
    }

    return { passed: errors.length === 0, errors, warnings }
  }

  // Helper methods

  private async applyChangesToContent(content: string, changes: CodeChange[]): Promise<string> {
    const lines = content.split('\n')
    
    // Sort changes by line number (reverse order)
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

  private extractDependenciesFromChanges(changes: CodeChange[]): string[] {
    const deps = new Set<string>()
    
    for (const change of changes) {
      if (change.semantic?.type === 'import') {
        deps.add(change.semantic.name)
      }
    }

    return Array.from(deps)
  }

  private extractImportsFromContent(content: string): string[] {
    const imports: string[] = []
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    return imports
  }

  private extractExportsFromContent(content: string): string[] {
    const exports: string[] = []
    const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g
    let match

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1])
    }

    return exports
  }

  private isValidSyntax(content: string): boolean {
    try {
      // Basic syntax validation for React/TypeScript
      if (content.includes('<') && content.includes('>')) {
        // Check JSX balance
        const openTags = (content.match(/<\w+/g) || []).length
        const closeTags = (content.match(/<\/\w+>/g) || []).length
        const selfClosing = (content.match(/<\w+[^>]*\/>/g) || []).length
        return openTags === closeTags + selfClosing
      }
      return true
    } catch {
      return false
    }
  }

  private checkMissingDependencies(content: string): string[] {
    const missing: string[] = []
    
    if (content.includes('useState') && !content.includes('import { useState }')) {
      missing.push('useState')
    }
    
    if (content.includes('useEffect') && !content.includes('import { useEffect }')) {
      missing.push('useEffect')
    }

    return missing
  }

  private isSemanticallySafe(content: string): boolean {
    // Basic semantic safety checks
    return !content.includes('eval(') && !content.includes('dangerouslySetInnerHTML')
  }
} 
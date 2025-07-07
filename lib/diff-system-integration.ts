import { AdvancedDiffEngine, AdvancedDiffResult, AdvancedDiffOptions } from './advanced-diff-engine'
import { IncrementalUpdateSystem, UpdatePlan, UpdateProgress } from './incremental-update-system'
import { AIDiffOrchestrator, DiffGenerationOptions, AIGeneratedDiff } from './ai-diff-orchestrator'
import { ChangeManagementSystem, ChangeRecord, ChangeType, ChangeCategory } from './change-management-system'
import { EnhancedVersionSystem, AppVersion, VersionTree } from './storage/enhanced-version-system'
import { CodeChange } from './enhanced-code-differ'
import { CodeOrchestrator, GenerationResult } from './ai-orchestrator'

export interface DiffSystemOptions {
  enableAI?: boolean
  enableChangeManagement?: boolean
  enableVersionTracking?: boolean
  autoApproval?: boolean
  conflictResolution?: 'auto' | 'manual' | 'interactive'
  diffMode?: 'smart' | 'basic' | 'ai-assisted'
}

export interface DiffUpdateRequest {
  userPrompt: string
  currentCode: any
  author?: string
  title?: string
  description?: string
  changeType?: ChangeType
  changeCategory?: ChangeCategory
  priority?: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
  reviewers?: string[]
}

export interface DiffUpdateResult {
  success: boolean
  changeId?: string
  versionId?: string
  diffResult?: AdvancedDiffResult
  aiDiff?: AIGeneratedDiff
  updatePlan?: UpdatePlan
  errors: string[]
  warnings: string[]
  recommendations: string[]
  previewCode?: string
  rollbackInfo?: {
    rollbackId: string
    instructions: string
  }
}

export interface DiffSystemStatus {
  activeUpdates: number
  pendingChanges: number
  conflictsDetected: number
  systemHealth: 'healthy' | 'warning' | 'error'
  lastUpdate: number
  version: string
}

export interface DiffBatchOperation {
  id: string
  name: string
  description: string
  requests: DiffUpdateRequest[]
  dependencies: Map<number, number[]> // index -> dependent indices
  parallelizable: boolean
  estimatedDuration: number
}

export interface DiffSystemMetrics {
  totalUpdates: number
  successRate: number
  averageProcessingTime: number
  conflictRate: number
  rollbackRate: number
  userSatisfactionScore?: number
  performanceMetrics: {
    diffGenerationTime: number
    validationTime: number
    applicationTime: number
  }
}

export class DiffSystemIntegration {
  private diffEngine = new AdvancedDiffEngine()
  private updateSystem: IncrementalUpdateSystem
  private aiOrchestrator: AIDiffOrchestrator
  private changeManager: ChangeManagementSystem
  private versionSystem: EnhancedVersionSystem
  private codeOrchestrator = new CodeOrchestrator()
  
  private activeOperations = new Map<string, any>()
  private systemOptions: DiffSystemOptions
  private metrics: DiffSystemMetrics

  constructor(
    private appId: string,
    options: DiffSystemOptions = {}
  ) {
    this.systemOptions = {
      enableAI: true,
      enableChangeManagement: true,
      enableVersionTracking: true,
      autoApproval: false,
      conflictResolution: 'auto',
      diffMode: 'ai-assisted',
      ...options
    }

    this.updateSystem = new IncrementalUpdateSystem(appId)
    this.aiOrchestrator = new AIDiffOrchestrator(appId)
    this.changeManager = new ChangeManagementSystem(appId)
    this.versionSystem = new EnhancedVersionSystem(appId)
    
    this.metrics = this.initializeMetrics()
    this.initializeSystem()
  }

  /**
   * Process a diff update request through the integrated system
   */
  async processUpdate(
    request: DiffUpdateRequest,
    onProgress?: (progress: UpdateProgress & { stage: string; details?: any }) => void
  ): Promise<DiffUpdateResult> {
    const operationId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Stage 1: AI-powered diff generation
      onProgress?.({
        stage: 'planning',
        progress: 10,
        errors: [],
        warnings: [],
        details: { analyzing: 'user intent and code context' }
      })

      let aiDiff: AIGeneratedDiff | undefined
      let diffResult: AdvancedDiffResult | undefined

      if (this.systemOptions.enableAI && this.systemOptions.diffMode === 'ai-assisted') {
        aiDiff = await this.aiOrchestrator.generateSmartDiff(
          request.userPrompt,
          request.currentCode,
          {
            semanticAnalysis: true,
            conflictResolution: this.systemOptions.conflictResolution,
            preserveComments: true,
            maintainStyle: true
          }
        )

        // Use AI-generated changes for diff creation
        // Generate preview code from AI changes
        const previewCode = await this.applyChangesToCode(request.currentCode, aiDiff.generatedChanges)
        
        diffResult = await this.diffEngine.createAdvancedDiff(
          request.currentCode,
          previewCode,
          {
            semantic: true,
            conflictResolution: this.systemOptions.conflictResolution
          }
        )
      } else {
        // Fallback to basic diff generation
        const generationResult = await this.codeOrchestrator.generateApp(
          request.userPrompt,
          undefined,
          request.currentCode
        )

        diffResult = await this.diffEngine.createAdvancedDiff(
          request.currentCode,
          generationResult.code,
          {
            semantic: true,
            conflictResolution: this.systemOptions.conflictResolution
          }
        )
      }

      // Stage 2: Change management
      onProgress?.({
        stage: 'validation',
        progress: 30,
        errors: [],
        warnings: [],
        details: { creating: 'change record and approval workflow' }
      })

      let changeRecord: ChangeRecord | undefined
      if (this.systemOptions.enableChangeManagement) {
        changeRecord = await this.changeManager.createChange(
          request.title || `Update: ${request.userPrompt.substring(0, 50)}...`,
          request.description || request.userPrompt,
          diffResult.changes,
          request.author || 'system',
          {
            type: request.changeType,
            category: request.changeCategory,
            priority: request.priority,
            tags: request.tags
          }
        )

        // Submit for review if not auto-approved
        if (!this.systemOptions.autoApproval) {
          await this.changeManager.submitChangeForReview(
            changeRecord.id,
            request.reviewers
          )
        }
      }

      // Stage 3: Create update plan
      onProgress?.({
        stage: 'planning',
        progress: 50,
        errors: [],
        warnings: [],
        details: { creating: 'execution plan and dependency analysis' }
      })

      const updatePlan = await this.updateSystem.createUpdatePlan(
        request.userPrompt,
        request.currentCode,
        {
          semantic: true,
          conflictResolution: this.systemOptions.conflictResolution
        }
      )

      // Stage 4: Validation and conflict resolution
      onProgress?.({
        stage: 'validation',
        progress: 70,
        errors: [],
        warnings: [],
        details: { validating: 'changes and resolving conflicts' }
      })

      const validationErrors: string[] = []
      const warnings: string[] = []
      const recommendations: string[] = []

      // Validate the diff result
      if (!diffResult.validation.isValid) {
        validationErrors.push(...diffResult.validation.errors)
      }
      warnings.push(...diffResult.validation.warnings)
      recommendations.push(...diffResult.recommendations)

      // Handle conflicts
      if (diffResult.conflicts.length > 0) {
        if (this.systemOptions.conflictResolution === 'auto') {
          // Attempt auto-resolution
          onProgress?.({
            stage: 'verification',
            progress: 75,
            errors: [],
            warnings: [],
            details: { resolving: `${diffResult.conflicts.length} conflicts automatically` }
          })
          
          // Auto-resolve conflicts here
          for (const conflict of diffResult.conflicts) {
            if (conflict.autoResolvable && conflict.strategies.length > 0) {
              warnings.push(`Auto-resolved conflict: ${conflict.description}`)
            } else {
              validationErrors.push(`Manual resolution required for: ${conflict.description}`)
            }
          }
        } else {
          validationErrors.push(`${diffResult.conflicts.length} conflicts require manual resolution`)
        }
      }

      // Stage 5: Execute if validation passes
      let versionId: string | undefined
      let previewCode: string | undefined

      if (validationErrors.length === 0) {
        onProgress?.({
          stage: 'execution',
          progress: 85,
          errors: [],
          warnings: [],
          details: { applying: 'changes to codebase' }
        })

        // Execute the update plan
        const executionResult = await this.updateSystem.executeUpdatePlan(
          updatePlan,
          (progress) => {
            onProgress?.({
              ...progress,
              stage: 'execution',
              details: { file: progress.currentFile, step: progress.currentStep }
            })
          }
        )

        if (executionResult.success) {
          // Create version if enabled
          if (this.systemOptions.enableVersionTracking) {
            const version = this.versionSystem.createVersion(
              diffResult.previewCode,
              changeRecord?.title || 'Diff-based update',
              changeRecord?.description || request.userPrompt,
              request.author || 'system',
              ['diff-update', ...(request.tags || [])]
            )
            versionId = version.id
          }

          previewCode = diffResult.previewCode

          // Mark change as implemented
          if (changeRecord && this.systemOptions.enableChangeManagement) {
            await this.changeManager.implementChange(
              changeRecord.id,
              request.author || 'system'
            )
          }
        } else {
          validationErrors.push(...executionResult.errors)
        }
      }

      // Stage 6: Complete
      onProgress?.({
        stage: 'complete',
        progress: 100,
        errors: validationErrors,
        warnings,
        details: { 
          success: validationErrors.length === 0,
          changeId: changeRecord?.id,
          versionId
        }
      })

      // Update metrics
      this.updateMetrics(startTime, validationErrors.length === 0, diffResult)

      return {
        success: validationErrors.length === 0,
        changeId: changeRecord?.id,
        versionId,
        diffResult,
        aiDiff,
        updatePlan,
        errors: validationErrors,
        warnings,
        recommendations,
        previewCode,
        rollbackInfo: versionId ? {
          rollbackId: versionId,
          instructions: 'Use version system to rollback to previous state'
        } : undefined
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.updateMetrics(startTime, false)

      return {
        success: false,
        errors: [errorMessage],
        warnings: [],
        recommendations: ['Review the error and try again with a different approach']
      }
    } finally {
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Process multiple diff updates as a batch operation
   */
  async processBatchUpdate(
    batchOperation: DiffBatchOperation,
    onProgress?: (
      operationId: string, 
      progress: UpdateProgress & { stage: string; requestIndex: number }
    ) => void
  ): Promise<Map<number, DiffUpdateResult>> {
    const results = new Map<number, DiffUpdateResult>()
    const startTime = Date.now()

    try {
      if (batchOperation.parallelizable) {
        // Process requests in parallel
        const promises = batchOperation.requests.map(async (request, index) => {
          const result = await this.processUpdate(request, (progress) => {
            onProgress?.(batchOperation.id, {
              ...progress,
              requestIndex: index
            })
          })
          return { index, result }
        })

        const batchResults = await Promise.all(promises)
        for (const { index, result } of batchResults) {
          results.set(index, result)
        }
      } else {
        // Process requests sequentially based on dependencies
        const processed = new Set<number>()
        const processingOrder = this.calculateProcessingOrder(batchOperation.dependencies)

        for (const requestIndex of processingOrder) {
          const request = batchOperation.requests[requestIndex]
          const result = await this.processUpdate(request, (progress) => {
            onProgress?.(batchOperation.id, {
              ...progress,
              requestIndex
            })
          })
          
          results.set(requestIndex, result)
          processed.add(requestIndex)

          // Stop if there's a critical failure
          if (!result.success && request.priority === 'critical') {
            break
          }
        }
      }

      return results
    } catch (error) {
      console.error('Batch operation failed:', error)
      return results
    }
  }

  /**
   * Get the current system status
   */
  getSystemStatus(): DiffSystemStatus {
    return {
      activeUpdates: this.activeOperations.size,
      pendingChanges: this.systemOptions.enableChangeManagement ? 
        this.changeManager.getChangeAnalytics().changesByStatus['under-review'] || 0 : 0,
      conflictsDetected: 0, // Would track recent conflicts
      systemHealth: this.assessSystemHealth(),
      lastUpdate: Date.now(),
      version: '1.0.0'
    }
  }

  /**
   * Get system metrics and analytics
   */
  getSystemMetrics(): DiffSystemMetrics {
    return { ...this.metrics }
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(
    versionId: string,
    reason: string,
    author?: string
  ): Promise<{ success: boolean; newVersionId?: string; error?: string }> {
    try {
      if (!this.systemOptions.enableVersionTracking) {
        return { success: false, error: 'Version tracking not enabled' }
      }

      const version = this.versionSystem.getVersion(versionId)
      if (!version) {
        return { success: false, error: 'Version not found' }
      }

      const revertedVersion = this.versionSystem.revertToVersion(
        versionId,
        `Rollback: ${reason}`,
        author
      )

      // Create change record for rollback if change management is enabled
      if (this.systemOptions.enableChangeManagement) {
        await this.changeManager.createChange(
          `Rollback to version ${version.versionNumber}`,
          reason,
          [], // No specific changes tracked for rollback
          author || 'system',
          {
            type: 'bug-fix',
            category: 'structure',
            priority: 'high',
            tags: ['rollback', `from-${versionId}`]
          }
        )
      }

      return { success: true, newVersionId: revertedVersion.id }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Rollback failed' 
      }
    }
  }

  /**
   * Get change history for the integrated system
   */
  getChangeHistory(limit?: number): ChangeRecord[] {
    if (!this.systemOptions.enableChangeManagement) {
      return []
    }
    return this.changeManager.getChangeHistory(undefined, undefined, limit)
  }

  /**
   * Get version history from the version system
   */
  getVersionHistory(limit?: number): AppVersion[] {
    if (!this.systemOptions.enableVersionTracking) {
      return []
    }
    return this.versionSystem.getVersionHistory(undefined, limit)
  }

  /**
   * Subscribe to system events
   */
  subscribe(
    eventType: 'change' | 'version' | 'conflict' | 'error',
    callback: (data: any) => void
  ): string {
    const subscriptionId = crypto.randomUUID()

    switch (eventType) {
      case 'change':
        if (this.systemOptions.enableChangeManagement) {
          this.changeManager.subscribe(eventType, callback)
        }
        break
      // Add other event subscriptions as needed
    }

    return subscriptionId
  }

  /**
   * Generate comprehensive documentation for recent changes
   */
  async generateSystemDocumentation(
    timeRange?: { start: number; end: number }
  ): Promise<{
    summary: string
    changes: any[]
    versions: any[]
    metrics: DiffSystemMetrics
    recommendations: string[]
  }> {
    const changes = this.systemOptions.enableChangeManagement ?
      this.getChangeHistory().filter(change => 
        !timeRange || (change.timestamp >= timeRange.start && change.timestamp <= timeRange.end)
      ) : []

    const versions = this.systemOptions.enableVersionTracking ?
      this.getVersionHistory().filter(version =>
        !timeRange || (version.metadata.timestamp >= timeRange.start && version.metadata.timestamp <= timeRange.end)
      ) : []

    const recommendations = this.generateSystemRecommendations()

    return {
      summary: this.generateSystemSummary(changes, versions),
      changes,
      versions,
      metrics: this.getSystemMetrics(),
      recommendations
    }
  }

  // Private helper methods

  private initializeMetrics(): DiffSystemMetrics {
    return {
      totalUpdates: 0,
      successRate: 0,
      averageProcessingTime: 0,
      conflictRate: 0,
      rollbackRate: 0,
      performanceMetrics: {
        diffGenerationTime: 0,
        validationTime: 0,
        applicationTime: 0
      }
    }
  }

  private initializeSystem(): void {
    // Initialize version system if not exists
    if (this.systemOptions.enableVersionTracking) {
      const tree = this.versionSystem.getVersionTree()
      if (!tree) {
        this.versionSystem.initializeVersionSystem({}, 'Initial system setup')
      }
    }
  }

  private updateMetrics(startTime: number, success: boolean, diffResult?: AdvancedDiffResult): void {
    const processingTime = Date.now() - startTime
    
    this.metrics.totalUpdates++
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.totalUpdates - 1) + processingTime) / 
      this.metrics.totalUpdates

    if (success) {
      this.metrics.successRate = 
        (this.metrics.successRate * (this.metrics.totalUpdates - 1) + 100) / 
        this.metrics.totalUpdates
    } else {
      this.metrics.successRate = 
        (this.metrics.successRate * (this.metrics.totalUpdates - 1)) / 
        this.metrics.totalUpdates
    }

    if (diffResult?.conflicts.length) {
      this.metrics.conflictRate = 
        (this.metrics.conflictRate * (this.metrics.totalUpdates - 1) + 
         (diffResult.conflicts.length > 0 ? 100 : 0)) / 
        this.metrics.totalUpdates
    }

    this.metrics.performanceMetrics.diffGenerationTime = diffResult?.applicationTime || 0
  }

  private assessSystemHealth(): 'healthy' | 'warning' | 'error' {
    if (this.metrics.successRate < 50) return 'error'
    if (this.metrics.conflictRate > 30) return 'warning'
    if (this.metrics.rollbackRate > 20) return 'warning'
    return 'healthy'
  }

  private calculateProcessingOrder(dependencies: Map<number, number[]>): number[] {
    const order: number[] = []
    const visited = new Set<number>()
    const visiting = new Set<number>()

    const visit = (index: number) => {
      if (visiting.has(index)) {
        throw new Error(`Circular dependency detected at index ${index}`)
      }
      if (visited.has(index)) return

      visiting.add(index)
      const deps = dependencies.get(index) || []
      for (const dep of deps) {
        visit(dep)
      }
      visiting.delete(index)
      visited.add(index)
      order.push(index)
    }

    for (const index of dependencies.keys()) {
      if (!visited.has(index)) {
        visit(index)
      }
    }

    return order
  }

  private generateSystemSummary(changes: ChangeRecord[], versions: AppVersion[]): string {
    return `System summary: ${changes.length} changes and ${versions.length} versions processed. ` +
           `Success rate: ${this.metrics.successRate.toFixed(1)}%, ` +
           `Average processing time: ${(this.metrics.averageProcessingTime / 1000).toFixed(1)}s`
  }

  private generateSystemRecommendations(): string[] {
    const recommendations: string[] = []
    
    if (this.metrics.successRate < 80) {
      recommendations.push('Consider improving change validation and testing procedures')
    }
    
    if (this.metrics.conflictRate > 20) {
      recommendations.push('Implement better conflict prevention strategies')
    }
    
    if (this.metrics.averageProcessingTime > 30000) {
      recommendations.push('Optimize diff generation and processing pipeline')
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing well, continue current practices')
    }

    return recommendations
  }

  private async applyChangesToCode(currentCode: string, changes: CodeChange[]): Promise<string> {
    let modifiedCode = currentCode
    const lines = currentCode.split('\n')
    
    // Sort changes by line number in reverse order to maintain line indices
    const sortedChanges = [...changes].sort((a, b) => b.startLine - a.startLine)
    
    for (const change of sortedChanges) {
      if (change.type === 'insertion') {
        lines.splice(change.startLine - 1, 0, change.content)
      } else if (change.type === 'deletion') {
        lines.splice(change.startLine - 1, change.endLine - change.startLine + 1)
      } else if (change.type === 'modification') {
        lines.splice(
          change.startLine - 1,
          change.endLine - change.startLine + 1,
          change.content
        )
      }
    }
    
    return lines.join('\n')
  }
} 
import { CodeChange } from './enhanced-code-differ'
import { AdvancedDiffResult } from './advanced-diff-engine'
import { UpdatePlan, UpdateProgress } from './incremental-update-system'
import { AppVersion, EnhancedVersionSystem } from './storage/enhanced-version-system'

export interface ChangeRecord {
  id: string
  timestamp: number
  type: ChangeType
  category: ChangeCategory
  title: string
  description: string
  changes: CodeChange[]
  author: string
  reviewers: string[]
  status: ChangeStatus
  priority: ChangePriority
  impact: ChangeImpact
  metadata: {
    estimatedTime: number
    actualTime?: number
    linesChanged: number
    filesAffected: string[]
    dependencies: string[]
    rollbackStrategy: string
    testingNotes?: string
  }
  approvals: ChangeApproval[]
  comments: ChangeComment[]
  tags: string[]
  parentChangeId?: string
  relatedChanges: string[]
}

export interface ChangeApproval {
  id: string
  approverId: string
  approverName: string
  timestamp: number
  status: 'pending' | 'approved' | 'rejected' | 'conditional'
  comments?: string
  conditions?: string[]
}

export interface ChangeComment {
  id: string
  authorId: string
  authorName: string
  timestamp: number
  content: string
  type: 'general' | 'concern' | 'suggestion' | 'question'
  resolved?: boolean
  responses: ChangeComment[]
}

export type ChangeType = 
  | 'feature' 
  | 'bug-fix' 
  | 'refactor' 
  | 'optimization' 
  | 'security' 
  | 'documentation' 
  | 'test'
  | 'configuration'
  | 'dependency'

export type ChangeCategory = 
  | 'ui' 
  | 'backend' 
  | 'database' 
  | 'api' 
  | 'styling' 
  | 'logic' 
  | 'structure'
  | 'performance'
  | 'accessibility'
  | 'internationalization'

export type ChangeStatus = 
  | 'draft' 
  | 'submitted' 
  | 'under-review' 
  | 'approved' 
  | 'rejected' 
  | 'implemented' 
  | 'tested'
  | 'deployed'
  | 'rolled-back'

export type ChangePriority = 'low' | 'medium' | 'high' | 'critical'

export interface ChangeImpact {
  scope: 'local' | 'component' | 'module' | 'global'
  risk: 'low' | 'medium' | 'high'
  userFacing: boolean
  breakingChange: boolean
  performanceImpact: 'positive' | 'negative' | 'neutral' | 'unknown'
  securityImplications: boolean
  accessibilityImpact: boolean
}

export interface ChangeApprovalWorkflow {
  id: string
  name: string
  description: string
  stages: ChangeApprovalStage[]
  triggers: {
    changeTypes: ChangeType[]
    priorities: ChangePriority[]
    impactLevels: ChangeImpact['risk'][]
  }
  autoApprovalRules: {
    conditions: string[]
    maxRiskLevel: ChangeImpact['risk']
    requiredTests: string[]
  }
}

export interface ChangeApprovalStage {
  id: string
  name: string
  description: string
  requiredApprovers: number
  approverRoles: string[]
  timeout?: number
  conditions?: string[]
  canBypass: boolean
}

export interface ChangeDocumentation {
  changeId: string
  generatedAt: number
  summary: string
  technicalDetails: {
    architecture: string
    implementation: string
    testing: string
    deployment: string
  }
  userGuide?: {
    newFeatures: string[]
    modifiedBehavior: string[]
    migration?: string
  }
  developerNotes?: {
    codeChanges: string
    patterns: string[]
    considerations: string[]
  }
  riskAssessment: {
    identifiedRisks: string[]
    mitigations: string[]
    rollbackPlan: string
  }
}

export interface ChangeAnalytics {
  totalChanges: number
  changesByType: Record<ChangeType, number>
  changesByCategory: Record<ChangeCategory, number>
  changesByStatus: Record<ChangeStatus, number>
  averageApprovalTime: number
  averageImplementationTime: number
  successRate: number
  rollbackRate: number
  timeDistribution: {
    period: string
    changes: number
  }[]
  topContributors: {
    author: string
    changeCount: number
    successRate: number
  }[]
  impactDistribution: Record<ChangeImpact['risk'], number>
}

export class ChangeManagementSystem {
  private versionSystem: EnhancedVersionSystem
  private changes = new Map<string, ChangeRecord>()
  private workflows = new Map<string, ChangeApprovalWorkflow>()
  private subscribers = new Map<string, (change: ChangeRecord) => void>()

  constructor(private appId: string) {
    this.versionSystem = new EnhancedVersionSystem(appId)
    this.initializeDefaultWorkflows()
    this.loadChanges()
  }

  /**
   * Create a new change record
   */
  async createChange(
    title: string,
    description: string,
    changes: CodeChange[],
    author: string,
    options: {
      type?: ChangeType
      category?: ChangeCategory
      priority?: ChangePriority
      tags?: string[]
      parentChangeId?: string
    } = {}
  ): Promise<ChangeRecord> {
    const changeRecord: ChangeRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: options.type || this.inferChangeType(changes),
      category: options.category || this.inferChangeCategory(changes),
      title,
      description,
      changes,
      author,
      reviewers: [],
      status: 'draft',
      priority: options.priority || this.calculatePriority(changes),
      impact: await this.assessChangeImpact(changes),
      metadata: {
        estimatedTime: this.estimateImplementationTime(changes),
        linesChanged: this.countLinesChanged(changes),
        filesAffected: this.extractAffectedFiles(changes),
        dependencies: this.extractChangeDependencies(changes),
        rollbackStrategy: 'version-based'
      },
      approvals: [],
      comments: [],
      tags: options.tags || [],
      parentChangeId: options.parentChangeId,
      relatedChanges: []
    }

    // Store the change
    this.changes.set(changeRecord.id, changeRecord)
    this.saveChanges()

    // Notify subscribers
    this.notifySubscribers(changeRecord)

    return changeRecord
  }

  /**
   * Submit a change for review
   */
  async submitChangeForReview(
    changeId: string,
    reviewers?: string[]
  ): Promise<{ success: boolean; workflow?: ChangeApprovalWorkflow; error?: string }> {
    const change = this.changes.get(changeId)
    if (!change) {
      return { success: false, error: 'Change not found' }
    }

    if (change.status !== 'draft') {
      return { success: false, error: 'Change must be in draft status to submit for review' }
    }

    // Find applicable workflow
    const workflow = this.findApplicableWorkflow(change)
    
    if (workflow) {
      // Initialize approval workflow
      change.status = 'submitted'
      change.reviewers = reviewers || this.getDefaultReviewers(workflow, change)
      
      // Create approval records
      const firstStage = workflow.stages[0]
      for (const reviewer of change.reviewers.slice(0, firstStage.requiredApprovers)) {
        change.approvals.push({
          id: crypto.randomUUID(),
          approverId: reviewer,
          approverName: reviewer, // In real app, would lookup name
          timestamp: Date.now(),
          status: 'pending'
        })
      }

      change.status = 'under-review'
    } else {
      // Auto-approve if no workflow needed
      change.status = 'approved'
    }

    this.changes.set(changeId, change)
    this.saveChanges()
    this.notifySubscribers(change)

    return { success: true, workflow: workflow || undefined }
  }

  /**
   * Approve or reject a change
   */
  async reviewChange(
    changeId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected' | 'conditional',
    comments?: string,
    conditions?: string[]
  ): Promise<{ success: boolean; changeStatus?: ChangeStatus; error?: string }> {
    const change = this.changes.get(changeId)
    if (!change) {
      return { success: false, error: 'Change not found' }
    }

    const approval = change.approvals.find(a => a.approverId === reviewerId && a.status === 'pending')
    if (!approval) {
      return { success: false, error: 'No pending approval found for this reviewer' }
    }

    // Update approval
    approval.status = decision
    approval.timestamp = Date.now()
    approval.comments = comments
    approval.conditions = conditions

    // Add comment if provided
    if (comments) {
      change.comments.push({
        id: crypto.randomUUID(),
        authorId: reviewerId,
        authorName: reviewerId,
        timestamp: Date.now(),
        content: comments,
        type: decision === 'approved' ? 'general' : 'concern',
        responses: []
      })
    }

    // Check if all required approvals are complete
    const workflow = this.findApplicableWorkflow(change)
    if (workflow) {
      const newStatus = this.checkApprovalStatus(change, workflow)
      change.status = newStatus
    }

    this.changes.set(changeId, change)
    this.saveChanges()
    this.notifySubscribers(change)

    return { success: true, changeStatus: change.status }
  }

  /**
   * Implement an approved change
   */
  async implementChange(
    changeId: string,
    implementerId: string
  ): Promise<{ success: boolean; versionId?: string; error?: string }> {
    const change = this.changes.get(changeId)
    if (!change) {
      return { success: false, error: 'Change not found' }
    }

    if (change.status !== 'approved') {
      return { success: false, error: 'Change must be approved before implementation' }
    }

    try {
      change.status = 'implemented'
      change.metadata.actualTime = Date.now() - change.timestamp

      // Create version in the version system
      const versionMessage = `${change.type}: ${change.title}`
      const version = this.versionSystem.createVersion(
        change.changes, // This would need to be the actual modified code
        versionMessage,
        change.description,
        implementerId,
        [change.type, `change-${changeId}`]
      )

      change.status = 'deployed'
      
      this.changes.set(changeId, change)
      this.saveChanges()
      this.notifySubscribers(change)

      return { success: true, versionId: version.id }
    } catch (error) {
      change.status = 'approved' // Revert status
      return { success: false, error: error instanceof Error ? error.message : 'Implementation failed' }
    }
  }

  /**
   * Add a comment to a change
   */
  async addComment(
    changeId: string,
    authorId: string,
    content: string,
    type: ChangeComment['type'] = 'general',
    parentCommentId?: string
  ): Promise<{ success: boolean; commentId?: string; error?: string }> {
    const change = this.changes.get(changeId)
    if (!change) {
      return { success: false, error: 'Change not found' }
    }

    const comment: ChangeComment = {
      id: crypto.randomUUID(),
      authorId,
      authorName: authorId, // In real app, would lookup name
      timestamp: Date.now(),
      content,
      type,
      responses: []
    }

    if (parentCommentId) {
      const parentComment = this.findComment(change.comments, parentCommentId)
      if (parentComment) {
        parentComment.responses.push(comment)
      } else {
        return { success: false, error: 'Parent comment not found' }
      }
    } else {
      change.comments.push(comment)
    }

    this.changes.set(changeId, change)
    this.saveChanges()
    this.notifySubscribers(change)

    return { success: true, commentId: comment.id }
  }

  /**
   * Generate documentation for a change
   */
  async generateChangeDocumentation(changeId: string): Promise<ChangeDocumentation | null> {
    const change = this.changes.get(changeId)
    if (!change) return null

    const documentation: ChangeDocumentation = {
      changeId,
      generatedAt: Date.now(),
      summary: this.generateChangeSummary(change),
      technicalDetails: {
        architecture: this.generateArchitectureDoc(change),
        implementation: this.generateImplementationDoc(change),
        testing: this.generateTestingDoc(change),
        deployment: this.generateDeploymentDoc(change)
      },
      riskAssessment: {
        identifiedRisks: this.identifyRisks(change),
        mitigations: this.suggestMitigations(change),
        rollbackPlan: this.generateRollbackPlan(change)
      }
    }

    // Add user-facing documentation if applicable
    if (change.impact.userFacing) {
      documentation.userGuide = {
        newFeatures: this.extractNewFeatures(change),
        modifiedBehavior: this.extractModifiedBehavior(change),
        migration: change.impact.breakingChange ? this.generateMigrationGuide(change) : undefined
      }
    }

    // Add developer notes
    documentation.developerNotes = {
      codeChanges: this.generateCodeChangesDoc(change),
      patterns: this.extractPatterns(change),
      considerations: this.extractConsiderations(change)
    }

    return documentation
  }

  /**
   * Get change analytics
   */
  getChangeAnalytics(
    timeRange?: { start: number; end: number },
    filters?: { author?: string; type?: ChangeType; category?: ChangeCategory }
  ): ChangeAnalytics {
    const filteredChanges = Array.from(this.changes.values()).filter(change => {
      if (timeRange && (change.timestamp < timeRange.start || change.timestamp > timeRange.end)) {
        return false
      }
      if (filters?.author && change.author !== filters.author) {
        return false
      }
      if (filters?.type && change.type !== filters.type) {
        return false
      }
      if (filters?.category && change.category !== filters.category) {
        return false
      }
      return true
    })

    const analytics: ChangeAnalytics = {
      totalChanges: filteredChanges.length,
      changesByType: this.groupByField(filteredChanges, 'type') as Record<ChangeType, number>,
      changesByCategory: this.groupByField(filteredChanges, 'category') as Record<ChangeCategory, number>,
      changesByStatus: this.groupByField(filteredChanges, 'status') as Record<ChangeStatus, number>,
      averageApprovalTime: this.calculateAverageApprovalTime(filteredChanges),
      averageImplementationTime: this.calculateAverageImplementationTime(filteredChanges),
      successRate: this.calculateSuccessRate(filteredChanges),
      rollbackRate: this.calculateRollbackRate(filteredChanges),
      timeDistribution: this.generateTimeDistribution(filteredChanges),
      topContributors: this.generateTopContributors(filteredChanges),
      impactDistribution: this.groupByField(filteredChanges, c => c.impact.risk) as Record<ChangeImpact['risk'], number>
    }

    return analytics
  }

  /**
   * Get change history for a specific file or component
   */
  getChangeHistory(
    filePath?: string,
    component?: string,
    limit?: number
  ): ChangeRecord[] {
    const allChanges = Array.from(this.changes.values())
    
    let filteredChanges = allChanges
    
    if (filePath) {
      filteredChanges = filteredChanges.filter(change =>
        change.metadata.filesAffected.includes(filePath)
      )
    }
    
    if (component) {
      filteredChanges = filteredChanges.filter(change =>
        change.changes.some(c => 
          c.semantic?.name === component || 
          c.content.includes(component)
        )
      )
    }

    // Sort by timestamp (newest first)
    filteredChanges.sort((a, b) => b.timestamp - a.timestamp)

    return limit ? filteredChanges.slice(0, limit) : filteredChanges
  }

  /**
   * Subscribe to change notifications
   */
  subscribe(eventType: string, callback: (change: ChangeRecord) => void): string {
    const subscriptionId = crypto.randomUUID()
    this.subscribers.set(subscriptionId, callback)
    return subscriptionId
  }

  /**
   * Unsubscribe from change notifications
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscribers.delete(subscriptionId)
  }

  // Private helper methods

  private initializeDefaultWorkflows(): void {
    const defaultWorkflow: ChangeApprovalWorkflow = {
      id: 'default',
      name: 'Default Approval Workflow',
      description: 'Standard approval process for most changes',
      stages: [
        {
          id: 'peer-review',
          name: 'Peer Review',
          description: 'Review by team members',
          requiredApprovers: 1,
          approverRoles: ['developer', 'lead'],
          canBypass: false
        }
      ],
      triggers: {
        changeTypes: ['feature', 'bug-fix', 'refactor'],
        priorities: ['medium', 'high'],
        impactLevels: ['medium', 'high']
      },
      autoApprovalRules: {
        conditions: ['automated tests pass', 'no breaking changes'],
        maxRiskLevel: 'low',
        requiredTests: ['unit', 'integration']
      }
    }

    this.workflows.set(defaultWorkflow.id, defaultWorkflow)
  }

  private inferChangeType(changes: CodeChange[]): ChangeType {
    // Simple heuristics to infer change type
    const hasNewCode = changes.some(c => c.type === 'insertion')
    const hasRemovedCode = changes.some(c => c.type === 'deletion')
    const hasModifications = changes.some(c => c.type === 'modification')

    if (hasNewCode && !hasRemovedCode) return 'feature'
    if (hasRemovedCode && hasModifications) return 'refactor'
    if (hasModifications) return 'bug-fix'
    
    return 'feature'
  }

  private inferChangeCategory(changes: CodeChange[]): ChangeCategory {
    // Analyze changes to infer category
    const hasStyleChanges = changes.some(c => 
      c.content.includes('className') || 
      c.content.includes('style') ||
      c.semantic?.type === 'style'
    )
    
    const hasLogicChanges = changes.some(c =>
      c.semantic?.type === 'function' ||
      c.content.includes('function') ||
      c.content.includes('=>')
    )

    const hasUIChanges = changes.some(c =>
      c.content.includes('<') || 
      c.content.includes('jsx') ||
      c.semantic?.type === 'component'
    )

    if (hasUIChanges) return 'ui'
    if (hasStyleChanges) return 'styling'
    if (hasLogicChanges) return 'logic'
    
    return 'structure'
  }

  private calculatePriority(changes: CodeChange[]): ChangePriority {
    const highImpactChanges = changes.filter(c => c.semantic?.impact === 'high')
    const totalChanges = changes.length

    if (highImpactChanges.length > totalChanges * 0.5) return 'high'
    if (highImpactChanges.length > 0 || totalChanges > 10) return 'medium'
    return 'low'
  }

  private async assessChangeImpact(changes: CodeChange[]): Promise<ChangeImpact> {
    const hasBreakingChanges = changes.some(c => 
      c.semantic?.impact === 'high' || 
      c.type === 'deletion'
    )

    const hasUIChanges = changes.some(c =>
      c.content.includes('<') || c.semantic?.type === 'component'
    )

    return {
      scope: changes.length > 5 ? 'global' : 'component',
      risk: this.calculateRiskLevel(changes),
      userFacing: hasUIChanges,
      breakingChange: hasBreakingChanges,
      performanceImpact: 'neutral',
      securityImplications: false,
      accessibilityImpact: false
    }
  }

  private calculateRiskLevel(changes: CodeChange[]): 'low' | 'medium' | 'high' {
    const highRiskChanges = changes.filter(c => c.semantic?.impact === 'high').length
    const totalChanges = changes.length

    if (highRiskChanges > totalChanges * 0.5) return 'high'
    if (highRiskChanges > 0 || totalChanges > 10) return 'medium'
    return 'low'
  }

  private estimateImplementationTime(changes: CodeChange[]): number {
    // Simple estimation: 30 minutes per change + base time
    return changes.length * 30 * 60 * 1000 + 60 * 60 * 1000 // ms
  }

  private countLinesChanged(changes: CodeChange[]): number {
    return changes.reduce((total, change) => {
      return total + (change.endLine - change.startLine + 1)
    }, 0)
  }

  private extractAffectedFiles(changes: CodeChange[]): string[] {
    // For now, assume single file
    return ['app.tsx']
  }

  private extractChangeDependencies(changes: CodeChange[]): string[] {
    const deps = new Set<string>()
    changes.forEach(change => {
      if (change.semantic?.type === 'import') {
        deps.add(change.semantic.name)
      }
    })
    return Array.from(deps)
  }

  private findApplicableWorkflow(change: ChangeRecord): ChangeApprovalWorkflow | null {
    for (const workflow of this.workflows.values()) {
      if (
        workflow.triggers.changeTypes.includes(change.type) &&
        workflow.triggers.priorities.includes(change.priority) &&
        workflow.triggers.impactLevels.includes(change.impact.risk)
      ) {
        return workflow
      }
    }
    return null
  }

  private getDefaultReviewers(workflow: ChangeApprovalWorkflow, change: ChangeRecord): string[] {
    // In a real implementation, this would fetch reviewers based on roles and availability
    return ['reviewer1', 'reviewer2']
  }

  private checkApprovalStatus(change: ChangeRecord, workflow: ChangeApprovalWorkflow): ChangeStatus {
    const approvedCount = change.approvals.filter(a => a.status === 'approved').length
    const rejectedCount = change.approvals.filter(a => a.status === 'rejected').length
    const requiredApprovals = workflow.stages[0].requiredApprovers

    if (rejectedCount > 0) return 'rejected'
    if (approvedCount >= requiredApprovals) return 'approved'
    return 'under-review'
  }

  private findComment(comments: ChangeComment[], commentId: string): ChangeComment | null {
    for (const comment of comments) {
      if (comment.id === commentId) return comment
      const found = this.findComment(comment.responses, commentId)
      if (found) return found
    }
    return null
  }

  private notifySubscribers(change: ChangeRecord): void {
    for (const callback of this.subscribers.values()) {
      try {
        callback(change)
      } catch (error) {
        console.error('Error notifying subscriber:', error)
      }
    }
  }

  private loadChanges(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`changes_${this.appId}`)
        if (stored) {
          const parsedChanges = JSON.parse(stored)
          for (const [id, change] of Object.entries(parsedChanges)) {
            this.changes.set(id, change as ChangeRecord)
          }
        }
      } catch (error) {
        console.error('Failed to load changes:', error)
      }
    }
  }

  private saveChanges(): void {
    if (typeof window !== 'undefined') {
      try {
        const changesToStore = Object.fromEntries(this.changes)
        localStorage.setItem(`changes_${this.appId}`, JSON.stringify(changesToStore))
      } catch (error) {
        console.error('Failed to save changes:', error)
      }
    }
  }

  // Documentation generation methods

  private generateChangeSummary(change: ChangeRecord): string {
    return `${change.type} change: ${change.title}. ${change.description}`
  }

  private generateArchitectureDoc(change: ChangeRecord): string {
    return `Architecture impact: ${change.impact.scope} scope with ${change.impact.risk} risk level.`
  }

  private generateImplementationDoc(change: ChangeRecord): string {
    return `Implementation involves ${change.changes.length} code modifications across ${change.metadata.filesAffected.length} files.`
  }

  private generateTestingDoc(change: ChangeRecord): string {
    return change.impact.risk === 'high' ? 
      'Comprehensive testing required due to high impact changes.' :
      'Standard testing procedures apply.'
  }

  private generateDeploymentDoc(change: ChangeRecord): string {
    return change.impact.breakingChange ?
      'Breaking change deployment - requires careful rollout strategy.' :
      'Standard deployment procedures apply.'
  }

  private identifyRisks(change: ChangeRecord): string[] {
    const risks: string[] = []
    if (change.impact.breakingChange) risks.push('Breaking change may affect existing functionality')
    if (change.impact.risk === 'high') risks.push('High risk change requires extra caution')
    if (change.impact.userFacing) risks.push('User-facing changes may impact user experience')
    return risks
  }

  private suggestMitigations(change: ChangeRecord): string[] {
    const mitigations: string[] = []
    if (change.impact.breakingChange) mitigations.push('Implement feature flags for gradual rollout')
    if (change.impact.risk === 'high') mitigations.push('Conduct thorough testing and peer review')
    return mitigations
  }

  private generateRollbackPlan(change: ChangeRecord): string {
    return `Rollback strategy: ${change.metadata.rollbackStrategy}. Can revert to previous version if issues arise.`
  }

  private extractNewFeatures(change: ChangeRecord): string[] {
    return change.type === 'feature' ? [change.title] : []
  }

  private extractModifiedBehavior(change: ChangeRecord): string[] {
    return change.type === 'bug-fix' || change.type === 'refactor' ? [change.title] : []
  }

  private generateMigrationGuide(change: ChangeRecord): string {
    return 'Migration steps will be provided based on the specific breaking changes introduced.'
  }

  private generateCodeChangesDoc(change: ChangeRecord): string {
    return `Code changes include ${change.changes.length} modifications with ${change.metadata.linesChanged} lines affected.`
  }

  private extractPatterns(change: ChangeRecord): string[] {
    const patterns: string[] = []
    if (change.changes.some(c => c.semantic?.type === 'function')) patterns.push('Function modifications')
    if (change.changes.some(c => c.semantic?.type === 'component')) patterns.push('Component updates')
    return patterns
  }

  private extractConsiderations(change: ChangeRecord): string[] {
    return ['Maintain backward compatibility', 'Ensure consistent coding style', 'Update relevant documentation']
  }

  // Analytics helper methods

  private groupByField<T>(items: T[], field: keyof T | ((item: T) => any)): Record<string, number> {
    const groups: Record<string, number> = {}
    for (const item of items) {
      const key = typeof field === 'function' ? field(item) : item[field]
      const keyStr = String(key)
      groups[keyStr] = (groups[keyStr] || 0) + 1
    }
    return groups
  }

  private calculateAverageApprovalTime(changes: ChangeRecord[]): number {
    const approvedChanges = changes.filter(c => c.status === 'approved' || c.status === 'implemented' || c.status === 'deployed')
    if (approvedChanges.length === 0) return 0

    const totalTime = approvedChanges.reduce((sum, change) => {
      const approvalTime = change.approvals.find(a => a.status === 'approved')?.timestamp
      return sum + (approvalTime ? approvalTime - change.timestamp : 0)
    }, 0)

    return totalTime / approvedChanges.length
  }

  private calculateAverageImplementationTime(changes: ChangeRecord[]): number {
    const implementedChanges = changes.filter(c => c.metadata.actualTime)
    if (implementedChanges.length === 0) return 0

    const totalTime = implementedChanges.reduce((sum, change) => 
      sum + (change.metadata.actualTime || 0), 0
    )

    return totalTime / implementedChanges.length
  }

  private calculateSuccessRate(changes: ChangeRecord[]): number {
    const completedChanges = changes.filter(c => 
      c.status === 'deployed' || c.status === 'rolled-back'
    )
    if (completedChanges.length === 0) return 0

    const successfulChanges = completedChanges.filter(c => c.status === 'deployed')
    return (successfulChanges.length / completedChanges.length) * 100
  }

  private calculateRollbackRate(changes: ChangeRecord[]): number {
    const deployedChanges = changes.filter(c => 
      c.status === 'deployed' || c.status === 'rolled-back'
    )
    if (deployedChanges.length === 0) return 0

    const rolledBackChanges = deployedChanges.filter(c => c.status === 'rolled-back')
    return (rolledBackChanges.length / deployedChanges.length) * 100
  }

  private generateTimeDistribution(changes: ChangeRecord[]): { period: string; changes: number }[] {
    // Group changes by day
    const groups: Record<string, number> = {}
    for (const change of changes) {
      const date = new Date(change.timestamp).toISOString().split('T')[0]
      groups[date] = (groups[date] || 0) + 1
    }

    return Object.entries(groups).map(([period, changes]) => ({ period, changes }))
  }

  private generateTopContributors(changes: ChangeRecord[]): { author: string; changeCount: number; successRate: number }[] {
    const contributors: Record<string, { count: number; successful: number }> = {}

    for (const change of changes) {
      if (!contributors[change.author]) {
        contributors[change.author] = { count: 0, successful: 0 }
      }
      contributors[change.author].count++
      if (change.status === 'deployed') {
        contributors[change.author].successful++
      }
    }

    return Object.entries(contributors).map(([author, data]) => ({
      author,
      changeCount: data.count,
      successRate: data.count > 0 ? (data.successful / data.count) * 100 : 0
    })).sort((a, b) => b.changeCount - a.changeCount)
  }
} 
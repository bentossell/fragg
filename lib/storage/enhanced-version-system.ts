export interface VersionMetadata {
  author?: string
  timestamp: number
  message: string
  description?: string
  changes: {
    additions: number
    deletions: number
    modifications: number
    filesChanged: string[]
  }
  tags?: string[]
  isStable?: boolean
  performance?: {
    buildTime?: number
    bundleSize?: number
    errors?: string[]
    warnings?: string[]
  }
}

export interface VersionBranch {
  id: string
  name: string
  description?: string
  createdAt: string
  createdBy?: string
  parentVersionId?: string
  parentBranchId?: string
  isMainBranch?: boolean
  isActive?: boolean
  color?: string
  metadata?: Record<string, any>
}

export interface AppVersion {
  id: string
  appId: string
  branchId: string
  parentVersionId?: string
  versionNumber: string // semantic version like "1.2.3"
  internalVersion: number // incremental number
  code: any // Fragment code
  result?: any // ExecutionResult
  metadata: VersionMetadata
  // Diff information
  diffFromParent?: {
    additions: number
    deletions: number
    modifications: number
    diff: string // unified diff format
    fileChanges: Array<{
      file: string
      type: 'added' | 'deleted' | 'modified'
      linesAdded: number
      linesDeleted: number
    }>
  }
  // Merge information
  mergeInfo?: {
    isMergeCommit: boolean
    mergedFromBranch: string
    mergedFromVersion: string
    conflictResolution?: string
  }
}

export interface VersionTree {
  versions: AppVersion[]
  branches: VersionBranch[]
  currentBranch: string
  currentVersion: string
  head: string // latest version in current branch
}

export interface VersionComparison {
  versionA: AppVersion
  versionB: AppVersion
  diff: {
    unified: string
    stats: {
      additions: number
      deletions: number
      modifications: number
      filesChanged: number
    }
    files: Array<{
      path: string
      type: 'added' | 'deleted' | 'modified'
      hunks: Array<{
        oldStart: number
        oldLines: number
        newStart: number
        newLines: number
        content: string
      }>
    }>
  }
}

export class EnhancedVersionSystem {
  private readonly VERSIONS_KEY = 'fragg_version_system'
  private readonly BRANCHES_KEY = 'fragg_version_branches'
  
  constructor(private appId: string) {}

  /**
   * Initialize version system for an app
   */
  initializeVersionSystem(initialCode: any, initialMessage: string = 'Initial version'): VersionTree {
    const mainBranch: VersionBranch = {
      id: 'main',
      name: 'main',
      description: 'Main development branch',
      createdAt: new Date().toISOString(),
      isMainBranch: true,
      isActive: true,
      color: '#2563eb'
    }

    const initialVersion: AppVersion = {
      id: crypto.randomUUID(),
      appId: this.appId,
      branchId: 'main',
      versionNumber: '1.0.0',
      internalVersion: 1,
      code: initialCode,
      metadata: {
        timestamp: Date.now(),
        message: initialMessage,
        changes: {
          additions: this.countLines(initialCode),
          deletions: 0,
          modifications: 0,
          filesChanged: ['app.tsx']
        }
      }
    }

    const versionTree: VersionTree = {
      versions: [initialVersion],
      branches: [mainBranch],
      currentBranch: 'main',
      currentVersion: initialVersion.id,
      head: initialVersion.id
    }

    this.saveVersionTree(versionTree)
    return versionTree
  }

  /**
   * Create a new version in the current branch
   */
  createVersion(
    code: any,
    message: string,
    description?: string,
    author?: string,
    tags?: string[]
  ): AppVersion {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    const currentBranch = tree.branches.find(b => b.id === tree.currentBranch)
    if (!currentBranch) {
      throw new Error('Current branch not found')
    }

    const parentVersion = tree.versions.find(v => v.id === tree.head)
    const newVersionNumber = this.calculateNextVersion(tree, 'minor')
    const newInternalVersion = Math.max(...tree.versions.map(v => v.internalVersion)) + 1

    // Calculate diff from parent
    const diffInfo = parentVersion ? this.calculateDiff(parentVersion.code, code) : null

    const newVersion: AppVersion = {
      id: crypto.randomUUID(),
      appId: this.appId,
      branchId: tree.currentBranch,
      parentVersionId: parentVersion?.id,
      versionNumber: newVersionNumber,
      internalVersion: newInternalVersion,
      code,
      metadata: {
        author,
        timestamp: Date.now(),
        message,
        description,
        changes: {
          additions: diffInfo?.additions || 0,
          deletions: diffInfo?.deletions || 0,
          modifications: diffInfo?.modifications || 0,
          filesChanged: ['app.tsx']
        },
        tags
      },
      diffFromParent: diffInfo ? {
        additions: diffInfo.additions,
        deletions: diffInfo.deletions,
        modifications: diffInfo.modifications,
        diff: diffInfo.unifiedDiff,
        fileChanges: [{
          file: 'app.tsx',
          type: 'modified',
          linesAdded: diffInfo.additions,
          linesDeleted: diffInfo.deletions
        }]
      } : undefined
    }

    tree.versions.push(newVersion)
    tree.head = newVersion.id
    tree.currentVersion = newVersion.id

    this.saveVersionTree(tree)
    return newVersion
  }

  /**
   * Create a new branch
   */
  createBranch(
    name: string,
    description?: string,
    fromVersion?: string,
    author?: string
  ): VersionBranch {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    if (tree.branches.find(b => b.name === name)) {
      throw new Error(`Branch '${name}' already exists`)
    }

    const sourceVersion = fromVersion || tree.head
    const sourceVersionObj = tree.versions.find(v => v.id === sourceVersion)
    if (!sourceVersionObj) {
      throw new Error('Source version not found')
    }

    const newBranch: VersionBranch = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: new Date().toISOString(),
      createdBy: author,
      parentVersionId: sourceVersion,
      parentBranchId: sourceVersionObj.branchId,
      isMainBranch: false,
      isActive: false,
      color: this.generateBranchColor(),
      metadata: {
        sourceVersion: sourceVersionObj.versionNumber,
        sourceBranch: sourceVersionObj.branchId
      }
    }

    tree.branches.push(newBranch)
    this.saveVersionTree(tree)
    return newBranch
  }

  /**
   * Switch to a different branch
   */
  switchBranch(branchId: string): void {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    const branch = tree.branches.find(b => b.id === branchId)
    if (!branch) {
      throw new Error('Branch not found')
    }

    // Set current branch as inactive
    const currentBranch = tree.branches.find(b => b.id === tree.currentBranch)
    if (currentBranch) {
      currentBranch.isActive = false
    }

    // Set new branch as active
    branch.isActive = true
    tree.currentBranch = branchId

    // Find the head of the new branch
    const branchVersions = tree.versions.filter(v => v.branchId === branchId)
    const latestVersion = branchVersions.sort((a, b) => b.internalVersion - a.internalVersion)[0]
    
    if (latestVersion) {
      tree.head = latestVersion.id
      tree.currentVersion = latestVersion.id
    }

    this.saveVersionTree(tree)
  }

  /**
   * Merge one branch into another
   */
  mergeBranch(
    sourceBranchId: string,
    targetBranchId: string,
    message: string,
    author?: string
  ): AppVersion {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    const sourceBranch = tree.branches.find(b => b.id === sourceBranchId)
    const targetBranch = tree.branches.find(b => b.id === targetBranchId)
    
    if (!sourceBranch || !targetBranch) {
      throw new Error('Source or target branch not found')
    }

    // Get latest versions from both branches
    const sourceVersions = tree.versions.filter(v => v.branchId === sourceBranchId)
    const targetVersions = tree.versions.filter(v => v.branchId === targetBranchId)
    
    const latestSource = sourceVersions.sort((a, b) => b.internalVersion - a.internalVersion)[0]
    const latestTarget = targetVersions.sort((a, b) => b.internalVersion - a.internalVersion)[0]

    if (!latestSource || !latestTarget) {
      throw new Error('Could not find latest versions for merge')
    }

    // For simplicity, we'll take the source code as the merge result
    // In a real implementation, this would involve conflict resolution
    const mergedCode = latestSource.code

    const newVersionNumber = this.calculateNextVersion(tree, 'patch', targetBranchId)
    const newInternalVersion = Math.max(...tree.versions.map(v => v.internalVersion)) + 1

    const mergeVersion: AppVersion = {
      id: crypto.randomUUID(),
      appId: this.appId,
      branchId: targetBranchId,
      parentVersionId: latestTarget.id,
      versionNumber: newVersionNumber,
      internalVersion: newInternalVersion,
      code: mergedCode,
      metadata: {
        author,
        timestamp: Date.now(),
        message,
        changes: {
          additions: 0,
          deletions: 0,
          modifications: 0,
          filesChanged: ['app.tsx']
        }
      },
      mergeInfo: {
        isMergeCommit: true,
        mergedFromBranch: sourceBranch.name,
        mergedFromVersion: latestSource.versionNumber
      }
    }

    tree.versions.push(mergeVersion)
    
    // Update head if merging into current branch
    if (targetBranchId === tree.currentBranch) {
      tree.head = mergeVersion.id
      tree.currentVersion = mergeVersion.id
    }

    this.saveVersionTree(tree)
    return mergeVersion
  }

  /**
   * Compare two versions
   */
  compareVersions(versionAId: string, versionBId: string): VersionComparison {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    const versionA = tree.versions.find(v => v.id === versionAId)
    const versionB = tree.versions.find(v => v.id === versionBId)

    if (!versionA || !versionB) {
      throw new Error('One or both versions not found')
    }

    const diffResult = this.calculateDiff(versionA.code, versionB.code)

    return {
      versionA,
      versionB,
      diff: {
        unified: diffResult.unifiedDiff,
        stats: {
          additions: diffResult.additions,
          deletions: diffResult.deletions,
          modifications: diffResult.modifications,
          filesChanged: 1
        },
        files: [{
          path: 'app.tsx',
          type: 'modified',
          hunks: this.parseUnifiedDiff(diffResult.unifiedDiff)
        }]
      }
    }
  }

  /**
   * Get version tree
   */
  getVersionTree(): VersionTree | null {
    // For server-side, return a minimal tree structure to prevent errors
    if (typeof window === 'undefined') {
      return {
        versions: [],
        branches: [{
          id: 'main',
          name: 'main',
          isMainBranch: true,
          isActive: true,
          createdAt: new Date().toISOString()
        }],
        currentBranch: 'main',
        currentVersion: '',
        head: ''
      }
    }
    
    const data = localStorage.getItem(`${this.VERSIONS_KEY}_${this.appId}`)
    return data ? JSON.parse(data) : null
  }

  /**
   * Get version history for a specific branch
   */
  getVersionHistory(branchId?: string, limit?: number): AppVersion[] {
    const tree = this.getVersionTree()
    if (!tree) return []

    const targetBranch = branchId || tree.currentBranch
    let versions = tree.versions.filter(v => v.branchId === targetBranch)
    
    versions = versions.sort((a, b) => b.internalVersion - a.internalVersion)
    
    if (limit) {
      versions = versions.slice(0, limit)
    }

    return versions
  }

  /**
   * Get a specific version
   */
  getVersion(versionId: string): AppVersion | null {
    const tree = this.getVersionTree()
    if (!tree) return null

    return tree.versions.find(v => v.id === versionId) || null
  }

  /**
   * Revert to a specific version
   */
  revertToVersion(versionId: string, message?: string, author?: string): AppVersion {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    const targetVersion = tree.versions.find(v => v.id === versionId)
    if (!targetVersion) {
      throw new Error('Target version not found')
    }

    const revertMessage = message || `Revert to version ${targetVersion.versionNumber}`
    
    return this.createVersion(
      targetVersion.code,
      revertMessage,
      `Reverted to version ${targetVersion.versionNumber}`,
      author,
      ['revert']
    )
  }

  /**
   * Tag a version
   */
  tagVersion(versionId: string, tag: string): void {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    const version = tree.versions.find(v => v.id === versionId)
    if (!version) {
      throw new Error('Version not found')
    }

    if (!version.metadata.tags) {
      version.metadata.tags = []
    }

    if (!version.metadata.tags.includes(tag)) {
      version.metadata.tags.push(tag)
      this.saveVersionTree(tree)
    }
  }

  /**
   * Delete a branch
   */
  deleteBranch(branchId: string): void {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    const branch = tree.branches.find(b => b.id === branchId)
    if (!branch) {
      throw new Error('Branch not found')
    }

    if (branch.isMainBranch) {
      throw new Error('Cannot delete main branch')
    }

    if (branch.id === tree.currentBranch) {
      throw new Error('Cannot delete current branch')
    }

    // Remove branch and its versions
    tree.branches = tree.branches.filter(b => b.id !== branchId)
    tree.versions = tree.versions.filter(v => v.branchId !== branchId)

    this.saveVersionTree(tree)
  }

  /**
   * Export version tree
   */
  exportVersionTree(): string {
    const tree = this.getVersionTree()
    if (!tree) {
      throw new Error('Version system not initialized')
    }

    return JSON.stringify(tree, null, 2)
  }

  /**
   * Import version tree
   */
  importVersionTree(jsonData: string): void {
    try {
      const tree = JSON.parse(jsonData) as VersionTree
      this.saveVersionTree(tree)
    } catch (error) {
      throw new Error('Invalid version tree data')
    }
  }

  // Private helper methods

  private saveVersionTree(tree: VersionTree): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(`${this.VERSIONS_KEY}_${this.appId}`, JSON.stringify(tree))
  }

  private calculateNextVersion(tree: VersionTree, type: 'major' | 'minor' | 'patch', branchId?: string): string {
    const targetBranch = branchId || tree.currentBranch
    const branchVersions = tree.versions.filter(v => v.branchId === targetBranch)
    
    if (branchVersions.length === 0) {
      return '1.0.0'
    }

    const latestVersion = branchVersions.sort((a, b) => b.internalVersion - a.internalVersion)[0]
    const [major, minor, patch] = latestVersion.versionNumber.split('.').map(Number)

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`
      case 'minor':
        return `${major}.${minor + 1}.0`
      case 'patch':
        return `${major}.${minor}.${patch + 1}`
      default:
        return `${major}.${minor}.${patch + 1}`
    }
  }

  private calculateDiff(oldCode: any, newCode: any): {
    additions: number
    deletions: number
    modifications: number
    unifiedDiff: string
  } {
    const oldStr = JSON.stringify(oldCode, null, 2)
    const newStr = JSON.stringify(newCode, null, 2)
    
    const oldLines = oldStr.split('\n')
    const newLines = newStr.split('\n')
    
    // Simple diff calculation
    const additions = Math.max(0, newLines.length - oldLines.length)
    const deletions = Math.max(0, oldLines.length - newLines.length)
    const modifications = Math.min(oldLines.length, newLines.length)
    
    // Generate unified diff (simplified)
    const unifiedDiff = this.generateUnifiedDiff(oldLines, newLines)
    
    return {
      additions,
      deletions,
      modifications,
      unifiedDiff
    }
  }

  private generateUnifiedDiff(oldLines: string[], newLines: string[]): string {
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

  private parseUnifiedDiff(unifiedDiff: string): Array<{
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    content: string
  }> {
    // Simplified hunk parsing
    return [{
      oldStart: 1,
      oldLines: 0,
      newStart: 1,
      newLines: 0,
      content: unifiedDiff
    }]
  }

  private countLines(code: any): number {
    if (typeof code === 'string') {
      return code.split('\n').length
    }
    return JSON.stringify(code, null, 2).split('\n').length
  }

  private generateBranchColor(): string {
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', 
      '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
      '#f43f5e', '#84cc16', '#10b981', '#0ea5e9'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }
} 
import { supabase } from '@/lib/supabase'

export interface AppVersion {
  id: string
  app_id: string
  version: number
  code: any
  message?: string
  changes?: {
    additions: number
    deletions: number
    files: string[]
  }
  parent_version?: string
  created_by?: string
  created_at: string
}

export class AppVersionManager {
  private appId: string
  private userId?: string
  
  constructor(appId: string, userId?: string) {
    this.appId = appId
    this.userId = userId
  }
  
  /**
   * Create a new version of the app
   */
  async createVersion(
    code: any,
    message: string,
    parentVersionId?: string
  ): Promise<AppVersion | null> {
    if (!supabase) return null
    
    try {
      // Get the current latest version number
      const { data: latestVersion } = await supabase
        .from('app_versions')
        .select('version')
        .eq('app_id', this.appId)
        .order('version', { ascending: false })
        .limit(1)
        .single()
      
      const nextVersion = (latestVersion?.version || 0) + 1
      
      // Calculate changes if parent version exists
      let changes = null
      if (parentVersionId) {
        const { data: parentVersion } = await supabase
          .from('app_versions')
          .select('code')
          .eq('id', parentVersionId)
          .single()
        
        if (parentVersion) {
          changes = this.calculateChanges(parentVersion.code, code)
        }
      }
      
      // Create new version
      const { data, error } = await supabase
        .from('app_versions')
        .insert({
          app_id: this.appId,
          version: nextVersion,
          code,
          message,
          changes,
          parent_version: parentVersionId,
          created_by: this.userId
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating version:', error)
        return null
      }
      
      // Update the app's current code
      await supabase
        .from('apps')
        .update({
          specification: code,
          compiled_app: code,
          version: `${nextVersion}.0.0`,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.appId)
      
      return data
    } catch (error) {
      console.error('Error in createVersion:', error)
      return null
    }
  }
  
  /**
   * Get version history for the app
   */
  async getVersionHistory(limit: number = 20): Promise<AppVersion[]> {
    if (!supabase) return []
    
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('app_id', this.appId)
        .order('version', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Error fetching version history:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error in getVersionHistory:', error)
      return []
    }
  }
  
  /**
   * Get a specific version
   */
  async getVersion(versionId: string): Promise<AppVersion | null> {
    if (!supabase) return null
    
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('id', versionId)
        .single()
      
      if (error) {
        console.error('Error fetching version:', error)
        return null
      }
      
      return data
    } catch (error) {
      console.error('Error in getVersion:', error)
      return null
    }
  }
  
  /**
   * Revert to a previous version
   */
  async revertToVersion(versionId: string, message?: string): Promise<AppVersion | null> {
    if (!supabase) return null
    
    try {
      // Get the version to revert to
      const targetVersion = await this.getVersion(versionId)
      if (!targetVersion) return null
      
      // Create a new version with the old code
      const revertMessage = message || `Reverted to version ${targetVersion.version}`
      return await this.createVersion(
        targetVersion.code,
        revertMessage,
        versionId
      )
    } catch (error) {
      console.error('Error in revertToVersion:', error)
      return null
    }
  }
  
  /**
   * Calculate changes between two code versions
   */
  private calculateChanges(oldCode: any, newCode: any): {
    additions: number
    deletions: number
    files: string[]
  } {
    // Simple implementation - in a real app, you'd do more sophisticated diffing
    const oldStr = JSON.stringify(oldCode, null, 2)
    const newStr = JSON.stringify(newCode, null, 2)
    
    const oldLines = oldStr.split('\n')
    const newLines = newStr.split('\n')
    
    const additions = Math.max(0, newLines.length - oldLines.length)
    const deletions = Math.max(0, oldLines.length - newLines.length)
    
    // For files, we'll just track the main file for now
    const files = ['app.tsx']
    
    return {
      additions,
      deletions,
      files
    }
  }
  
  /**
   * Get diff between two versions
   */
  async getDiff(versionId1: string, versionId2: string): Promise<{
    before: any
    after: any
    changes: any
  } | null> {
    if (!supabase) return null
    
    try {
      const [version1, version2] = await Promise.all([
        this.getVersion(versionId1),
        this.getVersion(versionId2)
      ])
      
      if (!version1 || !version2) return null
      
      return {
        before: version1.code,
        after: version2.code,
        changes: this.calculateChanges(version1.code, version2.code)
      }
    } catch (error) {
      console.error('Error in getDiff:', error)
      return null
    }
  }
} 
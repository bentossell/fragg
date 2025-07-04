export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface FragmentVersion {
  fragment: any // Fragment code
  result?: any // ExecutionResult
  timestamp: number
}

export interface SavedApp {
  id: string
  name: string
  description?: string
  template: string
  code: any // Fragment code (latest version)
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  sandboxConfig?: any // Latest sandbox config
  lastSandboxId?: string
  fragmentVersions?: FragmentVersion[] // All versions of the app
  currentVersionIndex?: number // Current selected version
}

export class AppLibrary {
  private readonly APPS_KEY = 'fragg_app_library'
  
  /**
   * Get all saved apps
   */
  getApps(): SavedApp[] {
    if (typeof window === 'undefined') return []
    const data = localStorage.getItem(this.APPS_KEY)
    const apps = data ? JSON.parse(data) : []
    
    // Migrate old apps to new format if needed
    return apps.map((app: any) => this.migrateApp(app))
  }
  
  /**
   * Migrate old app format to new format with fragment versions
   */
  private migrateApp(app: any): SavedApp {
    // If app already has fragmentVersions, no migration needed
    if (app.fragmentVersions) {
      return app
    }
    
    // Migrate old format to new format
    const migratedApp: SavedApp = {
      ...app,
      fragmentVersions: [],
      currentVersionIndex: -1
    }
    
    // If app has code, create a version from it
    if (app.code) {
      const version: FragmentVersion = {
        fragment: app.code,
        result: app.sandboxConfig,
        timestamp: new Date(app.updatedAt || app.createdAt).getTime()
      }
      migratedApp.fragmentVersions = [version]
      migratedApp.currentVersionIndex = 0
    }
    
    return migratedApp
  }
  
  /**
   * Get a specific app by ID
   */
  getApp(id: string): SavedApp | null {
    const apps = this.getApps()
    return apps.find(app => app.id === id) || null
  }
  
  /**
   * Save a new app or update existing
   */
  saveApp(app: Omit<SavedApp, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SavedApp {
    const apps = this.getApps()
    const now = new Date().toISOString()
    
    if (app.id) {
      // Update existing app
      const index = apps.findIndex(a => a.id === app.id)
      if (index !== -1) {
        const updatedApp: SavedApp = {
          ...apps[index],
          ...app,
          id: app.id,
          updatedAt: now
        }
        apps[index] = updatedApp
        localStorage.setItem(this.APPS_KEY, JSON.stringify(apps))
        return updatedApp
      }
    }
    
    // Create new app
    const newApp: SavedApp = {
      ...app,
      id: app.id || crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    }
    
    apps.unshift(newApp) // Add to beginning
    localStorage.setItem(this.APPS_KEY, JSON.stringify(apps))
    return newApp
  }
  
  /**
   * Delete an app
   */
  deleteApp(id: string): boolean {
    const apps = this.getApps()
    const filtered = apps.filter(app => app.id !== id)
    
    if (filtered.length < apps.length) {
      localStorage.setItem(this.APPS_KEY, JSON.stringify(filtered))
      return true
    }
    return false
  }
  
  /**
   * Clear all apps
   */
  clearAll(): void {
    localStorage.removeItem(this.APPS_KEY)
  }
  
  /**
   * Export all apps as JSON
   */
  exportApps(): string {
    return JSON.stringify(this.getApps(), null, 2)
  }
  
  /**
   * Import apps from JSON
   */
  importApps(jsonData: string): void {
    try {
      const apps = JSON.parse(jsonData)
      if (Array.isArray(apps)) {
        localStorage.setItem(this.APPS_KEY, JSON.stringify(apps))
      }
    } catch (error) {
      console.error('Failed to import apps:', error)
      throw new Error('Invalid JSON data')
    }
  }
} 
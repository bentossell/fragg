import { AppLibrary, SavedApp, ChatMessage } from '../app-library'

describe('AppLibrary', () => {
  let appLibrary: AppLibrary
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    appLibrary = new AppLibrary()
  })
  
  afterEach(() => {
    localStorage.clear()
  })
  
  describe('saveApp', () => {
    it('should save a new app with generated ID', () => {
      const app = {
        name: 'Test App',
        description: 'A test application',
        template: 'nextjs',
        code: { files: [] },
        messages: []
      }
      
      const savedApp = appLibrary.saveApp(app)
      
      expect(savedApp.id).toBeDefined()
      expect(savedApp.name).toBe('Test App')
      expect(savedApp.createdAt).toBeDefined()
      expect(savedApp.updatedAt).toBe(savedApp.createdAt)
    })
    
    it('should update an existing app', () => {
      const app = {
        name: 'Test App',
        template: 'nextjs',
        code: { files: [] },
        messages: []
      }
      
      const savedApp = appLibrary.saveApp(app)
      const originalCreatedAt = savedApp.createdAt
      
      // Wait a bit to ensure updatedAt is different
      jest.advanceTimersByTime(100)
      
      const updatedApp = appLibrary.saveApp({
        ...savedApp,
        name: 'Updated App',
        id: savedApp.id
      })
      
      expect(updatedApp.id).toBe(savedApp.id)
      expect(updatedApp.name).toBe('Updated App')
      expect(updatedApp.createdAt).toBe(originalCreatedAt)
      expect(updatedApp.updatedAt).not.toBe(originalCreatedAt)
    })
  })
  
  describe('getApps', () => {
    it('should return empty array when no apps exist', () => {
      const apps = appLibrary.getApps()
      expect(apps).toEqual([])
    })
    
    it('should return all saved apps', () => {
      appLibrary.saveApp({ name: 'App 1', template: 'nextjs', code: {}, messages: [] })
      appLibrary.saveApp({ name: 'App 2', template: 'vue', code: {}, messages: [] })
      
      const apps = appLibrary.getApps()
      expect(apps).toHaveLength(2)
      expect(apps[0].name).toBe('App 2') // Most recent first
      expect(apps[1].name).toBe('App 1')
    })
  })
  
  describe('getApp', () => {
    it('should return null for non-existent app', () => {
      const app = appLibrary.getApp('non-existent')
      expect(app).toBeNull()
    })
    
    it('should return the correct app by ID', () => {
      const savedApp = appLibrary.saveApp({
        name: 'Test App',
        template: 'nextjs',
        code: {},
        messages: []
      })
      
      const retrievedApp = appLibrary.getApp(savedApp.id)
      expect(retrievedApp).toEqual(savedApp)
    })
  })
  
  describe('deleteApp', () => {
    it('should delete an existing app', () => {
      const app = appLibrary.saveApp({
        name: 'Test App',
        template: 'nextjs',
        code: {},
        messages: []
      })
      
      const result = appLibrary.deleteApp(app.id)
      expect(result).toBe(true)
      expect(appLibrary.getApp(app.id)).toBeNull()
    })
    
    it('should return false when deleting non-existent app', () => {
      const result = appLibrary.deleteApp('non-existent')
      expect(result).toBe(false)
    })
  })
  
  describe('app with messages', () => {
    it('should save and retrieve app with chat messages', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Create a todo app',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          role: 'assistant',
          content: 'I\'ll create a todo app for you',
          createdAt: new Date().toISOString()
        }
      ]
      
      const app = appLibrary.saveApp({
        name: 'Todo App',
        template: 'nextjs',
        code: { files: ['app.tsx'] },
        messages
      })
      
      const retrieved = appLibrary.getApp(app.id)
      expect(retrieved?.messages).toHaveLength(2)
      expect(retrieved?.messages[0].content).toBe('Create a todo app')
    })
  })
  
  describe('clearAll', () => {
    it('should remove all apps', () => {
      appLibrary.saveApp({ name: 'App 1', template: 'nextjs', code: {}, messages: [] })
      appLibrary.saveApp({ name: 'App 2', template: 'vue', code: {}, messages: [] })
      
      appLibrary.clearAll()
      expect(appLibrary.getApps()).toEqual([])
    })
  })
  
  describe('export/import', () => {
    it('should export and import apps correctly', () => {
      const app1 = appLibrary.saveApp({
        name: 'App 1',
        template: 'nextjs',
        code: {},
        messages: []
      })
      
      const app2 = appLibrary.saveApp({
        name: 'App 2',
        template: 'vue',
        code: {},
        messages: []
      })
      
      const exported = appLibrary.exportApps()
      
      // Clear and reimport
      appLibrary.clearAll()
      expect(appLibrary.getApps()).toEqual([])
      
      appLibrary.importApps(exported)
      const imported = appLibrary.getApps()
      
      expect(imported).toHaveLength(2)
      expect(imported[0].id).toBe(app2.id)
      expect(imported[1].id).toBe(app1.id)
    })
    
    it('should throw error on invalid JSON import', () => {
      expect(() => {
        appLibrary.importApps('invalid json')
      }).toThrow('Invalid JSON data')
    })
  })
}) 
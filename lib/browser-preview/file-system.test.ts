import { BrowserFileSystem, createReactFileSystem, createVueFileSystem } from './file-system'

describe('BrowserFileSystem', () => {
  let fs: BrowserFileSystem

  beforeEach(() => {
    fs = new BrowserFileSystem()
  })

  describe('Basic file operations', () => {
    it('should add and retrieve files', () => {
      fs.addFile('/src/App.tsx', 'const App = () => <div>Hello</div>')
      expect(fs.getFile('/src/App.tsx')).toBe('const App = () => <div>Hello</div>')
    })

    it('should normalize paths when adding files', () => {
      fs.addFile('src/App.tsx', 'content')
      expect(fs.getFile('/src/App.tsx')).toBe('content')
      expect(fs.getFile('src/App.tsx')).toBe('content')
    })

    it('should return undefined for non-existent files', () => {
      expect(fs.getFile('/not-found.ts')).toBeUndefined()
    })

    it('should check if files exist', () => {
      fs.addFile('/index.html', '<html></html>')
      expect(fs.hasFile('/index.html')).toBe(true)
      expect(fs.hasFile('index.html')).toBe(true)
      expect(fs.hasFile('/not-found.html')).toBe(false)
    })

    it('should clear all files', () => {
      fs.addFile('/file1.ts', 'content1')
      fs.addFile('/file2.ts', 'content2')
      expect(fs.getFileList()).toHaveLength(2)
      
      fs.clear()
      expect(fs.getFileList()).toHaveLength(0)
    })
  })

  describe('Module resolution', () => {
    beforeEach(() => {
      fs.addFile('/src/components/Button.tsx', 'export const Button = () => {}')
      fs.addFile('/src/components/index.ts', 'export * from "./Button"')
      fs.addFile('/src/utils/helpers.js', 'export const helper = () => {}')
      fs.addFile('/src/App.tsx', 'import { Button } from "./components"')
    })

    it('should resolve relative imports with extensions', () => {
      const resolved = fs.resolveImport('./Button.tsx', '/src/components/index.ts')
      expect(resolved).toBe('/src/components/Button.tsx')
    })

    it('should resolve relative imports without extensions', () => {
      const resolved = fs.resolveImport('./Button', '/src/components/index.ts')
      expect(resolved).toBe('/src/components/Button.tsx')
    })

    it('should resolve parent directory imports', () => {
      const resolved = fs.resolveImport('../utils/helpers', '/src/components/Button.tsx')
      expect(resolved).toBe('/src/utils/helpers.js')
    })

    it('should resolve index files', () => {
      fs.addFile('/src/components/Card/index.tsx', 'export const Card = () => {}')
      const resolved = fs.resolveImport('./Card', '/src/components/index.ts')
      expect(resolved).toBe('/src/components/Card/index.tsx')
    })

    it('should map npm packages to CDN URLs', () => {
      expect(fs.resolveImport('react', '/src/App.tsx')).toBe('https://unpkg.com/react@18/umd/react.production.min.js')
      expect(fs.resolveImport('vue', '/src/App.tsx')).toBe('https://unpkg.com/vue@3/dist/vue.global.js')
      expect(fs.resolveImport('lodash', '/src/App.tsx')).toBe('https://unpkg.com/lodash@4/lodash.min.js')
    })

    it('should handle scoped packages', () => {
      expect(fs.resolveImport('@mui/material', '/src/App.tsx')).toBe('https://unpkg.com/@mui/material@5/umd/material-ui.production.min.js')
    })

    it('should default to unpkg for unknown packages', () => {
      expect(fs.resolveImport('unknown-package', '/src/App.tsx')).toBe('https://unpkg.com/unknown-package')
    })
  })

  describe('Helper methods', () => {
    beforeEach(() => {
      fs.addFile('/src/App.tsx', 'const App = () => {}')
      fs.addFile('/src/components/Button.tsx', 'export const Button = () => {}')
      fs.addFile('/src/utils/helpers.js', 'export const helper = () => {}')
      fs.addFile('/README.md', '# Project')
    })

    it('should get all files as a Map', () => {
      const allFiles = fs.getAllFiles()
      expect(allFiles).toBeInstanceOf(Map)
      expect(allFiles.size).toBe(4)
      expect(allFiles.get('/src/App.tsx')).toBe('const App = () => {}')
    })

    it('should get sorted file list', () => {
      const fileList = fs.getFileList()
      expect(fileList).toEqual([
        '/README.md',
        '/src/App.tsx',
        '/src/components/Button.tsx',
        '/src/utils/helpers.js'
      ])
    })

    it('should get file statistics', () => {
      const stats = fs.getStats()
      expect(stats.totalFiles).toBe(4)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.filesByExtension['.tsx']).toBe(2)
      expect(stats.filesByExtension['.js']).toBe(1)
      expect(stats.filesByExtension['.md']).toBe(1)
    })

    it('should create directory structure', () => {
      const structure = fs.getDirectoryStructure()
      expect(structure).toEqual({
        'README.md': 'file',
        src: {
          'App.tsx': 'file',
          components: {
            'Button.tsx': 'file'
          },
          utils: {
            'helpers.js': 'file'
          }
        }
      })
    })
  })

  describe('Package mapping', () => {
    it('should add custom package mappings', () => {
      fs.addPackageMapping('my-custom-lib', 'https://cdn.example.com/my-custom-lib.js')
      expect(fs.getPackageCDN('my-custom-lib')).toBe('https://cdn.example.com/my-custom-lib.js')
      expect(fs.resolveImport('my-custom-lib', '/src/App.tsx')).toBe('https://cdn.example.com/my-custom-lib.js')
    })

    it('should return undefined for unknown package CDN', () => {
      expect(fs.getPackageCDN('unknown-package')).toBeUndefined()
    })
  })

  describe('Pre-configured file systems', () => {
    it('should create React file system with defaults', () => {
      const reactFs = createReactFileSystem()
      expect(reactFs.hasFile('/package.json')).toBe(true)
      expect(reactFs.hasFile('/index.html')).toBe(true)
      
      const packageJson = JSON.parse(reactFs.getFile('/package.json')!)
      expect(packageJson.dependencies.react).toBe('^18.0.0')
      expect(packageJson.dependencies['react-dom']).toBe('^18.0.0')
    })

    it('should create Vue file system with defaults', () => {
      const vueFs = createVueFileSystem()
      expect(vueFs.hasFile('/package.json')).toBe(true)
      expect(vueFs.hasFile('/index.html')).toBe(true)
      
      const packageJson = JSON.parse(vueFs.getFile('/package.json')!)
      expect(packageJson.dependencies.vue).toBe('^3.0.0')
    })
  })
})

// Path utilities tests
describe('Path utilities', () => {
  // Since pathUtils is not exported, we'll test it through the file system
  let fs: BrowserFileSystem

  beforeEach(() => {
    fs = new BrowserFileSystem()
  })

  it('should handle complex path resolution', () => {
    fs.addFile('/src/components/nested/deep/Component.tsx', 'export default () => {}')
    
    // Test going up multiple directories
    const resolved = fs.resolveImport('../../../utils/helper', '/src/components/nested/deep/Component.tsx')
    expect(resolved).toBe('/src/utils/helper')
  })

  it('should handle edge cases in path resolution', () => {
    // Root level imports
    fs.addFile('/App.tsx', 'export default () => {}')
    const resolved = fs.resolveImport('./App', '/')
    expect(resolved).toBe('/App.tsx')
  })
}) 
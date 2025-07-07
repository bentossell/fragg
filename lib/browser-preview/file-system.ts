/**
 * Browser-based file system implementation for instant preview
 * Manages files in memory and handles module resolution
 */

interface PackageToCDNMapping {
  [key: string]: string
}

// Custom path utilities for browser environment
const pathUtils = {
  dirname(filePath: string): string {
    // Handle edge cases
    if (!filePath || filePath === '/') return '/'
    
    // Remove trailing slash if present
    const normalizedPath = filePath.endsWith('/') && filePath.length > 1 
      ? filePath.slice(0, -1) 
      : filePath
    
    const lastSlash = normalizedPath.lastIndexOf('/')
    
    // If no slash found or it's the root slash, return root
    if (lastSlash <= 0) return '/'
    
    return normalizedPath.substring(0, lastSlash)
  },

  resolve(...paths: string[]): string {
    let resolvedPath = ''
    
    for (const path of paths) {
      if (path.startsWith('/')) {
        // Absolute path, reset the resolved path
        resolvedPath = path
      } else {
        // Relative path, append to current resolved path
        if (resolvedPath && !resolvedPath.endsWith('/')) {
          resolvedPath += '/'
        }
        resolvedPath += path
      }
    }
    
    // Normalize the path (handle . and ..)
    const parts = resolvedPath.split('/').filter(Boolean)
    const normalized: string[] = []
    
    for (const part of parts) {
      if (part === '.') {
        // Current directory, skip
        continue
      } else if (part === '..' && normalized.length > 0) {
        // Parent directory, go up one level
        normalized.pop()
      } else if (part !== '..') {
        // Regular directory or file
        normalized.push(part)
      }
    }
    
    return '/' + normalized.join('/')
  },

  extname(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.')
    const lastSlash = filePath.lastIndexOf('/')
    
    // No extension if dot comes before last slash or no dot found
    if (lastDot <= lastSlash || lastDot === -1) {
      return ''
    }
    
    return filePath.substring(lastDot)
  }
}

export class BrowserFileSystem {
  private files: Map<string, string> = new Map()

  // Common package to CDN mappings
  private readonly packageToCDN: PackageToCDNMapping = {
    'react': 'https://unpkg.com/react@18/umd/react.production.min.js',
    'react-dom': 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'vue': 'https://unpkg.com/vue@3/dist/vue.global.js',
    'lodash': 'https://unpkg.com/lodash@4/lodash.min.js',
    'axios': 'https://unpkg.com/axios@1/dist/axios.min.js',
    'moment': 'https://unpkg.com/moment@2/moment.min.js',
    'd3': 'https://unpkg.com/d3@7/dist/d3.min.js',
    'three': 'https://unpkg.com/three@0/build/three.min.js',
    'chart.js': 'https://unpkg.com/chart.js@4/dist/chart.umd.js',
    '@mui/material': 'https://unpkg.com/@mui/material@5/umd/material-ui.production.min.js',
    'antd': 'https://unpkg.com/antd@5/dist/antd.min.js',
    'framer-motion': 'https://unpkg.com/framer-motion@11/dist/framer-motion.js',
    'styled-components': 'https://unpkg.com/styled-components@6/dist/styled-components.min.js',
    'tailwindcss': 'https://cdn.tailwindcss.com',
  }

  /**
   * Add a file to the file system
   * @param path - File path (e.g., '/src/App.tsx')
   * @param content - File content as string
   */
  addFile(path: string, content: string): void {
    // Normalize path to always start with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    this.files.set(normalizedPath, content)
  }

  /**
   * Get file content by path
   * @param path - File path to retrieve
   * @returns File content or undefined if not found
   */
  getFile(path: string): string | undefined {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return this.files.get(normalizedPath)
  }

  /**
   * Resolve module imports to file paths or CDN URLs
   * @param importPath - Import path (e.g., './module', 'react')
   * @param currentFile - Current file path for relative resolution
   * @returns Resolved path or CDN URL
   */
  resolveImport(importPath: string, currentFile: string): string {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const currentDir = pathUtils.dirname(currentFile)
      let resolvedPath = pathUtils.resolve(currentDir, importPath)
      
      // Try common extensions if no extension provided
      const extensions = ['', '.js', '.jsx', '.ts', '.tsx']
      for (const ext of extensions) {
        const pathWithExt = resolvedPath + ext
        if (this.hasFile(pathWithExt)) {
          return pathWithExt
        }
      }
      
      // Try index files
      const indexExtensions = ['/index.js', '/index.jsx', '/index.ts', '/index.tsx']
      for (const indexExt of indexExtensions) {
        const indexPath = resolvedPath + indexExt
        if (this.hasFile(indexPath)) {
          return indexPath
        }
      }
      
      return resolvedPath
    }
    
    // Handle npm packages
    // Check if we have a direct CDN mapping
    if (this.packageToCDN[importPath]) {
      return this.packageToCDN[importPath]
    }
    
    // Check for scoped packages (e.g., @mui/material/Button)
    const scopedPackageMatch = importPath.match(/^(@[^/]+\/[^/]+)(.*)/)
    if (scopedPackageMatch) {
      const [, packageName, subPath] = scopedPackageMatch
      if (this.packageToCDN[packageName]) {
        // For now, return the main package CDN
        // In a real implementation, we'd handle subpaths more intelligently
        return this.packageToCDN[packageName]
      }
    }
    
    // Default to unpkg for unknown packages
    return `https://unpkg.com/${importPath}`
  }

  /**
   * Clear all files from the file system
   */
  clear(): void {
    this.files.clear()
  }

  /**
   * Check if a file exists
   * @param path - File path to check
   * @returns True if file exists
   */
  hasFile(path: string): boolean {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return this.files.has(normalizedPath)
  }

  /**
   * Get all files as a Map
   * @returns Map of all files (path -> content)
   */
  getAllFiles(): Map<string, string> {
    return new Map(this.files)
  }

  /**
   * Get list of all file paths
   * @returns Array of file paths
   */
  getFileList(): string[] {
    return Array.from(this.files.keys()).sort()
  }

  /**
   * Add a custom package to CDN mapping
   * @param packageName - NPM package name
   * @param cdnUrl - CDN URL for the package
   */
  addPackageMapping(packageName: string, cdnUrl: string): void {
    this.packageToCDN[packageName] = cdnUrl
  }

  /**
   * Get the CDN URL for a package
   * @param packageName - NPM package name
   * @returns CDN URL or undefined
   */
  getPackageCDN(packageName: string): string | undefined {
    return this.packageToCDN[packageName]
  }

  /**
   * Get file statistics
   * @returns Object with file system statistics
   */
  getStats(): {
    totalFiles: number
    totalSize: number
    filesByExtension: Record<string, number>
  } {
    const stats = {
      totalFiles: this.files.size,
      totalSize: 0,
      filesByExtension: {} as Record<string, number>
    }

    for (const [filePath, content] of this.files) {
      stats.totalSize += content.length
      
      const ext = pathUtils.extname(filePath) || 'no-extension'
      stats.filesByExtension[ext] = (stats.filesByExtension[ext] || 0) + 1
    }

    return stats
  }

  /**
   * Create a virtual directory structure
   * @returns Nested object representing directory structure
   */
  getDirectoryStructure(): any {
    const structure: any = {}

    for (const filePath of this.files.keys()) {
      const parts = filePath.split('/').filter(Boolean)
      let current = structure

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {}
        }
        current = current[parts[i]]
      }

      // Add file to structure
      const fileName = parts[parts.length - 1]
      current[fileName] = 'file'
    }

    return structure
  }
}

/**
 * Create a pre-configured file system for React projects
 */
export function createReactFileSystem(): BrowserFileSystem {
  const fs = new BrowserFileSystem()
  
  // Add common React project structure
  fs.addFile('/package.json', JSON.stringify({
    name: 'browser-preview-app',
    version: '1.0.0',
    dependencies: {
      react: '^18.0.0',
      'react-dom': '^18.0.0'
    }
  }, null, 2))

  fs.addFile('/index.html', `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
  `.trim())

  return fs
}

/**
 * Create a pre-configured file system for Vue projects
 */
export function createVueFileSystem(): BrowserFileSystem {
  const fs = new BrowserFileSystem()
  
  // Add common Vue project structure
  fs.addFile('/package.json', JSON.stringify({
    name: 'browser-preview-app',
    version: '1.0.0',
    dependencies: {
      vue: '^3.0.0'
    }
  }, null, 2))

  fs.addFile('/index.html', `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
  `.trim())

  return fs
} 
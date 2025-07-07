import React, { lazy, Suspense, ComponentType } from 'react'

// Lazy loading helper with error boundary
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
): React.FC<React.ComponentProps<T>> {
  const LazyComponent = lazy(importFn)
  
  return function WrappedLazyComponent(props: React.ComponentProps<T>) {
    return React.createElement(
      Suspense,
      { fallback: fallback || React.createElement('div', null, 'Loading...') },
      React.createElement(LazyComponent, props)
    )
  }
}

// Bundle analyzer interface
export interface BundleAnalysis {
  totalSize: number
  chunks: ChunkInfo[]
  duplicates: DuplicateInfo[]
  unusedExports: UnusedExport[]
  recommendations: Recommendation[]
}

export interface ChunkInfo {
  name: string
  size: number
  modules: string[]
  dynamicImports: string[]
  isEntry: boolean
  isVendor: boolean
}

export interface DuplicateInfo {
  module: string
  occurrences: number
  totalSize: number
  chunks: string[]
}

export interface UnusedExport {
  file: string
  export: string
  estimatedSize: number
}

export interface Recommendation {
  type: 'code-split' | 'lazy-load' | 'tree-shake' | 'bundle-split' | 'preload'
  description: string
  impact: 'high' | 'medium' | 'low'
  estimatedSavings: number
  implementation: string
}

// Bundle optimizer class
export class BundleOptimizer {
  private static instance: BundleOptimizer
  private cache = new Map<string, any>()
  private preloadedComponents = new Set<string>()

  static getInstance(): BundleOptimizer {
    if (!BundleOptimizer.instance) {
      BundleOptimizer.instance = new BundleOptimizer()
    }
    return BundleOptimizer.instance
  }

  // Create optimized lazy component with preloading
  createOptimizedLazyComponent<T extends ComponentType<any>>(
    componentName: string,
    importFn: () => Promise<{ default: T }>,
    options: {
      preload?: boolean
      fallback?: React.ReactNode
      chunkName?: string
      prefetch?: boolean
    } = {}
  ): React.FC<React.ComponentProps<T>> {
    const { preload = false, fallback, chunkName, prefetch = false } = options

    // Cache the import function
    const cachedImportFn = () => {
      if (this.cache.has(componentName)) {
        return Promise.resolve(this.cache.get(componentName))
      }

      return importFn().then(module => {
        this.cache.set(componentName, module)
        return module
      })
    }

    const LazyComponent = lazy(cachedImportFn)

    // Preload if requested
    if (preload && !this.preloadedComponents.has(componentName)) {
      this.preloadComponent(componentName, cachedImportFn)
    }

    // Add prefetch link
    if (prefetch && typeof window !== 'undefined') {
      this.addPrefetchLink(chunkName || componentName)
    }

    return function OptimizedLazyComponent(props: React.ComponentProps<T>) {
      return React.createElement(
        Suspense,
        { 
          fallback: fallback || React.createElement(
            'div',
            { className: 'flex items-center justify-center p-4' },
            React.createElement('div', { 
              className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-primary' 
            })
          )
        },
        React.createElement(LazyComponent, props)
      )
    }
  }

  // Preload component
  async preloadComponent(
    componentName: string, 
    importFn: () => Promise<any>
  ): Promise<void> {
    if (this.preloadedComponents.has(componentName)) {
      return
    }

    try {
      await importFn()
      this.preloadedComponents.add(componentName)
      console.log(`✅ Preloaded component: ${componentName}`)
    } catch (error) {
      console.warn(`⚠️ Failed to preload component: ${componentName}`, error)
    }
  }

  // Add prefetch link for better caching
  private addPrefetchLink(chunkName: string): void {
    if (typeof document === 'undefined') return

    const existingLink = document.querySelector(`link[data-chunk="${chunkName}"]`)
    if (existingLink) return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = `/_next/static/chunks/${chunkName}.js`
    link.setAttribute('data-chunk', chunkName)
    document.head.appendChild(link)
  }

  // Analyze bundle performance
  analyzeBundlePerformance(): BundleAnalysis {
    // This would integrate with webpack-bundle-analyzer or similar
    const analysis: BundleAnalysis = {
      totalSize: 0,
      chunks: [],
      duplicates: [],
      unusedExports: [],
      recommendations: []
    }

    // Add recommendations based on component usage
    analysis.recommendations.push(
      {
        type: 'lazy-load',
        description: 'Lazy load large components like chat interfaces and preview panels',
        impact: 'high',
        estimatedSavings: 150000, // 150KB
        implementation: 'Use createOptimizedLazyComponent for ChatSession, UnifiedPreview'
      },
      {
        type: 'code-split',
        description: 'Split vendor libraries from application code',
        impact: 'medium',
        estimatedSavings: 100000, // 100KB
        implementation: 'Configure webpack splitChunks for react, lucide-icons'
      },
      {
        type: 'tree-shake',
        description: 'Remove unused exports from utility libraries',
        impact: 'medium',
        estimatedSavings: 50000, // 50KB
        implementation: 'Use ESM imports and mark sideEffects: false'
      }
    )

    return analysis
  }

  // Generate optimized imports
  generateOptimizedImports(): Record<string, string> {
    return {
      // Lazy loaded components
      'ChatSession': `const ChatSession = createOptimizedLazyComponent(
        'ChatSession',
        () => import('@/components/chat-session'),
        { preload: true, chunkName: 'chat-session' }
      )`,
      
      'UnifiedPreview': `const UnifiedPreview = createOptimizedLazyComponent(
        'UnifiedPreview',
        () => import('@/components/unified-preview'),
        { preload: true, chunkName: 'unified-preview' }
      )`,
      
      'DiffPreviewDialog': `const DiffPreviewDialog = createOptimizedLazyComponent(
        'DiffPreviewDialog',
        () => import('@/components/diff-preview-dialog'),
        { chunkName: 'diff-preview' }
      )`,
      
      'VersionManager': `const VersionManager = createOptimizedLazyComponent(
        'VersionManager',
        () => import('@/components/version-manager'),
        { chunkName: 'version-manager' }
      )`,
      
      // Tree-shaken imports
      'icons': `import { 
        Save, Plus, FolderOpen, LayoutGrid, Columns2 
      } from 'lucide-react'`,
      
      'utils': `import { cn, isFileInArray } from '@/lib/utils'`
    }
  }

  // Critical resource hints
  generateResourceHints(): string[] {
    return [
      // Preload critical chunks
      '<link rel="preload" href="/_next/static/chunks/chat-session.js" as="script">',
      '<link rel="preload" href="/_next/static/chunks/unified-preview.js" as="script">',
      
      // Prefetch likely-needed chunks
      '<link rel="prefetch" href="/_next/static/chunks/diff-preview.js">',
      '<link rel="prefetch" href="/_next/static/chunks/version-manager.js">',
      
      // DNS prefetch for external resources
      '<link rel="dns-prefetch" href="//openrouter.ai">',
      '<link rel="dns-prefetch" href="//api.e2b.dev">',
      
      // Preconnect to critical origins
      '<link rel="preconnect" href="//fonts.googleapis.com" crossorigin>',
      '<link rel="preconnect" href="//cdn.tailwindcss.com" crossorigin>'
    ]
  }
}

// Performance-optimized component factory
export function createPerformantComponent<T extends ComponentType<any>>(
  Component: T,
  options: {
    memo?: boolean
    lazy?: boolean
    preload?: boolean
    displayName?: string
  } = {}
): T {
  const { memo = true, lazy = false, preload = false, displayName } = options

  let OptimizedComponent = Component

  // Apply React.memo if requested
  if (memo) {
    OptimizedComponent = React.memo(OptimizedComponent) as any
  }

  // Set display name for debugging
  if (displayName) {
    OptimizedComponent.displayName = displayName
  }

  return OptimizedComponent
}

// Tree shaking utilities
export const TreeShaking = {
  // Mark modules as side-effect free
  markSideEffectFree: (moduleNames: string[]) => {
    // This would be used in package.json sideEffects field
    return moduleNames.map(name => `!./lib/${name}.ts`)
  },

  // Generate ESM-only imports
  generateESMImports: (imports: Record<string, string[]>) => {
    return Object.entries(imports).map(([module, exports]) => 
      `import { ${exports.join(', ')} } from '${module}'`
    ).join('\n')
  },

  // Identify unused exports
  findUnusedExports: (files: string[]): UnusedExport[] => {
    // This would analyze the codebase for unused exports
    return [
      {
        file: 'lib/utils.ts',
        export: 'formatDate',
        estimatedSize: 1200
      },
      {
        file: 'components/ui/button.tsx',
        export: 'ButtonVariants',
        estimatedSize: 800
      }
    ]
  }
}

// Code splitting utilities
export const CodeSplitting = {
  // Generate webpack configuration
  generateWebpackConfig: () => ({
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20
          },
          icons: {
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name: 'icons',
            chunks: 'all',
            priority: 15
          },
          ui: {
            test: /[\\/]components[\\/]ui[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 5
          }
        }
      }
    }
  }),

  // Route-based splitting
  generateRouteConfig: () => ({
    '/': { preload: true, chunk: 'home' },
    '/library': { preload: false, chunk: 'library' },
    '/real-time': { preload: false, chunk: 'real-time' },
    '/test-ai': { preload: false, chunk: 'test-ai' }
  })
}

// Export singleton instance
export const bundleOptimizer = BundleOptimizer.getInstance() 
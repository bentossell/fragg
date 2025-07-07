/**
 * Utility functions for browser preview functionality
 */

/**
 * Helper function to determine whether to use Sandpack or browser preview
 * Uses Sandpack for complex apps with npm dependencies or build requirements
 */
export function shouldUseSandpack(fragment: {
  code?: string
  template?: string
}): boolean {
  if (!fragment.code) return false

  const code = fragment.code.toLowerCase()
  
  // Check for npm package imports (not available via CDN)
  const npmPackagePatterns = [
    /import\s+.*\s+from\s+['"][^.\/].*['"]/g, // ES imports from packages
    /require\s*\(\s*['"][^.\/].*['"]\s*\)/g,  // CommonJS requires
    /from\s+['"](@[^\/]+\/[^'"]+|[^@.\/][^'"]*)['"]/g, // Scoped packages
  ]

  const hasNpmImports = npmPackagePatterns.some(pattern => pattern.test(code))
  
  // Check for complex build requirements
  const complexPatterns = [
    /\.module\.css/,           // CSS modules
    /\.scss|\.sass|\.less/,    // CSS preprocessors
    /import\s+.*\.svg/,        // SVG imports
    /import\s+.*\.(png|jpg|jpeg|gif|webp)/, // Image imports
    /process\.env\./,          // Environment variables
    /import\.meta\./,          // Vite-specific imports
    /__dirname|__filename/,    // Node.js globals
    /\.tsx?$/,                 // TypeScript files (in imports)
  ]

  const hasComplexRequirements = complexPatterns.some(pattern => pattern.test(code))

  // Check for specific npm packages that aren't available via CDN
  const nonCdnPackages = [
    'framer-motion',
    'react-spring',
    '@tanstack/react-query',
    'react-hook-form',
    'zod',
    'yup',
    '@emotion/',
    'styled-components',
    'axios',
    'swr',
    'react-router',
    '@reduxjs/toolkit',
    'mobx',
    'recoil',
    'valtio',
    'zustand',
    '@mui/',
    '@chakra-ui/',
    'antd',
    '@headlessui/',
    '@radix-ui/',
    'recharts',
    'chart.js',
    'd3',
    'three',
    '@react-three/',
  ]

  const hasNonCdnPackage = nonCdnPackages.some(pkg => code.includes(pkg))

  // Check for Vue-specific complex patterns
  if (fragment.template === 'vue-developer') {
    const vueComplexPatterns = [
      /<script\s+setup/,        // Vue 3 script setup
      /defineProps|defineEmits/, // Vue 3 composition API
      /import\s+.*\.vue/,       // Vue SFC imports
      /@vue\//, // Vue ecosystem packages
    ]
    
    if (vueComplexPatterns.some(pattern => pattern.test(code))) {
      return true
    }
  }

  return hasNpmImports || hasComplexRequirements || hasNonCdnPackage
} 
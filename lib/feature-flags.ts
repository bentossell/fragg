/**
 * Feature flags for controlling gradual rollout of new features
 */

import type { TemplateId } from './templates'

// Templates that support browser-based preview
const BROWSER_PREVIEW_SUPPORTED_TEMPLATES: TemplateId[] = [
  'nextjs-developer',
  'vue-developer', 
  'static-html'
]

// Templates that require full sandbox (Python-based)
const SANDBOX_ONLY_TEMPLATES: TemplateId[] = [
  'streamlit-developer',
  'gradio-developer',
  'code-interpreter-v1'
]

interface FeatureFlags {
  browserPreview: {
    enabled: boolean
    rolloutPercentage: number
    supportedTemplates: TemplateId[]
  }
}

// Default feature flag configuration
const defaultFlags: FeatureFlags = {
  browserPreview: {
    enabled: process.env.NODE_ENV === 'development', // Enable in dev by default
    rolloutPercentage: 0, // 0% rollout in production initially
    supportedTemplates: BROWSER_PREVIEW_SUPPORTED_TEMPLATES
  }
}

// Override flags from environment variables if set
const flags: FeatureFlags = {
  browserPreview: {
    enabled: process.env.NEXT_PUBLIC_BROWSER_PREVIEW_ENABLED === 'true' || defaultFlags.browserPreview.enabled,
    rolloutPercentage: parseInt(process.env.NEXT_PUBLIC_BROWSER_PREVIEW_ROLLOUT || '0', 10) || defaultFlags.browserPreview.rolloutPercentage,
    supportedTemplates: defaultFlags.browserPreview.supportedTemplates
  }
}

/**
 * Check if browser preview should be used based on feature flags and user
 * @param userId - Optional user ID for percentage-based rollout
 * @returns true if browser preview should be used
 */
export function shouldUseBrowserPreview(userId?: string): boolean {
  // First check if feature is enabled at all
  if (!flags.browserPreview.enabled) {
    return false
  }

  // In development, always use browser preview
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // In production, check rollout percentage
  if (flags.browserPreview.rolloutPercentage === 0) {
    return false
  }
  
  if (flags.browserPreview.rolloutPercentage === 100) {
    return true
  }

  // Use user ID for consistent rollout (same user always gets same experience)
  if (userId) {
    // Simple hash function to convert userId to number 0-99
    const hash = userId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0)
    }, 0)
    const userPercentage = Math.abs(hash) % 100
    return userPercentage < flags.browserPreview.rolloutPercentage
  }

  // If no user ID, use random rollout
  return Math.random() * 100 < flags.browserPreview.rolloutPercentage
}

/**
 * Check if a specific template supports browser preview
 * @param template - The template ID to check
 * @returns true if template supports browser preview
 */
export function templateSupportsBrowserPreview(template: TemplateId): boolean {
  return flags.browserPreview.supportedTemplates.includes(template)
}

/**
 * Check if a template requires sandbox-only preview
 * @param template - The template ID to check  
 * @returns true if template requires sandbox
 */
export function templateRequiresSandbox(template: TemplateId): boolean {
  return SANDBOX_ONLY_TEMPLATES.includes(template)
}

/**
 * Get the current feature flags configuration
 * @returns Current feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return flags
}

/**
 * Check if we should show browser preview option in UI
 * Useful for showing a toggle or indicator
 */
export function showBrowserPreviewOption(): boolean {
  return flags.browserPreview.enabled || process.env.NODE_ENV === 'development'
} 
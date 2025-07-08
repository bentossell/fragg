/**
 * Sandbox Router
 * 
 * This module provides a unified interface for deciding which sandbox implementation
 * to use based on the code, template, and feature flags.
 * 
 * The router supports a gradual rollout strategy with feature flags and falls back
 * to existing implementations when needed.
 */

import { Fragment, lazy } from 'react';
import { shouldUseBrowserPreview, templateSupportsBrowserPreview } from '@/lib/feature-flags';
import { TemplateId } from '@/lib/templates';
import { FragmentSchema } from '@/lib/schema';
import { shouldUseSandpack } from '@/components/sandpack-preview';

// Lazy load sandbox implementations to reduce initial bundle size
const WebContainerPreview = lazy(() => import('@/components/webcontainer-preview').then(mod => ({ default: mod.WebContainerPreview })));
const BrowserPreview = lazy(() => import('@/components/browser-preview').then(mod => ({ default: mod })));
const SandpackPreview = lazy(() => import('@/components/sandpack-preview').then(mod => ({ default: mod.SandpackPreview })));
const InstantPreview = lazy(() => import('@/components/instant-preview-v2').then(mod => ({ default: mod })));

// Sandbox type enum
export type SandboxType = 
  | 'webcontainer'  // WebContainers - Node.js in browser (fast)
  | 'browser'       // Browser Preview - simple HTML/JS/CSS preview (fastest)
  | 'sandpack'      // Sandpack - CodeSandbox integration (good for complex frontend)
  | 'instant'       // Instant Preview - CDN-based preview (very fast but limited)
  | 'legacy';       // Legacy - use the old decision tree

/**
 * Decides which sandbox implementation to use based on the fragment, user ID, and feature flags.
 * 
 * Decision flow:
 * 1. Check if WebContainers MVP flag is enabled
 * 2. If Python/backend template, use E2B (until WebContainers supports it)
 * 3. If simple HTML/CSS, use Browser Preview
 * 4. If complex frontend with npm dependencies, use WebContainers or Sandpack
 * 5. If simple React/Vue, use WebContainers or Instant Preview
 * 6. Fall back to legacy decision tree if all else fails
 */
export function selectSandbox(
  fragment: FragmentSchema | undefined | null,
  userId?: string | null
): SandboxType {
  // If no fragment or code, return legacy to let existing logic handle it
  if (!fragment || !fragment.code || !fragment.template) {
    return 'legacy';
  }

  // Get template ID
  const templateId = fragment.template as TemplateId;
  
  // 1. Check WebContainers MVP flag - this is the main switch for the new system
  const webcontainersMvpEnabled = process.env.NEXT_PUBLIC_WEBCONTAINERS_MVP === 'true';
  
  // If WebContainers MVP is enabled, use the new decision tree
  if (webcontainersMvpEnabled) {
    // 3. For simple HTML/CSS, use Browser Preview (it's faster than WebContainers)
    if (templateId === 'static-html' && !isComplexHTML(fragment.code)) {
      return 'browser';
    }
    
    // 4. For everything else, use WebContainers
    // This includes React, Vue, Next.js, and other Node.js based templates
    return 'webcontainer';
  }
  
  // If WebContainers MVP is not enabled, fall back to the existing decision tree
  
  // 5. Check if we should use Browser Preview (experimental)
  if (shouldUseBrowserPreview(userId) && templateSupportsBrowserPreview(templateId)) {
    return 'browser';
  }
  
  // 6. Check if we should use Sandpack for complex frontend apps
  if (shouldUseSandpack(fragment)) {
    return 'sandpack';
  }
  
  // 7. Check if we can use Instant Preview for simple React components
  if (canUseInstantPreview(fragment.code, templateId)) {
    return 'instant';
  }
  
  // 8. Default to WebContainers for everything else
  return 'webcontainer';
}

/**
 * Maps sandbox types to their respective components.
 * This allows for easy rendering of the selected sandbox.
 */
export const SandboxComponents = {
  webcontainer: WebContainerPreview,
  browser: BrowserPreview,
  sandpack: SandpackPreview,
  instant: InstantPreview,
  legacy: Fragment // Fragment is a placeholder, legacy will use existing logic
};

/**
 * Determines if the code is simple enough for instant preview.
 * This is a simplified version of the logic in fragment-preview.tsx.
 */
function canUseInstantPreview(code: string, template: string): boolean {
  // Only for React-based templates
  if (!['nextjs-developer', 'react'].includes(template)) {
    return false;
  }

  // Check if code is self-contained React
  const hasReact = code.includes('React') || code.includes('function App') || code.includes('const App');
  const hasComplexImports = code.match(/import .* from ['\"](?!react|react-dom|lucide-react)/g);
  const hasServerCode = code.includes('use server') || code.includes('export async function');
  const hasFileSystem = code.includes('fs.') || code.includes("require('fs')");
  
  // Can use instant preview if:
  // 1. Has React code
  // 2. No complex imports (only react, react-dom, lucide-react allowed)
  // 3. No server-side code
  // 4. No file system or Node.js specific code
  return hasReact && !hasComplexImports && !hasServerCode && !hasFileSystem;
}

/**
 * Determines if HTML code is complex (requires JavaScript, external resources, etc.)
 */
function isComplexHTML(code: string): boolean {
  // Check for script tags with src attributes
  const hasExternalScripts = /<script[^>]+src=/.test(code);
  
  // Check for complex JavaScript
  const hasComplexJS = /<script[^>]*>[\s\S]{100,}<\/script>/.test(code);
  
  // Check for fetch/ajax calls
  const hasFetchCalls = /fetch\s*\(/.test(code) || /XMLHttpRequest/.test(code);
  
  // Check for complex frameworks
  const hasFrameworks = /vue|react|angular|svelte/.test(code.toLowerCase());
  
  return hasExternalScripts || hasComplexJS || hasFetchCalls || hasFrameworks;
}

/**
 * Utility function to get the component for a given sandbox type
 */
export function getSandboxComponent(type: SandboxType) {
  return SandboxComponents[type] || SandboxComponents.legacy;
}

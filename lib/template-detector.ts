/**
 * Fast Template Detection System
 * 
 * This module provides a quick way to determine which template to use
 * based on the user's prompt, without requiring slow AI calls.
 * It uses keyword matching and caching for optimal performance.
 */

import { TemplateId } from './templates';
import { getGlobalTracker } from './performance';

// Cache for template detection to avoid re-processing similar prompts
const templateCache = new Map<string, TemplateId>();
const MAX_CACHE_SIZE = 100;

// Keywords that strongly indicate a specific template
const TEMPLATE_KEYWORDS: Record<TemplateId, string[]> = {
  'vue-developer': ['vue', 'nuxt', 'vuejs', 'vue.js', 'vue 3', 'vue app'],
  'static-html': ['html', 'css', 'vanilla js', 'static site', 'landing page', 'simple website'],
  'nextjs-developer': ['react', 'next', 'nextjs', 'next.js', 'react app', 'component']
};

/**
 * Get a normalized cache key from a prompt
 * We only use the first part of the prompt to avoid cache misses due to minor differences
 */
function getCacheKey(prompt: string): string {
  return prompt.toLowerCase().trim().substring(0, 100);
}

/**
 * Maintain cache size by removing oldest entries when needed
 */
function pruneCache(): void {
  if (templateCache.size > MAX_CACHE_SIZE) {
    // Remove the oldest 20% of entries
    const keysToRemove = Array.from(templateCache.keys())
      .slice(0, Math.floor(MAX_CACHE_SIZE * 0.2));
    
    keysToRemove.forEach(key => templateCache.delete(key));
  }
}

/**
 * Detect the most appropriate template based on the prompt
 * Uses keyword matching and caching for speed
 */
export function detectTemplate(prompt: string): TemplateId {
  const perf = getGlobalTracker();
  perf.mark('template-detection-start');
  
  // Check cache first for ultra-fast responses
  const cacheKey = getCacheKey(prompt);
  if (templateCache.has(cacheKey)) {
    const template = templateCache.get(cacheKey)!;
    perf.measure('Template Detection (cached)', 'template-detection-start');
    return template;
  }
  
  // Normalize prompt for keyword matching
  const lowerPrompt = prompt.toLowerCase();
  
  // Check for explicit template requests first
  for (const [templateId, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        // Cache the result
        templateCache.set(cacheKey, templateId as TemplateId);
        pruneCache();
        
        perf.measure('Template Detection (keyword)', 'template-detection-start');
        return templateId as TemplateId;
      }
    }
  }
  
  // Additional heuristics for common patterns
  if (lowerPrompt.includes('website') || lowerPrompt.includes('page')) {
    // For general websites, prefer static HTML
    templateCache.set(cacheKey, 'static-html');
    pruneCache();
    
    perf.measure('Template Detection (heuristic)', 'template-detection-start');
    return 'static-html';
  }
  
  // Default to React/Next.js for anything else (most common)
  templateCache.set(cacheKey, 'nextjs-developer');
  pruneCache();
  
  perf.measure('Template Detection (default)', 'template-detection-start');
  return 'nextjs-developer';
}

/**
 * Clear the template detection cache
 * Useful for testing or when templates are updated
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Get statistics about the template cache
 */
export function getTemplateCacheStats(): { size: number, entries: Record<TemplateId, number> } {
  const entries: Record<TemplateId, number> = {
    'nextjs-developer': 0,
    'vue-developer': 0,
    'static-html': 0
  };
  
  for (const template of templateCache.values()) {
    entries[template]++;
  }
  
  return {
    size: templateCache.size,
    entries
  };
}

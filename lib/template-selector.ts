import { TriageResult, triageRequest } from './ai-triage'

export function selectOptimalTemplate(userPrompt: string, triageResult?: TriageResult): string {
  // If we have triage results, respect them
  if (triageResult) {
    return triageResult.template
  }
  
  // Fallback logic only if no triage result is provided
  // This maintains backward compatibility but should rarely be used
  const uiKeywords = [
    'beautiful', 'modern', 'styled', 'responsive', 'animation',
    'gradient', 'card', 'hero', 'landing', 'showcase', 'portfolio',
    'dashboard', 'ui', 'ux', 'design', 'tailwind', 'component'
  ];
  
  const dataKeywords = [
    'data', 'analysis', 'visualization', 'plot', 'chart', 'graph',
    'ml', 'machine learning', 'dataset', 'statistics', 'notebook'
  ];
  
  const staticKeywords = [
    'personal', 'portfolio', 'resume', 'cv', 'about', 'landing',
    'simple', 'basic', 'static', 'website', 'site', 'page',
    'company', 'business', 'agency', 'service', 'restaurant',
    'html', 'vanilla', 'plain'
  ];
  
  const prompt = userPrompt.toLowerCase();
  
  const uiScore = uiKeywords.filter(keyword => prompt.includes(keyword)).length;
  const dataScore = dataKeywords.filter(keyword => prompt.includes(keyword)).length;
  const staticScore = staticKeywords.filter(keyword => prompt.includes(keyword)).length;
  
  // Check if user explicitly wants something simple
  const wantsSimple = /simple|basic|static|just html|plain html|no framework|vanilla/i.test(userPrompt);
  
  // Check for backend requirements
  const needsBackend = /database|auth|login|user|account|api|backend|server|dynamic/i.test(userPrompt);
  
  // Prefer static for simple sites
  if ((staticScore > uiScore || wantsSimple) && !needsBackend) {
    return 'static-html';
  }
  
  // Use Streamlit/Gradio for data-heavy apps
  if (dataScore > 2) {
    return prompt.includes('gradio') ? 'gradio-developer' : 'streamlit-developer';
  }
  
  // Default to Next.js only for complex apps
  if (uiScore > 0 && (needsBackend || uiScore > 3)) {
    return 'nextjs-developer';
  }
  
  // When in doubt, default to static for simplicity
  return 'static-html';
}

/**
 * Performs triage and returns the optimal template.
 * This is the recommended way to select a template as it ensures
 * the triage system's decision is always respected.
 */
export async function getOptimalTemplate(userPrompt: string): Promise<string> {
  try {
    const triageResult = await triageRequest(userPrompt);
    return triageResult.template;
  } catch (error) {
    console.warn('Triage failed, using fallback template selection:', error);
    return selectOptimalTemplate(userPrompt);
  }
}
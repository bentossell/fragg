export function selectOptimalTemplate(userPrompt: string): string {
  const uiKeywords = [
    'beautiful', 'modern', 'styled', 'responsive', 'animation',
    'gradient', 'card', 'hero', 'landing', 'showcase', 'portfolio',
    'dashboard', 'ui', 'ux', 'design', 'tailwind', 'component'
  ];
  
  const dataKeywords = [
    'data', 'analysis', 'visualization', 'plot', 'chart', 'graph',
    'ml', 'machine learning', 'dataset', 'statistics', 'notebook'
  ];
  
  const prompt = userPrompt.toLowerCase();
  
  const uiScore = uiKeywords.filter(keyword => prompt.includes(keyword)).length;
  const dataScore = dataKeywords.filter(keyword => prompt.includes(keyword)).length;
  
  // Default to Next.js for UI-heavy apps
  if (uiScore > dataScore || uiScore > 0) {
    return 'nextjs-developer';
  }
  
  // Use Streamlit/Gradio only for data-heavy apps with minimal UI requirements
  if (dataScore > 2) {
    return prompt.includes('gradio') ? 'gradio-developer' : 'streamlit-developer';
  }
  
  // Default to Next.js for general apps
  return 'nextjs-developer';
}
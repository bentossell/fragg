import templates from './templates.json'

export default templates
export type Templates = typeof templates
export type TemplateId = keyof typeof templates
export type TemplateConfig = typeof templates[TemplateId]

export function templatesToPrompt(templates: Templates) {
  return `${Object.entries(templates).map(([id, t], index) => {
    const dependencies = t.lib ? t.lib.join(', ') : 'none'
    return `${index + 1}. ${id}: "${t.instructions}". File: ${t.file || 'none'}. Dependencies installed: ${dependencies}. Port: ${t.port || 'none'}.`
  }).join('\n')}`
}

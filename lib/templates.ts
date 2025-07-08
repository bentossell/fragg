import templatesData from './templates.json'

export type TemplateId = keyof typeof templatesData

export interface Template {
  id: string
  name: string
  description: string
  icon: string
  start_cmd: string
  tags: string[]
}

export const templates = templatesData as Record<TemplateId, Template>

export function getTemplate(templateName: TemplateId): Template | undefined {
  return templates[templateName]
}

/**
 * Returns true if the given template **must** run inside the (slow) E2B
 * sandbox because it relies on Python-based runtimes that can’t execute in
 * WebContainers / the browser.
 *
 * Keep this in sync with any future Python templates that are added.
 */
export function templateRequiresSandbox(templateId: TemplateId): boolean {
  const pythonTemplates: TemplateId[] = [
    'streamlit-developer',
    'gradio-developer',
    'code-interpreter-v1',
  ] as TemplateId[]

  return pythonTemplates.includes(templateId)
}

export default templates

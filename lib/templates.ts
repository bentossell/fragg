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

export default templates

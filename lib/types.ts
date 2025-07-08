import { TemplateId } from './templates'

type ExecutionResultBase = {
  sbxId: string
}

export type ExecutionResult = ExecutionResultBase & {
  template: TemplateId
  url: string
}


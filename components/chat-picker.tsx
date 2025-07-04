import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { TemplateId, Templates } from '@/lib/templates'
import 'core-js/features/object/group-by.js'
import { Sparkles } from 'lucide-react'
import Image from 'next/image'

export function ChatPicker({
  templates,
  selectedTemplate,
  onSelectedTemplateChange,
  models,
  languageModel,
  onLanguageModelChange,
}: {
  templates: Templates
  selectedTemplate: 'auto' | TemplateId
  onSelectedTemplateChange: (template: 'auto' | TemplateId) => void
  models: LLMModel[]
  languageModel: LLMModelConfig
  onLanguageModelChange: (config: LLMModelConfig) => void
}) {
  // Map model IDs to the correct logo file
  const getModelLogo = (model: LLMModel | string) => {
    const modelId = typeof model === 'string' ? model.toLowerCase() : model.id.toLowerCase()
    if (modelId.includes('anthropic') || modelId.includes('claude')) return 'anthropic'
    if (modelId.includes('openai') || modelId.includes('gpt')) return 'openai'
    if (modelId.includes('google') || modelId.includes('gemini')) return 'google'
    if (modelId.includes('meta') || modelId.includes('llama')) return 'ollama'
    if (modelId.includes('mistral')) return 'mistral'
    if (modelId.includes('deepseek')) return 'deepseek'
    if (modelId.includes('groq')) return 'groq'
    if (modelId.includes('fireworks')) return 'fireworks'
    if (modelId.includes('together')) return 'togetherai'
    if (modelId.includes('xai') || modelId.includes('grok')) return 'xai'
    if (modelId.includes('vertex')) return 'vertex'
    
    // Default fallback
    if (typeof model === 'object' && model.providerId === 'openrouter') return 'openai'
    return typeof model === 'object' ? model.providerId : 'openai'
  }

  // Filter out (direct) models
  const filteredModels = models.filter(model => !model.provider.includes('(direct)'))

  // Get current model for logo display
  const currentModel = filteredModels.find(model => model.id === languageModel.model)

  return (
    <div className="flex items-center space-x-2">
      {/* <div className="flex flex-col">
        <Select
          name="template"
          defaultValue={selectedTemplate}
          onValueChange={onSelectedTemplateChange}
        >
          <SelectTrigger className="whitespace-nowrap border-none shadow-none focus:ring-0 px-0 py-0 h-6 text-xs">
            <SelectValue placeholder="Select a persona" />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectGroup>
              <SelectLabel>Persona</SelectLabel>
              <SelectItem value="auto">
                <div className="flex items-center space-x-2">
                  <Sparkles
                    className="flex text-[#a1a1aa]"
                    width={14}
                    height={14}
                  />
                  <span>Auto</span>
                </div>
              </SelectItem>
              {Object.entries(templates).map(([templateId, template]) => (
                <SelectItem key={templateId} value={templateId}>
                  <div className="flex items-center space-x-2">
                    <Image
                      className="flex"
                      src={`/thirdparty/templates/${templateId}.svg`}
                      alt={templateId}
                      width={14}
                      height={14}
                    />
                    <span>{template.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div> */}
      <div className="flex flex-col">
        <Select
          name="languageModel"
          defaultValue={languageModel.model}
          onValueChange={(e) => onLanguageModelChange({ model: e })}
        >
          <SelectTrigger className="whitespace-nowrap border-none shadow-none focus:ring-0 px-0 py-0 h-8 text-xs flex items-center gap-2">
            {currentModel && (
              <Image
                className="flex"
                src={`/thirdparty/logos/${getModelLogo(currentModel)}.svg`}
                alt={currentModel.provider}
                width={14}
                height={14}
              />
            )}
            <SelectValue placeholder="Language model" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(
              Object.groupBy(filteredModels, ({ provider }) => provider),
            ).map(([provider, models]) => (
              <SelectGroup key={provider}>
                <SelectLabel>{provider}</SelectLabel>
                {models?.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center space-x-2">
                      <Image
                        className="flex"
                        src={`/thirdparty/logos/${getModelLogo(model)}.svg`}
                        alt={model.provider}
                        width={14}
                        height={14}
                      />
                      <span>{model.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

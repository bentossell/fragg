import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { LLMModel, LLMModelConfig } from '@/lib/models'
import { TemplateId, Template } from '@/lib/templates'
import 'core-js/features/object/group-by.js'
import { Sparkles, Search, Brain } from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'

export function ChatPicker({
  templates,
  selectedTemplate,
  onSelectedTemplateChange,
  models,
  languageModel,
  onLanguageModelChange,
}: {
  templates: Record<TemplateId, Template>
  selectedTemplate: 'auto' | TemplateId
  onSelectedTemplateChange: (template: 'auto' | TemplateId) => void
  models: LLMModel[]
  languageModel: LLMModelConfig
  onLanguageModelChange: (config: LLMModelConfig) => void
}) {
  // Avoid hydration issues by handling client-side only state
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if a model is a reasoning model
  const isReasoningModel = (model: LLMModel): boolean => {
    const modelId = model.id.toLowerCase()
    const modelName = model.name.toLowerCase()
    return (
      modelId.includes('o1') ||
      modelId.includes('o3') ||
      modelId.includes('thinking') ||
      modelId.includes('reasoning') ||
      modelName.includes('thinking') ||
      modelName.includes('reasoning') ||
      modelId.includes('deepseek-r1') ||
      modelId.includes('magistral-medium-2506:thinking')
    )
  }

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
  const filteredModels = models.filter(model => !model.name.includes('(Direct)'))

  // Apply search filter
  const searchFilteredModels = filteredModels.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Set default model to Claude Sonnet 4 if no model is selected
  const defaultModel = 'anthropic/claude-sonnet-4'
  const effectiveModel = languageModel.model || defaultModel

  // Get current model for logo display
  const currentModel = filteredModels.find(model => model.id === effectiveModel) || 
                      filteredModels.find(model => model.id === defaultModel)

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
          value={mounted ? effectiveModel : undefined}
          onValueChange={(e) => onLanguageModelChange({ model: e })}
        >
          <SelectTrigger className="whitespace-nowrap border-none shadow-none focus:ring-0 px-0 py-0 h-8 text-xs flex items-center gap-2">
            <SelectValue>
              {mounted && currentModel && (
                <div className="flex items-center space-x-2">
                  <Image
                    className="flex"
                    src={`/thirdparty/logos/${getModelLogo(currentModel)}.svg`}
                    alt={currentModel.provider}
                    width={14}
                    height={14}
                  />
                  <span>{currentModel.name}</span>
                  {isReasoningModel(currentModel) && (
                    <Brain className="w-3 h-3 text-purple-500" />
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            <div className="sticky top-0 z-10 bg-background p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            {Object.entries(
              Object.groupBy(searchFilteredModels, ({ provider }) => provider),
            ).map(([provider, models]) => (
              <SelectGroup key={provider}>
                <SelectLabel>{provider}</SelectLabel>
                {models?.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center justify-between w-full">
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
                      {isReasoningModel(model) && (
                        <Brain className="w-3 h-3 text-purple-500 ml-2" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {searchFilteredModels.length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No models found matching &quot;{searchTerm}&quot;
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

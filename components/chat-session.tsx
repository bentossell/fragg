'use client'

import { ViewType } from '@/components/auth'
import { AuthDialog } from '@/components/auth-dialog'
import { Chat } from '@/components/chat'
import { ChatInput } from '@/components/chat-input'
import { ChatPicker } from '@/components/chat-picker'
import { ChatSettings } from '@/components/chat-settings'
import { Preview } from '@/components/preview'
import { Message, toAISDKMessages, toMessageImage } from '@/lib/messages'
import { LLMModelConfig } from '@/lib/models'
import modelsList from '@/lib/models.json'
import { FragmentSchema, fragmentSchema as schema } from '@/lib/schema'
import { LocalSessionManager } from '@/lib/storage/local-sessions'
import templates, { TemplateId } from '@/lib/templates'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { experimental_useObject as useObject } from 'ai/react'
import { usePostHog } from 'posthog-js/react'
import { SetStateAction, useEffect, useState, useRef, useCallback } from 'react'

interface ChatSessionProps {
  sessionId: string
  session: any
  userTeam: any
  languageModel: LLMModelConfig
  selectedTemplate: 'auto' | TemplateId
  onAuthRequired: () => void
  onNewMessage: (message: Message) => void
  onSessionUpdate: (updates: any) => void
  messages: Message[]
  onMessagesChange: (messages: Message[]) => void
  initialFragment?: any
  initialResult?: any
  initialTab?: 'code' | 'fragment'
  initialPreviewLoading?: boolean
  isGenerating?: boolean
  onGeneratingChange: (generating: boolean) => void
}

export function ChatSession({
  sessionId,
  session,
  userTeam,
  languageModel,
  selectedTemplate,
  onAuthRequired,
  onNewMessage,
  onSessionUpdate,
  messages,
  onMessagesChange,
  initialFragment,
  initialResult,
  initialTab = 'code',
  initialPreviewLoading = false,
  isGenerating = false,
  onGeneratingChange,
}: ChatSessionProps) {
  const posthog = usePostHog()
  const sessionManager = useRef(new LocalSessionManager())
  
  const [chatInput, setChatInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const setMessages = onMessagesChange
  const [fragment, setFragment] = useState<DeepPartial<FragmentSchema> | undefined>(initialFragment)
  const [result, setResult] = useState<ExecutionResult | undefined>(initialResult)
  const [currentTab, setCurrentTab] = useState<'code' | 'fragment'>(initialTab)
  const [isPreviewLoading, setIsPreviewLoading] = useState(initialPreviewLoading)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const filteredModels = modelsList.models.filter((model) => {
    if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
      return model.providerId !== 'ollama'
    }
    return true
  })

  const currentModel = filteredModels.find(
    (model) => model.id === languageModel.model,
  )
  const currentTemplate = selectedTemplate === 'auto' ? templates : { [selectedTemplate]: templates[selectedTemplate] }
  const lastMessage = messages[messages.length - 1]

  // Debug logging for state updates
  useEffect(() => {
    console.log('ChatSession State Update:', {
      messagesCount: messages.length,
      lastMessage: messages[messages.length - 1],
      isGenerating,
    });
  }, [messages, isGenerating]);

  const { object, submit, isLoading, stop, error } = useObject({
    api: '/api/chat',
    schema,
    onError: (error) => {
      console.error('Error submitting request:', error)
      if (error.message.includes('limit')) {
        setIsRateLimited(true)
      }
      setErrorMessage(error.message)
      onGeneratingChange(false)
    },
    onFinish: async ({ object: fragment, error }) => {
      if (!error && fragment) {
        setIsPreviewLoading(true);
        console.log('fragment', fragment);
        posthog.capture('fragment_generated', {
          template: fragment?.template,
        });
        
        const response = await fetch('/api/sandbox', {
          method: 'POST',
          body: JSON.stringify({
            fragment,
            userID: session?.user?.id,
            teamID: userTeam?.id,
            accessToken: session?.access_token,
            sessionId,
          }),
        });

        const result = await response.json();
        console.log('result', result);
        posthog.capture('sandbox_created', { url: result.url });
        
        setResult(result);
        setCurrentTab('fragment');
        setIsPreviewLoading(false);
        
        // Update the last message with the result
        const currentMessages = messagesRef.current;
        if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant') {
          const updated = [...currentMessages];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            result,
          };
          setMessages(updated);
        }
        
        // Update session state with sandboxId
        onSessionUpdate({
          fragment,
          result,
          sandboxId: result.sbxId,
          currentTab: 'fragment',
          isPreviewLoading: false,
          isGenerating: false
        });
        onGeneratingChange(false);
      }
    },
  })

  // Update fragment when object changes
  useEffect(() => {
    if (object) {
      setFragment(object);
      
      const content: Message['content'] = [];
      
      if ('commentary' in object) {
        content.push({ type: 'text', text: object.commentary || '' });
      }
      
      if (object.code) {
        content.push({ type: 'code', text: object.code });
      }
      
      if (content.length === 0) return;
      
      const currentMessages = messagesRef.current;
      const lastMessage = currentMessages[currentMessages.length - 1];
        
      if (!lastMessage || lastMessage.role === 'user') {
        // Add new assistant message
        const newMessage: Message = {
          role: 'assistant',
          content,
          object,
        };
        onNewMessage(newMessage);
        setMessages([...currentMessages, newMessage]);
      } else if (lastMessage.role === 'assistant') {
        // Update existing assistant message
        const updated = [...currentMessages];
        updated[updated.length - 1] = {
          ...lastMessage,
          content,
          object,
        };
        setMessages(updated);
      }
    }
  }, [object, onNewMessage, setMessages])

  // Stop on error
  useEffect(() => {
    if (error) stop()
  }, [error, stop])

  // Report state changes
  useEffect(() => {
    onSessionUpdate({
      fragment,
      result,
      currentTab,
      isPreviewLoading
    })
  }, [fragment, result, currentTab, isPreviewLoading, onSessionUpdate])

  async function handleSubmitAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!session) {
      return onAuthRequired()
    }

    if (isLoading) {
      stop()
      return
    }

    const content: Message['content'] = [{ type: 'text', text: chatInput }]
    const images = await toMessageImage(files)

    if (images.length > 0) {
      images.forEach((image) => {
        content.push({ type: 'image', image })
      })
    }

    const userMessage: Message = {
      role: 'user',
      content,
    }
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Use functional update to ensure we have the latest messages
    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(newMessages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })

    onGeneratingChange(true);
    setChatInput('')
    setFiles([])
    setCurrentTab('code')

    posthog.capture('chat_submit', {
      template: selectedTemplate,
      model: languageModel.model,
    })
  }

  const retry = useCallback(() => {
    onGeneratingChange(true)
    
    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(messages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })
  }, [messages, session, userTeam, currentTemplate, currentModel, languageModel, onGeneratingChange, submit])

  function handleSaveInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setChatInput(e.target.value)
  }

  function handleFileChange(change: SetStateAction<File[]>) {
    setFiles(change)
  }

  function setCurrentPreview(preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) {
    setFragment(preview.fragment || undefined)
    setResult(preview.result)
  }

  function handleUndo() {
    setMessages([...messages.slice(0, -2)])
    setCurrentPreview({ fragment: undefined, result: undefined })
  }

  function handleClearChat() {
    stop()
    setChatInput('')
    setFiles([])
    setMessages([])
    setFragment(undefined)
    setResult(undefined)
    setCurrentTab('code')
    setIsPreviewLoading(false)
  }

  return (
    <>
      <div className={`flex flex-col w-full max-h-full max-w-[800px] mx-auto px-4 overflow-auto ${fragment ? 'col-span-1' : 'col-span-2'}`}>
        <Chat
          messages={messages}
          isLoading={isGenerating}
          setCurrentPreview={setCurrentPreview}
        />
        <ChatInput
          retry={retry}
          isErrored={error !== undefined}
          errorMessage={errorMessage}
          isLoading={isGenerating}
          isRateLimited={isRateLimited}
          stop={stop}
          input={chatInput}
          handleInputChange={handleSaveInputChange}
          handleSubmit={handleSubmitAuth}
          isMultiModal={currentModel?.multiModal || false}
          files={files}
          handleFileChange={handleFileChange}
        >
          <ChatPicker
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelectedTemplateChange={() => {}}
            models={[]}
            languageModel={languageModel}
            onLanguageModelChange={() => {}}
          />
          <ChatSettings
            languageModel={languageModel}
            onLanguageModelChange={() => {}}
            apiKeyConfigurable={!process.env.NEXT_PUBLIC_NO_API_KEY_INPUT}
            baseURLConfigurable={!process.env.NEXT_PUBLIC_NO_BASE_URL_INPUT}
          />
        </ChatInput>
      </div>
      <Preview
        teamID={userTeam?.id}
        accessToken={session?.access_token}
        selectedTab={currentTab}
        onSelectedTabChange={setCurrentTab}
        isChatLoading={isGenerating}
        isPreviewLoading={isPreviewLoading}
        fragment={fragment}
        result={result as ExecutionResult}
        onClose={() => setFragment(undefined)}
      />
    </>
  )
}

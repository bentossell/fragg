import { DeployDialog } from './deploy-dialog'
import { FragmentCode } from './fragment-code'
import { FragmentPreview } from './fragment-preview'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { ChevronsRight, LoaderCircle, Save, ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react'
import { Dispatch, SetStateAction, useState, useEffect } from 'react'

interface FragmentVersion {
  fragment: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  timestamp: number
}

export function Preview({
  teamID,
  accessToken,
  selectedTab,
  onSelectedTabChange,
  isChatLoading,
  isPreviewLoading,
  fragment,
  result,
  onClose,
  appName,
  onAppNameChange,
  onSave,
  canSave,
  fragmentVersions,
  currentVersionIndex,
  onPreviousVersion,
  onNextVersion,
  isAutoSaving,
}: {
  teamID: string | undefined
  accessToken: string | undefined
  selectedTab: 'code' | 'fragment'
  onSelectedTabChange: Dispatch<SetStateAction<'code' | 'fragment'>>
  isChatLoading: boolean
  isPreviewLoading: boolean
  fragment?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  onClose: () => void
  appName?: string
  onAppNameChange?: (name: string) => void
  onSave?: () => void
  canSave?: boolean
  fragmentVersions?: FragmentVersion[]
  currentVersionIndex?: number
  onPreviousVersion?: () => void
  onNextVersion?: () => void
  isAutoSaving?: boolean
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState(appName || '')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setEditingName(appName || '')
  }, [appName])

  const handleSaveName = () => {
    if (onAppNameChange && editingName.trim()) {
      onAppNameChange(editingName.trim())
      if (onSave) {
        onSave()
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2000)
      }
      setIsEditingName(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingName(appName || '')
    setIsEditingName(false)
  }

  if (!fragment) {
    return null
  }

  const isLinkAvailable = result?.template !== 'code-interpreter-v1'

  return (
    <div className="h-full overflow-hidden shadow-2xl md:rounded-tl-3xl md:rounded-bl-3xl md:border-l md:border-y bg-popover">
      <Tabs
        value={selectedTab}
        onValueChange={(value) =>
          onSelectedTabChange(value as 'code' | 'fragment')
        }
        className="h-full flex flex-col"
      >
        <div className="w-full p-2 grid grid-cols-3 items-center border-b flex-shrink-0">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={onClose}
                >
                  <ChevronsRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex justify-center items-center gap-2">
            <TabsList className="px-1 py-0 border h-8">
              <TabsTrigger
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="code"
              >
                {isChatLoading && (
                  <LoaderCircle
                    strokeWidth={3}
                    className="h-3 w-3 animate-spin"
                  />
                )}
                Code
              </TabsTrigger>
              <TabsTrigger
                disabled={!result}
                className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                value="fragment"
              >
                Preview
                {isPreviewLoading && (
                  <LoaderCircle
                    strokeWidth={3}
                    className="h-3 w-3 animate-spin"
                  />
                )}
              </TabsTrigger>
            </TabsList>
            {fragmentVersions && fragmentVersions.length > 1 && currentVersionIndex !== undefined && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onPreviousVersion}
                  disabled={currentVersionIndex === 0}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentVersionIndex + 1} / {fragmentVersions.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onNextVersion}
                  disabled={currentVersionIndex === fragmentVersions.length - 1}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            {isAutoSaving && (
              <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md animate-pulse">
                <LoaderCircle className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Auto-saving...</span>
              </div>
            )}
            {onAppNameChange && (
              <div className="flex items-center gap-1 group relative">
                {isEditingName ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSaveName()
                        } else if (e.key === 'Escape') {
                          handleCancelEdit()
                        }
                      }}
                      placeholder="App name..."
                      className="px-2 py-1 text-xs border rounded-md max-w-[120px]"
                      autoFocus
                    />
                    <Button
                      onClick={handleSaveName}
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                    >
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-xs px-2 py-1 max-w-[120px] truncate">
                      {appName || 'Untitled App'}
                    </span>
                    <Button
                      onClick={() => setIsEditingName(true)}
                      size="icon"
                      variant="ghost"
                      className={`h-6 w-6 ${justSaved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                    >
                      {justSaved ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Pencil className="h-3 w-3" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
            {result && isLinkAvailable && (
              <DeployDialog
                url={result.url!}
                sbxId={result.sbxId!}
                teamID={teamID}
                accessToken={accessToken}
              />
            )}
          </div>
        </div>
        {fragment && (
          <div className="overflow-y-auto w-full h-full">
            <TabsContent value="code" className="h-full">
              {fragment.code && fragment.file_path && (
                <FragmentCode
                  files={[
                    {
                      name: fragment.file_path,
                      content: fragment.code,
                    },
                  ]}
                />
              )}
            </TabsContent>
            <TabsContent value="fragment" className="h-full">
              {result && <FragmentPreview result={result as ExecutionResult} />}
            </TabsContent>
          </div>
        )}
      </Tabs>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Play, 
  Pause, 
  Square, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Info, 
  GitBranch, 
  Eye, 
  Settings,
  Clock,
  TrendingUp,
  Activity,
  FileText,
  Code,
  Users,
  Zap,
  RotateCcw,
  Download,
  Upload,
  Trash2
} from 'lucide-react'
import { DiffSystemIntegration, DiffUpdateRequest, DiffUpdateResult, DiffSystemStatus } from '@/lib/diff-system-integration'
import { AdvancedDiffResult } from '@/lib/advanced-diff-engine'
import { AIGeneratedDiff } from '@/lib/ai-diff-orchestrator'
import { ChangeRecord, ChangeType, ChangeCategory } from '@/lib/change-management-system'
import { UpdateProgress } from '@/lib/incremental-update-system'

interface DiffPreviewDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  appId: string
  currentCode?: any
  userPrompt?: string
  onApply?: (result: DiffUpdateResult) => void
  onCancel?: () => void
  className?: string
}

interface DiffPreviewState {
  stage: 'input' | 'preview' | 'processing' | 'complete' | 'error'
  request?: DiffUpdateRequest
  result?: DiffUpdateResult
  progress?: UpdateProgress & { stage: string; details?: any }
  error?: string
}

export function DiffPreviewDialog({
  isOpen,
  onOpenChange,
  appId,
  currentCode,
  userPrompt = '',
  onApply,
  onCancel,
  className
}: DiffPreviewDialogProps) {
  const [diffSystem] = useState(() => new DiffSystemIntegration(appId))
  const [state, setState] = useState<DiffPreviewState>({ stage: 'input' })
  const [systemStatus, setSystemStatus] = useState<DiffSystemStatus | null>(null)
  const [activeTab, setActiveTab] = useState<'preview' | 'changes' | 'validation' | 'conflicts'>('preview')
  
  // Form state
  const [formData, setFormData] = useState({
    userPrompt,
    title: '',
    description: '',
    author: 'user',
    changeType: 'feature' as ChangeType,
    changeCategory: 'ui' as ChangeCategory,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    tags: [] as string[],
    reviewers: [] as string[]
  })

  // Load system status
  useEffect(() => {
    if (isOpen) {
      const status = diffSystem.getSystemStatus()
      setSystemStatus(status)
    }
  }, [isOpen, diffSystem])

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setState({ stage: 'input' })
      setFormData(prev => ({
        ...prev,
        userPrompt,
        title: '',
        description: ''
      }))
    }
  }, [isOpen, userPrompt])

  // Generate preview
  const handleGeneratePreview = useCallback(async () => {
    if (!currentCode || !formData.userPrompt.trim()) return

    setState({ stage: 'processing' })

    const request: DiffUpdateRequest = {
      userPrompt: formData.userPrompt,
      currentCode,
      author: formData.author,
      title: formData.title || undefined,
      description: formData.description || undefined,
      changeType: formData.changeType,
      changeCategory: formData.changeCategory,
      priority: formData.priority,
      tags: formData.tags,
      reviewers: formData.reviewers
    }

    try {
      const result = await diffSystem.processUpdate(request, (progress) => {
        setState(prev => ({ ...prev, progress }))
      })

      setState({
        stage: result.success ? 'preview' : 'error',
        request,
        result,
        error: result.success ? undefined : result.errors.join(', ')
      })
    } catch (error) {
      setState({
        stage: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [diffSystem, currentCode, formData])

  // Apply changes
  const handleApplyChanges = useCallback(async () => {
    if (!state.result || !state.request) return

    setState(prev => ({ ...prev, stage: 'processing' }))

    try {
      // In a real implementation, this would actually apply the changes
      setState(prev => ({ ...prev, stage: 'complete' }))
      
      if (onApply) {
        onApply(state.result)
      }
      
      setTimeout(() => {
        onOpenChange(false)
      }, 2000)
    } catch (error) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: error instanceof Error ? error.message : 'Failed to apply changes'
      }))
    }
  }, [state.result, state.request, onApply, onOpenChange])

  // Cancel operation
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel()
    }
    onOpenChange(false)
  }, [onCancel, onOpenChange])

  // Render diff content
  const renderDiffContent = useCallback(() => {
    if (!state.result?.diffResult) return null

    const { diffResult, aiDiff } = state.result

    return (
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="changes">
            Changes 
            <Badge variant="secondary" className="ml-1 text-xs">
              {diffResult.changes.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="conflicts">
            Conflicts
            {diffResult.conflicts.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {diffResult.conflicts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Code Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full">
                <pre className="text-sm font-mono bg-muted p-4 rounded-lg overflow-x-auto">
                  {state.result.previewCode || 'No preview available'}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>

          {aiDiff && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  AI Analysis
                  <Badge variant="outline" className="ml-2">
                    {Math.round(aiDiff.confidence * 100)}% confidence
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="font-medium">Intent Analysis</Label>
                  <p className="text-sm text-muted-foreground">
                    {aiDiff.originalAnalysis.intentAnalysis.description}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Reasoning</Label>
                  <p className="text-sm text-muted-foreground">
                    {aiDiff.reasoning.approach}
                  </p>
                </div>
                {aiDiff.alternatives.length > 0 && (
                  <div>
                    <Label className="font-medium">Alternative Approaches</Label>
                    <div className="space-y-2 mt-2">
                      {aiDiff.alternatives.map((alt, index) => (
                        <div key={index} className="p-2 bg-muted rounded">
                          <div className="font-medium text-sm">{alt.description}</div>
                          <div className="text-xs text-muted-foreground">
                            Confidence: {Math.round(alt.confidence * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="changes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Code Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {diffResult.changes.map((change, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge 
                          variant={
                            change.type === 'insertion' ? 'default' :
                            change.type === 'deletion' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {change.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Lines {change.startLine}-{change.endLine}
                        </span>
                      </div>
                      <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                        {change.content}
                      </pre>
                      {change.semantic && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {change.semantic.type}: {change.semantic.name} 
                          ({change.semantic.impact} impact)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Validation Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {diffResult.validation.syntaxValid ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Syntax Valid</span>
                </div>
                <div className="flex items-center gap-2">
                  {diffResult.validation.semanticValid ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Semantically Valid</span>
                </div>
              </div>

              {state.result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {state.result.errors.map((error, index) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {state.result.warnings.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {state.result.warnings.map((warning, index) => (
                        <div key={index}>{warning}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {state.result.recommendations.length > 0 && (
                <div>
                  <Label className="font-medium">Recommendations</Label>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-2">
                    {state.result.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Conflicts
                {diffResult.conflicts.length === 0 && (
                  <Badge variant="outline" className="ml-2">No conflicts</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {diffResult.conflicts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No conflicts detected in the proposed changes.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {diffResult.conflicts.map((conflict, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="destructive">{conflict.type}</Badge>
                          {conflict.autoResolvable && (
                            <Badge variant="outline">Auto-resolvable</Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{conflict.description}</p>
                          <p className="text-sm text-muted-foreground">{conflict.location}</p>
                          
                          {conflict.strategies.length > 0 && (
                            <div>
                              <Label className="text-xs font-medium">Resolution Strategies:</Label>
                              <div className="space-y-1 mt-1">
                                {conflict.strategies.map((strategy, i) => (
                                  <div key={i} className="text-xs p-2 bg-muted rounded">
                                    <div className="font-medium">{strategy.strategy}</div>
                                    <div className="text-muted-foreground">{strategy.description}</div>
                                    <Badge 
                                      variant={
                                        strategy.riskLevel === 'low' ? 'default' :
                                        strategy.riskLevel === 'medium' ? 'secondary' :
                                        'destructive'
                                      }
                                      className="mt-1"
                                    >
                                      {strategy.riskLevel} risk
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    )
  }, [state.result, activeTab])

  // Render progress
  const renderProgress = useCallback(() => {
    if (!state.progress) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {state.progress.stage.charAt(0).toUpperCase() + state.progress.stage.slice(1)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={state.progress.progress} className="w-full" />
          <div className="text-sm text-muted-foreground">
            {state.progress.details && (
              <div>
                {Object.entries(state.progress.details).map(([key, value]) => (
                  <div key={key}>
                    {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                  </div>
                ))}
              </div>
            )}
          </div>
          {state.progress.currentFile && (
            <div className="text-sm">
              Processing: {state.progress.currentFile}
            </div>
          )}
          {state.progress.estimatedTimeRemaining && (
            <div className="text-sm text-muted-foreground">
              Estimated time remaining: {Math.round(state.progress.estimatedTimeRemaining / 1000)}s
            </div>
          )}
        </CardContent>
      </Card>
    )
  }, [state.progress])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Diff-based Code Update
            {systemStatus && (
              <Badge 
                variant={
                  systemStatus.systemHealth === 'healthy' ? 'default' :
                  systemStatus.systemHealth === 'warning' ? 'secondary' :
                  'destructive'
                }
                className="ml-2"
              >
                {systemStatus.systemHealth}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[calc(90vh-120px)] overflow-y-auto">
          {state.stage === 'input' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userPrompt">Request Description</Label>
                  <Textarea
                    id="userPrompt"
                    value={formData.userPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, userPrompt: e.target.value }))}
                    placeholder="Describe the changes you want to make..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Change Title (Optional)</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Brief title for the change"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="author">Author</Label>
                    <Input
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      placeholder="Your name or identifier"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Change Type</Label>
                  <Select 
                    value={formData.changeType} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, changeType: value as ChangeType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="bug-fix">Bug Fix</SelectItem>
                      <SelectItem value="refactor">Refactor</SelectItem>
                      <SelectItem value="optimization">Optimization</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="documentation">Documentation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select 
                    value={formData.changeCategory} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, changeCategory: value as ChangeCategory }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ui">UI</SelectItem>
                      <SelectItem value="logic">Logic</SelectItem>
                      <SelectItem value="styling">Styling</SelectItem>
                      <SelectItem value="structure">Structure</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Detailed Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Additional details about the change..."
                  rows={3}
                />
              </div>

              {systemStatus && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">System Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Active Updates: {systemStatus.activeUpdates}</div>
                      <div>Pending Changes: {systemStatus.pendingChanges}</div>
                      <div>System Health: 
                        <Badge 
                          variant={
                            systemStatus.systemHealth === 'healthy' ? 'default' :
                            systemStatus.systemHealth === 'warning' ? 'secondary' :
                            'destructive'
                          }
                          className="ml-1"
                        >
                          {systemStatus.systemHealth}
                        </Badge>
                      </div>
                      <div>Version: {systemStatus.version}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {state.stage === 'processing' && renderProgress()}
          {state.stage === 'preview' && renderDiffContent()}
          
          {state.stage === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {state.error || 'An error occurred while processing the request'}
              </AlertDescription>
            </Alert>
          )}

          {state.stage === 'complete' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Changes have been successfully applied!
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {state.stage === 'preview' && state.result && (
              <>
                {state.result.rollbackInfo && (
                  <Button variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Rollback Plan
                  </Button>
                )}
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export Diff
                </Button>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            
            {state.stage === 'input' && (
              <Button 
                onClick={handleGeneratePreview}
                disabled={!formData.userPrompt.trim() || !currentCode}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Changes
              </Button>
            )}
            
            {state.stage === 'preview' && state.result && (
              <Button 
                onClick={handleApplyChanges}
                disabled={!state.result.success || state.result.errors.length > 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Apply Changes
              </Button>
            )}
            
            {state.stage === 'error' && (
              <Button 
                onClick={() => setState({ stage: 'input' })}
                variant="outline"
              >
                Try Again
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 
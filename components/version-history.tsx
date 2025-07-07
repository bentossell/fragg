'use client'

import { useState, useEffect, useCallback } from 'react'
import { GitBranch, Clock, RotateCcw, ChevronRight } from 'lucide-react'
import { AppVersionManager, AppVersion } from '@/lib/storage/app-version-manager'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatDistanceToNow } from 'date-fns'

interface VersionHistoryProps {
  appId: string
  userId?: string
  onRevert?: (version: AppVersion) => void
}

export function VersionHistory({ appId, userId, onRevert }: VersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [versions, setVersions] = useState<AppVersion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<AppVersion | null>(null)
  const { toast } = useToast()
  
  const versionManager = new AppVersionManager(appId, userId)
  
  const loadVersionHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const history = await versionManager.getVersionHistory()
      setVersions(history)
    } catch (error) {
      toast({
        title: "Error loading version history",
        description: "Failed to fetch version history.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [versionManager, toast])
  
  useEffect(() => {
    if (isOpen) {
      loadVersionHistory()
    }
  }, [isOpen, loadVersionHistory])
  
  const handleRevert = async (version: AppVersion) => {
    try {
      const revertedVersion = await versionManager.revertToVersion(version.id)
      
      if (revertedVersion) {
        toast({
          title: "Version reverted",
          description: `Successfully reverted to version ${version.version}`,
        })
        
        if (onRevert) {
          onRevert(revertedVersion)
        }
        
        // Reload version history
        await loadVersionHistory()
        setIsOpen(false)
      } else {
        throw new Error('Failed to revert version')
      }
    } catch (error) {
      toast({
        title: "Error reverting version",
        description: "Failed to revert to selected version.",
        variant: "destructive"
      })
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitBranch className="h-4 w-4 mr-2" />
          Version History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>
            View and revert to previous versions of your app
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading versions...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No version history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`
                    relative flex gap-4 pb-4
                    ${index < versions.length - 1 ? 'border-b' : ''}
                  `}
                >
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                    `}>
                      <span className="text-sm font-medium">
                        v{version.version}
                      </span>
                    </div>
                    {index < versions.length - 1 && (
                      <div className="w-0.5 h-full bg-muted mt-2" />
                    )}
                  </div>
                  
                  {/* Version details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">
                          {version.message || `Version ${version.version}`}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                          </span>
                          {version.changes && (
                            <>
                              <span className="text-green-600">
                                +{version.changes.additions}
                              </span>
                              <span className="text-red-600">
                                -{version.changes.deletions}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {index > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedVersion(version)
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Revert
                        </Button>
                      )}
                    </div>
                    
                    {index === 0 && (
                      <Badge variant="default" className="w-fit">
                        Current Version
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
      
      {/* Revert confirmation dialog */}
      <Dialog 
        open={!!selectedVersion} 
        onOpenChange={(open) => !open && setSelectedVersion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Revert</DialogTitle>
            <DialogDescription>
              Are you sure you want to revert to version {selectedVersion?.version}? 
              This will create a new version with the code from the selected version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedVersion(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedVersion) {
                  handleRevert(selectedVersion)
                  setSelectedVersion(null)
                }
              }}
            >
              Revert to Version {selectedVersion?.version}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
} 
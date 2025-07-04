'use client'

import { useState } from 'react'
import { Share2, Copy, Check, Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { publishApp } from '@/app/actions/publish-app'
import { useToast } from '@/components/ui/use-toast'

interface ShareButtonProps {
  appData: {
    name: string
    description?: string
    code: any
    template: string
    sandboxId?: string
  }
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function ShareButton({ appData, variant = 'outline', size = 'sm' }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()
  
  const handlePublish = async () => {
    setIsPublishing(true)
    
    try {
      const result = await publishApp(appData, true)
      
      if (result.error) {
        toast({
          title: "Failed to publish",
          description: result.error,
          variant: "destructive"
        })
        return
      }
      
      setShareUrl(result.url)
      toast({
        title: "Published successfully!",
        description: "Your app is now publicly accessible."
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while publishing.",
        variant: "destructive"
      })
    } finally {
      setIsPublishing(false)
    }
  }
  
  const handleCopyLink = async () => {
    if (!shareUrl) return
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast({
        title: "Link copied!",
        description: "The share link has been copied to your clipboard."
      })
      
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try copying manually.",
        variant: "destructive"
      })
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Your App</DialogTitle>
          <DialogDescription>
            Publish your app to get a permanent shareable link that anyone can access.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!shareUrl ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">App Details</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Name:</strong> {appData.name}</p>
                  {appData.description && (
                    <p><strong>Description:</strong> {appData.description}</p>
                  )}
                </div>
              </div>
              
              <Button 
                onClick={handlePublish} 
                disabled={isPublishing}
                className="w-full"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish App'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-url">Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    id="share-url"
                    value={shareUrl}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>✓ Your app is now publicly accessible</p>
                <p>✓ Anyone with the link can view and fork it</p>
                <p>✓ The link is permanent and won&apos;t expire</p>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 
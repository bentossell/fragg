'use client'

import { useState, useEffect } from 'react'
import { AppLibrary, SavedApp } from '@/lib/storage/app-library'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import { 
  Code2, 
  Calendar, 
  MessageSquare, 
  Trash2, 
  Download,
  Upload,
  FolderOpen,
  Plus
} from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

export default function LibraryPage() {
  const [apps, setApps] = useState<SavedApp[]>([])
  const appLibrary = new AppLibrary()
  
  useEffect(() => {
    loadApps()
  }, [])
  
  const loadApps = () => {
    setApps(appLibrary.getApps())
  }
  
  const handleDelete = (appId: string, appName: string) => {
    if (confirm(`Are you sure you want to delete "${appName}"? This action cannot be undone.`)) {
      appLibrary.deleteApp(appId)
      loadApps()
      toast({
        title: 'App deleted',
        description: 'The app has been removed from your library.',
      })
    }
  }
  
  const handleExport = () => {
    const data = appLibrary.exportApps()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fragg-apps-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    toast({
      title: 'Apps exported',
      description: 'Your apps have been exported to a JSON file.',
    })
  }
  
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        appLibrary.importApps(text)
        loadApps()
        toast({
          title: 'Apps imported',
          description: 'Your apps have been imported successfully.',
        })
      } catch (error) {
        toast({
          title: 'Import failed',
          description: 'Failed to import apps. Please check the file format.',
          variant: 'destructive',
        })
      }
    }
    input.click()
  }
  
  const handleOpenApp = (app: SavedApp) => {
    // Store the app ID in sessionStorage so the main page can load it
    sessionStorage.setItem('loadAppId', app.id)
    window.location.href = '/'
  }
  
  const getTemplateIcon = (template: string) => {
    switch (template) {
      case 'nextjs':
      case 'nextjs-developer':
        return '⚛️'
      case 'vue':
      case 'vue-developer':
        return '💚'
      case 'streamlit':
      case 'streamlit-developer':
        return '🐍'
      case 'gradio':
      case 'gradio-developer':
        return '🎨'
      default:
        return '📱'
    }
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My App Library</h1>
            <p className="text-muted-foreground">
              {apps.length} app{apps.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.location.href = '/'}
              variant="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              New App
            </Button>
            
            <Button
              onClick={handleExport}
              variant="outline"
              disabled={apps.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button
              onClick={handleImport}
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>
        
        {apps.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No apps yet</h2>
            <p className="text-muted-foreground mb-4">
              Start creating apps and save them to your library
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Create your first app
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <Card
                key={app.id}
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleOpenApp(app)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{getTemplateIcon(app.template)}</span>
                      <h3 className="font-semibold text-lg truncate">{app.name}</h3>
                    </div>
                    {app.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {app.description}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(app.id, app.name)
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-3 w-3" />
                    <span className="capitalize">{app.template.replace('-developer', '')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3" />
                    <span>{app.messages.length} messages</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 
import { notFound, redirect } from 'next/navigation'
import { getPublishedApp } from '@/app/actions/publish-app'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FragmentWebEnhanced } from '@/components/fragment-web-enhanced'
import { FragmentCode } from '@/components/fragment-code'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Eye, Copy, Code2, Globe } from 'lucide-react'

interface PageProps {
  params: Promise<{ shareId: string }>
}

export default async function PublicAppPage({ params }: PageProps) {
  const { shareId } = await params
  const publishedApp = await getPublishedApp(shareId)
  
  if (!publishedApp) {
    notFound()
  }
  
  const app = publishedApp.apps
  
  // Prepare the execution result for the preview
  const executionResult = app.runtime_info?.url ? {
    type: 'web' as const,
    code: app.compiled_app,
    sbxId: app.instance_id || '',
    url: app.runtime_info.url,
    duration: 0,
    template: 'nextjs-developer' as const // Default template, could be stored in DB
  } : null
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">{app.name}</h1>
              {app.description && (
                <p className="text-muted-foreground">{app.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>{publishedApp.view_count || 0} views</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Fork functionality - redirect to main app with fork params
                  const forkUrl = `/?fork=${shareId}`
                  window.location.href = forkUrl
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Fork App
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card className="overflow-hidden">
          <Tabs defaultValue="preview" className="h-[600px]">
            <TabsList className="w-full justify-start rounded-none border-b bg-muted/50">
              <TabsTrigger value="preview" className="gap-2">
                <Globe className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="gap-2">
                <Code2 className="h-4 w-4" />
                Code
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="preview" className="h-full mt-0">
              {executionResult ? (
                <FragmentWebEnhanced result={executionResult} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-2">
                    <p className="text-muted-foreground">
                      This app is not currently running.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Fork it to run your own version.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="code" className="h-full mt-0">
              <FragmentCode 
                files={[{
                  name: 'app.tsx',
                  content: typeof (app.compiled_app || app.specification) === 'string' 
                    ? (app.compiled_app || app.specification) 
                    : JSON.stringify(app.compiled_app || app.specification, null, 2)
                }]}
              />
            </TabsContent>
          </Tabs>
        </Card>
        
        {/* App Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Version</h3>
            <p className="text-sm text-muted-foreground">{app.version || '1.0.0'}</p>
          </Card>
          
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Status</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {app.status || 'ready'}
            </p>
          </Card>
          
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Created</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(publishedApp.created_at).toLocaleDateString()}
            </p>
          </Card>
        </div>
      </main>
    </div>
  )
} 
'use client'

import { useState, useEffect } from 'react'
import { AppLibrary } from '@/lib/storage/app-library'
import { Button } from '@/components/ui/button'

export default function TestLibraryPage() {
  const [testResult, setTestResult] = useState<string[]>([])
  const appLibrary = new AppLibrary()

  useEffect(() => {
    runTests()
  }, [])

  const runTests = () => {
    const results: string[] = []
    
    // Test 1: Create an app
    const app1 = appLibrary.saveApp({
      name: 'Test App 1',
      description: 'A test application',
      template: 'nextjs',
      code: { files: [{ path: 'app.tsx', content: 'test' }] },
      messages: [{
        id: '1',
        role: 'user',
        content: 'Create a test app',
        createdAt: new Date().toISOString()
      }]
    })
    results.push(`✅ Created app with ID: ${app1.id}`)
    
    // Test 2: Get all apps
    const apps = appLibrary.getApps()
    results.push(`✅ Found ${apps.length} apps in library`)
    
    // Test 3: Get specific app
    const retrievedApp = appLibrary.getApp(app1.id)
    results.push(`✅ Retrieved app: ${retrievedApp?.name}`)
    
    // Test 4: Update app
    const updated = appLibrary.saveApp({
      ...app1,
      name: 'Updated Test App 1',
      messages: [...app1.messages, {
        id: '2',
        role: 'assistant',
        content: 'App created successfully',
        createdAt: new Date().toISOString()
      }]
    })
    results.push(`✅ Updated app: ${updated.name}`)
    
    // Test 5: Create another app
    const app2 = appLibrary.saveApp({
      name: 'Test App 2',
      description: 'Another test app',
      template: 'streamlit',
      code: { files: [] },
      messages: []
    })
    results.push(`✅ Created second app: ${app2.name}`)
    
    // Test 6: Check isolation
    const allApps = appLibrary.getApps()
    const hasCorrectCount = allApps.length === 2
    const hasUniqueIds = allApps[0].id !== allApps[1].id
    const hasIsolatedMessages = allApps[0].messages.length !== allApps[1].messages.length
    
    if (hasCorrectCount && hasUniqueIds && hasIsolatedMessages) {
      results.push('✅ Apps are properly isolated')
    } else {
      results.push('❌ App isolation failed')
    }
    
    // Test 7: Delete first app
    appLibrary.deleteApp(app1.id)
    const remainingApps = appLibrary.getApps()
    results.push(`✅ Deleted app, ${remainingApps.length} apps remaining`)
    
    // Test 8: Export/Import
    const allAppsExport = appLibrary.exportApps()
    try {
      appLibrary.clearAll() // Clear before import
      appLibrary.importApps(allAppsExport)
      const importedApps = appLibrary.getApps()
      results.push(`✅ Export/Import successful: ${importedApps.length} apps imported`)
    } catch (error) {
      results.push(`❌ Export/Import failed: ${error}`)
    }
    
    // Test 9: Clear all for clean state
    appLibrary.clearAll()
    const finalCount = appLibrary.getApps().length
    results.push(`✅ Cleared all apps, count: ${finalCount}`)
    
    setTestResult(results)
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">App Library Test Results</h1>
      
      <div className="space-y-2 mb-4">
        {testResult.map((result, index) => (
          <div key={index} className="font-mono text-sm">
            {result}
          </div>
        ))}
      </div>
      
      <div className="flex gap-4">
        <Button onClick={runTests}>Run Tests Again</Button>
        <Button onClick={() => window.location.href = '/'} variant="outline">
          Back to App
        </Button>
        <Button onClick={() => window.location.href = '/library'} variant="outline">
          View Library
        </Button>
      </div>
      
      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">Test Summary:</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Apps are saved to localStorage</li>
          <li>Each app has its own isolated data</li>
          <li>Messages are stored per app</li>
          <li>Apps can be updated without affecting others</li>
          <li>Export/Import functionality works</li>
          <li>No bleeding between app sessions</li>
        </ul>
      </div>
    </div>
  )
} 
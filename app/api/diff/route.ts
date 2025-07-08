import { NextRequest, NextResponse } from 'next/server'
import { DiffSystemIntegration, DiffUpdateRequest } from '@/lib/diff-system-integration'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { appId, userPrompt, currentCode, author, title, description, changeType, priority } = body

    // Validate required fields
    if (!userPrompt || !currentCode) {
      return NextResponse.json(
        { error: 'Missing required fields: userPrompt, currentCode' },
        { status: 400 }
      )
    }

    // Create diff system instance
    const diffSystem = new DiffSystemIntegration(appId || 'session', {
      enableAI: true,
      enableChangeManagement: true,
      enableVersionTracking: true,
      autoApproval: false,
      conflictResolution: 'auto',
      diffMode: 'ai-assisted'
    })

    // Create diff update request
    const request_obj: DiffUpdateRequest = {
      userPrompt,
      currentCode,
      author: author || 'user',
      title: title || `Update: ${userPrompt.substring(0, 50)}...`,
      description: description || userPrompt,
      changeType: changeType || 'feature',
      priority: priority || 'medium'
    }

    // Process the diff update
    const result = await diffSystem.processUpdate(request_obj, (progress) => {
      // Progress updates could be sent via SSE in the future
      console.log('Diff progress:', progress)
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Diff API error:', error)
    return NextResponse.json(
      {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
        recommendations: ['Check the server logs for more details']
      },
      { status: 500 }
    )
  }
} 
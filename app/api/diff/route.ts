import { NextRequest, NextResponse } from 'next/server'
import { DiffSystemIntegration, DiffUpdateRequest, DiffUpdateResult } from '@/lib/diff-system-integration'
import { UpdateProgress } from '@/lib/incremental-update-system'

// Define error types for better categorization
enum DiffErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  VERSION_SYSTEM_ERROR = 'VERSION_SYSTEM_ERROR',
  DIFF_GENERATION_ERROR = 'DIFF_GENERATION_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

interface DiffError {
  type: DiffErrorType
  message: string
  details?: any
  timestamp: number
}

interface DiffApiResponse extends DiffUpdateResult {
  requestId: string
  processingTime: number
  systemInfo: {
    timestamp: number
    version: string
    stage: string
  }
}

// Enhanced validation function
function validateDiffRequest(body: any): { isValid: boolean; errors: DiffError[] } {
  const errors: DiffError[] = []
  
  // Required field validation
  if (!body.userPrompt || typeof body.userPrompt !== 'string') {
    errors.push({
      type: DiffErrorType.VALIDATION_ERROR,
      message: 'userPrompt is required and must be a non-empty string',
      details: { field: 'userPrompt', value: body.userPrompt },
      timestamp: Date.now()
    })
  }
  
  if (!body.currentCode) {
    errors.push({
      type: DiffErrorType.VALIDATION_ERROR,
      message: 'currentCode is required',
      details: { field: 'currentCode', provided: !!body.currentCode },
      timestamp: Date.now()
    })
  }
  
  // Optional field validation
  if (body.priority && !['low', 'medium', 'high', 'critical'].includes(body.priority)) {
    errors.push({
      type: DiffErrorType.VALIDATION_ERROR,
      message: 'priority must be one of: low, medium, high, critical',
      details: { field: 'priority', value: body.priority },
      timestamp: Date.now()
    })
  }
  
  if (body.changeType && !['feature', 'bug-fix', 'refactor', 'docs', 'style', 'test'].includes(body.changeType)) {
    errors.push({
      type: DiffErrorType.VALIDATION_ERROR,
      message: 'changeType must be one of: feature, bug-fix, refactor, docs, style, test',
      details: { field: 'changeType', value: body.changeType },
      timestamp: Date.now()
    })
  }
  
  // Validate userPrompt length
  if (body.userPrompt && body.userPrompt.length > 2000) {
    errors.push({
      type: DiffErrorType.VALIDATION_ERROR,
      message: 'userPrompt must be less than 2000 characters',
      details: { field: 'userPrompt', length: body.userPrompt.length },
      timestamp: Date.now()
    })
  }
  
  // Validate currentCode is not empty
  if (body.currentCode && (
    (typeof body.currentCode === 'string' && body.currentCode.trim().length === 0) ||
    (typeof body.currentCode === 'object' && Object.keys(body.currentCode).length === 0)
  )) {
    errors.push({
      type: DiffErrorType.VALIDATION_ERROR,
      message: 'currentCode cannot be empty',
      details: { field: 'currentCode', type: typeof body.currentCode },
      timestamp: Date.now()
    })
  }
  
  return { isValid: errors.length === 0, errors }
}

// Enhanced error handler
function handleDiffError(error: any, requestId: string, stage: string): DiffApiResponse {
  const timestamp = Date.now()
  let errorType = DiffErrorType.SYSTEM_ERROR
  let errorMessage = 'An unexpected error occurred'
  let details: any = {}
  
  // Categorize errors based on their characteristics
  if (error instanceof Error) {
    errorMessage = error.message
    
    // AI service errors
    if (error.message.includes('AI') || error.message.includes('model') || error.message.includes('openrouter')) {
      errorType = DiffErrorType.AI_SERVICE_ERROR
      details = { aiError: true, originalError: error.message }
    }
    // Version system errors
    else if (error.message.includes('version') || error.message.includes('storage')) {
      errorType = DiffErrorType.VERSION_SYSTEM_ERROR
      details = { versionError: true, originalError: error.message }
    }
    // Diff generation errors
    else if (error.message.includes('diff') || error.message.includes('generation')) {
      errorType = DiffErrorType.DIFF_GENERATION_ERROR
      details = { diffError: true, originalError: error.message }
    }
    // Processing errors
    else if (error.message.includes('process') || error.message.includes('execute')) {
      errorType = DiffErrorType.PROCESSING_ERROR
      details = { processingError: true, originalError: error.message }
    }
  }
  
  // Log the error for debugging
  console.error(`[DIFF-API] ${requestId} - ${stage} - ${errorType}:`, {
    error: errorMessage,
    details,
    timestamp,
    stack: error instanceof Error ? error.stack : undefined
  })
  
  return {
    requestId,
    processingTime: 0,
    systemInfo: {
      timestamp,
      version: '1.0.0',
      stage
    },
    success: false,
    errors: [errorMessage],
    warnings: [],
    recommendations: getErrorRecommendations(errorType, errorMessage)
  }
}

// Get contextual recommendations based on error type
function getErrorRecommendations(errorType: DiffErrorType, errorMessage: string): string[] {
  const baseRecommendations = ['Check the server logs for more details']
  
  switch (errorType) {
    case DiffErrorType.AI_SERVICE_ERROR:
      return [
        'Verify AI service connectivity',
        'Check API key configuration',
        'Try again with a simpler prompt',
        'Ensure model availability',
        ...baseRecommendations
      ]
    
    case DiffErrorType.VERSION_SYSTEM_ERROR:
      return [
        'Check version system configuration',
        'Verify storage permissions',
        'Try with a different appId',
        ...baseRecommendations
      ]
    
    case DiffErrorType.DIFF_GENERATION_ERROR:
      return [
        'Try with smaller code segments',
        'Ensure code is properly formatted',
        'Use more specific prompts',
        'Check for syntax errors in currentCode',
        ...baseRecommendations
      ]
    
    case DiffErrorType.PROCESSING_ERROR:
      return [
        'Reduce complexity of the request',
        'Try breaking down the changes into smaller parts',
        'Verify system resources are available',
        ...baseRecommendations
      ]
    
    case DiffErrorType.VALIDATION_ERROR:
      return [
        'Review required fields and their formats',
        'Check parameter types and values',
        'Ensure all inputs meet the specified constraints'
      ]
    
    default:
      return baseRecommendations
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  console.log(`[DIFF-API] ${requestId} - Starting diff request processing`)
  
  try {
    // Parse request body
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error(`[DIFF-API] ${requestId} - JSON parse error:`, parseError)
      return NextResponse.json(
        handleDiffError(
          new Error('Invalid JSON in request body'),
          requestId,
          'request-parsing'
        ),
        { status: 400 }
      )
    }
    
    console.log(`[DIFF-API] ${requestId} - Request parsed:`, {
      hasUserPrompt: !!body.userPrompt,
      hasCurrentCode: !!body.currentCode,
      appId: body.appId || 'session',
      author: body.author || 'user',
      changeType: body.changeType || 'feature',
      priority: body.priority || 'medium'
    })
    
    // Validate request
    const validation = validateDiffRequest(body)
    if (!validation.isValid) {
      console.error(`[DIFF-API] ${requestId} - Validation failed:`, validation.errors)
      return NextResponse.json(
        {
          requestId,
          processingTime: Date.now() - startTime,
          systemInfo: {
            timestamp: Date.now(),
            version: '1.0.0',
            stage: 'validation'
          },
          success: false,
          errors: validation.errors.map(e => e.message),
          warnings: [],
          recommendations: validation.errors.flatMap(e => getErrorRecommendations(e.type, e.message))
        } as DiffApiResponse,
        { status: 400 }
      )
    }
    
    // Extract and sanitize request data
    const { appId, userPrompt, author, title, description, changeType, priority } = body
    
    // Extract actual code from fragment structure if needed
    let extractedCode = body.currentCode
    if (typeof body.currentCode === 'string') {
      try {
        const parsed = JSON.parse(body.currentCode)
        if (parsed.code) {
          extractedCode = parsed.code
        }
      } catch {
        // currentCode is already a string, use as-is
      }
    } else if (typeof body.currentCode === 'object' && body.currentCode.code) {
      extractedCode = body.currentCode.code
    }
    
    console.log(`[DIFF-API] ${requestId} - Extracted code:`, {
      originalType: typeof body.currentCode,
      extractedType: typeof extractedCode,
      extractedLength: typeof extractedCode === 'string' ? extractedCode.length : 'N/A'
    })
    
    console.log(`[DIFF-API] ${requestId} - Creating diff system instance`)
    
    // Create diff system instance with enhanced configuration
    let diffSystem: DiffSystemIntegration
    try {
      diffSystem = new DiffSystemIntegration(appId || 'session', {
        enableAI: true,
        enableChangeManagement: true,
        enableVersionTracking: true,
        autoApproval: false,
        conflictResolution: 'auto',
        diffMode: 'ai-assisted'
      })
    } catch (systemError) {
      console.error(`[DIFF-API] ${requestId} - Diff system creation failed:`, systemError)
      return NextResponse.json(
        handleDiffError(systemError, requestId, 'system-initialization'),
        { status: 500 }
      )
    }
    
    // Create diff update request
    const diffRequest: DiffUpdateRequest = {
      userPrompt: userPrompt.trim(),
      currentCode: extractedCode,
      author: author || 'user',
      title: title || `Update: ${userPrompt.substring(0, 50)}...`,
      description: description || userPrompt,
      changeType: changeType || 'feature',
      priority: priority || 'medium'
    }
    
    console.log(`[DIFF-API] ${requestId} - Processing diff update`)
    
    // Process the diff update with enhanced progress tracking
    let currentStage = 'initialization'
    const result = await diffSystem.processUpdate(
      diffRequest,
      (progress: UpdateProgress & { stage: string; details?: any }) => {
        currentStage = progress.stage
        console.log(`[DIFF-API] ${requestId} - Progress update:`, {
          stage: progress.stage,
          progress: progress.progress,
          errors: progress.errors?.length || 0,
          warnings: progress.warnings?.length || 0,
          details: progress.details
        })
      }
    )
    
    const processingTime = Date.now() - startTime
    
    console.log(`[DIFF-API] ${requestId} - Diff processing completed:`, {
      success: result.success,
      errors: result.errors.length,
      warnings: result.warnings.length,
      hasPreviewCode: !!result.previewCode,
      processingTime
    })
    
    // Create enhanced response
    const response: DiffApiResponse = {
      requestId,
      processingTime,
      systemInfo: {
        timestamp: Date.now(),
        version: '1.0.0',
        stage: 'complete'
      },
      ...result
    }
    
    // Return appropriate status code based on result
    const statusCode = result.success ? 200 : (result.errors.length > 0 ? 422 : 500)
    
    return NextResponse.json(response, { status: statusCode })
    
  } catch (error) {
    console.error(`[DIFF-API] ${requestId} - Unexpected error:`, error)
    
    const processingTime = Date.now() - startTime
    const errorResponse = handleDiffError(error, requestId, 'processing')
    errorResponse.processingTime = processingTime
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0',
    service: 'diff-api'
  })
} 
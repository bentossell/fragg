import { useEffect, useState } from 'react'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Card } from './ui/card'
import { 
  Loader2, 
  Zap, 
  Code, 
  CheckCircle, 
  Brain, 
  Cog, 
  Sparkles,
  Clock,
  FileText,
  Layers,
  Play
} from 'lucide-react'

interface GenerationStage {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  color: string
  estimatedDuration: number
}

interface GenerationLoadingProps {
  stage: 'analyzing' | 'thinking' | 'planning' | 'generating' | 'coding' | 'reviewing' | 'building' | 'deploying' | 'complete'
  progress: number
  message?: string
  showDetails?: boolean
  showEstimatedTime?: boolean
  estimatedTime?: number
  currentFile?: string
  totalFiles?: number
  className?: string
}

const stages: Record<string, GenerationStage> = {
  analyzing: {
    id: 'analyzing',
    name: 'Analyzing',
    description: 'Understanding your request and requirements',
    icon: Brain,
    color: 'text-blue-500',
    estimatedDuration: 2000
  },
  thinking: {
    id: 'thinking',
    name: 'Thinking',
    description: 'Processing and planning the solution',
    icon: Loader2,
    color: 'text-yellow-500',
    estimatedDuration: 3000
  },
  planning: {
    id: 'planning',
    name: 'Planning',
    description: 'Designing the application architecture',
    icon: FileText,
    color: 'text-purple-500',
    estimatedDuration: 2500
  },
  generating: {
    id: 'generating',
    name: 'Generating',
    description: 'Creating the initial code structure',
    icon: Sparkles,
    color: 'text-green-500',
    estimatedDuration: 4000
  },
  coding: {
    id: 'coding',
    name: 'Coding',
    description: 'Writing the application code',
    icon: Code,
    color: 'text-green-500',
    estimatedDuration: 5000
  },
  reviewing: {
    id: 'reviewing',
    name: 'Reviewing',
    description: 'Optimizing and refining the code',
    icon: CheckCircle,
    color: 'text-blue-500',
    estimatedDuration: 2000
  },
  building: {
    id: 'building',
    name: 'Building',
    description: 'Compiling and preparing the application',
    icon: Cog,
    color: 'text-orange-500',
    estimatedDuration: 3000
  },
  deploying: {
    id: 'deploying',
    name: 'Deploying',
    description: 'Setting up the execution environment',
    icon: Zap,
    color: 'text-red-500',
    estimatedDuration: 2500
  },
  complete: {
    id: 'complete',
    name: 'Complete',
    description: 'Your application is ready!',
    icon: CheckCircle,
    color: 'text-green-600',
    estimatedDuration: 0
  }
}

export function GenerationLoading({ 
  stage, 
  progress, 
  message,
  showDetails = true,
  showEstimatedTime = true,
  estimatedTime,
  currentFile,
  totalFiles,
  className = ""
}: GenerationLoadingProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [animationPhase, setAnimationPhase] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Start visibility animation
  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Track elapsed time
  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)

    return () => clearInterval(interval)
  }, [stage])

  // Animation phase cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const currentStage = stages[stage] || stages.analyzing
  const StageIcon = currentStage.icon

  // Calculate remaining time
  const remainingTime = estimatedTime ? Math.max(0, estimatedTime - elapsedTime) : null

  // Get stage progress indicators
  const getStageProgress = () => {
    const stageOrder = ['analyzing', 'thinking', 'planning', 'generating', 'coding', 'reviewing', 'building', 'deploying', 'complete']
    const currentIndex = stageOrder.indexOf(stage)
    
    return stageOrder.map((stageId, index) => ({
      ...stages[stageId],
      isActive: index === currentIndex,
      isComplete: index < currentIndex,
      isFuture: index > currentIndex
    }))
  }

  const stageProgress = getStageProgress()

  return (
    <Card className={`p-6 max-w-lg mx-auto transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}>
      {/* Main stage indicator */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative">
          {/* Animated background circle */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-pulse" />
          
          {/* Icon container */}
          <div className="relative w-16 h-16 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center">
            <StageIcon 
              className={`w-8 h-8 ${currentStage.color} transition-all duration-300 ${
                stage !== 'complete' ? 'animate-spin' : 'animate-none'
              }`} 
            />
          </div>
          
          {/* Progress ring */}
          <svg className="absolute inset-0 w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              className={`${currentStage.color} transition-all duration-500`}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Stage title and description */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-semibold mb-2 flex items-center justify-center gap-2">
          {currentStage.name}
          <Badge variant="secondary" className="text-xs">
            {Math.round(progress)}%
          </Badge>
        </h3>
        <p className="text-sm text-muted-foreground mb-2">
          {message || currentStage.description}
        </p>
        
        {/* File progress indicator */}
        {currentFile && totalFiles && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <FileText className="w-3 h-3" />
            <span className="truncate max-w-32">{currentFile}</span>
            <span>({totalFiles} files)</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <Progress 
          value={progress} 
          className="h-2 transition-all duration-300"
          style={{
            background: `linear-gradient(90deg, ${currentStage.color.replace('text-', '')}, ${currentStage.color.replace('text-', '')}/60)`
          }}
        />
      </div>

      {/* Time indicators */}
      {showEstimatedTime && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Elapsed: {(elapsedTime / 1000).toFixed(1)}s</span>
          </div>
          {remainingTime !== null && (
            <div className="flex items-center gap-1">
              <span>Est. remaining: {(remainingTime / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      )}

      {/* Detailed stage progress */}
      {showDetails && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Generation Progress</span>
            <span>{stageProgress.filter(s => s.isComplete).length}/{stageProgress.length} stages</span>
          </div>
          
          <div className="grid grid-cols-1 gap-1">
            {stageProgress.slice(0, 6).map((stageInfo) => {
              const StageItemIcon = stageInfo.icon
              return (
                <div
                  key={stageInfo.id}
                  className={`flex items-center gap-2 p-2 rounded-md transition-all duration-300 ${
                    stageInfo.isActive 
                      ? 'bg-primary/10 border border-primary/20' 
                      : stageInfo.isComplete
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-muted/50'
                  }`}
                >
                  <div className={`relative ${stageInfo.isActive ? 'animate-pulse' : ''}`}>
                    <StageItemIcon 
                      className={`w-4 h-4 ${
                        stageInfo.isComplete 
                          ? 'text-green-600' 
                          : stageInfo.isActive 
                          ? stageInfo.color
                          : 'text-muted-foreground'
                      }`} 
                    />
                    {stageInfo.isActive && (
                      <div className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium truncate ${
                        stageInfo.isComplete 
                          ? 'text-green-700 dark:text-green-400' 
                          : stageInfo.isActive 
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}>
                        {stageInfo.name}
                      </span>
                      
                      {stageInfo.isComplete && (
                        <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                      )}
                      
                      {stageInfo.isActive && (
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full bg-current transition-opacity duration-300 ${
                                animationPhase === i ? 'opacity-100' : 'opacity-30'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {stageInfo.isActive && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {stageInfo.description}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Streaming indicators */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-600">Live Generation</span>
        </div>
        
        {/* AI status */}
        <div className="flex items-center gap-2">
          <Brain className="w-3 h-3 text-blue-500" />
          <span className="text-xs text-muted-foreground">AI Active</span>
        </div>
      </div>

      {/* Motivational messages */}
      <div className="text-center mt-4">
        <p className="text-xs text-muted-foreground italic">
          {stage === 'analyzing' && "Reading your requirements carefully..."}
          {stage === 'thinking' && "Considering the best approach..."}
          {stage === 'planning' && "Designing a robust architecture..."}
          {stage === 'generating' && "Crafting your application..."}
          {stage === 'coding' && "Writing clean, efficient code..."}
          {stage === 'reviewing' && "Adding final touches..."}
          {stage === 'building' && "Preparing for deployment..."}
          {stage === 'deploying' && "Almost ready to launch..."}
          {stage === 'complete' && "🎉 Your app is ready to use!"}
        </p>
      </div>
    </Card>
  )
} 
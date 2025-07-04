export function GenerationLoading({ 
  stage,
  progress 
}: {
  stage: 'analyzing' | 'generating' | 'building' | 'deploying'
  progress?: number
}) {
  const stages = [
    { id: 'analyzing', label: 'Analyzing request', icon: '🔍' },
    { id: 'generating', label: 'Generating code', icon: '⚡' },
    { id: 'building', label: 'Building app', icon: '🔨' },
    { id: 'deploying', label: 'Creating preview', icon: '🚀' }
  ]
  
  const currentIndex = stages.findIndex(s => s.id === stage)
  
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 min-h-[300px]">
      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {stages.map((s, index) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`
                flex items-center justify-center w-10 h-10 rounded-full
                transition-all duration-300 
                ${index <= currentIndex 
                  ? 'bg-primary text-primary-foreground scale-110' 
                  : 'bg-muted text-muted-foreground scale-100'
                }
                ${index === currentIndex ? 'animate-pulse' : ''}
              `}
            >
              <span className="text-lg">{s.icon}</span>
            </div>
            {index < stages.length - 1 && (
              <div className="w-12 h-0.5 mx-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-muted" />
                <div 
                  className="absolute inset-0 bg-primary transition-transform duration-500"
                  style={{
                    transform: `translateX(${index < currentIndex ? '0' : '-100%'})`
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Current stage label */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold animate-in fade-in duration-300">
          {stages[currentIndex].label}
        </h3>
        
        {/* Progress bar */}
        {progress !== undefined && (
          <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        
        {/* Loading animation dots */}
        <div className="flex justify-center gap-1 pt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
} 
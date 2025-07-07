// Example prompts that generate instant preview-friendly code
export const instantPreviewPrompts = [
  {
    title: "Simple Counter",
    prompt: "Create a simple React counter component with increment and decrement buttons",
    expectedTemplate: "react"
  },
  {
    title: "Todo List",
    prompt: "Build a basic todo list app with add and delete functionality using React hooks",
    expectedTemplate: "react"
  },
  {
    title: "Calculator",
    prompt: "Create a simple calculator with basic operations (+, -, *, /) using React",
    expectedTemplate: "react"
  },
  {
    title: "Color Picker",
    prompt: "Build a color picker component that shows the selected color and its hex value",
    expectedTemplate: "react"
  },
  {
    title: "Timer",
    prompt: "Create a countdown timer with start, pause, and reset buttons using React",
    expectedTemplate: "react"
  },
  {
    title: "Weather Card",
    prompt: "Build a weather card component that displays temperature, conditions, and an icon (use placeholder data)",
    expectedTemplate: "react"
  },
  {
    title: "Profile Card",
    prompt: "Create a user profile card with avatar, name, bio, and social links using React and Tailwind",
    expectedTemplate: "react"
  },
  {
    title: "Quiz Component",
    prompt: "Build a simple quiz component with multiple choice questions and score tracking",
    expectedTemplate: "react"
  },
  {
    title: "Markdown Previewer",
    prompt: "Create a markdown previewer with live preview using React (implement basic markdown parsing)",
    expectedTemplate: "react"
  },
  {
    title: "Expense Tracker",
    prompt: "Build a simple expense tracker with add/remove transactions and balance calculation",
    expectedTemplate: "react"
  }
]

// Helper to check if a prompt is instant-preview friendly
export function isInstantPreviewPrompt(prompt: string): boolean {
  const keywords = [
    'simple', 'basic', 'component', 'calculator', 'counter', 'timer',
    'todo', 'list', 'form', 'card', 'picker', 'preview'
  ]
  
  const complexKeywords = [
    'api', 'database', 'server', 'backend', 'authentication',
    'fetch', 'axios', 'prisma', 'mongodb', 'postgresql'
  ]
  
  const promptLower = prompt.toLowerCase()
  
  // Check for complex keywords that indicate non-instant preview
  const hasComplexFeatures = complexKeywords.some(keyword => 
    promptLower.includes(keyword)
  )
  
  if (hasComplexFeatures) {
    return false
  }
  
  // Check for simple keywords that indicate instant preview
  const hasSimpleFeatures = keywords.some(keyword => 
    promptLower.includes(keyword)
  )
  
  // If explicitly asking for React or component, likely instant-preview friendly
  const isReactRequest = promptLower.includes('react') || 
                        promptLower.includes('component')
  
  return hasSimpleFeatures || isReactRequest
}
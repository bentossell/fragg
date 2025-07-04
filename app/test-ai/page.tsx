'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestAIPage() {
  const testCommands = [
    {
      title: 'Simple Question',
      command: 'await window.AI.ask("What is 2+2?")',
      description: 'Basic AI interaction'
    },
    {
      title: 'Chat with Context',
      command: `await window.AI.chat([
  { role: "user", content: "Hello!" },
  { role: "assistant", content: "Hi there!" },
  { role: "user", content: "What's React?" }
])`,
      description: 'Multi-message conversation'
    },
    {
      title: 'Different Model',
      command: 'await window.AI.ask("Write a poem", window.AI.models.powerful)',
      description: 'Use a more powerful model'
    },
    {
      title: 'Code Help',
      command: 'await window.AI.ask("How to center a div in CSS?")',
      description: 'Programming assistance'
    }
  ]

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Injection Testing</h1>
          <p className="text-muted-foreground">
            Stage 2 implementation allows generated apps to use AI capabilities through the window.AI object.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>🧪 How to Test</CardTitle>
            <CardDescription>
              Generate any app, then open its browser console and run these commands
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              <li>Generate an app (Next.js, Vue, or any template)</li>
              <li>Open the generated app in a new window</li>
              <li>Open browser Developer Tools (F12)</li>
              <li>Go to the Console tab</li>
              <li>Look for the &ldquo;🤖 AI capabilities loaded!&rdquo; message</li>
              <li>Try the commands below</li>
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">Test Commands</h2>
          {testCommands.map((test, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{test.title}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(test.command)}
                  >
                    Copy
                  </Button>
                </div>
                <CardDescription>{test.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                  <code>{test.command}</code>
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Models</CardTitle>
            <CardDescription>Use these model presets for different needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">window.AI.models.fast</code>
                <span className="text-sm">Claude 3.5 Haiku (fastest/cheapest)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">window.AI.models.balanced</code>
                <span className="text-sm">Claude 3.7 Sonnet (balanced)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">window.AI.models.powerful</code>
                <span className="text-sm">Claude Opus 4 (most capable)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">window.AI.models.cheap</code>
                <span className="text-sm">DeepSeek V3 (free)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">window.AI.models.turbo</code>
                <span className="text-sm">Gemini 2.5 Flash (fastest)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">window.AI.models.reasoning</code>
                <span className="text-sm">OpenAI o3 (advanced reasoning)</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-sm">window.AI.models.reasoningMini</code>
                <span className="text-sm">OpenAI o3 Mini (lightweight reasoning)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💡 Example Use Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Todo App:</strong> &ldquo;Suggest improvements for this task: Learn React&rdquo;</p>
              <p><strong>Calculator:</strong> &ldquo;Explain how this calculation works step by step&rdquo;</p>
              <p><strong>Recipe App:</strong> &ldquo;Suggest wine pairings for this recipe&rdquo;</p>
              <p><strong>Notes App:</strong> &ldquo;Summarize these notes in bullet points&rdquo;</p>
              <p><strong>Dashboard:</strong> &ldquo;What insights can you provide about this data?&rdquo;</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
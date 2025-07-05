export interface CodeDiff {
  type: 'add' | 'remove' | 'replace' | 'modify'
  startLine?: number
  endLine?: number
  searchPattern?: string
  content: string
  description: string
}

export interface DiffContext {
  existingCode: string
  language: string
  framework?: string
  fileType?: string
}

export interface DiffResult {
  success: boolean
  modifiedCode: string
  appliedDiffs: CodeDiff[]
  errors?: string[]
}

export class CodeDiffer {
  /**
   * Analyze if the request is asking for changes to existing code
   */
  static isIterationRequest(userPrompt: string, existingCode?: string): boolean {
    if (!existingCode) return false
    
    const iterationKeywords = [
      'change', 'modify', 'update', 'fix', 'add', 'remove', 'delete',
      'improve', 'refactor', 'rename', 'move', 'replace', 'adjust',
      'make it', 'convert', 'transform', 'enhance', 'optimize',
      'bug', 'error', 'issue', 'problem', 'broken', 'not working'
    ]
    
    const promptLower = userPrompt.toLowerCase()
    return iterationKeywords.some(keyword => promptLower.includes(keyword))
  }
  
  /**
   * Extract code sections that need to be modified based on the user's request
   */
  static identifyTargetSections(
    userPrompt: string, 
    existingCode: string
  ): { sections: string[], confidence: number } {
    const sections: string[] = []
    let confidence = 0
    
    // Look for specific component/function names mentioned
    const componentMatches = userPrompt.match(/(?:component|function|class|method|element)\s+(\w+)/gi)
    if (componentMatches) {
      componentMatches.forEach(match => {
        const name = match.split(/\s+/).pop()
        if (name && existingCode.includes(name)) {
          sections.push(name)
          confidence += 0.3
        }
      })
    }
    
    // Look for UI element references
    const uiElements = ['button', 'form', 'input', 'header', 'footer', 'nav', 'menu', 'sidebar', 'modal', 'dialog']
    uiElements.forEach(element => {
      if (userPrompt.toLowerCase().includes(element) && existingCode.toLowerCase().includes(element)) {
        sections.push(element)
        confidence += 0.2
      }
    })
    
    // Look for style/color references
    const styleKeywords = ['color', 'background', 'style', 'css', 'theme', 'dark', 'light']
    const hasStyleChange = styleKeywords.some(keyword => userPrompt.toLowerCase().includes(keyword))
    if (hasStyleChange) {
      sections.push('styles')
      confidence += 0.2
    }
    
    // Look for functionality keywords
    const funcKeywords = ['api', 'fetch', 'submit', 'click', 'handler', 'event', 'state', 'hook']
    const hasFuncChange = funcKeywords.some(keyword => userPrompt.toLowerCase().includes(keyword))
    if (hasFuncChange) {
      sections.push('functionality')
      confidence += 0.2
    }
    
    return { sections: [...new Set(sections)], confidence: Math.min(confidence, 1) }
  }
  
  /**
   * Apply diffs to existing code
   */
  static applyDiffs(context: DiffContext, diffs: CodeDiff[]): DiffResult {
    let modifiedCode = context.existingCode
    const appliedDiffs: CodeDiff[] = []
    const errors: string[] = []
    
    // Sort diffs by line number (if available) to apply from bottom to top
    const sortedDiffs = [...diffs].sort((a, b) => {
      if (a.startLine && b.startLine) {
        return b.startLine - a.startLine // Reverse order
      }
      return 0
    })
    
    for (const diff of sortedDiffs) {
      try {
        switch (diff.type) {
          case 'add':
            modifiedCode = this.applyAddDiff(modifiedCode, diff)
            break
          case 'remove':
            modifiedCode = this.applyRemoveDiff(modifiedCode, diff)
            break
          case 'replace':
            modifiedCode = this.applyReplaceDiff(modifiedCode, diff)
            break
          case 'modify':
            modifiedCode = this.applyModifyDiff(modifiedCode, diff)
            break
        }
        appliedDiffs.push(diff)
      } catch (error) {
        errors.push(`Failed to apply diff: ${diff.description} - ${error}`)
      }
    }
    
    return {
      success: errors.length === 0,
      modifiedCode,
      appliedDiffs,
      errors: errors.length > 0 ? errors : undefined
    }
  }
  
  private static applyAddDiff(code: string, diff: CodeDiff): string {
    const lines = code.split('\n')
    
    if (diff.startLine !== undefined) {
      // Insert at specific line
      lines.splice(diff.startLine, 0, ...diff.content.split('\n'))
    } else if (diff.searchPattern) {
      // Find pattern and add after it
      const index = lines.findIndex(line => line.includes(diff.searchPattern!))
      if (index !== -1) {
        lines.splice(index + 1, 0, ...diff.content.split('\n'))
      } else {
        throw new Error(`Pattern "${diff.searchPattern}" not found`)
      }
    } else {
      // Add at end
      lines.push(...diff.content.split('\n'))
    }
    
    return lines.join('\n')
  }
  
  private static applyRemoveDiff(code: string, diff: CodeDiff): string {
    if (diff.searchPattern) {
      // Remove lines containing pattern
      const lines = code.split('\n')
      return lines.filter(line => !line.includes(diff.searchPattern!)).join('\n')
    } else if (diff.startLine !== undefined && diff.endLine !== undefined) {
      // Remove specific line range
      const lines = code.split('\n')
      lines.splice(diff.startLine, diff.endLine - diff.startLine + 1)
      return lines.join('\n')
    }
    
    throw new Error('Remove diff must specify either searchPattern or line range')
  }
  
  private static applyReplaceDiff(code: string, diff: CodeDiff): string {
    if (diff.searchPattern) {
      // Replace all occurrences of pattern
      return code.replace(new RegExp(diff.searchPattern, 'g'), diff.content)
    } else if (diff.startLine !== undefined && diff.endLine !== undefined) {
      // Replace specific line range
      const lines = code.split('\n')
      lines.splice(
        diff.startLine, 
        diff.endLine - diff.startLine + 1, 
        ...diff.content.split('\n')
      )
      return lines.join('\n')
    }
    
    throw new Error('Replace diff must specify either searchPattern or line range')
  }
  
  private static applyModifyDiff(code: string, diff: CodeDiff): string {
    // Modify diff is more intelligent - it finds a block and modifies it
    if (diff.searchPattern) {
      const regex = new RegExp(
        `(${diff.searchPattern}[\\s\\S]*?)(?=\\n\\n|\\n(?:function|class|const|let|var|export)|$)`,
        'g'
      )
      return code.replace(regex, diff.content)
    }
    
    throw new Error('Modify diff must specify searchPattern')
  }
  
  /**
   * Generate a prompt for AI to create diffs instead of full code
   */
  static createDiffPrompt(
    userPrompt: string,
    existingCode: string,
    targetSections: string[],
    language: string
  ): string {
    return `You are a code modification expert. The user wants to modify existing code.

USER REQUEST: "${userPrompt}"

EXISTING CODE:
\`\`\`${language}
${existingCode}
\`\`\`

TARGET SECTIONS: ${targetSections.join(', ')}

Generate ONLY the necessary changes as a JSON array of diffs. Each diff should have:
- type: "add" | "remove" | "replace" | "modify"
- searchPattern: A unique string to find the location (or startLine/endLine for line-based changes)
- content: The new code to add/replace (empty for remove)
- description: Brief description of the change

Example response format:
[
  {
    "type": "replace",
    "searchPattern": "className=\\"old-class\\"",
    "content": "className=\\"new-class\\"",
    "description": "Update button styling"
  },
  {
    "type": "add",
    "searchPattern": "const [count, setCount]",
    "content": "  const [loading, setLoading] = useState(false)",
    "description": "Add loading state"
  }
]

IMPORTANT:
- Only generate diffs for the requested changes
- Keep searchPatterns unique and specific
- Preserve all unrelated code
- Maintain proper indentation in content
- Generate valid JSON array only`
  }
  
  /**
   * Parse AI response to extract diffs
   */
  static parseDiffResponse(response: string): CodeDiff[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }
      
      const diffs = JSON.parse(jsonMatch[0]) as CodeDiff[]
      
      // Validate diffs
      return diffs.filter(diff => 
        diff.type && 
        diff.content !== undefined && 
        diff.description &&
        (diff.searchPattern || (diff.startLine !== undefined && diff.endLine !== undefined))
      )
    } catch (error) {
      console.error('Failed to parse diff response:', error)
      return []
    }
  }
  
  /**
   * Create a fallback full regeneration if diff application fails
   */
  static createFallbackPrompt(
    userPrompt: string,
    existingCode: string,
    language: string
  ): string {
    return `The user wants to modify existing code but diff application failed. 
    Generate the complete updated code.

USER REQUEST: "${userPrompt}"

EXISTING CODE AS REFERENCE:
\`\`\`${language}
${existingCode}
\`\`\`

Generate the complete updated ${language} code that incorporates the requested changes while preserving all unrelated functionality:`
  }
} 
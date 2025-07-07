/**
 * Sandbox configuration utilities
 * Centralizes timeout and configuration settings for sandbox operations
 */

export interface SandboxConfig {
  creationTimeoutMs: number
  maxDurationSeconds: number
  startupRetries: number
  startupRetryDelayMs: number
  development: {
    enableExtendedTimeouts: boolean
    disableTimeouts: boolean
    verboseLogging: boolean
  }
}

/**
 * Get sandbox configuration based on environment
 */
export function getSandboxConfig(): SandboxConfig {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Allow environment variable override for timeout
  const customTimeoutMs = process.env.E2B_TIMEOUT_MS ? parseInt(process.env.E2B_TIMEOUT_MS) : null
  
  return {
    // Sandbox creation timeout
    creationTimeoutMs: customTimeoutMs || (isDevelopment ? 0 : 20 * 60 * 1000), // No timeout in dev, 20min in prod
    
    // API route max duration
    maxDurationSeconds: isDevelopment ? 300 : 60, // 5 minutes in dev, 1 minute in prod
    
    // App startup configuration
    startupRetries: 30,
    startupRetryDelayMs: 2000,
    
    development: {
      enableExtendedTimeouts: isDevelopment,
      disableTimeouts: isDevelopment && !customTimeoutMs, // Disable unless explicitly set
      verboseLogging: isDevelopment
    }
  }
}

/**
 * Get timeout configuration for E2B sandbox creation
 */
export function getSandboxCreationTimeout(): number {
  const config = getSandboxConfig()
  return config.creationTimeoutMs
}

/**
 * Check if timeouts should be disabled (development mode)
 */
export function shouldDisableTimeouts(): boolean {
  const config = getSandboxConfig()
  return config.development.disableTimeouts
}

/**
 * Log configuration on startup (development only)
 */
export function logSandboxConfig(): void {
  const config = getSandboxConfig()
  if (config.development.verboseLogging) {
    console.log('🔧 Sandbox Configuration:')
    console.log(`  • Creation timeout: ${config.creationTimeoutMs}ms ${config.creationTimeoutMs === 0 ? '(disabled)' : ''}`)
    console.log(`  • Max duration: ${config.maxDurationSeconds}s`)
    console.log(`  • Startup retries: ${config.startupRetries}`)
    console.log(`  • Development mode: ${config.development.enableExtendedTimeouts}`)
  }
} 
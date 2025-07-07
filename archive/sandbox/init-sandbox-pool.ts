import { sandboxPool } from './sandbox-pool'

let initialized = false

/**
 * Initialize sandbox pool once on server startup
 */
export async function initializeSandboxPool() {
  if (initialized) {
    console.log('🔄 Sandbox pool already initialized')
    return
  }
  
  // Skip initialization if E2B API key is not set
  if (!process.env.E2B_API_KEY) {
    console.log('⚠️ E2B_API_KEY not set, skipping sandbox pool initialization')
    return
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 Initializing sandbox pool in development mode...')
    
    try {
      // In development, only pre-warm 1 sandbox per template to save resources
      sandboxPool.setPoolSize('nextjs-developer', 1, 2)
      sandboxPool.setPoolSize('streamlit-developer', 1, 2)
      sandboxPool.setPoolSize('vue-developer', 1, 2)
      
      // Initialize with the most commonly used templates
      await sandboxPool.initialize(['nextjs-developer'])
      
      // Pre-warm other templates in background
      setTimeout(async () => {
        await sandboxPool.preWarmTemplate('streamlit-developer', 1)
        await sandboxPool.preWarmTemplate('vue-developer', 1)
      }, 5000)
      
      initialized = true
      console.log('✅ Sandbox pool initialized for development')
    } catch (error) {
      console.error('❌ Failed to initialize sandbox pool:', error)
    }
  } else {
    console.log('🚀 Initializing sandbox pool in production mode...')
    
    try {
      // In production, maintain larger pools
      sandboxPool.setPoolSize('nextjs-developer', 3, 10)
      sandboxPool.setPoolSize('streamlit-developer', 2, 5)
      sandboxPool.setPoolSize('vue-developer', 2, 5)
      
      // Initialize all template pools
      await sandboxPool.initialize()
      
      initialized = true
      console.log('✅ Sandbox pool initialized for production')
    } catch (error) {
      console.error('❌ Failed to initialize sandbox pool:', error)
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down sandbox pool...')
  await sandboxPool.shutdown()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down sandbox pool...')
  await sandboxPool.shutdown()
  process.exit(0)
}) 
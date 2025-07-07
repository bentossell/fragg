export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on the server
    const { initializeSandboxPool } = await import('./archive/sandbox/init-sandbox-pool')
    
    // Initialize sandbox pool on server startup
    await initializeSandboxPool()
  }
}
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RealTimePage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to main page since real-time generation is now integrated
    router.push('/')
  }, [router])
  
  return (
    <div className="min-h-screen p-6 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
        <p className="text-muted-foreground">
          Real-time generation is now integrated into the main app.
        </p>
      </div>
    </div>
  )
} 
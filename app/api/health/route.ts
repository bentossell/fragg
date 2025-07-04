import { NextRequest, NextResponse } from 'next/server'
import { sandboxPool } from '@/lib/sandbox-pool'
import { templateCache } from '@/lib/template-cache'

export async function GET(req: NextRequest) {
  try {
    // Get system health metrics
    const poolStats = sandboxPool.getPoolStats()
    const templateCount = templateCache.getTemplateNames().length
    const quickStartCount = templateCache.getQuickStartNames().length
    
    // Calculate overall system health
    let healthScore = 100
    let issues: string[] = []
    
    // Check sandbox pool health
    for (const [template, stats] of Object.entries(poolStats)) {
      if (stats.errorRate > 0.1) { // More than 10% error rate
        healthScore -= 20
        issues.push(`High error rate for ${template}: ${(stats.errorRate * 100).toFixed(1)}%`)
      }
      
      if (stats.hitRate < 0.5) { // Less than 50% hit rate
        healthScore -= 10
        issues.push(`Low hit rate for ${template}: ${(stats.hitRate * 100).toFixed(1)}%`)
      }
      
      if (stats.averageInitTime > 10000) { // More than 10 seconds
        healthScore -= 15
        issues.push(`Slow initialization for ${template}: ${stats.averageInitTime}ms`)
      }
    }
    
    const status = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'degraded' : 'unhealthy'
    
    const healthData = {
      status,
      healthScore,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      issues,
      
      // Sandbox pool metrics
      sandboxPool: {
        totalTemplates: Object.keys(poolStats).length,
        totalSandboxes: Object.values(poolStats).reduce((sum, s) => sum + s.totalSandboxes, 0),
        availableSandboxes: Object.values(poolStats).reduce((sum, s) => sum + s.availableSandboxes, 0),
        activeSandboxes: Object.values(poolStats).reduce((sum, s) => sum + s.activeSandboxes, 0),
        averageHitRate: Object.values(poolStats).length > 0 
          ? Object.values(poolStats).reduce((sum, s) => sum + s.hitRate, 0) / Object.values(poolStats).length 
          : 0,
        details: poolStats
      },
      
      // Template cache metrics
      templateCache: {
        totalTemplates: templateCount,
        totalQuickStarts: quickStartCount,
        cacheEnabled: true
      },
      
      // Performance metrics
      performance: {
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch
      }
    }
    
    return NextResponse.json(healthData, {
      status: status === 'healthy' ? 200 : status === 'degraded' ? 206 : 503
    })
    
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Health check summary endpoint
export async function HEAD(req: NextRequest) {
  try {
    const poolStats = sandboxPool.getPoolStats()
    const hasIssues = Object.values(poolStats).some(stats => 
      stats.errorRate > 0.1 || stats.hitRate < 0.5 || stats.averageInitTime > 10000
    )
    
    return new NextResponse(null, { 
      status: hasIssues ? 503 : 200,
      headers: {
        'X-Health-Status': hasIssues ? 'degraded' : 'healthy',
        'X-Uptime': process.uptime().toString(),
        'X-Total-Sandboxes': Object.values(poolStats).reduce((sum, s) => sum + s.totalSandboxes, 0).toString()
      }
    })
  } catch (error) {
    return new NextResponse(null, { status: 500 })
  }
} 
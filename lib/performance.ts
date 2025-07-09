/**
 * Performance Tracking Utility
 * 
 * This utility helps track and measure performance bottlenecks
 * in the code generation pipeline. It provides methods to mark
 * timestamps, measure durations, and track async function execution.
 */

// Enable/disable performance logging
const ENABLE_PERF_LOGGING = process.env.NODE_ENV === 'development' || 
  process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

export class PerformanceTracker {
  private marks = new Map<string, number>();
  private measures: Record<string, number> = {};
  private sessionStart: number;
  private sessionName: string;
  
  constructor(sessionName: string = 'default') {
    this.sessionName = sessionName;
    this.sessionStart = performance.now();
    this.mark('session:start');
  }
  
  /**
   * Mark a timestamp with a name for later measurement
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }
  
  /**
   * Measure time between two marks
   * If endMark is omitted, uses current time
   */
  measure(name: string, startMark: string, endMark?: string): number | undefined {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();
    
    if (!start) {
      console.warn(`⚠️ Performance mark "${startMark}" not found`);
      return;
    }
    
    const duration = end! - start;
    this.measures[name] = duration;
    
    if (ENABLE_PERF_LOGGING) {
      console.log(`⏱️ [${this.sessionName}] ${name}: ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
  
  /**
   * Track execution time of an async function
   */
  async trackAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.measures[name] = duration;
      
      if (ENABLE_PERF_LOGGING) {
        console.log(`⏱️ [${this.sessionName}] ${name}: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ [${this.sessionName}] ${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
  
  /**
   * Get all measurements as a record
   */
  getMeasures(): Record<string, number> {
    return { ...this.measures };
  }
  
  /**
   * End the session and get total duration
   */
  endSession(name: string = 'Total'): number {
    const duration = this.measure(`${name} Duration`, 'session:start')!;
    return duration;
  }
  
  /**
   * Get a performance report as a formatted string
   */
  getReport(): string {
    const totalDuration = this.endSession();
    const measures = this.getMeasures();
    
    let report = `📊 Performance Report [${this.sessionName}]\n`;
    report += `Total Duration: ${totalDuration.toFixed(2)}ms\n`;
    report += `Breakdown:\n`;
    
    // Sort by duration (descending)
    const sortedMeasures = Object.entries(measures)
      .sort(([, a], [, b]) => b - a);
    
    for (const [name, duration] of sortedMeasures) {
      if (name === 'Total Duration') continue;
      const percentage = ((duration / totalDuration) * 100).toFixed(1);
      report += `  - ${name}: ${duration.toFixed(2)}ms (${percentage}%)\n`;
    }
    
    return report;
  }
  
  /**
   * Log the performance report to console
   */
  logReport(): void {
    if (ENABLE_PERF_LOGGING) {
      console.log(this.getReport());
    }
  }
}

// Singleton instance for global tracking
let globalTracker: PerformanceTracker | null = null;

/**
 * Get or create the global performance tracker
 */
export function getGlobalTracker(sessionName?: string): PerformanceTracker {
  if (!globalTracker || sessionName) {
    globalTracker = new PerformanceTracker(sessionName || 'global');
  }
  return globalTracker;
}

/**
 * Track a specific part of the code generation pipeline
 */
export async function trackGeneration<T>(
  stage: string, 
  fn: () => Promise<T>, 
  tracker?: PerformanceTracker
): Promise<T> {
  const t = tracker || getGlobalTracker('generation');
  return t.trackAsync(stage, fn);
}

/**
 * Utility for tracking template detection performance
 */
export function createGenerationTracker(): PerformanceTracker {
  return new PerformanceTracker('code-generation');
}

// Example usage:
// 
// const perf = createGenerationTracker();
// 
// perf.mark('generation-start');
// perf.mark('template-detection-start');
// const template = await detectTemplate(prompt);
// perf.measure('Template Detection', 'template-detection-start');
// 
// perf.mark('ai-generation-start');
// const response = await generateCode(prompt, template);
// perf.measure('AI Generation', 'ai-generation-start');
// 
// perf.measure('Total Generation', 'generation-start');
// perf.logReport();

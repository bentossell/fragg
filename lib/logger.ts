/**
 * Centralized Logger Utility
 * 
 * This module provides a centralized logging system that respects debug flags
 * and environment settings. It replaces direct console.log calls throughout
 * the codebase to provide consistent, controllable logging.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   
 *   logger.debug('Detailed debug info');
 *   logger.info('General information');
 *   logger.warn('Warning message');
 *   logger.error('Error occurred', errorObject);
 *   
 *   // For streaming-specific logs
 *   logger.stream('Streaming update', data);
 */

// Environment detection
const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Debug flags
const DEBUG_STREAMING = typeof process !== 'undefined' && 
  process.env.NEXT_PUBLIC_DEBUG_STREAMING === 'true';

const DEBUG_PERFORMANCE = typeof process !== 'undefined' && 
  process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

// Log level enum (higher numbers = more verbose)
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

// Current log level based on environment
const currentLogLevel = isDev ? LogLevel.INFO : LogLevel.ERROR;

// Timestamp formatter
const timestamp = () => {
  return new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
};

// Color codes for console (dev only)
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
};

// Counter to track streaming log frequency
let streamLogCounter = 0;
let lastStreamLogTime = 0;
const STREAM_LOG_THROTTLE = 500; // ms

/**
 * Main logger object with methods for different log levels
 */
export const logger = {
  /**
   * Debug level logging - most verbose, only shown when explicitly enabled
   */
  debug: (...args: any[]) => {
    if (isDev && currentLogLevel >= LogLevel.DEBUG) {
      console.debug(
        `${colors.dim}${timestamp()}${colors.reset} ${colors.cyan}[DEBUG]${colors.reset}`,
        ...args
      );
    }
  },

  /**
   * Info level logging - general information, shown in development
   */
  info: (...args: any[]) => {
    if (currentLogLevel >= LogLevel.INFO) {
      console.info(
        `${colors.dim}${timestamp()}${colors.reset} ${colors.blue}[INFO]${colors.reset}`,
        ...args
      );
    }
  },

  /**
   * Warning level logging - potential issues, shown in development
   */
  warn: (...args: any[]) => {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(
        `${colors.dim}${timestamp()}${colors.reset} ${colors.yellow}[WARN]${colors.reset}`,
        ...args
      );
    }
  },

  /**
   * Error level logging - always shown in all environments
   */
  error: (...args: any[]) => {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(
        `${colors.dim}${timestamp()}${colors.reset} ${colors.red}[ERROR]${colors.reset}`,
        ...args
      );
    }
  },

  /**
   * Performance logging - for timing and performance metrics
   */
  perf: (...args: any[]) => {
    if (DEBUG_PERFORMANCE) {
      console.log(
        `${colors.dim}${timestamp()}${colors.reset} ${colors.green}[PERF]${colors.reset}`,
        ...args
      );
    }
  },

  /**
   * Streaming-specific logs - heavily throttled unless debug flag is enabled
   * This addresses the "bunch of logs for streaming" issue
   */
  stream: (...args: any[]) => {
    // Only log if streaming debug is enabled
    if (DEBUG_STREAMING) {
      const now = Date.now();
      
      // Throttle logs to reduce console spam
      if (now - lastStreamLogTime > STREAM_LOG_THROTTLE) {
        console.log(
          `${colors.dim}${timestamp()}${colors.reset} ${colors.magenta}[STREAM]${colors.reset}`,
          ...args
        );
        lastStreamLogTime = now;
      } else {
        // Count skipped logs
        streamLogCounter++;
        
        // Show summary every 50 skipped logs
        if (streamLogCounter % 50 === 0) {
          console.log(
            `${colors.dim}${timestamp()}${colors.reset} ${colors.magenta}[STREAM]${colors.reset}`,
            `Throttled ${streamLogCounter} streaming logs in the last ${Math.round((now - lastStreamLogTime) / 1000)}s`
          );
        }
      }
    }
  },

  /**
   * Group related logs together (dev only)
   */
  group: (label: string, fn: () => void) => {
    if (isDev) {
      console.group(label);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    } else {
      fn();
    }
  },

  /**
   * Log a table of data (dev only)
   */
  table: (tabularData: any, properties?: string[]) => {
    if (isDev && currentLogLevel >= LogLevel.DEBUG) {
      console.table(tabularData, properties);
    }
  }
};

// Default export
export default logger;

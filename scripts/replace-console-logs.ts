#!/usr/bin/env ts-node
/**
 * Console Log Replacement Script
 * 
 * This script finds and replaces all console.log, console.error, console.warn, etc. statements
 * with the appropriate logger utility calls to reduce console noise and provide better
 * control over logging.
 * 
 * Usage:
 *   ts-node scripts/replace-console-logs.ts [--dry-run] [--path=<path>]
 * 
 * Options:
 *   --dry-run    Show what would be changed without actually modifying files
 *   --path       Specify a subdirectory to process (default: entire project)
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PATH_ARG = args.find(arg => arg.startsWith('--path='));
const ROOT_DIR = PATH_ARG ? PATH_ARG.split('=')[1] : process.cwd();

// File extensions to process
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
];

// Mapping of console methods to logger methods
const METHOD_MAP = {
  'log': 'debug',
  'info': 'info',
  'warn': 'warn',
  'error': 'error',
  'debug': 'debug',
};

// Special case for streaming logs
const STREAMING_LOG_REGEX = /console\.log\s*\(\s*['"]?📡['"]?/;

// Counter for statistics
let stats = {
  filesProcessed: 0,
  filesModified: 0,
  replacementsTotal: 0,
  replacementsByType: {} as Record<string, number>,
};

/**
 * Process a single file
 */
async function processFile(filePath: string): Promise<void> {
  try {
    // Read file content
    const content = await readFile(filePath, 'utf8');
    stats.filesProcessed++;

    // Skip files that already import our logger
    if (content.includes("import { logger }") || content.includes("import logger")) {
      console.log(`⏭️  Skipping ${filePath} - already uses logger`);
      return;
    }

    // Find all console.X calls
    let modified = content;
    let replacements = 0;
    let needsLoggerImport = false;

    // Process each console method
    for (const [consoleMethod, loggerMethod] of Object.entries(METHOD_MAP)) {
      // Regular expression to match console.X calls
      const regex = new RegExp(`console\\.${consoleMethod}\\s*\\(`, 'g');
      const matches = content.match(regex);
      
      if (matches && matches.length > 0) {
        replacements += matches.length;
        
        // Update stats
        stats.replacementsByType[consoleMethod] = 
          (stats.replacementsByType[consoleMethod] || 0) + matches.length;
        
        // Special handling for streaming logs
        if (consoleMethod === 'log' && STREAMING_LOG_REGEX.test(content)) {
          modified = modified.replace(
            STREAMING_LOG_REGEX, 
            `logger.stream(`
          );
        }
        
        // Replace normal console calls
        modified = modified.replace(
          regex, 
          `logger.${loggerMethod}(`
        );
        
        needsLoggerImport = true;
      }
    }

    // If we made replacements, add the logger import
    if (needsLoggerImport && replacements > 0) {
      // Add import statement if not already present
      if (!modified.includes("import { logger }") && !modified.includes("import logger")) {
        // Find a good place to add the import
        if (modified.includes('import ')) {
          // Add after the last import
          const importLines = modified.split('\n').filter(line => line.trim().startsWith('import '));
          const lastImportLine = importLines[importLines.length - 1];
          const lastImportIndex = modified.indexOf(lastImportLine) + lastImportLine.length;
          
          modified = 
            modified.substring(0, lastImportIndex) + 
            '\nimport { logger } from \'@/lib/logger\';' + 
            modified.substring(lastImportIndex);
        } else {
          // Add at the top of the file
          modified = 'import { logger } from \'@/lib/logger\';\n\n' + modified;
        }
      }
      
      stats.filesModified++;
      stats.replacementsTotal += replacements;
      
      // Write the modified content back to the file
      if (!DRY_RUN) {
        await writeFile(filePath, modified, 'utf8');
        console.log(`✅ Updated ${filePath} (${replacements} replacements)`);
      } else {
        console.log(`🔍 Would update ${filePath} (${replacements} replacements)`);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

/**
 * Recursively process all files in a directory
 */
async function processDirectory(dirPath: string): Promise<void> {
  try {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const entryStat = await stat(entryPath);
      
      // Skip excluded directories
      if (entryStat.isDirectory()) {
        if (EXCLUDE_DIRS.includes(entry)) {
          continue;
        }
        await processDirectory(entryPath);
      } 
      // Process files with matching extensions
      else if (entryStat.isFile() && EXTENSIONS.includes(path.extname(entryPath))) {
        await processFile(entryPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing directory ${dirPath}:`, error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`🔍 ${DRY_RUN ? 'Analyzing' : 'Replacing'} console statements in ${ROOT_DIR}`);
  
  const startTime = Date.now();
  await processDirectory(ROOT_DIR);
  const duration = Date.now() - startTime;
  
  // Print statistics
  console.log('\n📊 Summary:');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Total replacements: ${stats.replacementsTotal}`);
  console.log('\nReplacements by type:');
  
  for (const [type, count] of Object.entries(stats.replacementsByType)) {
    console.log(`  console.${type} → logger.${METHOD_MAP[type]}: ${count}`);
  }
  
  console.log(`\n⏱️  Completed in ${duration}ms`);
  
  if (DRY_RUN) {
    console.log('\n💡 This was a dry run. No files were modified.');
    console.log('   Run without --dry-run to apply changes.');
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

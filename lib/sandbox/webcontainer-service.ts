/**
 * WebContainer Service
 * 
 * Manages WebContainers for running code in the browser.
 * Provides a singleton interface to boot, configure, and interact with WebContainers.
 * Supports React, Vue, and static HTML applications with optimized startup times.
 */

import { WebContainer, FileSystemTree, SpawnOptions } from '@webcontainer/api';
import { injectAI } from '@/lib/inject-ai';
import { TemplateId } from '@/lib/templates';
import { logger } from '@/lib/logger';

// Status types for callbacks
export type WebContainerStatus = 
  | 'initializing'
  | 'booting'
  | 'ready'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'running'
  | 'error';

export type StatusCallback = (status: WebContainerStatus, details?: any) => void;

// Template-specific configuration
export interface TemplateConfig {
  startCommand: string[];
  port: number;
  installCommand?: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * WebContainer Service - Singleton manager for browser-based code execution
 */
export class WebContainerService {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;
  private static isBooting = false;
  private static statusListeners: StatusCallback[] = [];

  // Template configurations
  private static readonly TEMPLATES: Record<string, TemplateConfig> = {
    'react': {
      startCommand: ['npm', 'run', 'dev'],
      port: 5173,
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.2.0',
        'vite': '^5.0.0'
      }
    },
    'vue': {
      startCommand: ['npm', 'run', 'dev'],
      port: 5173,
      dependencies: {
        'vue': '^3.3.0'
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^4.0.0',
        'vite': '^5.0.0'
      }
    },
    'nextjs': {
      startCommand: ['npm', 'run', 'dev'],
      port: 3000,
      dependencies: {
        'next': '^14.0.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        'typescript': '^5.0.0'
      }
    },
    'static-html': {
      startCommand: ['npx', 'serve', '-p', '8080'],
      port: 8080,
      dependencies: {},
      devDependencies: {
        'serve': '^14.0.0'
      }
    }
  };

  /**
   * Get the WebContainer instance, booting if necessary
   */
  public static async getInstance(onStatus?: StatusCallback): Promise<WebContainer> {
    if (onStatus) {
      this.statusListeners.push(onStatus);
    }

    if (this.instance) {
      return this.instance;
    }

    if (!this.bootPromise) {
      this.isBooting = true;
      this.updateStatus('booting');
      
      this.bootPromise = WebContainer.boot()
        .then(webcontainer => {
          this.instance = webcontainer;
          this.isBooting = false;
          this.updateStatus('ready');
          return webcontainer;
        })
        .catch(error => {
          this.isBooting = false;
          this.bootPromise = null;
          this.updateStatus('error', error);
          throw error;
        });
    }

    return this.bootPromise;
  }

  /**
   * Notify all status listeners of a status change
   */
  private static updateStatus(status: WebContainerStatus, details?: any): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(status, details);
      } catch (e) {
        logger.error('Error in WebContainer status listener:', e);
      }
    });
  }

  /**
   * Remove a status listener
   */
  public static removeStatusListener(listener: StatusCallback): void {
    this.statusListeners = this.statusListeners.filter(l => l !== listener);
  }

  /**
   * Create a React application in the WebContainer
   */
  public static async createReactApp(
    code: string,
    onStatus?: StatusCallback
  ): Promise<string> {
    return this.createApp('react', {
      'src/App.jsx': { file: { contents: this.injectAICapabilities(code, 'react') } },
      'src/main.jsx': { file: { contents: `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
      `.trim() } },
      'index.html': { file: { contents: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
      `.trim() } },
      // Basic Vite config with React plugin
      'vite.config.js': { file: { contents: `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
      `.trim() } },
      'src/index.css': { file: { contents: `
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

body {
  margin: 0;
  display: flex;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  width: 100%;
}
      `.trim() } }
    }, onStatus);
  }

  /**
   * Create a Vue application in the WebContainer
   */
  public static async createVueApp(
    code: string,
    onStatus?: StatusCallback
  ): Promise<string> {
    return this.createApp('vue', {
      'src/App.vue': { file: { contents: this.injectAICapabilities(code, 'vue') } },
      'src/main.js': { file: { contents: `
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')
      `.trim() } },
      'index.html': { file: { contents: `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
      `.trim() } },
      'src/style.css': { file: { contents: `
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#app {
  width: 100%;
}
      `.trim() } }
    }, onStatus);
  }

  /**
   * Create a Next.js application in the WebContainer
   */
  public static async createNextJsApp(
    code: string,
    onStatus?: StatusCallback
  ): Promise<string> {
    return this.createApp('nextjs', {
      // Classic "pages" directory – works everywhere
      'pages/index.tsx': { file: { contents: this.injectAICapabilities(code, 'nextjs') } },
      'pages/_app.tsx': { file: { contents: `
import type { AppProps } from 'next/app'

// Global styles could be added here if desired
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
      `.trim() } },
      // Minimal TS config so Next.js can compile TS/TSX without errors
      'tsconfig.json': { file: { contents: `
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["dom", "dom.iterable", "es2021"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "types": ["node", "react", "react-dom"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
      `.trim() } },
      'next.config.js': { file: { contents: `
/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig
      `.trim() } }
    }, onStatus);
  }

  /**
   * Create a static HTML application in the WebContainer
   */
  public static async createStaticHtmlApp(
    code: string,
    onStatus?: StatusCallback
  ): Promise<string> {
    return this.createApp('static-html', {
      'index.html': { file: { contents: this.injectAICapabilities(code, 'static-html') } }
    }, onStatus);
  }

  /**
   * Create an application based on template and files
   */
  private static async createApp(
    templateType: keyof typeof WebContainerService.TEMPLATES,
    files: FileSystemTree,
    onStatus?: StatusCallback
  ): Promise<string> {
    const template = this.TEMPLATES[templateType];
    if (!template) {
      throw new Error(`Unknown template type: ${templateType}`);
    }

    if (onStatus) {
      this.statusListeners.push(onStatus);
    }

    try {
      this.updateStatus('initializing');
      
      // Get WebContainer instance
      const webcontainer = await this.getInstance();
      
      // Add package.json to files
      const packageJson = this.generatePackageJson(templateType);
      files['package.json'] = { file: { contents: packageJson } };
      
      // Mount files
      this.updateStatus('mounting');

      // Capture file structure for easier debugging if mount fails
      const fileList = Object.keys(files);
      try {
        logger.debug('Mounting files to WebContainer:', fileList);
        await webcontainer.mount(files);
      } catch (mountErr: any) {
        /**
         * Provide an actionable error that surfaces which files were
         * about to be mounted – this is the most common point of failure
         * when file names contain unsupported characters (e.g. "*", ":", "\\")
         * or wrong root folders.
         */
        logger.error(
          '🛑 WebContainer mount failed. File list:',
          fileList.join(', ')
        );

        // Augment the original error so UI layers can show a nicer hint
        const enhanced = new Error(
          `WebContainer mount failed: ${mountErr?.message || mountErr}\n\n` +
          `Files attempted:\n• ${fileList.join('\n• ')}\n\n` +
          `Hint: ensure filenames are POSIX-compatible and paths are correct.`
        );
        this.updateStatus('error', enhanced);
        // Remove listener added earlier before throwing
        if (onStatus) this.removeStatusListener(onStatus);
        throw enhanced;
      }
      
      // Install dependencies
      this.updateStatus('installing', { template: templateType });
      logger.info(`Installing dependencies for ${templateType} template...`);
      const installProcess = await webcontainer.spawn('npm', ['install'], {
        output: true,
      });
      
      const installExitCode = await installProcess.exit;
      if (installExitCode !== 0) {
        throw new Error(`Installation failed with exit code ${installExitCode}`);
      }
      
      // Start the dev server
      this.updateStatus('starting', { command: template.startCommand.join(' ') });
      logger.info(`Starting dev server with: ${template.startCommand.join(' ')}`);
      const startProcess = await webcontainer.spawn(template.startCommand[0], template.startCommand.slice(1), {
        output: true,
      });
      
      // Wait for server to be ready
      const url = await this.waitForServerReady(webcontainer, template.port);
      logger.info(`Server ready at: ${url}`);
      this.updateStatus('running', { url });
      
      // Clean up status listener
      if (onStatus) {
        this.removeStatusListener(onStatus);
      }
      
      return url;
    } catch (error) {
      logger.error('WebContainer application creation failed:', error);
      this.updateStatus('error', error);
      
      // Clean up status listener
      if (onStatus) {
        this.removeStatusListener(onStatus);
      }
      
      throw error;
    }
  }

  /**
   * Generate a package.json file for the given template
   */
  private static generatePackageJson(templateType: keyof typeof WebContainerService.TEMPLATES): string {
    const template = this.TEMPLATES[templateType];
    
    // Base shape common to all templates
    const packageJson: any = {
      name: `${templateType}-app`,
      private: true,
      version: '0.0.0',
      scripts: {
        dev: templateType === 'nextjs' ? 'next dev' : 'vite',
        build: templateType === 'nextjs' ? 'next build' : 'vite build',
        preview: templateType === 'nextjs' ? 'next start' : 'vite preview'
      },
      dependencies: template.dependencies,
      devDependencies: template.devDependencies
    };

    /**
     * Only Vite projects need `"type": "module"`.  
     * Next.js handles module-resolution itself and breaks if this field is present.
     */
    if (templateType !== 'nextjs') {
      packageJson.type = 'module';
    }
    
    return JSON.stringify(packageJson, null, 2);
  }

  /**
   * Wait for the server to be ready and return the URL
   */
  private static async waitForServerReady(
    webcontainer: WebContainer,
    port: number,
    maxRetries = 30,
    retryDelay = 100
  ): Promise<string> {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const url = await webcontainer.openUrl(port);
        return url;
      } catch (error) {
        retries++;
        if (retries % 5 === 0) {
          logger.debug(`Waiting for server to be ready (attempt ${retries}/${maxRetries})...`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw new Error(`Server did not become ready after ${maxRetries} retries`);
  }

  /**
   * Inject AI capabilities into the code
   */
  private static injectAICapabilities(code: string, template: string): string {
    // Reuse the existing injectAI function
    try {
      return injectAI(code, template as TemplateId);
    } catch (error) {
      logger.error('Failed to inject AI capabilities:', error);
      return code;
    }
  }

  /**
   * Create an application based on the template ID
   */
  public static async createAppFromTemplate(
    templateId: TemplateId,
    code: string,
    onStatus?: StatusCallback
  ): Promise<string> {
    logger.info(`Creating app from template: ${templateId}`);
    switch (templateId) {
      case 'nextjs-developer':
        return this.createNextJsApp(code, onStatus);
      case 'vue-developer':
        return this.createVueApp(code, onStatus);
      case 'static-html':
        return this.createStaticHtmlApp(code, onStatus);
      default:
        // Default to React for unknown templates
        logger.info(`Unknown template "${templateId}", defaulting to React`);
        return this.createReactApp(code, onStatus);
    }
  }

  /**
   * Execute a command in the WebContainer
   */
  public static async executeCommand(
    command: string,
    args: string[] = [],
    options: SpawnOptions = {}
  ): Promise<{ exitCode: number; output: string }> {
    const webcontainer = await this.getInstance();
    logger.debug(`Executing command: ${command} ${args.join(' ')}`);
    
    const process = await webcontainer.spawn(command, args, {
      ...options,
      output: true,
    });
    
    let output = '';
    process.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
        },
      })
    );
    
    const exitCode = await process.exit;
    logger.debug(`Command completed with exit code: ${exitCode}`);
    
    return { exitCode, output };
  }

  /**
   * Terminate the WebContainer instance
   * Useful for cleanup or when switching between apps
   */
  public static async terminate(): Promise<void> {
    if (this.instance) {
      logger.info('Terminating WebContainer instance');
      // WebContainer API doesn't have a direct terminate method
      // but we can reset our references to allow garbage collection
      this.instance = null;
      this.bootPromise = null;
      this.isBooting = false;
      this.statusListeners = [];
    }
  }
}

// Component Library for instant UI generation
export interface Component {
  name: string
  html: string
  css?: string
  js?: string
  react?: string
  dependencies?: string[]
  variants?: Record<string, Partial<Component>>
}

export interface ComponentSet {
  components: Component[]
  theme: string
  css: string
  js?: string
}

export class ComponentLibrary {
  private cache = new Map<string, Component>()
  
  // Shadcn/UI inspired component definitions
  private readonly components: Record<string, Component> = {
    button: {
      name: 'button',
      html: `<button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
        Button
      </button>`,
      react: `export function Button({ 
        children, 
        variant = 'default', 
        size = 'default', 
        className = '', 
        ...props 
      }: ButtonProps) {
        return (
          <button
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
              {
                "bg-primary text-primary-foreground hover:bg-primary/90": variant === "default",
                "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === "destructive",
                "border border-input bg-background hover:bg-accent hover:text-accent-foreground": variant === "outline",
                "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
                "text-primary underline-offset-4 hover:underline": variant === "link",
              },
              {
                "h-10 px-4 py-2": size === "default",
                "h-9 rounded-md px-3": size === "sm",
                "h-11 rounded-md px-8": size === "lg",
                "h-10 w-10": size === "icon",
              },
              className
            )}
            {...props}
          >
            {children}
          </button>
        )
      }`,
      dependencies: ['class-variance-authority', 'clsx'],
      variants: {
        destructive: { html: `<button class="... bg-destructive text-destructive-foreground hover:bg-destructive/90 ...">Delete</button>` },
        outline: { html: `<button class="... border border-input bg-background hover:bg-accent hover:text-accent-foreground ...">Outline</button>` },
        ghost: { html: `<button class="... hover:bg-accent hover:text-accent-foreground ...">Ghost</button>` }
      }
    },
    
    card: {
      name: 'card',
      html: `<div class="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col space-y-1.5 p-6">
          <h3 class="text-2xl font-semibold leading-none tracking-tight">Card Title</h3>
          <p class="text-sm text-muted-foreground">Card description goes here.</p>
        </div>
        <div class="p-6 pt-0">
          <p>Card content goes here. Add any components or text.</p>
        </div>
        <div class="flex items-center p-6 pt-0">
          <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            Action
          </button>
        </div>
      </div>`,
      react: `export function Card({ className, ...props }: CardProps) {
        return (
          <div
            className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
            {...props}
          />
        )
      }
      
      export function CardHeader({ className, ...props }: CardHeaderProps) {
        return (
          <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
        )
      }
      
      export function CardTitle({ className, ...props }: CardTitleProps) {
        return (
          <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
        )
      }
      
      export function CardContent({ className, ...props }: CardContentProps) {
        return <div className={cn("p-6 pt-0", className)} {...props} />
      }`
    },
    
    form: {
      name: 'form',
      html: `<form class="space-y-6">
        <div class="space-y-2">
          <label for="email" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter your email"
            required
          />
        </div>
        <div class="space-y-2">
          <label for="message" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Type your message here."
            rows="4"
            required
          ></textarea>
        </div>
        <button 
          type="submit" 
          class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
        >
          Send Message
        </button>
      </form>`,
      js: `
      document.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // Add loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        
        try {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Show success message
          showToast('Message sent successfully!', 'success');
          e.target.reset();
        } catch (error) {
          showToast('Failed to send message. Please try again.', 'error');
        } finally {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      });`,
      react: `export function ContactForm() {
        const [isLoading, setIsLoading] = useState(false)
        
        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault()
          setIsLoading(true)
          
          try {
            // Handle form submission
            await new Promise(resolve => setTimeout(resolve, 1000))
            toast.success('Message sent successfully!')
          } catch (error) {
            toast.error('Failed to send message')
          } finally {
            setIsLoading(false)
          }
        }
        
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form fields */}
          </form>
        )
      }`
    },
    
    navigation: {
      name: 'navigation',
      html: `<nav class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="container flex h-14 max-w-screen-2xl items-center">
          <div class="mr-4 hidden md:flex">
            <a class="mr-6 flex items-center space-x-2" href="/">
              <span class="hidden font-bold sm:inline-block">Brand</span>
            </a>
            <nav class="flex items-center space-x-6 text-sm font-medium">
              <a class="transition-colors hover:text-foreground/80 text-foreground" href="/">Home</a>
              <a class="transition-colors hover:text-foreground/80 text-foreground/60" href="/about">About</a>
              <a class="transition-colors hover:text-foreground/80 text-foreground/60" href="/services">Services</a>
              <a class="transition-colors hover:text-foreground/80 text-foreground/60" href="/contact">Contact</a>
            </nav>
          </div>
          <div class="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div class="w-full flex-1 md:w-auto md:flex-none">
              <!-- Mobile menu button -->
              <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 py-2 mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden">
                <span class="sr-only">Toggle Menu</span>
                <!-- Hamburger icon -->
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <nav class="flex items-center">
              <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
                Get Started
              </button>
            </nav>
          </div>
        </div>
      </nav>`,
      js: `
      // Mobile menu toggle
      document.addEventListener('DOMContentLoaded', function() {
        const mobileMenuBtn = document.querySelector('button[class*="md:hidden"]');
        if (mobileMenuBtn) {
          mobileMenuBtn.addEventListener('click', function() {
            // Toggle mobile menu
            console.log('Mobile menu toggled');
          });
        }
      });`
    },
    
    dialog: {
      name: 'dialog',
      html: `<div class="fixed inset-0 z-50 hidden" id="dialog" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-black/50" onclick="closeDialog()"></div>
        <div class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
          <div class="flex flex-col space-y-1.5 text-center sm:text-left">
            <h2 class="text-lg font-semibold leading-none tracking-tight">Confirm Action</h2>
            <p class="text-sm text-muted-foreground">Are you sure you want to continue? This action cannot be undone.</p>
          </div>
          <div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <button onclick="closeDialog()" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 mt-2 sm:mt-0">
              Cancel
            </button>
            <button onclick="confirmAction()" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              Continue
            </button>
          </div>
        </div>
      </div>`,
      js: `
      function openDialog() {
        document.getElementById('dialog').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
      
      function closeDialog() {
        document.getElementById('dialog').classList.add('hidden');
        document.body.style.overflow = '';
      }
      
      function confirmAction() {
        // Handle confirmation
        console.log('Action confirmed');
        closeDialog();
      }
      
      // Close on escape key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closeDialog();
        }
      });`
    },
    
    table: {
      name: 'table',
      html: `<div class="relative w-full overflow-auto">
        <table class="w-full caption-bottom text-sm">
          <thead class="[&_tr]:border-b">
            <tr class="border-b transition-colors hover:bg-muted/50">
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                Name
              </th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                Status
              </th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                Email
              </th>
              <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="[&_tr:last-child]:border-0">
            <tr class="border-b transition-colors hover:bg-muted/50">
              <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                <div class="flex items-center space-x-2">
                  <div class="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <span class="text-xs font-medium">JD</span>
                  </div>
                  <span class="font-medium">John Doe</span>
                </div>
              </td>
              <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                  Active
                </span>
              </td>
              <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">john@example.com</td>
              <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10">
                  <span class="sr-only">Actions</span>
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>`
    },
    
    toast: {
      name: 'toast',
      html: `<div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2"></div>`,
      js: `
      function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        const bgClasses = {
          success: 'bg-green-50 border-green-200 text-green-800',
          error: 'bg-red-50 border-red-200 text-red-800',
          warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          info: 'bg-blue-50 border-blue-200 text-blue-800'
        };
        
        toast.className = \`group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all \${bgClasses[type]} data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full\`;
        
        toast.innerHTML = \`
          <div class="flex items-center space-x-2">
            <p class="text-sm font-medium">\${message}</p>
          </div>
          <button class="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100" onclick="this.parentElement.remove()">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        \`;
        
        container.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, duration);
      }`
    },
    
    progress: {
      name: 'progress',
      html: `<div class="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
        <div class="h-full w-3/5 flex-1 bg-primary transition-all" style="transform: translateX(-40%)"></div>
      </div>`,
      js: `
      function updateProgress(element, percentage) {
        const progressBar = element.querySelector('[class*="bg-primary"]');
        if (progressBar) {
          progressBar.style.width = percentage + '%';
          progressBar.style.transform = 'translateX(0)';
        }
      }`
    },
    
    search: {
      name: 'search',
      html: `<div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="search"
          class="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search..."
        />
      </div>`,
      js: `
      document.addEventListener('DOMContentLoaded', function() {
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput) {
          searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            // Implement search logic here
            console.log('Searching for:', query);
          });
        }
      });`
    }
  }
  
  // Get CSS theme variables
  private readonly themeCSS = `
    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 84% 4.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 84% 4.9%;
      --primary: 222.2 47.4% 11.2%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96%;
      --secondary-foreground: 222.2 84% 4.9%;
      --muted: 210 40% 96%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96%;
      --accent-foreground: 222.2 84% 4.9%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --ring: 222.2 84% 4.9%;
      --radius: 0.5rem;
    }
    
    .dark {
      --background: 222.2 84% 4.9%;
      --foreground: 210 40% 98%;
      --card: 222.2 84% 4.9%;
      --card-foreground: 210 40% 98%;
      --popover: 222.2 84% 4.9%;
      --popover-foreground: 210 40% 98%;
      --primary: 210 40% 98%;
      --primary-foreground: 222.2 47.4% 11.2%;
      --secondary: 217.2 32.6% 17.5%;
      --secondary-foreground: 210 40% 98%;
      --muted: 217.2 32.6% 17.5%;
      --muted-foreground: 215 20.2% 65.1%;
      --accent: 217.2 32.6% 17.5%;
      --accent-foreground: 210 40% 98%;
      --destructive: 0 62.8% 30.6%;
      --destructive-foreground: 210 40% 98%;
      --border: 217.2 32.6% 17.5%;
      --input: 217.2 32.6% 17.5%;
      --ring: 212.7 26.8% 83.9%;
    }
    
    * {
      border-color: hsl(var(--border));
    }
    
    body {
      background-color: hsl(var(--background));
      color: hsl(var(--foreground));
    }
  `
  
  async getComponents(names: string[]): Promise<Component[]> {
    const components: Component[] = []
    
    for (const name of names) {
      // Check cache first
      if (this.cache.has(name)) {
        components.push(this.cache.get(name)!)
        continue
      }
      
      // Get from library
      const component = this.components[name]
      if (component) {
        this.cache.set(name, component)
        components.push(component)
      }
    }
    
    return components
  }
  
  // Get component set for quick generation
  getComponentSet(names: string[]): ComponentSet {
    const components = names.map(name => this.components[name]).filter(Boolean)
    
    return {
      components,
      theme: this.themeCSS,
      css: this.getCombinedCSS(components),
      js: this.getCombinedJS(components)
    }
  }
  
  // Get all CSS for selected components
  private getCombinedCSS(components: Component[]): string {
    const cssRules: string[] = []
    
    components.forEach(comp => {
      if (comp.css) {
        cssRules.push(`/* ${comp.name} styles */`)
        cssRules.push(comp.css)
      }
    })
    
    return cssRules.join('\n\n')
  }
  
  // Get all JS for selected components
  private getCombinedJS(components: Component[]): string {
    const jsCode: string[] = []
    
    components.forEach(comp => {
      if (comp.js) {
        jsCode.push(`// ${comp.name} functionality`)
        jsCode.push(comp.js)
      }
    })
    
    return jsCode.join('\n\n')
  }
  
  // Get React components combined
  getCombinedReact(components: Component[]): string {
    const imports = [
      `import React, { useState, useEffect } from 'react'`,
      `import { cn } from '@/lib/utils'`
    ]
    
    const reactCode = components
      .filter(c => c.react)
      .map(c => c.react)
      .join('\n\n')
    
    return imports.join('\n') + '\n\n' + reactCode
  }
  
  // Get all component names
  getAvailableComponents(): string[] {
    return Object.keys(this.components)
  }
  
  // Generate starter template with components
  generateStarterTemplate(type: 'landing' | 'dashboard' | 'app', components: string[]): string {
    const componentSet = this.getComponentSet(components)
    
    switch (type) {
      case 'landing':
        return this.generateLandingPage(componentSet)
      case 'dashboard':
        return this.generateDashboard(componentSet)
      case 'app':
        return this.generateApp(componentSet)
      default:
        return this.generateBasicTemplate(componentSet)
    }
  }
  
  private generateLandingPage(set: ComponentSet): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Landing Page</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        ${set.theme}
        ${set.css}
    </style>
</head>
<body>
    <!-- Navigation -->
    ${this.components.navigation?.html || ''}
    
    <!-- Hero Section -->
    <section class="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div class="container mx-auto px-6 text-center">
            <h1 class="text-5xl font-bold mb-4">Welcome to Our Platform</h1>
            <p class="text-xl mb-8">Build amazing things with our tools</p>
            ${this.components.button?.html?.replace('Button', 'Get Started') || ''}
        </div>
    </section>
    
    <!-- Features -->
    <section class="py-20 bg-gray-50">
        <div class="container mx-auto px-6">
            <h2 class="text-3xl font-bold text-center mb-12">Features</h2>
            <div class="grid md:grid-cols-3 gap-8">
                ${Array(3).fill(this.components.card?.html || '').join('')}
            </div>
        </div>
    </section>
    
    <!-- Contact Form -->
    <section class="py-20">
        <div class="container mx-auto px-6 max-w-md">
            <h2 class="text-3xl font-bold text-center mb-8">Get In Touch</h2>
            ${this.components.form?.html || ''}
        </div>
    </section>
    
    <script>
        ${set.js}
    </script>
</body>
</html>`
  }
  
  private generateDashboard(set: ComponentSet): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        ${set.theme}
        ${set.css}
    </style>
</head>
<body>
    <div class="min-h-screen bg-gray-50">
        <!-- Navigation -->
        ${this.components.navigation?.html || ''}
        
        <!-- Main Content -->
        <main class="container mx-auto px-6 py-8">
            <div class="flex justify-between items-center mb-8">
                <h1 class="text-3xl font-bold">Dashboard</h1>
                ${this.components.search?.html || ''}
            </div>
            
            <!-- Stats Cards -->
            <div class="grid md:grid-cols-4 gap-6 mb-8">
                ${Array(4).fill(this.components.card?.html || '').join('')}
            </div>
            
            <!-- Data Table -->
            <div class="bg-white rounded-lg shadow">
                <div class="p-6">
                    <h2 class="text-lg font-semibold mb-4">Recent Activity</h2>
                    ${this.components.table?.html || ''}
                </div>
            </div>
        </main>
    </div>
    
    <script>
        ${set.js}
    </script>
</body>
</html>`
  }
  
  private generateApp(set: ComponentSet): string {
    return this.generateBasicTemplate(set)
  }
  
  private generateBasicTemplate(set: ComponentSet): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        ${set.theme}
        ${set.css}
    </style>
</head>
<body>
    <div class="min-h-screen bg-background">
        <!-- Navigation -->
        ${this.components.navigation?.html || ''}
        
        <!-- Main Content -->
        <main class="container mx-auto px-6 py-8">
            <h1 class="text-3xl font-bold mb-8">Welcome</h1>
            
            <!-- Components will be placed here -->
            <div class="space-y-8">
                ${set.components.map(c => c.html).join('\n\n')}
            </div>
        </main>
        
        <!-- Toast Container -->
        ${this.components.toast?.html || ''}
    </div>
    
    <script>
        ${set.js}
    </script>
</body>
</html>`
  }
}

// Export singleton instance
export const componentLibrary = new ComponentLibrary() 
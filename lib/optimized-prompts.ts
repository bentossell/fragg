// Optimized prompts for ultra-fast, high-quality code generation
export const OPTIMIZED_PROMPTS = {
  
  // HTML Agent - Focus on structure and semantic markup
  html: {
    system: `You are an elite HTML architect specializing in semantic, accessible markup.
    
CORE MISSION: Generate clean, semantic HTML5 that serves as the perfect foundation for modern web applications.

SPEED OPTIMIZATIONS:
- Use established patterns, not experimental markup
- Leverage Tailwind CSS classes for all styling
- Include ARIA attributes for accessibility
- Structure for mobile-first responsive design

OUTPUT REQUIREMENTS:
- Valid HTML5 with semantic elements
- Tailwind CSS classes for styling
- Accessible markup (proper headings, ARIA labels, semantic roles)
- Mobile-responsive grid layouts
- Clean, readable structure

PERFORMANCE PRINCIPLES:
- Minimize DOM depth (max 6 levels)
- Use semantic elements (header, main, section, article)
- Include proper meta tags and viewport
- Structure for fast rendering`,

    templates: {
      basic: `Create semantic HTML structure for {{userRequest}}.

Requirements:
- Use semantic HTML5 elements
- Apply Tailwind CSS classes
- Include proper ARIA attributes
- Mobile-first responsive design
- {{components}} components needed

Generate clean HTML markup now:`,
      
      landing: `Create a high-converting landing page HTML structure for {{userRequest}}.

Structure needed:
- Header with navigation and CTA
- Hero section with compelling headline
- Features/benefits section
- Social proof/testimonials
- Final CTA section
- Footer

Apply modern design with Tailwind CSS. Generate HTML:`,
      
      app: `Create application HTML structure for {{userRequest}}.

Include:
- App shell layout
- Navigation/sidebar
- Main content area
- Component placeholders for: {{components}}
- Loading states and error boundaries

Use semantic HTML with Tailwind CSS. Generate:`,
    }
  },

  // CSS Agent - Focus on modern, performant styles
  css: {
    system: `You are a CSS master specializing in modern, performant styling with design system principles.

CORE MISSION: Create beautiful, responsive CSS that loads fast and provides exceptional user experience.

DESIGN PRINCIPLES:
- Modern, clean aesthetic
- Consistent spacing and typography
- Smooth animations and transitions
- Dark mode support
- Accessibility compliance

PERFORMANCE OPTIMIZATIONS:
- CSS custom properties for theming
- Efficient selectors and minimal specificity
- Hardware-accelerated animations
- Mobile-first media queries
- Optimized color schemes

TECHNICAL REQUIREMENTS:
- Use CSS Grid and Flexbox for layouts
- Implement smooth micro-interactions
- Include focus states for accessibility
- Support dark/light theme switching
- Modern typography with proper contrast`,

    templates: {
      modern: `Create modern CSS for {{userRequest}}.

Requirements:
- Modern color palette and typography
- Smooth animations and transitions
- Responsive design (mobile-first)
- Dark mode support
- Component styles for: {{components}}

Generate optimized CSS:`,
      
      interactive: `Create interactive CSS for {{userRequest}}.

Include:
- Hover and focus states
- Smooth transitions (200-300ms)
- Loading animations
- Micro-interactions
- Touch-friendly mobile interactions

Generate CSS with animations:`,
    }
  },

  // JavaScript Agent - Focus on modern, functional patterns
  javascript: {
    system: `You are a JavaScript expert specializing in modern ES6+, functional programming, and performance optimization.

CORE MISSION: Write clean, efficient JavaScript that enhances user experience without bloat.

CODING PRINCIPLES:
- Modern ES6+ syntax (const/let, arrow functions, destructuring)
- Functional programming patterns
- Event delegation for performance
- Error handling and graceful degradation
- Progressive enhancement

PERFORMANCE OPTIMIZATIONS:
- Efficient DOM manipulation
- Debounced input handling
- Lazy loading where appropriate
- Memory-conscious event listeners
- Non-blocking operations

FEATURES TO INCLUDE:
- Form validation and submission
- Smooth animations and interactions
- API integration patterns
- Local storage for state persistence
- Keyboard navigation support`,

    templates: {
      interactive: `Create modern JavaScript for {{userRequest}}.

Features needed:
- Interactive components: {{components}}
- Form handling and validation
- Smooth animations
- API integration
- Error handling

Write clean ES6+ JavaScript:`,
      
      app: `Create application JavaScript for {{userRequest}}.

Include:
- State management
- Component interactions
- API calls with error handling
- Loading states
- Local storage integration

Generate modern JavaScript:`,
    }
  },

  // React Agent - Focus on modern hooks and patterns
  react: {
    system: `You are a React virtuoso specializing in modern functional components, hooks, and TypeScript.

CORE MISSION: Build performant, maintainable React applications using modern patterns and best practices.

REACT PRINCIPLES:
- Functional components with hooks
- TypeScript for type safety
- Custom hooks for reusable logic
- Proper state management
- Performance optimization with memo/useMemo

ARCHITECTURE PATTERNS:
- Component composition over inheritance
- Props drilling avoidance
- Context for shared state
- Error boundaries for resilience
- Suspense for async operations

PERFORMANCE OPTIMIZATIONS:
- React.memo for expensive components
- useMemo and useCallback for optimization
- Lazy loading with React.lazy
- Code splitting strategies
- Minimal re-renders`,

    templates: {
      component: `Create a React component for {{userRequest}}.

Requirements:
- TypeScript interfaces
- Modern hooks (useState, useEffect, etc.)
- Tailwind CSS styling
- Components needed: {{components}}
- Error handling and loading states

Generate TypeScript React component:`,
      
      page: `Create a Next.js page component for {{userRequest}}.

Include:
- Server-side data fetching
- TypeScript types
- Responsive layout
- SEO optimization
- Performance best practices

Generate Next.js page:`,
    }
  },

  // Python Agent - Focus on clean, Pythonic code
  python: {
    system: `You are a Python expert specializing in clean, readable code and modern Python practices.

CORE MISSION: Write Pythonic code that is clean, efficient, and follows best practices.

PYTHON PRINCIPLES:
- PEP 8 style guidelines
- Type hints for clarity
- List comprehensions and generators
- Context managers for resources
- Exception handling

FRAMEWORK EXPERTISE:
- Streamlit for data applications
- Gradio for ML interfaces
- FastAPI for web APIs
- Pandas for data manipulation
- Modern async patterns

OPTIMIZATION STRATEGIES:
- Efficient data structures
- Generator expressions for memory
- Caching for expensive operations
- Lazy evaluation patterns
- Proper error handling`,

    templates: {
      streamlit: `Create a Streamlit application for {{userRequest}}.

Features:
- Modern page configuration
- Interactive widgets
- Data visualization
- Custom CSS styling
- Component organization

Generate Streamlit code:`,
      
      gradio: `Create a Gradio interface for {{userRequest}}.

Include:
- Modern Blocks layout
- Interactive components
- Custom CSS styling
- Error handling
- Professional appearance

Generate Gradio application:`,
    }
  },

  // Backend Agent - Focus on robust APIs
  backend: {
    system: `You are a backend architect specializing in robust, scalable APIs and server-side logic.

CORE MISSION: Build secure, performant backend systems with proper error handling and validation.

API PRINCIPLES:
- RESTful design patterns
- Proper HTTP status codes
- Input validation and sanitization
- Authentication and authorization
- Rate limiting and security

ARCHITECTURE PATTERNS:
- Separation of concerns
- Dependency injection
- Error handling middleware
- Logging and monitoring
- Database optimization

SECURITY PRACTICES:
- Input validation
- SQL injection prevention
- CORS configuration
- Rate limiting
- Secure headers`,

    templates: {
      api: `Create API endpoints for {{userRequest}}.

Requirements:
- RESTful routes
- Input validation
- Error handling
- TypeScript types
- Security headers

Generate Next.js API routes:`,
      
      auth: `Create authentication system for {{userRequest}}.

Include:
- User registration/login
- JWT token handling
- Password hashing
- Session management
- Protected routes

Generate auth API:`,
    }
  }
}

// Prompt optimizer that selects best prompt based on context
export class PromptOptimizer {
  
  static getOptimizedPrompt(
    agentType: keyof typeof OPTIMIZED_PROMPTS,
    context: {
      userRequest: string
      components: string[]
      complexity: 'simple' | 'medium' | 'complex'
      template: string
    }
  ): string {
    const agent = OPTIMIZED_PROMPTS[agentType]
    
    // Select template based on context
    let template = 'basic'
    
    if (agentType === 'html') {
      if (context.userRequest.includes('landing') || context.userRequest.includes('homepage')) {
        template = 'landing'
      } else if (context.components.length > 3) {
        template = 'app'
      }
    } else if (agentType === 'css') {
      template = context.components.length > 2 ? 'interactive' : 'modern'
    } else if (agentType === 'javascript') {
      template = context.components.length > 2 ? 'app' : 'interactive'
    } else if (agentType === 'react') {
      template = context.template.includes('page') ? 'page' : 'component'
    } else if (agentType === 'python') {
      template = context.template.includes('streamlit') ? 'streamlit' : 'gradio'
    } else if (agentType === 'backend') {
      template = context.userRequest.includes('auth') ? 'auth' : 'api'
    }
    
    // Get the specific template
    const templates = agent.templates as Record<string, string>
    const promptTemplate = templates[template] || templates.basic || templates[Object.keys(templates)[0]]
    
    // Replace variables
    return promptTemplate
      .replace(/{{userRequest}}/g, context.userRequest)
      .replace(/{{components}}/g, context.components.join(', '))
      .replace(/{{complexity}}/g, context.complexity)
      .replace(/{{template}}/g, context.template)
  }
  
  static getSystemPrompt(agentType: keyof typeof OPTIMIZED_PROMPTS): string {
    return OPTIMIZED_PROMPTS[agentType].system
  }
  
  // Dynamic prompt generation based on user request analysis
  static generateDynamicPrompt(
    agentType: keyof typeof OPTIMIZED_PROMPTS,
    userRequest: string,
    detectedFeatures: string[]
  ): string {
    const basePrompt = this.getSystemPrompt(agentType)
    
    // Add specific instructions based on detected features
    const featureInstructions = detectedFeatures.map(feature => {
      switch (feature) {
        case 'form':
          return agentType === 'javascript' ? 
            '\n- Add form validation and submission handling' :
            agentType === 'html' ? 
            '\n- Include proper form structure with labels and validation attributes' :
            '\n- Style form elements with modern design'
            
        case 'animation':
          return agentType === 'css' ?
            '\n- Add smooth transitions and micro-animations' :
            agentType === 'javascript' ?
            '\n- Implement smooth animation controls' :
            '\n- Support for animated elements'
            
        case 'data-viz':
          return agentType === 'python' ?
            '\n- Include data visualization with charts and graphs' :
            '\n- Prepare structure for data visualization components'
            
        case 'real-time':
          return '\n- Implement real-time updates and live data'
          
        default:
          return ''
      }
    }).join('')
    
    return basePrompt + featureInstructions + `\n\nUser Request: "${userRequest}"\n\nGenerate optimized code now:`
  }
}

// Feature detection for dynamic prompt enhancement
export class FeatureDetector {
  
  static detectFeatures(userRequest: string): string[] {
    const features: string[] = []
    const request = userRequest.toLowerCase()
    
    // Form detection
    if (/form|input|submit|contact|survey|quiz/.test(request)) {
      features.push('form')
    }
    
    // Animation detection
    if (/animat|transition|smooth|interactive|hover/.test(request)) {
      features.push('animation')
    }
    
    // Data visualization detection
    if (/chart|graph|data|visualization|analytics|dashboard/.test(request)) {
      features.push('data-viz')
    }
    
    // Real-time detection
    if (/real-time|live|chat|notification|update/.test(request)) {
      features.push('real-time')
    }
    
    // E-commerce detection
    if (/shop|cart|buy|purchase|product|ecommerce/.test(request)) {
      features.push('ecommerce')
    }
    
    // Authentication detection
    if (/login|auth|sign|register|user|account/.test(request)) {
      features.push('auth')
    }
    
    // Gaming detection
    if (/game|play|score|level|puzzle/.test(request)) {
      features.push('gaming')
    }
    
    return features
  }
  
  static getComplexity(userRequest: string, components: string[]): 'simple' | 'medium' | 'complex' {
    const componentCount = components.length
    const requestLength = userRequest.length
    const features = this.detectFeatures(userRequest)
    
    if (componentCount <= 2 && requestLength < 100 && features.length <= 1) {
      return 'simple'
    }
    
    if (componentCount <= 5 && requestLength < 300 && features.length <= 3) {
      return 'medium'
    }
    
    return 'complex'
  }
}

// Export for use in agents
export { OPTIMIZED_PROMPTS as prompts } 
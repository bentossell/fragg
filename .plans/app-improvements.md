Looking at your codebase and the examples, the main issue is that Streamlit/Gradio apps have limited styling capabilities compared to React/Next.js apps with Tailwind CSS. Here's a comprehensive plan to make your generated apps as beautiful as Claude Artifacts:
1. Smart Template Selection Based on UI Requirements
Create a pre-processor that analyzes the user's request and chooses the best template:
typescript// lib/template-selector.ts
export function selectOptimalTemplate(userPrompt: string): string {
  const uiKeywords = [
    'beautiful', 'modern', 'styled', 'responsive', 'animation',
    'gradient', 'card', 'hero', 'landing', 'showcase', 'portfolio',
    'dashboard', 'ui', 'ux', 'design', 'tailwind', 'component'
  ];
  
  const dataKeywords = [
    'data', 'analysis', 'visualization', 'plot', 'chart', 'graph',
    'ml', 'machine learning', 'dataset', 'statistics', 'notebook'
  ];
  
  const prompt = userPrompt.toLowerCase();
  
  const uiScore = uiKeywords.filter(keyword => prompt.includes(keyword)).length;
  const dataScore = dataKeywords.filter(keyword => prompt.includes(keyword)).length;
  
  // Default to Next.js for UI-heavy apps
  if (uiScore > dataScore || uiScore > 0) {
    return 'nextjs-developer';
  }
  
  // Use Streamlit/Gradio only for data-heavy apps with minimal UI requirements
  if (dataScore > 2) {
    return prompt.includes('gradio') ? 'gradio-developer' : 'streamlit-developer';
  }
  
  // Default to Next.js for general apps
  return 'nextjs-developer';
}
2. Enhanced Prompts with Styling Instructions
Update your prompt to emphasize beautiful UI:
typescript// lib/prompt.ts
export function toPrompt(template: Templates) {
  const basePrompt = `
    You are a skilled software engineer who creates BEAUTIFUL, MODERN applications.
    Your apps should be visually stunning and user-friendly.
    
    CRITICAL UI REQUIREMENTS:
    - Use modern, clean design with proper spacing and typography
    - Include smooth animations and transitions where appropriate
    - Use color gradients, shadows, and modern UI patterns
    - Make the UI responsive and mobile-friendly
    - Add loading states and micro-interactions
    
    For React/Next.js apps:
    - Use Tailwind CSS classes extensively
    - Implement shadcn/ui components where applicable
    - Use modern layouts with cards, sections, and proper hierarchy
    - Include hover effects and transitions
    - Use beautiful color schemes (consider using gradients)
    - Add icons from lucide-react where appropriate
    
    For Streamlit apps:
    - Use st.markdown() with custom CSS for styling
    - Implement custom themes with st.set_page_config()
    - Use columns and containers for better layouts
    - Add custom CSS through st.markdown(unsafe_allow_html=True)
    - Use emoji and icons to enhance visual appeal
    
    For Gradio apps:
    - Use gr.Blocks() instead of gr.Interface() for more control
    - Implement custom CSS with gr.HTML()
    - Use gr.Row() and gr.Column() for layouts
    - Apply themes and custom styling
    
    Generate a fragment with exceptional UI/UX design.
    Templates available:
    ${templatesToPrompt(template)}
  `;
  
  return basePrompt;
}
3. Custom Streamlit Styling Template
Create a better Streamlit template with built-in styling:
python# sandbox-templates/streamlit-developer/app.py
import streamlit as st

# Configure page with custom theme
st.set_page_config(
    page_title="Beautiful App",
    page_icon="✨",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for beautiful styling
st.markdown("""
<style>
    /* Main container styling */
    .main {
        padding: 2rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
    }
    
    /* Card-like sections */
    .stApp > div > div > div > div {
        background-color: rgba(255, 255, 255, 0.95);
        padding: 2rem;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(10px);
        margin-bottom: 2rem;
    }
    
    /* Headers */
    h1, h2, h3 {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
        margin-bottom: 1.5rem;
    }
    
    /* Buttons */
    .stButton > button {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 50px;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 30px rgba(102, 126, 234, 0.4);
    }
    
    /* Input fields */
    .stTextInput > div > div > input {
        border-radius: 10px;
        border: 2px solid #e0e0e0;
        padding: 0.75rem;
        transition: all 0.3s ease;
    }
    
    .stTextInput > div > div > input:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    /* Animations */
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .element-container {
        animation: fadeIn 0.5s ease-out;
    }
</style>
""", unsafe_allow_html=True)

# Your app content here
st.title("✨ Beautiful Streamlit App")
4. Gradio Blocks with Custom Styling
For Gradio apps, use Blocks API with custom CSS:
python# sandbox-templates/gradio-developer/app.py
import gradio as gr

# Custom CSS for beautiful Gradio apps
custom_css = """
    .gradio-container {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        font-family: 'Inter', sans-serif;
    }
    
    .container {
        max-width: 800px !important;
        margin: auto;
        padding: 2rem;
    }
    
    .panel {
        background: rgba(255, 255, 255, 0.95) !important;
        border-radius: 20px !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
        padding: 2rem !important;
        backdrop-filter: blur(10px);
    }
    
    h1 {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2.5rem;
        font-weight: 700;
        text-align: center;
        margin-bottom: 2rem;
    }
    
    .button {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%) !important;
        border: none !important;
        color: white !important;
        padding: 0.75rem 2rem !important;
        border-radius: 50px !important;
        font-weight: 600 !important;
        transition: all 0.3s ease !important;
        cursor: pointer !important;
    }
    
    .button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3) !important;
    }
"""

with gr.Blocks(css=custom_css, theme=gr.themes.Soft()) as demo:
    with gr.Column(elem_classes="panel"):
        gr.Markdown("# ✨ Beautiful Gradio App")
        # Your app components here
5. Smart Fallback System
Update your chat route to prefer React/Next.js for UI apps:
typescript// app/api/chat/route.ts (add this logic)
export async function POST(req: Request) {
  const { messages, template, model, config } = await req.json();
  
  // Extract user's last message
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  const userPrompt = lastUserMessage?.content || '';
  
  // Override template selection for better UI
  let selectedTemplate = template;
  if (selectedTemplate === templates) { // If "auto" mode
    selectedTemplate = { 
      [selectOptimalTemplate(userPrompt)]: templates[selectOptimalTemplate(userPrompt)] 
    };
  }
  
  // Continue with existing logic...
}
6. Add a React-Streamlit Hybrid Template
Create a new template that combines Streamlit backend with React frontend:
json// lib/templates.json (add)
"react-data-app": {
  "name": "React + FastAPI Data App",
  "lib": ["react", "tailwindcss", "shadcn", "fastapi", "pandas", "numpy"],
  "file": "app.tsx",
  "instructions": "A beautiful React frontend with FastAPI backend for data processing. Use this for data apps that need stunning UI.",
  "port": 3000
}
7. UI Component Library for Generated Apps
Create pre-styled components that can be injected:
typescript// lib/ui-components.ts
export const BEAUTIFUL_COMPONENTS = {
  card: `
    <div class="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
      <!-- content -->
    </div>
  `,
  
  button: `
    <button class="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-full hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200">
      Click me
    </button>
  `,
  
  input: `
    <input class="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors duration-200" />
  `
};
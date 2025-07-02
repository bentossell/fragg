# Beautiful Gradio app with custom styling
import gradio as gr

# Custom CSS for beautiful Gradio apps
custom_css = """
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    .gradio-container {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        font-family: 'Inter', sans-serif !important;
    }
    
    .container {
        max-width: 1200px !important;
        margin: auto;
        padding: 2rem;
    }
    
    .panel {
        background: rgba(255, 255, 255, 0.95) !important;
        border-radius: 20px !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
        padding: 2rem !important;
        backdrop-filter: blur(10px);
        border: none !important;
    }
    
    h1, h2, h3 {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        font-weight: 700 !important;
        text-align: center;
        margin-bottom: 2rem !important;
    }
    
    .button, .primary {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%) !important;
        border: none !important;
        color: white !important;
        padding: 0.75rem 2rem !important;
        border-radius: 50px !important;
        font-weight: 600 !important;
        font-size: 1rem !important;
        transition: all 0.3s ease !important;
        cursor: pointer !important;
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3) !important;
    }
    
    .button:hover, .primary:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 15px 30px rgba(102, 126, 234, 0.4) !important;
    }
    
    input[type="text"], input[type="number"], textarea, select {
        border-radius: 10px !important;
        border: 2px solid #e0e0e0 !important;
        padding: 0.75rem !important;
        font-size: 1rem !important;
        transition: all 0.3s ease !important;
        background-color: rgba(255, 255, 255, 0.9) !important;
    }
    
    input[type="text"]:focus, input[type="number"]:focus, textarea:focus, select:focus {
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        outline: none !important;
    }
    
    .tabs {
        border-radius: 15px !important;
        background-color: rgba(255, 255, 255, 0.7) !important;
        padding: 0.5rem !important;
        margin-bottom: 1rem !important;
    }
    
    .tab-selected {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
    }
    
    .markdown {
        line-height: 1.6;
        color: #333;
    }
    
    .label {
        font-weight: 600 !important;
        color: #667eea !important;
        margin-bottom: 0.5rem !important;
    }
    
    /* Animations */
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .panel {
        animation: fadeIn 0.5s ease-out;
    }
    
    /* Custom containers */
    .gr-box {
        border-radius: 15px !important;
        border: 1px solid rgba(255, 255, 255, 0.8) !important;
        background-color: rgba(255, 255, 255, 0.9) !important;
        padding: 1.5rem !important;
        margin: 1rem 0 !important;
    }
    
    /* Output areas */
    .output-class {
        background-color: rgba(102, 126, 234, 0.05) !important;
        border-radius: 10px !important;
        padding: 1rem !important;
        border: 1px solid rgba(102, 126, 234, 0.2) !important;
    }
    
    /* Sliders */
    input[type="range"] {
        background: linear-gradient(120deg, #667eea 0%, #764ba2 100%) !important;
        border-radius: 10px !important;
        height: 8px !important;
    }
    
    input[type="range"]::-webkit-slider-thumb {
        background: white !important;
        border: 3px solid #667eea !important;
        width: 20px !important;
        height: 20px !important;
        border-radius: 50% !important;
        cursor: pointer !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
    }
"""

# Example beautiful Gradio app using Blocks
with gr.Blocks(css=custom_css, theme=gr.themes.Soft()) as demo:
    with gr.Column(elem_classes="panel"):
        gr.Markdown("# ✨ Beautiful Gradio App")
        gr.Markdown("### Experience stunning UI with Gradio Blocks")
        
        # Add your app components here
        # This template provides a beautiful foundation for any Gradio app
        
        # Example components with beautiful styling
        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("#### Input Section")
                name = gr.Textbox(label="Your Name", placeholder="Enter your name here...")
                intensity = gr.Slider(1, 10, value=5, label="Intensity Level")
                submit_btn = gr.Button("Generate Greeting", variant="primary")
            
            with gr.Column(scale=1):
                gr.Markdown("#### Output Section")
                output = gr.Textbox(label="Generated Greeting", interactive=False)
        
        # Example function
        def greet(name, intensity):
            return "✨ " + "Hello, " + name + "!" * int(intensity)
        
        submit_btn.click(fn=greet, inputs=[name, intensity], outputs=output)

demo.launch()

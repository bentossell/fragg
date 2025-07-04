# Optimized base image for static web development
FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential tools for web development
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    nano \
    vim \
    python3 \
    python3-pip \
    nodejs \
    npm \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Install live-server for better development experience
RUN npm install -g live-server http-server browser-sync

# Create workspace directory
WORKDIR /home/user
RUN mkdir -p /home/user/app

# Set up nginx for production serving
COPY nginx.conf /etc/nginx/nginx.conf

# Create a simple index.html template
RUN echo '<!DOCTYPE html>\n\
<html lang="en">\n\
<head>\n\
    <meta charset="UTF-8">\n\
    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n\
    <title>Static Web App</title>\n\
    <script src="https://cdn.tailwindcss.com"></script>\n\
</head>\n\
<body class="bg-gray-50">\n\
    <div class="container mx-auto px-4 py-8">\n\
        <h1 class="text-4xl font-bold text-center text-gray-900 mb-8">\n\
            Welcome to your Static Web App\n\
        </h1>\n\
        <p class="text-center text-gray-600">\n\
            Start editing this file to build your application\n\
        </p>\n\
    </div>\n\
</body>\n\
</html>' > /home/user/app/index.html

# Create basic CSS and JS files
RUN echo '/* Custom styles */\n\
body {\n\
    font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;\n\
}\n\
\n\
.fade-in {\n\
    animation: fadeIn 0.5s ease-in;\n\
}\n\
\n\
@keyframes fadeIn {\n\
    from { opacity: 0; transform: translateY(20px); }\n\
    to { opacity: 1; transform: translateY(0); }\n\
}' > /home/user/app/style.css

RUN echo '// Interactive JavaScript\n\
document.addEventListener("DOMContentLoaded", function() {\n\
    console.log("App loaded successfully!");\n\
    \n\
    // Add fade-in animation to body\n\
    document.body.classList.add("fade-in");\n\
    \n\
    // Add click handlers to buttons\n\
    document.querySelectorAll("button").forEach(button => {\n\
        button.addEventListener("click", function() {\n\
            this.style.transform = "scale(0.95)";\n\
            setTimeout(() => {\n\
                this.style.transform = "scale(1)";\n\
            }, 150);\n\
        });\n\
    });\n\
});' > /home/user/app/script.js

# Set permissions
RUN chmod -R 755 /home/user/app

# Expose ports for development servers
EXPOSE 3000 8000 8080

# Default command to serve files
CMD ["python3", "-m", "http.server", "3000", "--directory", "/home/user/app"] 
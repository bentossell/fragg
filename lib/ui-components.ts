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
  `,
  
  hero: `
    <div class="relative overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600 text-white">
      <div class="absolute inset-0 bg-black opacity-20"></div>
      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <h1 class="text-4xl md:text-6xl font-bold mb-6">Welcome to Your App</h1>
        <p class="text-xl md:text-2xl mb-8 opacity-90">Build something amazing today</p>
        <button class="bg-white text-purple-600 px-8 py-4 rounded-full font-semibold text-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200">
          Get Started
        </button>
      </div>
    </div>
  `,
  
  gridLayout: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <!-- Grid items -->
    </div>
  `,
  
  glassmorphism: `
    <div class="backdrop-blur-md bg-white/30 rounded-2xl shadow-xl border border-white/20 p-6">
      <!-- Glassmorphism content -->
    </div>
  `,
  
  animatedGradient: `
    <div class="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 background-animate rounded-xl p-8">
      <style>
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .background-animate {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }
      </style>
      <!-- Content -->
    </div>
  `,
  
  modernForm: `
    <form class="space-y-6 bg-white p-8 rounded-2xl shadow-lg">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
        <input type="text" class="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors duration-200" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input type="email" class="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors duration-200" />
      </div>
      <button type="submit" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200">
        Submit
      </button>
    </form>
  `,
  
  floatingActionButton: `
    <button class="fixed bottom-6 right-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 z-50">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
    </button>
  `,
  
  notification: `
    <div class="fixed top-4 right-4 bg-white rounded-lg shadow-xl p-6 max-w-sm animate-slide-in">
      <style>
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      </style>
      <h3 class="font-semibold text-gray-900 mb-2">Notification Title</h3>
      <p class="text-gray-600">Your notification message here.</p>
    </div>
  `
}
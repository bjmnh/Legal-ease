/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-red': {
          light: '#f8e9e7',    // Very light, parchment-like
          DEFAULT: '#7b1e1e',  // Dark red (main color)
          dark: '#5a0e0e',     // Even darker red
        },
        'neutral-dark': '#2c2c2c', // Dark text
        'neutral-medium': '#6c6c6c', // Gray text
        'neutral-light': '#cccccc', // Light border
        'neutral-bg-light': '#fdf6e3', // Old paper / parchment feel
        'neutral-bg-medium': '#f5f0e6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
    }
    
  },
  plugins: [],
}

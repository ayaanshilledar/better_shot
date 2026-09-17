/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        mono: ['Poppins', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        dark: {
          bg: '#121316',
          surface: '#181a1f',
          card: '#20232b',
          hover: '#2a2e38',
          border: '#2e3340',
        }
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.25)',
        'pill': '0 10px 30px -5px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}

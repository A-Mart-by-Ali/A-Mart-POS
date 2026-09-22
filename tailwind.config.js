/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mart: {
          dark: '#022c22',       // deep forest green
          '950': '#032e1e',
          '900': '#064e3b',      // primary dark green
          '800': '#065f46',      // medium dark green
          '700': '#047857',      // classic emerald
          '600': '#059669',      // vibrant green
          '500': '#10b981',      // accent green
          '400': '#34d399',
          '200': '#a7f3d0',
          '100': '#d1fae5',
          '50': '#f0fdf4',       // soft tint
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'mart': '0 4px 20px -2px rgba(6, 78, 59, 0.08), 0 2px 6px -1px rgba(6, 78, 59, 0.04)',
        'mart-lg': '0 10px 25px -3px rgba(6, 78, 59, 0.12), 0 4px 10px -2px rgba(6, 78, 59, 0.06)',
      }
    },
  },
  plugins: [],
}

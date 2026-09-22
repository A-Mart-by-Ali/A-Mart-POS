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
          dark: '#431407',       // deep warm espresso
          '950': '#431407',      // deep dark warm orange / espresso
          '900': '#ea580c',      // primary signature vibrant orange
          '800': '#c2410c',      // rich deep burnt orange (hover & borders)
          '700': '#9a3412',      // deep warm accent for icons & high-contrast text
          '600': '#ea580c',      // vibrant orange
          '500': '#f97316',      // bright accent orange
          '400': '#fb923c',      // warm orange
          '300': '#fdba74',      // light peach
          '200': '#fed7aa',      // soft peach highlight
          '100': '#ffedd5',      // soft orange tint
          '50': '#fff7ed',       // soft warm cream / orange tint
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'mart': '0 4px 20px -2px rgba(234, 88, 12, 0.12), 0 2px 6px -1px rgba(234, 88, 12, 0.06)',
        'mart-lg': '0 10px 25px -3px rgba(234, 88, 12, 0.18), 0 4px 10px -2px rgba(234, 88, 12, 0.08)',
      }
    },
  },
  plugins: [],
}

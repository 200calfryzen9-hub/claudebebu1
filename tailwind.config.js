/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wagyu: {
          50: '#f2fcf5',
          100: '#e1f8e8',
          500: '#22c55e',
          700: '#15803d',
          900: '#14532d',
        },
        gold: '#fbbf24',
        silver: '#94a3b8',
        bronze: '#b45309',
      }
    },
  },
  plugins: [],
}
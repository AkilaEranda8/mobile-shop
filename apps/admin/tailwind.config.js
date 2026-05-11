/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        surface: '#f8fafc',
        card: '#ffffff',
        border: '#e5e7eb',
        accent: '#111827',
      },
    },
  },
  plugins: [],
}

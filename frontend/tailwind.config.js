/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-dark)',
        card: 'var(--bg-card)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-primary)',
        'neon-pink': 'var(--color-neon-pink)',
        'neon-orange': 'var(--color-neon-orange)',
        'neon-yellow': 'var(--color-neon-yellow)',
        'neon-blue': 'var(--color-neon-blue)',
        'neon-purple': 'var(--color-neon-purple)',
      },
    },
  },
  plugins: [],
}

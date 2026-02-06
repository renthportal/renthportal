/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        renth: {
          yellow: {
            DEFAULT: '#F7B500',
            light: '#FFD54F',
            dark: '#C49000',
          },
          navy: {
            DEFAULT: '#0A1628',
            light: '#1A2744',
          },
          charcoal: '#2D3748',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

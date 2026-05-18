/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17212b',
        muted: '#64748b',
        line: '#d8e0ea',
        paper: '#f7fafc',
        brand: {
          50: '#eaf7f4',
          100: '#cdebe5',
          500: '#198c7c',
          600: '#127465',
          700: '#0f5d52',
        },
        coral: {
          50: '#fff1ee',
          500: '#ee6c4d',
          600: '#dc5538',
        },
        gold: {
          50: '#fff7dc',
          500: '#d99f18',
        },
      },
      boxShadow: {
        soft: '0 18px 45px rgba(23, 33, 43, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

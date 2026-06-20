/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        triq: {
          yellow: '#FACC15',
          cyan: '#06B6D4',
          magenta: '#EC4899',
          dark: '#0F172A',
          slate: '#1E293B',
          light: '#334155',
          cloud: '#F8FAFC',
          surface: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(6, 182, 212, 0.4)',
        'neon-sm': '0 0 8px rgba(6, 182, 212, 0.5)',
        'neon-yellow': '0 0 20px rgba(250, 204, 21, 0.4)',
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shake: 'shake 0.5s ease-in-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
    },
  },
  plugins: [],
};

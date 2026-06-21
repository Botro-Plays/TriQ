/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        triq: {
          yellow: '#FACC15',
          'yellow-dark': '#CA8A04',
          cyan: '#06B6D4',
          'cyan-dark': '#0891B2',
          magenta: '#EC4899',
          dark: '#0B1120',
          'dark-elevated': '#111827',
          slate: '#1E293B',
          'slate-elevated': '#273449',
          light: '#334155',
          cloud: '#F8FAFC',
          surface: '#E2E8F0',
          success: '#22C55E',
          danger: '#EF4444',
          warning: '#F59E0B',
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
        'card': '0 4px 24px rgba(0, 0, 0, 0.25)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.35)',
        'bottom-nav': '0 -2px 20px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shake: 'shake 0.5s ease-in-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      maxWidth: {
        'mobile': '480px',
        'tablet': '768px',
      },
    },
  },
  plugins: [],
};

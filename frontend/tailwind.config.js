/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Custom dark palette
        dark: {
          950: '#060610',
          900: '#0a0a16',
          800: '#0f0f1e',
          700: '#161628',
          600: '#1e1e35',
          500: '#272742',
        },
        // Priority
        priority: {
          high:   '#f43f5e',
          medium: '#f59e0b',
          low:    '#10b981',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh-purple': `
          radial-gradient(at 40% 20%, rgba(139, 92, 246, 0.15) 0px, transparent 50%),
          radial-gradient(at 80% 0%,  rgba(6, 182, 212, 0.10) 0px, transparent 50%),
          radial-gradient(at 0%  50%, rgba(124, 58, 237, 0.10) 0px, transparent 50%)
        `,
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-sm':     '0 0 10px rgba(139, 92, 246, 0.2)',
        'card':        '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'scale-in':   'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                         to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.97)' },      to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};

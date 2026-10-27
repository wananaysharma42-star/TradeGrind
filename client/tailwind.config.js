/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        'dark-base': '#0B0709',
        'plum-glow': '#3A2A3F',
        'plum-card': 'rgba(58, 42, 63, 0.35)',
        'glass-surface': 'rgba(255, 255, 255, 0.04)',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
        mauve: {
          light: '#E4D4ED',
          DEFAULT: '#C9A6D8',
          deep: '#8E6AA5',
          dark: '#5B4366',
        },
        'trade-green': {
          light: '#86EFAC',
          DEFAULT: '#4ADE80',
          dark: '#22C55E',
        },
        'trade-red': {
          light: '#FCA5A5',
          DEFAULT: '#F87171',
          dark: '#EF4444',
        },
        muted: '#9A9199',
        'primary-white': '#FFFFFF',
      },
      borderRadius: {
        '24': '24px',
        '20': '20px',
        '16': '16px',
      },
      backdropBlur: {
        glass: '20px',
        card: '16px',
      },
      backgroundImage: {
        'plum-radial': 'radial-gradient(circle at 10% 10%, rgba(58, 42, 63, 0.45) 0%, transparent 40%), radial-gradient(circle at 90% 90%, rgba(58, 42, 63, 0.35) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(35, 20, 42, 0.25) 0%, transparent 60%)',
        'mauve-pill': 'linear-gradient(135deg, rgba(91, 67, 102, 0.8) 0%, rgba(58, 42, 63, 0.4) 100%)',
        'mauve-gradient': 'linear-gradient(135deg, #C9A6D8 0%, #8E6AA5 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-glow': '0 0 25px rgba(201, 166, 216, 0.2)',
        'inner-glow': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)',
      },
      keyframes: {
        flashGreen: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(74, 222, 128, 0.25)' },
        },
        flashRed: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(248, 113, 113, 0.25)' },
        }
      },
      animation: {
        'flash-green': 'flashGreen 0.4s ease-out',
        'flash-red': 'flashRed 0.4s ease-out',
      }
    },
  },
  plugins: [],
}

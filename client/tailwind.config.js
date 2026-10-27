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
        // Amber Gold Private-Banking Design Tokens
        bg: 'var(--color-bg, #0C0A07)',
        surface: 'var(--color-surface, #17130C)',
        raised: 'var(--color-raised, #1E1810)',
        border: 'var(--color-border, #2B2315)',
        accent: {
          DEFAULT: 'var(--color-accent, #F5B93B)',
          deep: 'var(--color-accent-deep, #B7791F)',
          soft: 'var(--color-accent-soft, rgba(245, 185, 59, 0.12))',
        },
        gain: {
          light: '#86EFAC',
          DEFAULT: 'var(--color-gain, #4ADE80)',
          dark: '#22C55E',
        },
        loss: {
          light: '#FCA5A5',
          DEFAULT: 'var(--color-loss, #F87171)',
          dark: '#EF4444',
        },
        text: {
          DEFAULT: 'var(--color-text-primary, #FAF5EA)',
          primary: 'var(--color-text-primary, #FAF5EA)',
          muted: 'var(--color-text-muted, #A39578)',
          disabled: 'var(--color-text-disabled, #6B614C)',
        },
        muted: 'var(--color-text-muted, #A39578)',
        warning: 'var(--color-warning, #F59E0B)',

        // Glassmorphism Token Aliases
        'glass-surface': 'var(--color-surface-glass, rgba(245, 185, 59, 0.04))',
        'glass-border': 'var(--color-border-glass, rgba(245, 185, 59, 0.10))',
      },
      borderRadius: {
        '24': '24px',
        '20': '20px',
        '16': '16px',
        '10': '10px',
      },
      backdropBlur: {
        glass: '20px',
        card: '16px',
      },
      backgroundImage: {
        'amber-radial': 'radial-gradient(circle at 10% 10%, rgba(183, 121, 31, 0.18) 0%, transparent 45%), radial-gradient(circle at 90% 90%, rgba(245, 185, 59, 0.06) 0%, transparent 50%), #0C0A07',
        'amber-pill': 'linear-gradient(135deg, rgba(183, 121, 31, 0.55) 0%, rgba(245, 185, 59, 0.12) 100%)',
        'amber-gradient': 'linear-gradient(135deg, #F5B93B 0%, #B7791F 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.50)',
        'glass-glow': '0 0 25px rgba(245, 185, 59, 0.20)',
        'inner-glow': 'inset 0 1px 1px 0 rgba(245, 185, 59, 0.15)',
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

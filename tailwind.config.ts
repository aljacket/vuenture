import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // Editorial ink scale (slate-tuned, per "Surgical Editor" DS)
        ink: {
          500: '#64748B',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Vue Green — used as a laser pointer, not a bucket of paint
        brand: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        // Surfaces (tonal layering, no borders)
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        'surface-low': '#F2F3FF',
        border: '#E2E8F0',
        must: '#DC2626',
        nice: '#10B981',
        warn: '#D97706',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      boxShadow: {
        // Reserved for floating elements only (modals, tooltips)
        float: '0 20px 40px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;

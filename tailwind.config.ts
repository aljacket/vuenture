import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#1a1a2e' },
        brand: {
          100: '#f5f3ff',
          600: '#4f46e5',
          900: '#1a1a2e',
        },
        must: '#dc2626',
        nice: '#059669',
        warn: '#d97706',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

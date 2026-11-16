import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta clínica: teal/azul suave
        clinico: {
          50: '#effbfa',
          100: '#d6f3f1',
          200: '#ade6e2',
          300: '#7ad2cd',
          400: '#45b6b2',
          500: '#2a9a97',
          600: '#1f7b7a',
          700: '#1d6263',
          800: '#1b4f50',
          900: '#183f41',
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;

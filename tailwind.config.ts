import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd4fe',
          300: '#93b6fd',
          400: '#6090fa',
          500: '#3b6bf5',
          600: '#254aea',
          700: '#1d38d6',
          800: '#1e2fad',
          900: '#1e2c88',
          950: '#161d54'
        }
      }
    }
  },
  plugins: []
};

export default config;

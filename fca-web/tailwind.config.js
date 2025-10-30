/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    '../**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#63FF82', // softer lime
          foreground: '#021406',
          50: '#E9FFE3',
          100: '#C9FFB9',
          200: '#9EFF89',
          300: '#7DFF68',
          400: '#63FF82',
          500: '#48F06C',
          600: '#2BD150',
          700: '#1EA13C',
          800: '#197F31',
          900: '#0D451B',
        },
        aqua: {
          DEFAULT: '#00D9FF',
          500: '#00D9FF',
          600: '#00B9FF',
          700: '#0090FF',
        },
        neutral: {
          50: '#030405',
          100: '#060708',
          200: '#0C0E10',
          300: '#121417',
          400: '#1A1D21',
          500: '#2B2F35',
          600: '#3E444C',
          700: '#5F6874',
          800: '#8992A1',
          900: '#F5F6FA',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 40px 80px -50px rgba(0,0,0,0.9), 0 25px 55px -35px rgba(0,217,255,0.25)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

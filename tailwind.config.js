/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        handwriting: ['Caveat', 'cursive'],
      },
      colors: {
        cork: {
          DEFAULT: '#d4a373',
          light: '#e9d8a6',
          dark: '#a98467',
        },
      },
      transitionProperty: {
        'max-height': 'max-height',
        'transform-opacity-filter': 'transform, opacity, filter',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwind-scrollbar') // If you want to keep using this for notes
  ],
};
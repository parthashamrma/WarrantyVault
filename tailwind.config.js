/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: 'var(--bg)',
          bg2: 'var(--bg2)',
          ink: 'var(--ink)',
          muted: 'var(--mut)',
          line: 'var(--line)',
          green: 'var(--g)',
          amber: 'var(--a)',
          red: 'var(--r)',
        }
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '4px 4px 0 var(--ink)',
        'brutal-green': '4px 4px 0 var(--g)',
        'brutal-amber': '4px 4px 0 var(--a)',
        'brutal-red': '4px 4px 0 var(--r)',
      }
    },
  },
  plugins: [],
};


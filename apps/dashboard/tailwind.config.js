/** @type {import('tailwindcss').Config} */
// Colours are CSS variables set from packages/design-tokens (hawem.ts), so the
// dashboard and the app share one palette and both schemes.
const v = (name) => `var(--${name})`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans"',
          '"Noto Sans Arabic"',
          'sans-serif',
        ],
      },
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        raised: v('surfaceRaised'),
        ink: v('ink'),
        ink2: v('ink2'),
        ink3: v('ink3'),
        line: v('hairline'),
        fill: v('fill'),
        accent: v('accent'),
        'accent-soft': v('accentSoft'),
        'on-accent': v('onAccent'),
        lime: v('lime'),
        'lime-soft': v('limeSoft'),
        'on-lime': v('onLime'),
        warm: v('warm'),
        'warm-soft': v('warmSoft'),
        'warm-ink': v('warmInk'),
        danger: v('danger'),
        'danger-soft': v('dangerSoft'),
        warning: v('warning'),
        'warning-soft': v('warningSoft'),
        cat: v('cat'),
        'cat-soft': v('catSoft'),
        dog: v('dog'),
        'dog-soft': v('dogSoft'),
      },
      borderRadius: { card: '18px', control: '12px' },
      boxShadow: {
        card: '0 6px 18px -8px rgba(22, 24, 29, 0.10), 0 1px 2px rgba(22, 24, 29, 0.04)',
      },
    },
  },
  plugins: [],
};

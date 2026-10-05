/** @type {import('tailwindcss').Config} */
// Colours are CSS variables set from packages/design-tokens (hawem.ts), so the
// dashboard and the app share one palette and both schemes. The porcelain
// shell tones (rail, glass, pill shadows) are dashboard-only and live in
// index.css.
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
          '"SF Arabic"',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans"',
          '"Noto Sans Arabic"',
          'sans-serif',
        ],
      },
      colors: {
        canvas: v('canvas'),
        shell: v('shell'),
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
        // The black pill of the reference boards: selected tab, primary action
        pill: v('pill'),
        'on-pill': v('onPill'),
      },
      borderRadius: { card: '24px', tile: '18px', control: '12px' },
      boxShadow: {
        card: 'var(--shadow-card)',
        pill: 'var(--shadow-pill)',
        float: 'var(--shadow-float)',
      },
      screens: { '3xl': '1680px' },
    },
  },
  plugins: [],
};

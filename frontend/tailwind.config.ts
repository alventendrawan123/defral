import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--color-paper)',
        surface: 'var(--color-surface)',
        'surface-sunken': 'var(--color-surface-sunken)',
        ink: 'var(--color-ink)',
        'ink-muted': 'var(--color-ink-muted)',
        line: 'var(--color-line)',
        'line-soft': 'var(--color-line-soft)',
        safe: 'var(--color-safe)',
        'safe-soft': 'var(--color-safe-soft)',
        defending: 'var(--color-defending)',
        'defending-soft': 'var(--color-defending-soft)',
        critical: 'var(--color-critical)',
        'critical-soft': 'var(--color-critical-soft)',
        accent: 'var(--color-accent)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        raised: 'var(--shadow-raised)',
        card: 'var(--shadow-card)',
        lifted: 'var(--shadow-lifted)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;

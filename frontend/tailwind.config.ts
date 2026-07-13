import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#0A84FF",
        "on-primary": "#ffffff",
        "primary-container": "#e0f2fe",
        "on-primary-container": "#0369a1",
        "primary-fixed": "#bae6fd",
        "primary-fixed-dim": "#7dd3fc",
        "on-primary-fixed": "#0c4a6e",
        "on-primary-fixed-variant": "#075985",
        
        "secondary": "#5E5CE6",
        "on-secondary": "#ffffff",
        "secondary-container": "#ede9fe",
        "on-secondary-container": "#4c1d95",
        "secondary-fixed": "#ddd6fe",
        "secondary-fixed-dim": "#c4b5fd",
        "on-secondary-fixed": "#2e1065",
        "on-secondary-fixed-variant": "#4c1d95",
        
        "tertiary": "#30D158",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#dcfce7",
        "on-tertiary-container": "#14532d",
        "tertiary-fixed": "#bbf7d0",
        "tertiary-fixed-dim": "#86efac",
        "on-tertiary-fixed": "#052e16",
        "on-tertiary-fixed-variant": "#14532d",
        
        "error": "#ff3b30",
        "on-error": "#ffffff",
        "error-container": "#fee2e2",
        "on-error-container": "#7f1d1d",
        
        "background": "#ffffff",
        "on-background": "#0f172a",
        "surface": "#ffffff",
        "on-surface": "#0f172a",
        "surface-variant": "#f1f5f9",
        "on-surface-variant": "#475569",
        
        "surface-dim": "#e2e8f0",
        "surface-bright": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f8fafc",
        "surface-container": "#f1f5f9",
        "surface-container-high": "#e2e8f0",
        "surface-container-highest": "#cbd5e1",
        "surface-tint": "#0A84FF",
        
        "outline": "#94a3b8",
        "outline-variant": "#cbd5e1",
        
        "inverse-surface": "#0f172a",
        "inverse-on-surface": "#f8fafc",
        "inverse-primary": "#bae6fd",
        
        "border-color": "var(--border-color)",
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        headline: ["Inter", "sans-serif"],
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Public Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

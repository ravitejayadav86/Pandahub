import type { Config } from "tailwindcss";

// Full design token set (brand colors, typography scale) is finalized in
// Module 6 (Frontend Foundation) alongside the UI component library.
// This config establishes darkMode strategy + container conventions now
// so every component built from here on already assumes class-based dark mode.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        panda: {
          black: "#0d1117",
          white: "#ffffff",
          accent: "#2f9e44", // bamboo green — primary brand accent
        },
        // Semantic surface tokens — backed by CSS vars in globals.css
        primary: "var(--color-primary, #0A84FF)",
        "on-surface": "var(--text-primary)",
        "on-surface-variant": "var(--text-secondary)",
        surface: "var(--bg-primary)",
        "surface-variant": "var(--bg-secondary)",
        "border-color": "var(--border-color)",
        "glass-bg": "var(--glass-bg)",
        "glass-border": "var(--glass-border)",
        "glass-shadow": "var(--glass-shadow)",
        outline: "var(--text-muted)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
        display: ["Inter", "ui-sans-serif", "system-ui"],
        headline: ["Inter", "ui-sans-serif", "system-ui"],
      },
      borderColor: {
        "border-color": "var(--border-color)",
        "glass-border": "var(--glass-border)",
        primary: "var(--color-primary, #0A84FF)",
      },
    },
  },
  plugins: [],
};

export default config;

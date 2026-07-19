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
        panda: {
          black: "#0d1117",
          white: "#ffffff",
          accent: "#2f9e44", // bamboo green — primary brand accent
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

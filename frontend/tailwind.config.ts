import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-primary-container": "#003064",
        "primary": "#0A84FF",
        "on-surface-variant": "#6b7280", // gray-500
        "surface-dim": "#f3f4f6", // gray-100
        "primary-fixed": "#d6e3ff",
        "on-surface": "#111827", // gray-900
        "tertiary-container": "#fff3ea",
        "secondary-fixed-dim": "#aac7ff",
        "primary-fixed-dim": "#005db8",
        "on-error-container": "#410002",
        "error": "#ff3b30",
        "on-secondary-fixed": "#001b3e",
        "surface-container": "#ffffff",
        "surface-variant": "#f3f4f6",
        "on-secondary-fixed-variant": "#264778",
        "error-container": "#ffdad6",
        "tertiary": "#ff9f0a",
        "outline-variant": "#e5e7eb", // gray-200
        "on-secondary": "#ffffff",
        "surface-container-highest": "#e5e7eb",
        "surface": "#ffffff",
        "outline": "#9ca3af", // gray-400
        "tertiary-fixed": "#ffdbcb",
        "surface-container-lowest": "#ffffff",
        "primary-container": "#0A84FF", // using primary directly for buttons often
        "on-tertiary-container": "#341100",
        "inverse-surface": "#1f2937", // gray-800
        "on-tertiary-fixed": "#341100",
        "on-primary": "#ffffff",
        "secondary-container": "#f1f5f9",
        "on-secondary-container": "#334155",
        "inverse-primary": "#aac7ff",
        "background": "#ffffff",
        "surface-tint": "#0A84FF",
        "surface-container-high": "#f9fafb", // gray-50
        "surface-bright": "#ffffff",
        "tertiary-fixed-dim": "#ffb691",
        "secondary": "#5856D6",
        "on-tertiary-fixed-variant": "#793100",
        "on-error": "#ffffff",
        "inverse-on-surface": "#f3f4f6",
        "on-background": "#111827",
        "surface-container-low": "#ffffff",
        "secondary-fixed": "#e0e7ff",
        "on-primary-fixed": "#001b3e",
        "on-primary-fixed-variant": "#00468d",
        "on-tertiary": "#ffffff"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
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
      animation: {
        'fade-in-up': 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in-up-delay': 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards',
        'fade-in-up-delay-2': 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};

export default config;

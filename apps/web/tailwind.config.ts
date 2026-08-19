import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090d",
        surface: "#0f111a",
        surfaceLight: "#181b2a",
        primary: {
          DEFAULT: "#6366f1", // Indigo / Electric Violet
          hover: "#4f46e5",
          glow: "rgba(99, 102, 241, 0.35)",
        },
        secondary: {
          DEFAULT: "#06b6d4", // Cyan
          hover: "#0891b2",
          glow: "rgba(6, 182, 212, 0.35)",
        },
        accent: {
          pink: "#ec4899",
          emerald: "#10b981",
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ripple": "ripple 2.5s cubic-bezier(0, 0.2, 0.8, 1) infinite",
        "glow": "glow 3s ease-in-out infinite alternate",
      },
      keyframes: {
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(99, 102, 241, 0.2)" },
          "100%": { boxShadow: "0 0 35px rgba(6, 182, 212, 0.5)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

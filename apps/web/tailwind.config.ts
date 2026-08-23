import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "420px",
      },
      colors: {
        background: "#000000",
        foreground: "#FFFFFF",
        surface: "#0A0A0A",
        surfaceLight: "#141414",
        primary: {
          DEFAULT: "#FFFFFF",
          hover: "#E4E4E7",
          light: "#F4F4F5",
          glow: "rgba(255, 255, 255, 0.20)",
        },
        secondary: {
          DEFAULT: "#A1A1AA",
          hover: "#D4D4D8",
          light: "#E4E4E7",
          glow: "rgba(255, 255, 255, 0.10)",
        },
        accent: {
          pink: "#FFFFFF",
          purple: "#E4E4E7",
          cyan: "#D4D4D8",
          emerald: "#10B981",
          amber: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ripple": "ripple 2.5s cubic-bezier(0, 0.2, 0.8, 1) infinite",
        "glow": "glow 3s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        ripple: {
          "0%": { transform: "scale(0.8)", opacity: "1" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(139, 92, 246, 0.25)" },
          "100%": { boxShadow: "0 0 40px rgba(6, 182, 212, 0.4)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

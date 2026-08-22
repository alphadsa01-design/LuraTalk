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
        background: "#08090E",
        foreground: "#F8FAFC",
        surface: "#0F111A",
        surfaceLight: "#181B26",
        primary: {
          DEFAULT: "#8B5CF6",
          hover: "#7C3AED",
          light: "#A78BFA",
          glow: "rgba(139, 92, 246, 0.25)",
        },
        secondary: {
          DEFAULT: "#06B6D4",
          hover: "#0891B2",
          light: "#38BDF8",
          glow: "rgba(6, 182, 212, 0.2)",
        },
        accent: {
          pink: "#F43F5E",
          purple: "#A855F7",
          cyan: "#06B6D4",
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
